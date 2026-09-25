# Páginas de error ReMicos

Archivos estáticos sin JavaScript ni dependencias externas:

- `403.html`: acceso restringido para `www.remicos.com.co` y `app.remicos.com.co`.
- `404.html`: página no encontrada para `www.remicos.com.co` y `app.remicos.com.co`.
- `security-403.html`: acceso restringido para `seguridad.remicos.com.co`; mantiene su `404.html` actual.

Las páginas no deben sustituir las respuestas JSON de `/api/` ni las rutas del
gestor de noticias. Se recomienda instalarlas en un directorio root-owned
independiente de los releases de las aplicaciones y servirlas mediante
`error_page` y una ubicación `internal` en cada bloque HTTPS correspondiente.
Nginx debe conservar el código HTTP 403 o 404 original, no redirigir a HTTP 200.

La portada pública oculta `/admin/` con 404. Esa restricción debe permanecer.
El gestor solo debe seguir accesible a través de WireGuard.
