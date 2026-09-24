# ReMicos-www

Sitio público independiente de `remicos-app-2026`. La portada es estática y el
gestor de noticias es un proceso Node pequeño, separado de la app de operación.

## Estado

La versión publicada en Debian aún usa noticias de demostración. El gestor está
en desarrollo local: **no publicar el panel ni cambiar Nginx antes de probarlo en
el servidor y revisar los permisos**. No existe una contraseña predeterminada ni
se guarda ninguna clave en Git.

## Desarrollo local

Se requiere Node.js 20.9 o superior y pnpm. Desde esta carpeta:

```sh
pnpm install --frozen-lockfile
```

Generar un hash para una contraseña de prueba de al menos 16 caracteres pasando
la contraseña por la entrada estándar de `pnpm password:hash`. Configurar
`REMICOS_NEWS_ADMIN_PASSWORD_HASH` con ese resultado. Después iniciar el gestor:

```sh
pnpm start
```

La vista local se abre en `http://localhost:4401/` y el panel en
`http://localhost:4401/admin/`. El proceso solo escucha en loopback. En modo de
desarrollo los datos se guardan en `data/`, carpeta excluida de Git.

## Modelo de publicación

- El panel permite crear y editar noticias con título, fecha, mensaje y un
  recurso opcional: foto, MP4 o enlace de YouTube/Vimeo. Solo uno por noticia.
- La portada consulta `GET /api/news`, que entrega únicamente noticias
  publicadas. Las fotos de borradores requieren sesión.
- Se aceptan JPG, PNG y WebP de hasta 5 MB. En Debian, FFmpeg comprueba el formato,
  limita los píxeles, convierte a WebP y descarta los metadatos de origen. Esto
  evita depender del binario de Sharp, incompatible con procesadores sin SSE4.2.
- Los MP4 deben venir codificados en H.264/AAC (audio opcional), hasta 1080p,
  25 MB y 2 minutos. FFmpeg recompone el contenedor y elimina metadatos sin
  recodificar el video, adecuado para el procesador del servidor. Se necesitan
  `ffmpeg` y `ffprobe` instalados en el servidor
  o sus rutas absolutas en `REMICOS_NEWS_FFMPEG` y `REMICOS_NEWS_FFPROBE`;
  sin ello la carga devuelve un error claro.
- Los enlaces externos solo admiten YouTube/Vimeo por HTTPS y se convierten a
  URL de reproducción autorizada; no se aceptan códigos HTML para incrustar.
- El texto se muestra como texto, no como HTML; no se permiten etiquetas ni
  scripts en las noticias.
- No hay borrado definitivo desde el panel: una noticia puede volver a borrador.

## Seguridad y despliegue futuro

Antes de publicar el gestor, crear un usuario de sistema exclusivo para el
servicio, instalar el código ejecutable como solo lectura en `/opt/remicos-www`,
y guardar datos privados en `/var/lib/remicos-www`, fuera de `/var/www`. En
producción, el hash de la contraseña se entrega como credencial privada de
systemd llamada `admin-password-hash` mediante `LoadCredential=`; no se coloca
en variables de entorno ni en el repositorio. El proceso debe escuchar en
`127.0.0.1:4401`; Nginx expondrá en Internet solo `/api/news` y los recursos
publicados. El panel `/admin/` se sirve únicamente por la dirección WireGuard
`10.99.99.10`, según `deploy/nginx-news-wg.conf.example`. En producción se requiere
`NODE_ENV=production` y `REMICOS_NEWS_ORIGIN=https://www.remicos.com.co`.

El panel usa cookie `Secure`, `HttpOnly`, `SameSite=Strict`, sesión de 8 horas,
token CSRF, comprobación de origen y límite de intentos de acceso. Deben
mantenerse HTTPS, ModSecurity y las cabeceras de seguridad existentes. El
proxy privado debe aceptar hasta 26 MB en `/admin/`, y el límite de cuerpo de
ModSecurity debe revisarse antes de intentar subir MP4. La política CSP de la
portada debe permitir `frame-src` para `www.youtube-nocookie.com`,
`player.vimeo.com` y el mapa de Google, además de `media-src 'self'`. El
fragmento de rutas públicas está en `deploy/nginx-news-locations.example`; **no sustituye
la configuración activa de Nginx**. El archivo `deploy/nginx.conf.example` es
solo un aviso para evitar copiar una plantilla obsoleta.

Para actualizar la portada, no servir el repositorio completo desde Nginx:
publicar únicamente `index.html`, `styles.css`, `app.js` y `assets/` en el
directorio estático raíz, como ya se hizo en Debian. No publicar `admin/`,
`node_modules/`, `data/` ni archivos de entorno en esa raíz.

## Datos vigentes del sitio

- Horario: todos los días, incluidos festivos, 10:00 a. m.–7:30 p. m.
- Tarifas: 15 min $7.000, 30 min $10.000 y 1 h $15.000 COP.
- WhatsApp: el visitante redacta el mensaje y la conversación se abre en
  WhatsApp; no es un chat interno.
- Mapa: incrustación oficial proporcionada por ReMicos.

Los archivos `assets/galeria-*.jpg` contienen fotografías reales. Verificar
siempre la autorización de uso de imagen de las personas que aparezcan,
especialmente menores, antes de publicar una foto nueva.
