import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { readFile, stat, writeFile, unlink } from 'node:fs/promises';
import { isIP } from 'node:net';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { NewsStore } from './store.js';

const scrypt = promisify(scryptCallback);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const adminRoot = join(projectRoot, 'admin');
const dataDirectory = resolve(process.env.REMICOS_NEWS_DATA_DIR ?? join(projectRoot, 'data'));
const host = process.env.REMICOS_NEWS_HOST ?? '127.0.0.1';
const port = Number(process.env.REMICOS_NEWS_PORT ?? 4401);
const origin = process.env.REMICOS_NEWS_ORIGIN ?? `http://localhost:${port}`;
const username = process.env.REMICOS_NEWS_ADMIN_USER ?? 'admin';
const production = process.env.NODE_ENV === 'production';
const passwordHash = production
  ? (process.env.CREDENTIALS_DIRECTORY
      ? (await readFile(join(process.env.CREDENTIALS_DIRECTORY, 'admin-password-hash'), 'utf8')).trim()
      : undefined)
  : process.env.REMICOS_NEWS_ADMIN_PASSWORD_HASH;
const cookieName = production ? '__Host-remicos_news' : 'remicos_news_dev';
const sessionLifetime = 8 * 60 * 60 * 1000;
const sessions = new Map();
const failures = new Map();
const store = new NewsStore(dataDirectory);
const mediaPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;
const videoPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/;
const maxVideoBytes = 25 * 1024 * 1024;
const ffmpeg = process.env.REMICOS_NEWS_FFMPEG ?? 'ffmpeg';
const ffprobe = process.env.REMICOS_NEWS_FFPROBE ?? 'ffprobe';
const runFile = promisify(execFile);

if (!passwordHash || !/^scrypt:65536:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(passwordHash)) {
  throw new Error(production ? 'Configura la credencial admin-password-hash de systemd.' : 'Configura REMICOS_NEWS_ADMIN_PASSWORD_HASH con un hash válido.');
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido.');
if (!['127.0.0.1', '::1'].includes(host)) throw new Error('El servicio solo puede escuchar en loopback.');
if (production && (!origin.startsWith('https://') || dataDirectory === projectRoot || dataDirectory.startsWith(projectRoot + sep))) {
  throw new Error('En producción se requiere HTTPS y datos fuera del proyecto público.');
}

function reply(response, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  response.end(body);
}

function error(status, message) {
  return Object.assign(new Error(message), { status });
}

async function bodyBuffer(request, limit) {
  const pieces = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw error(413, 'El archivo o mensaje supera el tamaño permitido.');
    pieces.push(chunk);
  }
  return Buffer.concat(pieces);
}

async function jsonBody(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw error(415, 'Se requiere contenido JSON.');
  }
  try {
    const value = JSON.parse((await bodyBuffer(request, 16_384)).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch (cause) {
    if (cause.status) throw cause;
    throw error(400, 'El mensaje JSON no es válido.');
  }
}

function sessionHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

function currentSession(request) {
  const cookie = (request.headers.cookie ?? '').split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const key = sessionHash(token);
  const session = sessions.get(key);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return { key, ...session };
}

function requireSession(request) {
  const session = currentSession(request);
  if (!session) throw error(401, 'Inicia sesión para continuar.');
  return session;
}

function clientAddress(request) {
  const remote = request.socket.remoteAddress ?? 'unknown';
  if (remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1') {
    const forwarded = request.headers['x-real-ip'];
    if (typeof forwarded === 'string' && isIP(forwarded)) return forwarded;
  }
  return remote;
}

function requireOrigin(request) {
  if (request.headers.origin !== origin) throw error(403, 'Origen no permitido.');
}

function requireCsrf(request, session) {
  const supplied = request.headers['x-csrf-token'];
  if (typeof supplied !== 'string' || supplied.length !== session.csrf.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(session.csrf))) {
    throw error(403, 'Token de seguridad inválido.');
  }
}

async function verifyPassword(password) {
  const [, , , , saltText, hashText] = passwordHash.split(':');
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(hashText, 'base64url');
  if (salt.length !== 32 || expected.length !== 64) throw new Error('Hash de contraseña mal configurado.');
  const actual = await scrypt(password, salt, expected.length, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return timingSafeEqual(actual, expected);
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function matchesImageSignature(input, type) {
  if (type === 'image/jpeg') return input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
  if (type === 'image/png') return input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/webp') return input.length >= 12 && input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

async function processImage(input, type) {
  const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
  if (process.platform === 'win32') {
    const { default: sharp } = await import('sharp');
    const processor = sharp(input, { limitInputPixels: 20_000_000, failOn: 'error' });
    const metadata = await processor.metadata();
    if (metadata.format !== formats[type] || (metadata.pages ?? 1) !== 1) throw new Error('Formato inválido.');
    return processor.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
  }

  const id = randomUUID();
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
  const temporary = join(store.mediaDirectory, `.${id}.image-upload.${extension}`);
  const outputPath = join(store.mediaDirectory, `.${id}.image-output.webp`);
  try {
    await writeFile(temporary, input, { mode: 0o600, flag: 'wx' });
    const { stdout } = await runFile(ffprobe, [
      '-v', 'error', '-protocol_whitelist', 'file', '-count_frames', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name,width,height,nb_read_frames', '-of', 'json', temporary,
    ], { timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true });
    const stream = JSON.parse(stdout).streams?.[0];
    const expectedCodec = { 'image/jpeg': 'mjpeg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    if (stream?.codec_name !== expectedCodec || !Number.isInteger(stream.width) || !Number.isInteger(stream.height) ||
        stream.width < 1 || stream.height < 1 || stream.width * stream.height > 20_000_000 ||
        Number(stream.nb_read_frames) !== 1) throw new Error('Formato o dimensiones inválidas.');
    const factor = Math.min(1, 1600 / stream.width, 1200 / stream.height);
    const targetWidth = Math.max(1, Math.floor(stream.width * factor));
    const targetHeight = Math.max(1, Math.floor(stream.height * factor));
    await runFile(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-nostdin', '-threads', '2', '-protocol_whitelist', 'file', '-i', temporary,
      '-map', '0:v:0', '-frames:v', '1',
      '-vf', `scale=${targetWidth}:${targetHeight}:flags=lanczos`,
      '-c:v', 'libwebp', '-q:v', '82', '-compression_level', '4', '-map_metadata', '-1',
      '-y', outputPath,
    ], { timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true });
    return await readFile(outputPath);
  } finally {
    await unlink(temporary).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

function embedUrl(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 300) throw error(400, 'Enlace de video inválido.');
  let url;
  try { url = new URL(value); } catch { throw error(400, 'Enlace de video inválido.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw error(400, 'Usa un enlace HTTPS de YouTube o Vimeo.');
  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) id = url.pathname.slice(1);
  else if ((host === 'youtube.com' || host === 'www.youtube.com') && url.pathname === '/watch') id = url.searchParams.get('v');
  else if ((host === 'youtube.com' || host === 'www.youtube.com' || host === 'www.youtube-nocookie.com') && /^\/(embed|shorts)\/[A-Za-z0-9_-]{11}$/.test(url.pathname)) id = url.pathname.split('/')[2];
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if ((host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') && /^\/(?:video\/)?[0-9]{1,12}$/.test(url.pathname)) {
    return `https://player.vimeo.com/video/${url.pathname.split('/').pop()}`;
  }
  throw error(400, 'Usa un enlace válido de YouTube o Vimeo.');
}

async function serveVideo(request, response, filename, cache) {
  const path = join(store.mediaDirectory, filename);
  let details;
  try { details = await stat(path); } catch { throw error(404, 'Video no encontrado.'); }
  const range = request.headers.range;
  let start = 0;
  let end = details.size - 1;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) throw error(416, 'Rango de video inválido.');
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
    if (start > end || end >= details.size) throw error(416, 'Rango de video inválido.');
  }
  const { createReadStream } = await import('node:fs');
  response.writeHead(range ? 206 : 200, {
    'Content-Type': 'video/mp4', 'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${details.size}` } : {}),
  });
  createReadStream(path, { start, end }).pipe(response);
}

async function newsInput(value) {
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const message = typeof value.message === 'string' ? value.message.trim() : '';
  const imageId = value.imageId === null || value.imageId === '' || value.imageId === undefined ? null : value.imageId;
  const videoId = value.videoId === null || value.videoId === '' || value.videoId === undefined ? null : value.videoId;
  const videoEmbedUrl = embedUrl(value.videoUrl);
  if (title.length < 3 || title.length > 120 || /[\u0000-\u001f]/.test(title)) throw error(400, 'El título debe tener entre 3 y 120 caracteres.');
  if (message.length < 3 || message.length > 2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message)) {
    throw error(400, 'El mensaje debe tener entre 3 y 2000 caracteres.');
  }
  if (!validDate(value.date)) throw error(400, 'Selecciona una fecha válida.');
  if (!['draft', 'published'].includes(value.status)) throw error(400, 'Estado de publicación inválido.');
  if (imageId !== null) {
    if (typeof imageId !== 'string' || !mediaPattern.test(imageId)) throw error(400, 'Imagen inválida.');
    try { await stat(join(store.mediaDirectory, imageId)); } catch { throw error(400, 'La imagen no existe.'); }
  }
  if ([imageId, videoId, videoEmbedUrl].filter(Boolean).length > 1) throw error(400, 'Elige una sola foto o video por noticia.');
  if (videoId !== null) {
    if (typeof videoId !== 'string' || !videoPattern.test(videoId)) throw error(400, 'Video inválido.');
    try { await stat(join(store.mediaDirectory, videoId)); } catch { throw error(400, 'El video no existe.'); }
  }
  return { title, message, date: value.date, status: value.status, imageId, videoId, videoUrl: videoEmbedUrl };
}

async function serveFile(response, path, contentType, cache = 'no-store', csp = false) {
  const buffer = await readFile(path);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buffer.length,
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...(csp ? { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", 'X-Frame-Options': 'DENY' } : {}),
  });
  response.end(buffer);
}

function publicItem(item) {
  return {
    id: item.id,
    title: item.title,
    message: item.message,
    date: item.date,
    imageUrl: item.imageId ? `/api/news/media/${item.imageId}` : null,
    videoUrl: item.videoId ? `/api/news/media/${item.videoId}` : item.videoUrl ?? null,
    videoType: item.videoId ? 'mp4' : item.videoUrl ? 'embed' : null,
  };
}

async function handle(request, response) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const method = request.method;

  if (method === 'GET' && pathname === '/healthz') return reply(response, 200, { ok: true });
  if (method === 'GET' && pathname === '/api/news') {
    return reply(response, 200, store.published().map(publicItem), { 'Cache-Control': 'public, max-age=30' });
  }
  const publicMedia = pathname.match(/^\/api\/news\/media\/([0-9a-f-]+\.webp)$/);
  if (method === 'GET' && publicMedia) {
    const filename = publicMedia[1];
    if (!mediaPattern.test(filename) || !store.published().some((item) => item.imageId === filename)) throw error(404, 'Imagen no encontrada.');
    return serveFile(response, join(store.mediaDirectory, filename), 'image/webp', 'public, max-age=86400');
  }
  const publicVideo = pathname.match(/^\/api\/news\/media\/([0-9a-f-]+\.mp4)$/);
  if (method === 'GET' && publicVideo) {
    const filename = publicVideo[1];
    if (!videoPattern.test(filename) || !store.published().some((item) => item.videoId === filename)) throw error(404, 'Video no encontrado.');
    return serveVideo(request, response, filename, 'public, max-age=86400');
  }

  if (method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
    return serveFile(response, join(adminRoot, 'index.html'), 'text/html; charset=utf-8', 'no-store', true);
  }
  if (method === 'GET' && pathname === '/admin/admin.css') {
    return serveFile(response, join(adminRoot, 'admin.css'), 'text/css; charset=utf-8', 'no-store', true);
  }
  if (method === 'GET' && pathname === '/admin/admin.js') {
    return serveFile(response, join(adminRoot, 'admin.js'), 'text/javascript; charset=utf-8', 'no-store', true);
  }
  if (method === 'GET' && pathname === '/admin/api/session') {
    const session = currentSession(request);
    return reply(response, 200, session ? { authenticated: true, csrf: session.csrf } : { authenticated: false });
  }
  if (method === 'POST' && pathname === '/admin/api/login') {
    requireOrigin(request);
    const address = clientAddress(request);
    const previous = failures.get(address);
    const record = previous && previous.until > Date.now() ? previous : { count: previous?.until ? 0 : (previous?.count ?? 0), until: 0 };
    if (record.until > Date.now()) throw error(429, 'Demasiados intentos. Inténtalo más tarde.');
    const input = await jsonBody(request);
    if (typeof input.username !== 'string' || typeof input.password !== 'string' || input.password.length > 1024) throw error(400, 'Datos de acceso inválidos.');
    const valid = await verifyPassword(input.password);
    if (input.username !== username || !valid) {
      const count = record.count + 1;
      failures.set(address, { count, until: count >= 5 ? Date.now() + 15 * 60_000 : 0 });
      throw error(401, 'Usuario o contraseña incorrectos.');
    }
    failures.delete(address);
    const token = randomBytes(32).toString('base64url');
    const csrf = randomBytes(32).toString('base64url');
    sessions.set(sessionHash(token), { csrf, expiresAt: Date.now() + sessionLifetime });
    return reply(response, 200, { authenticated: true, csrf }, {
      'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionLifetime / 1000}${production ? '; Secure' : ''}`,
    });
  }

  if (pathname.startsWith('/admin/api/')) {
    const session = requireSession(request);
    if (method !== 'GET') { requireOrigin(request); requireCsrf(request, session); }
    if (method === 'POST' && pathname === '/admin/api/logout') {
      sessions.delete(session.key);
      return reply(response, 200, { ok: true }, {
        'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${production ? '; Secure' : ''}`,
      });
    }
    if (method === 'GET' && pathname === '/admin/api/news') return reply(response, 200, store.list());
    if (method === 'POST' && pathname === '/admin/api/news') {
      const input = await newsInput(await jsonBody(request));
      const now = new Date().toISOString();
      const item = { id: randomUUID(), ...input, createdAt: now, updatedAt: now };
      await store.mutate((items) => { items.push(item); });
      return reply(response, 201, item);
    }
    const newsMatch = pathname.match(/^\/admin\/api\/news\/([0-9a-f-]{36})$/);
    if (method === 'POST' && newsMatch) {
      const input = await newsInput(await jsonBody(request));
      const updated = await store.mutate((items) => {
        const item = items.find((entry) => entry.id === newsMatch[1]);
        if (!item) throw error(404, 'Noticia no encontrada.');
        Object.assign(item, input, { updatedAt: new Date().toISOString() });
        return item;
      });
      return reply(response, 200, updated);
    }
    if (method === 'POST' && pathname === '/admin/api/media') {
      const type = request.headers['content-type']?.split(';')[0];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw error(415, 'Solo se aceptan imágenes JPG, PNG o WebP.');
      const input = await bodyBuffer(request, 5 * 1024 * 1024);
      if (!matchesImageSignature(input, type)) throw error(400, 'La imagen no coincide con su formato.');
      let output;
      try {
        output = await processImage(input, type);
      } catch (cause) {
        if (cause.code === 'ENOENT') throw error(503, 'La carga de fotos requiere FFmpeg y FFprobe en el servidor.');
        throw error(400, 'La imagen está dañada o no coincide con su formato.');
      }
      if (output.length > 5 * 1024 * 1024) throw error(413, 'La imagen procesada es demasiado grande.');
      const filename = `${randomUUID()}.webp`;
      await writeFile(join(store.mediaDirectory, filename), output, { mode: 0o600, flag: 'wx' });
      return reply(response, 201, { imageId: filename, previewUrl: `/admin/api/media/${filename}` });
    }
    if (method === 'POST' && pathname === '/admin/api/video') {
      if (request.headers['content-type']?.split(';')[0] !== 'video/mp4') throw error(415, 'Solo se aceptan archivos MP4.');
      const input = await bodyBuffer(request, maxVideoBytes);
      if (input.length < 24 || input.toString('ascii', 4, 8) !== 'ftyp') throw error(400, 'El archivo no es un MP4 válido.');
      const id = randomUUID();
      const temporary = join(store.mediaDirectory, `.${id}.upload`);
      const filename = `${id}.mp4`;
      try {
        await writeFile(temporary, input, { mode: 0o600, flag: 'wx' });
        const { stdout } = await runFile(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,pix_fmt', '-of', 'json', temporary], { timeout: 10_000, maxBuffer: 1024 * 1024, windowsHide: true });
        const probe = JSON.parse(stdout);
        const duration = Number(probe.format?.duration);
        const streams = probe.streams ?? [];
        const video = streams.find((stream) => stream.codec_type === 'video');
        const audio = streams.filter((stream) => stream.codec_type === 'audio');
        if (!video || streams.filter((stream) => stream.codec_type === 'video').length !== 1 ||
            audio.length > 1 || (audio.length && audio[0].codec_name !== 'aac') ||
            video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p' ||
            !Number.isFinite(duration) || duration < 1 || duration > 120 ||
            video.width < 1 || video.height < 1 || video.width > 1920 || video.height > 1080) {
          throw error(400, 'Usa un MP4 H.264/AAC, hasta 1080p, 25 MB y 2 minutos.');
        }
        await runFile(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-protocol_whitelist', 'file', '-i', temporary, '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', '-map_metadata', '-1', '-map_chapters', '-1', '-y', join(store.mediaDirectory, filename)], { timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true });
        const output = await stat(join(store.mediaDirectory, filename));
        if (!output.size || output.size > maxVideoBytes) throw error(413, 'El video procesado supera 25 MB.');
      } catch (cause) {
        await unlink(join(store.mediaDirectory, filename)).catch(() => {});
        if (cause.code === 'ENOENT') throw error(503, 'La carga de videos requiere FFmpeg y FFprobe en el servidor.');
        if (cause.status) throw cause;
        throw error(400, 'No se pudo procesar el video. Usa un MP4 de hasta 2 minutos.');
      } finally { await unlink(temporary).catch(() => {}); }
      return reply(response, 201, { videoId: filename, previewUrl: `/admin/api/video/${filename}` });
    }
    const adminVideo = pathname.match(/^\/admin\/api\/video\/([0-9a-f-]+\.mp4)$/);
    if (method === 'GET' && adminVideo) {
      if (!videoPattern.test(adminVideo[1])) throw error(404, 'Video no encontrado.');
      return serveVideo(request, response, adminVideo[1], 'no-store');
    }
    const adminMedia = pathname.match(/^\/admin\/api\/media\/([0-9a-f-]+\.webp)$/);
    if (method === 'GET' && adminMedia) {
      if (!mediaPattern.test(adminMedia[1])) throw error(404, 'Imagen no encontrada.');
      return serveFile(response, join(store.mediaDirectory, adminMedia[1]), 'image/webp');
    }
  }

  if (!production && method === 'GET') {
    if (pathname === '/') return serveFile(response, join(projectRoot, 'index.html'), 'text/html; charset=utf-8');
    if (pathname === '/styles.css') return serveFile(response, join(projectRoot, 'styles.css'), 'text/css; charset=utf-8');
    if (pathname === '/app.js') return serveFile(response, join(projectRoot, 'app.js'), 'text/javascript; charset=utf-8');
    if (/^\/assets\/[A-Za-z0-9._-]+$/.test(pathname)) {
      const extension = pathname.split('.').pop();
      const type = { jpg: 'image/jpeg', png: 'image/png', ico: 'image/x-icon', webp: 'image/webp', mp4: 'video/mp4' }[extension];
      if (type) return serveFile(response, join(projectRoot, pathname.slice(1)), type);
    }
  }
  throw error(404, 'Ruta no encontrada.');
}

await store.init();
createServer((request, response) => {
  handle(request, response).catch((cause) => {
    if (response.headersSent) { response.destroy(); return; }
    if (!cause.status) console.error('Error interno del gestor:', cause);
    reply(response, cause.status ?? 500, { error: cause.status ? cause.message : 'Error interno.' });
  });
}).listen(port, host, () => {
  console.log(`Gestor ReMicos escuchando en ${host}:${port}`);
});
