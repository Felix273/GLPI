<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

if (is_file(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

function emailLogFile(): string
{
    return DATA_DIR . '/email-log.json';
}

function loadEmailLog(): array
{
    $entries = readJsonFile(emailLogFile(), []);
    return is_array($entries) ? $entries : [];
}

function appendEmailLog(array $entry): void
{
    $entries = loadEmailLog();
    array_unshift($entries, array_merge(['id' => bin2hex(random_bytes(6)), 'sentAt' => date(DATE_ATOM)], $entry));
    writeJsonFile(emailLogFile(), array_slice($entries, 0, 100));
}

function emailConfigurationFromSettings(array $settings, array $incoming = []): array
{
    $stored = $settings['email'] ?? [];
    $config = mergeSettings($stored, $incoming);
    $password = (string)($incoming['password'] ?? '');
    if ($password === '' && !empty($stored['passwordEncrypted'])) {
        $password = decryptSetting((string)$stored['passwordEncrypted']);
    }
    $config['password'] = $password;
    $config['port'] = max(1, min(65535, (int)($config['port'] ?? 587)));
    return $config;
}

function sendSmtpEmail(array $config, string $to, string $subject, string $htmlBody, string $textBody = '', array $cc = []): void
{
    $host = trim((string)($config['host'] ?? ''));
    $fromAddress = trim((string)($config['fromAddress'] ?? ''));
    if ($host === '' || !filter_var($fromAddress, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('SMTP host and a valid From email address are required.');
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('A valid recipient email address is required.');
    }
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = $host;
    $mail->Port = (int)($config['port'] ?? 587);
    $mail->Timeout = 15;
    $mail->CharSet = 'UTF-8';
    $enc = strtolower(trim((string)($config['encryption'] ?? 'tls')));
    if ($enc === 'ssl') $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    elseif ($enc === 'tls') $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    else { $mail->SMTPSecure = ''; $mail->SMTPAutoTLS = false; }
    $user = trim((string)($config['username'] ?? ''));
    if ($user !== '') {
        $mail->SMTPAuth = true;
        $mail->Username = $user;
        $mail->Password = (string)($config['password'] ?? '');
    }
    $mail->setFrom($fromAddress, trim((string)($config['fromName'] ?? 'GLPI Asset Hub')) ?: 'GLPI Asset Hub');
    $mail->addAddress($to);
    $replyTo = trim((string)($config['replyTo'] ?? ''));
    if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $mail->addReplyTo($replyTo);
    foreach ($cc as $addr) {
        if (filter_var($addr, FILTER_VALIDATE_EMAIL) && strcasecmp($addr, $to) !== 0) $mail->addCC($addr);
    }
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $htmlBody;
    $mail->AltBody = $textBody !== '' ? $textBody : strip_tags($htmlBody);
    $mail->send();
}

function resolveGlpiUserContact(array $glpi, int $userId): array
{
    $user = glpiHttp($glpi['url'], '/User/' . $userId, 'GET', null, $glpi['user_token'], $glpi['session_token'], $glpi['app_token']);
    $name = trim(implode(' ', array_filter([$user['firstname'] ?? '', $user['realname'] ?? '']))) ?: (string)($user['name'] ?? "User #{$userId}");
    $email = trim((string)($user['email'] ?? $user['usermail'] ?? $user['useremail'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        try {
            $emails = glpiHttp($glpi['url'], '/User/' . $userId . '/UserEmail', 'GET', null, $glpi['user_token'], $glpi['session_token'], $glpi['app_token']);
            usort($emails, static fn($a, $b) => ((int)($b['is_default'] ?? 0)) <=> ((int)($a['is_default'] ?? 0)));
            foreach ($emails as $row) {
                $candidate = trim((string)($row['email'] ?? ''));
                if ($candidate !== '' && filter_var($candidate, FILTER_VALIDATE_EMAIL)) { $email = $candidate; break; }
            }
        } catch (Throwable) {}
    }
    return ['name' => $name, 'email' => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : ''];
}

function buildAssetEventEmail(string $event, string $orgName, string $officerName, array $assets, array $context): array
{
    $esc = static fn($v) => htmlspecialchars((string)$v, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $titles = [
        'assigned' => ['Asset Assignment Notice', 'The following equipment has been assigned to you:'],
        'returned' => ['Asset Return Confirmation', 'The following equipment has been returned to inventory:'],
        'clearance' => ['Equipment Clearance Summary', 'Here is your current equipment assignment & handover status:'],
    ];
    [$heading, $intro] = $titles[$event] ?? $titles['assigned'];
    $rows = '';
    $lines = [];
    foreach ($assets as $a) {
        $n = (string)($a['name'] ?? 'Unnamed');
        $t = (string)($a['type'] ?? 'Asset');
        $tag = (string)($a['tag'] ?? '-');
        $ser = (string)($a['serial'] ?? '-');
        $st = (string)($a['status'] ?? ($event === 'returned' ? 'Returned' : 'Assigned'));
        $rows .= "<tr><td style='padding:8px;border:1px solid #e2e8f0'>{$esc($n)}</td><td style='padding:8px;border:1px solid #e2e8f0'>{$esc($t)}</td><td style='padding:8px;border:1px solid #e2e8f0'>{$esc($tag)}</td><td style='padding:8px;border:1px solid #e2e8f0'>{$esc($ser)}</td><td style='padding:8px;border:1px solid #e2e8f0'>{$esc($st)}</td></tr>";
        $lines[] = "- {$n} ({$t}) | Tag: {$tag} | Serial: {$ser} | {$st}";
    }
    $meta = [];
    if (!empty($context['assignedAt'])) $meta[] = 'Date: ' . $esc($context['assignedAt']);
    if (!empty($context['dueDate'])) $meta[] = 'Expected return: ' . $esc($context['dueDate']);
    if (!empty($context['notes'])) $meta[] = 'Notes: ' . $esc($context['notes']);
    $metaHtml = $meta ? '<p style="color:#475569;font-size:14px">' . implode('<br>', $meta) . '</p>' : '';
    $html = "<div style='font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a'><h2 style='color:#1d4ed8;margin-bottom:4px'>{$esc($orgName)} — {$esc($heading)}</h2><p>Hello {$esc($officerName)},</p><p>{$esc($intro)}</p><table style='width:100%;border-collapse:collapse;font-size:14px;margin:14px 0'><thead><tr style='background:#f8fafc'><th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Asset</th><th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Type</th><th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Asset Tag</th><th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Serial</th><th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Status</th></tr></thead><tbody>{$rows}</tbody></table>{$metaHtml}<p style='color:#64748b;font-size:12px;margin-top:20px'>Sent by {$esc($orgName)} Asset Management.</p></div>";
    $subject = "[{$orgName}] {$heading} (" . count($assets) . ' ' . (count($assets) === 1 ? 'item' : 'items') . ')';
    $text = "Hello {$officerName},\n\n{$intro}\n\n" . implode("\n", $lines) . ($meta ? "\n\n" . strip_tags(implode("\n", $meta)) : '');
    return [$subject, $html, $text];
}

function handleEmailLog(): void
{
    requireAdminGlpiSession();
    jsonResponse(['entries' => loadEmailLog()]);
}

function handleEmailTest(): void
{
    $glpi = requireAdminGlpiSession();
    $body = jsonBody();
    $to = trim((string)($body['to'] ?? ''));
    $settings = loadSettings();
    $incoming = is_array($body['email'] ?? null) ? $body['email'] : [];
    $config = emailConfigurationFromSettings($settings, $incoming);
    $orgName = (string)($settings['organization']['name'] ?? 'GLPI Asset Hub');
    try {
        sendSmtpEmail($config, $to, "[{$orgName}] SMTP Test Email", "<p>SMTP configuration for <strong>" . htmlspecialchars($orgName, ENT_QUOTES | ENT_HTML5, 'UTF-8') . "</strong> is working.</p>");
        $settings['email']['lastTestAt'] = date(DATE_ATOM);
        $settings['email']['lastTestStatus'] = 'success';
        $settings['email']['lastTestError'] = '';
        saveSettings($settings);
        appendEmailLog(['event' => 'test', 'to' => $to, 'subject' => "[{$orgName}] SMTP Test Email", 'status' => 'sent', 'actor' => currentGlpiUserLabel($glpi)]);
        jsonResponse(['ok' => true, 'message' => "Test email sent to {$to}.", 'testedAt' => $settings['email']['lastTestAt']]);
    } catch (Throwable $e) {
        $settings['email']['lastTestAt'] = date(DATE_ATOM);
        $settings['email']['lastTestStatus'] = 'error';
        $settings['email']['lastTestError'] = $e->getMessage();
        saveSettings($settings);
        appendEmailLog(['event' => 'test', 'to' => $to, 'subject' => "[{$orgName}] SMTP Test Email", 'status' => 'failed', 'error' => $e->getMessage(), 'actor' => currentGlpiUserLabel($glpi)]);
        jsonResponse(['error' => 'SMTP test failed: ' . $e->getMessage()], 422);
    }
}

function handleAssetEmailNotification(): void
{
    $glpi = requireGlpiSession();
    $body = jsonBody();
    $event = (string)($body['event'] ?? 'assigned');
    $userId = (int)($body['userId'] ?? 0);
    $assets = is_array($body['assets'] ?? null) ? $body['assets'] : [];
    if (!in_array($event, ['assigned', 'returned', 'clearance'], true) || $userId < 1 || !$assets) {
        jsonResponse(['error' => 'Valid event, userId, and assets are required'], 422);
    }
    $settings = loadSettings();
    $emailCfg = emailConfigurationFromSettings($settings);
    if (empty($emailCfg['enabled'])) jsonResponse(['ok' => true, 'sent' => false, 'skipped' => true, 'reason' => 'SMTP disabled']);
    if ($event === 'assigned' && empty($emailCfg['notifyOnAssign'])) jsonResponse(['ok' => true, 'sent' => false, 'skipped' => true, 'reason' => 'Assignment emails disabled']);
    if ($event === 'returned' && empty($emailCfg['notifyOnReturn'])) jsonResponse(['ok' => true, 'sent' => false, 'skipped' => true, 'reason' => 'Return emails disabled']);
    $contact = resolveGlpiUserContact($glpi, $userId);
    if ($contact['email'] === '') jsonResponse(['ok' => true, 'sent' => false, 'skipped' => true, 'reason' => 'Officer has no email in GLPI']);
    $orgName = (string)($settings['organization']['name'] ?? 'GLPI Asset Hub');
    [$subject, $html, $text] = buildAssetEventEmail($event, $orgName, $contact['name'], $assets, $body);
    $cc = !empty($emailCfg['ccAdminEmail']) ? [trim((string)$emailCfg['ccAdminEmail'])] : [];
    try {
        sendSmtpEmail($emailCfg, $contact['email'], $subject, $html, $text, $cc);
        appendEmailLog(['event' => $event, 'to' => $contact['email'], 'subject' => $subject, 'status' => 'sent']);
        jsonResponse(['ok' => true, 'sent' => true, 'to' => $contact['email']]);
    } catch (Throwable $e) {
        appendEmailLog(['event' => $event, 'to' => $contact['email'], 'subject' => $subject, 'status' => 'failed', 'error' => $e->getMessage()]);
        jsonResponse(['ok' => false, 'sent' => false, 'error' => $e->getMessage()], 200);
    }
}
