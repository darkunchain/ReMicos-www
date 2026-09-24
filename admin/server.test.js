import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const runFile = promisify(execFile);
const password = 'Prueba-local-no-usar-2026!';

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('panel, publicación y carga de imágenes', { timeout: 40_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'remicos-news-test-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const salt = randomBytes(32);
  const hash = await scrypt(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const child = spawn(process.execPath, ['admin/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      REMICOS_NEWS_PORT: String(port),
      REMICOS_NEWS_ORIGIN: base,
      REMICOS_NEWS_DATA_DIR: directory,
      REMICOS_NEWS_ADMIN_PASSWORD_HASH: `scrypt:65536:8:1:${salt.toString('base64url')}:${hash.toString('base64url')}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let errors = '';
  child.stderr.on('data', (chunk) => { errors += chunk; });
  t.after(async () => {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  });

  let healthy = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) { healthy = true; break; }
    } catch { /* Esperar el inicio del proceso. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(healthy, true, `El servidor no inició: ${errors}`);

  const get = (path, headers = {}) => fetch(`${base}${path}`, { headers });
  const post = (path, payload, headers = {}) => fetch(`${base}${path}`, {
    method: 'POST',
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    headers: { Origin: base, 'Content-Type': 'application/json', ...headers },
  });

  assert.deepEqual(await (await get('/api/news')).json(), []);
  assert.equal((await get('/admin/api/news')).status, 401);
  assert.equal((await post('/admin/api/login', { username: 'admin', password: 'incorrecta' })).status, 401);
  assert.equal((await fetch(`${base}/admin/api/login`, { method: 'POST', body: '{}', headers: { Origin: 'https://malicioso.example', 'Content-Type': 'application/json' } })).status, 403);

  const login = await post('/admin/api/login', { username: 'admin', password });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const { csrf } = await login.json();
  const authenticated = { Cookie: cookie, 'X-CSRF-Token': csrf };
  assert.equal((await post('/admin/api/news', {}, { Cookie: cookie })).status, 403);

  const draft = await post('/admin/api/news', {
    title: 'Tarde en familia', date: '2026-09-24', message: 'Ven a jugar con toda la familia.', status: 'draft', imageId: null,
  }, authenticated);
  assert.equal(draft.status, 201);
  const saved = await draft.json();
  assert.equal((await get('/api/news')).status, 200);
  assert.deepEqual(await (await get('/api/news')).json(), []);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAIElEQVQ4jWP4b5xGNmIY1Zw2GmBpo4kkbTRjpA1cYQAAV+R9nxH4cEMAAAAASUVORK5CYII=', 'base64');
  const uploaded = await fetch(`${base}/admin/api/media`, {
    method: 'POST', body: png,
    headers: { Origin: base, ...authenticated, 'Content-Type': 'image/png' },
  });
  assert.equal(uploaded.status, 201);
  const { imageId } = await uploaded.json();
  assert.equal((await get(`/api/news/media/${imageId}`)).status, 404);
  assert.equal((await get(`/admin/api/media/${imageId}`, { Cookie: cookie })).status, 200);
  assert.equal((await fetch(`${base}/admin/api/media`, {
    method: 'POST', body: '<svg></svg>', headers: { Origin: base, ...authenticated, 'Content-Type': 'image/png' },
  })).status, 400);

  const published = await fetch(`${base}/admin/api/news/${saved.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: saved.title, date: saved.date, message: saved.message, status: 'published', imageId }),
    headers: { Origin: base, ...authenticated, 'Content-Type': 'application/json' },
  });
  assert.equal(published.status, 200);
  const publicItems = await (await get('/api/news')).json();
  assert.equal(publicItems.length, 1);
  assert.equal(publicItems[0].title, saved.title);
  const imageResponse = await get(publicItems[0].imageUrl);
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get('content-type'), 'image/webp');
  const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
  assert.equal(imageBytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(imageBytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(imageBytes.includes(Buffer.from('EXIF')), false);
  const webpUpload = await fetch(`${base}/admin/api/media`, {
    method: 'POST', body: imageBytes,
    headers: { Origin: base, ...authenticated, 'Content-Type': 'image/webp' },
  });
  assert.equal(webpUpload.status, 201, await webpUpload.text());

  const linked = await post('/admin/api/news', {
    title: 'Video de la semana', date: '2026-09-25', message: 'Mira la nueva aventura.', status: 'published',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
  }, authenticated);
  assert.equal(linked.status, 201);
  assert.equal((await linked.json()).videoUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  const linkedItems = await (await get('/api/news')).json();
  assert.equal(linkedItems[0].videoType, 'embed');
  assert.equal(linkedItems[0].videoUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal((await post('/admin/api/news', {
    title: 'Enlace falso', date: '2026-09-25', message: 'No publicar.', status: 'published',
    videoUrl: 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
  }, authenticated)).status, 400);
  assert.equal((await post('/admin/api/news', {
    title: 'Doble archivo', date: '2026-09-25', message: 'No publicar.', status: 'published',
    imageId, videoUrl: 'https://vimeo.com/12345',
  }, authenticated)).status, 400);
  assert.equal((await fetch(`${base}/admin/api/video`, {
    method: 'POST', body: '<svg></svg>', headers: { Origin: base, ...authenticated, 'Content-Type': 'video/mp4' },
  })).status, 400);

  if (process.platform !== 'win32') {
    const fixture = join(directory, 'fixture.mp4');
    await runFile('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:d=1',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', '-y', fixture], { timeout: 20_000 });
    const videoUpload = await fetch(`${base}/admin/api/video`, {
      method: 'POST', body: await readFile(fixture),
      headers: { Origin: base, ...authenticated, 'Content-Type': 'video/mp4' },
    });
    const uploadBody = await videoUpload.json();
    assert.equal(videoUpload.status, 201, JSON.stringify(uploadBody));
    const { videoId } = uploadBody;
    assert.equal((await get(`/api/news/media/${videoId}`)).status, 404);
    const videoNews = await post('/admin/api/news', {
      title: 'Video de prueba', date: '2026-09-26', message: 'Video corto para probar.', status: 'published', videoId,
    }, authenticated);
    assert.equal(videoNews.status, 201);
    const videoResponse = await get(`/api/news/media/${videoId}`, { Range: 'bytes=0-31' });
    assert.equal(videoResponse.status, 206);
    assert.equal(videoResponse.headers.get('content-type'), 'video/mp4');
  }

  const logout = await post('/admin/api/logout', '{}', authenticated);
  assert.equal(logout.status, 200);
  assert.equal((await get('/admin/api/news', { Cookie: cookie })).status, 401);
});
