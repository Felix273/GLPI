import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { spawn } from 'node:child_process';

const sessions = new Map();
const glpiServer = http.createServer((request, response) => {
    const token = request.headers['session-token'];
    const user = sessions.get(token);

    if (request.url === '/apirest.php/initSession') {
        const userToken = request.headers.authorization?.replace('user_token ', '');
        const sessionToken = `session-${userToken}`;
        sessions.set(sessionToken, userToken);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ session_token: sessionToken }));
        return;
    }

    if (request.url === '/apirest.php/getFullSession') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
            session: {
                glpiactiveprofile: {
                    config: user === 'admin-token' ? 2 : 1,
                    name: user === 'reader-token' ? 'Administrator' : 'User'
                }
            }
        }));
        return;
    }

    if (request.url === '/apirest.php/Computer/7') {
        if (user === 'denied-token') {
            response.writeHead(403, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify(['Access denied']));
            return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ id: 7, name: 'Test computer' }));
        return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(['Not found']));
});

await new Promise(resolve => glpiServer.listen(0, '127.0.0.1', resolve));
const glpiPort = glpiServer.address().port;
const probe = netServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const frontendPort = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));

const frontend = spawn('php', ['-S', `127.0.0.1:${frontendPort}`, 'server.php'], {
    cwd: new URL('..', import.meta.url),
    env: {
        ...process.env,
        GLPI_BACKEND_URL: `http://127.0.0.1:${glpiPort}`,
        RATE_LIMIT_MAX: '1000'
    },
    stdio: ['ignore', 'ignore', 'pipe']
});
let frontendError = '';
frontend.stderr.setEncoding('utf8');
frontend.stderr.on('data', chunk => { frontendError += chunk; });

async function waitForFrontend() {
    for (let attempt = 0; attempt < 50; attempt++) {
        if (frontend.exitCode !== null) {
            throw new Error(`PHP server exited early: ${frontendError}`);
        }
        try {
            await fetch(`http://127.0.0.1:${frontendPort}/backend/health`);
            return;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw new Error(`PHP server did not start: ${frontendError}`);
}

async function login(userToken) {
    const response = await fetch(`http://127.0.0.1:${frontendPort}/backend/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://unused.invalid', token: userToken })
    });
    assert.equal(response.status, 200, await response.text());
    return response.headers.get('set-cookie').split(';', 1)[0];
}

function netServer() {
    return http.createServer();
}

try {
    await waitForFrontend();

    const readerCookie = await login('reader-token');
    const readable = await fetch(`http://127.0.0.1:${frontendPort}/backend/metadata/Computer/7`, {
        headers: { Cookie: readerCookie }
    });
    assert.equal(readable.status, 200, await readable.text());

    const forbiddenWrite = await fetch(`http://127.0.0.1:${frontendPort}/backend/metadata/Computer/7`, {
        method: 'PUT',
        headers: { Cookie: readerCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ financial: { cost: 100 } })
    });
    assert.equal(forbiddenWrite.status, 403, await forbiddenWrite.text());

    const deniedCookie = await login('denied-token');
    const deniedRead = await fetch(`http://127.0.0.1:${frontendPort}/backend/metadata/Computer/7`, {
        headers: { Cookie: deniedCookie }
    });
    assert.equal(deniedRead.status, 403, await deniedRead.text());

    console.log('Backend access integration passed.');
} finally {
    frontend.kill('SIGTERM');
    await once(frontend, 'exit');
    await new Promise(resolve => glpiServer.close(resolve));
}