const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const CONTENT_PATH = path.join(DATA_DIR, 'site-content.json');
const ORDERS_PATH = path.join(DATA_DIR, 'orders.json');
const SALES_PATH = path.join(DATA_DIR, 'sales.json');
const ADMIN_CODE = process.env.ADMIN_CODE || 'KFRESITA2026';
const ADMIN_COOKIE_SECRET = process.env.ADMIN_COOKIE_SECRET || 'cambia_esta_clave_super_secreta';
const ADMIN_COOKIE_NAME = 'k_fresita_admin_session';

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(ADMIN_COOKIE_SECRET));
app.use(express.static(ROOT));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeContentShape(content) {
  const safe = content && typeof content === 'object' ? content : {};
  safe.hero = safe.hero && typeof safe.hero === 'object' ? safe.hero : {};
  safe.about = safe.about && typeof safe.about === 'object' ? safe.about : {};
  safe.values = Array.isArray(safe.values) ? safe.values : [];
  safe.menu = Array.isArray(safe.menu)
    ? safe.menu.map((item) => ({
        title: String(item?.title || 'Producto').trim(),
        description: String(item?.description || '').trim(),
        price: Number(item?.price || 0),
        image: String(item?.image || '').trim()
      }))
    : [];
  safe.toppings = Array.isArray(safe.toppings) ? safe.toppings : [];
  safe.organization = Array.isArray(safe.organization) ? safe.organization : [];
  safe.benefits = Array.isArray(safe.benefits) ? safe.benefits : [];
  safe.layout = safe.layout && typeof safe.layout === 'object' ? safe.layout : {};
  safe.contactText = String(safe.contactText || '');
  safe.mission = String(safe.mission || '');
  safe.vision = String(safe.vision || '');
  return safe;
}

function nextId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toMoney(value) {
  return Number(value || 0).toFixed(2);
}

function isAdminAuthenticated(req) {
  return req.signedCookies?.[ADMIN_COOKIE_NAME] === 'ok';
}

function requireAdminAuth(req, res, next) {
  if (isAdminAuthenticated(req)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'No autorizado.' });
  }
  return res.redirect('/admin-login');
}

app.get('/api/config', (_req, res) => {
  res.json(readJson(CONFIG_PATH));
});

app.get('/api/content', (_req, res) => {
  res.json(normalizeContentShape(readJson(CONTENT_PATH)));
});

app.post('/api/orders', (req, res) => {
  try {
    const payload = req.body;
    const content = normalizeContentShape(readJson(CONTENT_PATH));
    const selectedProduct = content.menu.find((item) => item.title === payload.product);
    const quantity = Math.max(1, Number(payload.quantity || 1));
    const unitPrice = selectedProduct ? Number(selectedProduct.price || 0) : Number(payload.unitPrice || 0);
    const order = {
      id: nextId('order'),
      createdAt: new Date().toISOString(),
      status: 'nuevo',
      customerName: String(payload.customerName || '').trim(),
      phone: String(payload.phone || '').trim(),
      product: String(payload.product || '').trim(),
      quantity,
      toppings: String(payload.toppings || '').trim(),
      deliveryDate: String(payload.deliveryDate || '').trim(),
      deliveryTime: String(payload.deliveryTime || '').trim(),
      notes: String(payload.notes || '').trim(),
      unitPrice,
      total: Number(unitPrice * quantity),
      salesRecorded: false
    };

    if (!order.customerName || !order.phone || !order.product) {
      return res.status(400).json({ ok: false, error: 'Completa nombre, teléfono y producto.' });
    }

    const orders = readJson(ORDERS_PATH);
    orders.push(order);
    writeJson(ORDERS_PATH, orders);
    return res.json({ ok: true, message: 'Pedido recibido correctamente.', order });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'No se pudo guardar el pedido.' });
  }
});

app.get('/admin-login', (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin-login.html'));
});

app.post('/api/admin/login', (req, res) => {
  const code = String(req.body.code || '').trim();
  if (!code) return res.status(400).json({ ok: false, error: 'Ingresa el código.' });
  if (code !== ADMIN_CODE) return res.status(401).json({ ok: false, error: 'Código incorrecto.' });

  res.cookie(ADMIN_COOKIE_NAME, 'ok', {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  });

  return res.json({ ok: true, message: 'Acceso concedido.' });
});

app.post('/api/admin/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE_NAME);
  return res.json({ ok: true, message: 'Sesión cerrada.' });
});

app.get('/api/admin/session', (req, res) => {
  res.json({ ok: true, authenticated: isAdminAuthenticated(req) });
});

app.get('/admin', requireAdminAuth, (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});

app.post('/api/content', requireAdminAuth, (req, res) => {
  try {
    const payload = normalizeContentShape(req.body);
    writeJson(CONTENT_PATH, payload);
    res.json({ ok: true, message: 'Contenido actualizado correctamente.' });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'No se pudo guardar el contenido.' });
  }
});

app.get('/api/orders', requireAdminAuth, (_req, res) => {
  const orders = readJson(ORDERS_PATH).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});

app.patch('/api/orders/:id', requireAdminAuth, (req, res) => {
  try {
    const orders = readJson(ORDERS_PATH);
    const sales = readJson(SALES_PATH);
    const order = orders.find((item) => item.id === req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Pedido no encontrado.' });

    const allowedStatuses = ['nuevo', 'preparando', 'listo', 'entregado', 'cancelado'];
    const nextStatus = String(req.body.status || order.status);
    if (!allowedStatuses.includes(nextStatus)) {
      return res.status(400).json({ ok: false, error: 'Estado inválido.' });
    }

    order.status = nextStatus;
    order.notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : order.notes;

    if (nextStatus === 'entregado' && !order.salesRecorded) {
      sales.push({
        id: nextId('sale'),
        orderId: order.id,
        date: new Date().toISOString(),
        customerName: order.customerName,
        product: order.product,
        quantity: order.quantity,
        unitPrice: Number(order.unitPrice || 0),
        total: Number(order.total || 0)
      });
      order.salesRecorded = true;
    }

    writeJson(ORDERS_PATH, orders);
    writeJson(SALES_PATH, sales);
    res.json({ ok: true, message: 'Pedido actualizado.', order });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'No se pudo actualizar el pedido.' });
  }
});

app.get('/api/sales', requireAdminAuth, (_req, res) => {
  const sales = readJson(SALES_PATH).sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(sales);
});

app.get('/api/sales/download', requireAdminAuth, (_req, res) => {
  const sales = readJson(SALES_PATH);
  const headers = ['ID venta', 'ID pedido', 'Fecha', 'Cliente', 'Producto', 'Cantidad', 'Precio unitario', 'Total'];
  const rows = sales.map((item) => [
    item.id,
    item.orderId,
    item.date,
    item.customerName,
    item.product,
    item.quantity,
    toMoney(item.unitPrice),
    toMoney(item.total)
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="registro-ventas-k-fresita.csv"');
  res.send(csv);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`K-Fresita corriendo en http://localhost:${PORT}`);
});
