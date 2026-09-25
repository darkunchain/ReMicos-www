# Páginas de error ReMicos

Archivos estáticos sin JavaScript ni dependencias externas:

- `403.html`: acceso restringido para `www.remicos.com.co` y `app.remicos.com.co`.
- `404.html`: página no encontrada para `www.remicos.com.co` y `app.remicos.com.co`.
- `security-403.html`: acceso restringido para `seguridad.remicos.com.co`.
- `security-404.html`: conserva el texto y diseño del 404 existente de `seguridad.remicos.com.co`, pero utiliza la nueva ilustración.
- `403.png` y `404.png`: ilustraciones proporcionadas por el propietario del sitio.

Las páginas no deben sustituir las respuestas JSON de `/api/` ni las rutas del
gestor de noticias. Se recomienda instalarlas en un directorio root-owned
independiente de los releases de las aplicaciones y servirlas mediante
`error_page` y una ubicación `internal` en cada bloque HTTPS correspondiente.
Nginx debe conservar el código HTTP 403 o 404 original, no redirigir a HTTP 200.
Las imágenes sí deben estar disponibles mediante rutas públicas exactas
`/error-assets/403.png` y `/error-assets/404.png`; una ubicación `internal`
impediría que el navegador las cargara desde la página de error.

La portada pública oculta `/admin/` con 404. Esa restricción debe permanecer.
El gestor solo debe seguir accesible a través de WireGuard.
