# ReMicos-www

Sitio público independiente de la aplicación de operación `remicos-app-2026`.
Es una web estática sin dependencias de Node, base de datos ni API: puede
servirse directamente con Nginx.

## Vista local

Desde esta carpeta:

```sh
python3 -m http.server 4300
```

En Windows también sirve `python -m http.server 4300`. Abrir
`http://localhost:4300/`. No abrir el archivo HTML directamente: un servidor
local reproduce mejor las rutas que usará Nginx.

## Publicación en Debian

1. Crear el repositorio GitHub `darkunchain/ReMicos-www` y subir este proyecto.
2. Clonarlo en `/srv/remicos/www`, con permiso de lectura para Nginx.
3. Configurar DNS para `www.remicos.com.co` y `remicos.com.co`, y obtener un
   certificado HTTPS válido para **ambos** nombres.
4. Adaptar e instalar [`deploy/nginx.conf.example`](deploy/nginx.conf.example).
   Validar con `sudo nginx -t` antes de recargar Nginx.

`https://www.remicos.com.co` es la dirección principal. La dirección sin `www`
y las dos versiones HTTP redirigen hacia ella.

Para actualizar, hacer `git pull --ff-only` en `/srv/remicos/www` y recargar
Nginx si cambió su configuración. No se ejecutan migraciones ni procesos Node
en este sitio.

## Contenido y límites actuales

- Horario: todos los días, incluidos festivos, 10:00 a. m.–7:30 p. m.
- Tarifas de ingreso: 15 min $7.000, 30 min $10.000, 1 h $15.000 COP.
- WhatsApp: se redacta el mensaje aquí y la conversación se abre en WhatsApp.
- Mapa: incrustación oficial proporcionada por ReMicos.
- Noticias: contenido de demostración; aún no existe un gestor de publicaciones.

Los archivos `assets/galeria-*.jpg` contienen fotografías reales. Antes de
publicar el repositorio, confirmar que se cuenta con autorización de uso de
imagen de las personas que aparecen en ellas. Las fotos originales no usadas
por la portada permanecen fuera de este proyecto.
