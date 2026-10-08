<?php
/*
 * PHPUnit tests for GLPI Asset Dashboard backend server
 */
class BackendTest extends PHPUnit\Framework\TestCase
{
    public function testRateLimitReturnsTrueForNewKey(): void
    {
        $key = 'test-ip:' . time();
        $this->assertTrue(rateLimit($key, 5, 60));
    }

    public function testRateLimitReturnsFalseWhenExceeded(): void
    {
        $key = 'test-ip-exceed:' . time();
        for ($i = 0; $i < 5; $i++) {
            rateLimit($key, 5, 60);
        }
        $this->assertFalse(rateLimit($key, 5, 60));
    }

    public function testConfiguredRateLimitUsesEnvironmentMaximum(): void
    {
        putenv('RATE_LIMIT_MAX=1');
        putenv('RATE_LIMIT_WINDOW=60');
        $key = 'configured-limit:' . bin2hex(random_bytes(8));

        try {
            $this->assertTrue(configuredRateLimit($key));
            $this->assertFalse(configuredRateLimit($key));
        } finally {
            putenv('RATE_LIMIT_MAX');
            putenv('RATE_LIMIT_WINDOW');
        }
    }

    public function testReadOnlyConfigurationRightIsNotAdministrative(): void
    {
        $this->assertFalse(sessionHasAdministrativeProfile([
            'session' => ['glpiactiveprofile' => ['config' => 1]],
        ]));
    }

    public function testConfigurationUpdateRightIsAdministrative(): void
    {
        $this->assertTrue(sessionHasAdministrativeProfile([
            'session' => ['glpiactiveprofile' => ['config' => 2]],
        ]));
    }

    public function testAdminProfileNameDoesNotGrantAdministrativeAccess(): void
    {
        $this->assertFalse(sessionHasAdministrativeProfile([
            'session' => ['glpiactiveprofile' => ['name' => 'Administrator']],
        ]));
    }

    public function testRateLimitWindowResets(): void
    {
        $key = 'test-ip-reset:' . time();
        rateLimit($key, 2, 1);
        rateLimit($key, 2, 1);
        $this->assertFalse(rateLimit($key, 2, 1));
        sleep(2);
        $this->assertTrue(rateLimit($key, 2, 1));
    }

    public function testSanitizeSvgRemovesScript(): void
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10"/></svg>';
        $result = sanitizeSvg($svg);
        $this->assertNotFalse($result);
        $this->assertStringNotContainsString('script', $result);
        $this->assertStringContainsString('rect', $result);
    }

    public function testSanitizeSvgRemovesOnloadAttribute(): void
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" onload="alert(1)"/></svg>';
        $result = sanitizeSvg($svg);
        $this->assertNotFalse($result);
        $this->assertStringNotContainsString('onload', $result);
    }

    public function testSanitizeSvgRemovesJavascriptLinks(): void
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)"><rect/></a></svg>';
        $result = sanitizeSvg($svg);
        $this->assertNotFalse($result);
        $this->assertStringNotContainsString('javascript:', $result);
    }

    public function testSanitizeSvgHandlesMalformedInput(): void
    {
        $result = sanitizeSvg('<not-valid-xml');
        $this->assertFalse($result);
    }

    public function testDefaultSettingsContainsGeneralDefaults(): void
    {
        $defaults = defaultSettings();
        $this->assertArrayHasKey('general', $defaults);
        $this->assertArrayHasKey('lowStockAlertsEnabled', $defaults['general']);
        $this->assertTrue($defaults['general']['lowStockAlertsEnabled']);
        $this->assertSame(30, $defaults['general']['warrantyWarningDays']);
        $this->assertSame(10, $defaults['general']['itemsPerPage']);
    }

    public function testMergeSettingsDeepMerge(): void
    {
        $base = ['general' => ['currency' => 'USD', 'itemsPerPage' => 10]];
        $patch = ['general' => ['itemsPerPage' => 20]];
        $result = mergeSettings($base, $patch);
        $this->assertSame('USD', $result['general']['currency']);
        $this->assertSame(20, $result['general']['itemsPerPage']);
    }
}
