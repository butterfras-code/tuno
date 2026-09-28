import { createHash, X509Certificate } from 'node:crypto';
import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { readFile, readdir, stat, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const contentType = (name) => name.endsWith('.js') ? 'text/javascript'
  : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png'
  : name.endsWith('.webmanifest') ? 'application/manifest+json' : 'text/html';
export async function hostBuild({ tls = false } = {}) {
  const root = new URL('../dist/hosted/', import.meta.url);
  const files = new Map(await Promise.all((await readdir(root, { recursive: true })).map(async (name) => [name, (await stat(new URL(name, root))).isFile() ? await readFile(new URL(name, root)) : null])));
  let certDirectory;
  let certificate;
  if (tls) {
    certDirectory = await mkdtemp(join(tmpdir(), 'tuno-test-tls-'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(certDirectory, 'key.pem'), '-out', join(certDirectory, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
    certificate = { key: await readFile(join(certDirectory, 'key.pem')), cert: await readFile(join(certDirectory, 'cert.pem')) };
  }
  let available = true;
  const handler = (request, response) => {
    if (!available) { response.destroy(); return; }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const redirect = files.get('_redirects').toString().split('\n').map((line) => line.trim().split(/\s+/)).find(([from]) => from === pathname);
    if (redirect) { response.writeHead(Number(redirect[2]), { Location: redirect[1] }).end(); return; }
    if (pathname.endsWith('/index.html')) { response.writeHead(308, { Location: pathname.slice(0, -10) }).end(); return; }
    const name = pathname.slice(1) + (pathname.endsWith('/') ? 'index.html' : '');
    if (!files.get(name) || name.startsWith('_')) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': contentType(name), 'Cache-Control': 'no-cache' });
    response.end(files.get(name));
  };
  const server = tls ? httpsServer(certificate, handler) : httpServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    files, // Mutable deployment fixture for upgrade tests.
    setAvailable(value) { available = value; },
    certificateSpki: tls ? createHash('sha256').update(new X509Certificate(certificate.cert).publicKey.export({ type: 'spki', format: 'der' })).digest('base64') : undefined,
    url: `${tls ? 'https' : 'http'}://127.0.0.1:${server.address().port}/tune/`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      if (certDirectory) await rm(certDirectory, { recursive: true, force: true });
    },
  };
}
