# K-Fresita · Panel administrador con Supabase

Esta versión agrega:

- login real para administrador con Supabase Auth
- pedidos guardados en base de datos
- productos sincronizados entre dispositivos
- cambio de estatus de pedidos
- panel para agregar, ocultar o quitar productos
- fallback local si todavía no configuras Supabase

## 1. Crear proyecto en Supabase

1. Crea un proyecto en Supabase.
2. Entra a **SQL Editor**.
3. Ejecuta el archivo `supabase/setup.sql`.
4. En **Authentication > Users**, crea tu usuario administrador con correo y contraseña.

## 2. Configurar el frontend

Edita el archivo `supabase-config.js` y pega tus credenciales públicas:

```js
window.KFRESITA_SUPABASE = {
  url: 'https://TU-PROYECTO.supabase.co',
  anonKey: 'TU_ANON_KEY'
};
```

## 3. Probar en local

Puedes abrir el proyecto con cualquier servidor estático.

## 4. Subir a GitHub y Vercel

Sube estos archivos al repositorio y vuelve a desplegar.

## 5. Flujo final

- el cliente hace pedido desde el sitio
- el pedido se guarda en `orders`
- también se abre WhatsApp para confirmación
- el admin entra a `/admin.html`
- desde ahí cambia estatus y administra productos

## Recomendación siguiente

La siguiente mejora ideal sería mover `supabase-config.js` a variables de entorno con build moderno usando Next.js o Vite, pero para tu estructura actual estática esta solución es la más directa.
