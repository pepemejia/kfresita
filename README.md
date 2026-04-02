# K-Fresita

Sitio web con pedido en linea, panel de administrador protegido con codigo de seguridad, gestion de productos y precios, seguimiento de pedidos y registro de ventas descargable en CSV.

## Requisitos
- Node.js 18 o superior

## Instalacion
```bash
npm install
```

## Configuracion
Crea un archivo `.env` en la raiz con este contenido:

```env
ADMIN_CODE=KFRESITA2026
ADMIN_COOKIE_SECRET=cambia_esta_clave_super_secreta
```

## Uso
```bash
npm start
```

Abre:
- Sitio: `http://localhost:3000`
- Login admin: `http://localhost:3000/admin-login`
- Panel admin: `http://localhost:3000/admin`

## Funciones
- Pedido en linea desde la landing
- Productos con imagen, descripcion y precio
- Panel admin para editar productos
- Lista de pedidos
- Cambio de estatus del pedido
- Registro de ventas automatico cuando un pedido pasa a `entregado`
- Descarga CSV del registro de ventas
