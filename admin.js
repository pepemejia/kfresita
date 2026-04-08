const STORAGE_KEYS = {
  menu: 'kfresita_menu_override',
  orders: 'kfresita_orders',
  adminSession: 'kfresita_admin_session'
};

const adminState = {
  baseMenu: [],
  activeMenu: [],
  orders: [],
  orderFilter: 'all',
  mode: 'local',
  user: null
};

const supabaseConfig = window.KFRESITA_SUPABASE || null;
const supabaseClient = (window.supabase && supabaseConfig?.url && supabaseConfig?.anonKey)
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

function $(id) { return document.getElementById(id); }
function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function safeArray(value) { return Array.isArray(value) ? value : []; }

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`No se pudo leer ${key}`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setStatus(id, text, type) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = `status ${type || ''}`.trim();
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

function normalizeOrder(order = {}) {
  return {
    id: order.id || order.order_code || order.order_id || 'Pedido',
    createdAt: order.createdAt || order.created_at || new Date().toISOString(),
    customerName: order.customerName || order.customer_name || 'Sin nombre',
    customerPhone: order.customerPhone || order.customer_phone || 'Sin teléfono',
    deliveryMode: order.deliveryMode || order.delivery_mode || '-',
    deliveryAddress: order.deliveryAddress || order.delivery_address || 'Sin dirección',
    deliveryWhen: order.deliveryWhen || order.delivery_when || 'ahora',
    deliveryDate: order.deliveryDate || order.delivery_date || '',
    deliveryTime: order.deliveryTime || order.delivery_time || '',
    notes: order.notes || '',
    subtotal: Number(order.subtotal || 0),
    deliveryFee: Number(order.deliveryFee || order.delivery_fee || 0),
    total: Number(order.total || 0),
    status: order.status || 'nuevo',
    items: safeArray(order.items)
  };
}
function mapCategory(title = '') {
  const text = String(title).toLowerCase();

  if (
    text.includes('malteada') ||
    text.includes('vainilla') ||
    text.includes('plátano') ||
    text.includes('platano') ||
    text.includes('chocolate')
  ) return 'malteadas';

  if (text.includes('combo')) return 'combos';

  if (
    text.includes('hotcakes') ||
    text.includes('plátanos machos') ||
    text.includes('platano macho')
  ) return 'especiales';

  return 'fresas';
}
function normalizeProduct(item = {}) {
  return {
    id: item.id || crypto.randomUUID(),
    title: item.title || item.name || 'Producto',
    description: item.description || '',
    price: Number(item.price || 0),
    image: item.image || '/images/hero-fresas.svg',
    category: item.category || mapCategory(item.title || item.name || ''),
    active: item.active !== false,
    created_at: item.created_at || new Date().toISOString()
  };
}

function setModeBadge() {
  const badge = $('adminConnectionBadge');
  if (!badge) return;
  badge.textContent = adminState.mode === 'supabase'
    ? `Conectado a Supabase${adminState.user?.email ? ` · ${adminState.user.email}` : ''}`
    : 'Modo local de prueba';
  badge.className = `admin-connection-badge ${adminState.mode === 'supabase' ? 'ok' : 'warn'}`;
}

async function loadOrders() {
  if (adminState.mode === 'supabase' && supabaseClient) {
    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      adminState.orders = safeArray(readStorage(STORAGE_KEYS.orders, [])).map(normalizeOrder);
      return;
    }

    adminState.orders = safeArray(data).map(normalizeOrder);
    return;
  }

  adminState.orders = safeArray(readStorage(STORAGE_KEYS.orders, [])).map(normalizeOrder);
}

async function loadMenu() {
  if (adminState.mode === 'supabase' && supabaseClient) {
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      adminState.activeMenu = data.map(normalizeProduct);
      writeStorage(STORAGE_KEYS.menu, adminState.activeMenu);
      return;
    }
  }

  const overrideMenu = readStorage(STORAGE_KEYS.menu, null);
  adminState.activeMenu = safeArray(overrideMenu).length
    ? overrideMenu.map(normalizeProduct)
    : [...adminState.baseMenu];
}

function updateSummary() {
  const revenue = adminState.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  $('ordersCount').textContent = String(adminState.orders.length);
  $('ordersRevenue').textContent = money(revenue);
  $('productsCount').textContent = String(adminState.activeMenu.filter((item) => item.active !== false).length);
}

function filteredOrders() {
  return adminState.orders.filter((order) =>
    adminState.orderFilter === 'all' ? true : order.status === adminState.orderFilter
  );
}

async function updateOrderStatus(orderId, status) {
  if (adminState.mode === 'supabase' && supabaseClient) {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) {
      setStatus('adminProductStatus', 'No se pudo actualizar el pedido.', 'error');
      return;
    }

    await refreshAdminData();
    return;
  }

  adminState.orders = adminState.orders.map((order) =>
    order.id === orderId ? { ...order, status } : order
  );
  writeStorage(STORAGE_KEYS.orders, adminState.orders);
  renderOrders();
  updateSummary();
}

function renderOrders() {
  const list = $('ordersList');
  if (!list) return;

  list.innerHTML = '';
  const orders = filteredOrders();

  if (!orders.length) {
    list.innerHTML = '<p class="empty-cart">Todavía no hay pedidos para este filtro.</p>';
    return;
  }

  orders.forEach((order) => {
    const card = document.createElement('article');
    card.className = 'order-admin-card';

    const itemsHtml = safeArray(order.items)
      .map((item) => `<li>${item.title} × ${item.quantity} — ${money(item.price * item.quantity)}</li>`)
      .join('');

    card.innerHTML = `
      <div class="order-admin-head">
        <div>
          <strong>${order.id || 'Pedido'}</strong>
          <p>${formatDate(order.createdAt)}</p>
        </div>
        <select class="admin-status-select" data-order-id="${order.id}">
          <option value="nuevo" ${order.status === 'nuevo' ? 'selected' : ''}>Nuevo</option>
          <option value="preparando" ${order.status === 'preparando' ? 'selected' : ''}>Preparando</option>
          <option value="listo" ${order.status === 'listo' ? 'selected' : ''}>Listo</option>
          <option value="entregado" ${order.status === 'entregado' ? 'selected' : ''}>Entregado</option>
          <option value="cancelado" ${order.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
      </div>
      <div class="order-admin-body">
        <p><strong>Cliente:</strong> ${order.customerName}</p>
        <p><strong>Teléfono:</strong> ${order.customerPhone}</p>
        <p><strong>Entrega:</strong> ${order.deliveryMode} / ${order.deliveryAddress}</p>
        <p><strong>Programación:</strong> ${order.deliveryWhen}${order.deliveryDate ? ` / ${order.deliveryDate}` : ''}${order.deliveryTime ? ` ${order.deliveryTime}` : ''}</p>
        <p><strong>Notas:</strong> ${order.notes || 'Sin notas'}</p>
        <ul>${itemsHtml}</ul>
        <div class="order-admin-total"><span>Total</span><strong>${money(order.total)}</strong></div>
      </div>`;

    list.appendChild(card);
  });

  list.querySelectorAll('.admin-status-select').forEach((select) => {
    select.addEventListener('change', () => updateOrderStatus(select.dataset.orderId, select.value));
  });
}

async function persistMenu() {
  if (adminState.mode === 'supabase' && supabaseClient) {
    const payload = adminState.activeMenu.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      price: Number(item.price),
      image: item.image,
      category: item.category,
      active: item.active !== false
    }));

    const { error } = await supabaseClient
      .from('products')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.error(error);
      setStatus('adminProductStatus', 'No se pudieron guardar los productos en Supabase.', 'error');
      return;
    }
  }

  writeStorage(STORAGE_KEYS.menu, adminState.activeMenu);
  renderProducts();
  updateSummary();
  setStatus('adminProductStatus', 'Productos guardados correctamente.', 'ok');
}

function renderProducts() {
  const list = $('productsAdminList');
  if (!list) return;

  list.innerHTML = '';

  if (!adminState.activeMenu.length) {
    list.innerHTML = '<p class="empty-cart">No hay productos activos.</p>';
    return;
  }

  adminState.activeMenu.forEach((product) => {
    const row = document.createElement('div');
    row.className = 'product-admin-row';

    row.innerHTML = `
      <div class="product-admin-main">
        <img src="${product.image || '/images/hero-fresas.svg'}" alt="${product.title || 'Producto'}" />
        <div>
          <strong>${product.title || 'Producto'}</strong>
          <p>${product.description || ''}</p>
          <small>${product.category || 'fresas'} · ${product.active !== false ? 'Activo' : 'Oculto'}</small>
        </div>
      </div>
      <div class="product-admin-side wrap-actions">
        <strong>${money(product.price)}</strong>
        <button type="button" class="small-btn toggle-product-btn" data-id="${product.id}">${product.active !== false ? 'Ocultar' : 'Activar'}</button>
        <button type="button" class="small-btn delete-product-btn" data-id="${product.id}">Quitar</button>
      </div>`;

    list.appendChild(row);
  });

  list.querySelectorAll('.toggle-product-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      adminState.activeMenu = adminState.activeMenu.map((item) =>
        item.id === btn.dataset.id ? { ...item, active: item.active === false } : item
      );
      await persistMenu();
    });
  });

  list.querySelectorAll('.delete-product-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.id;

      if (adminState.mode === 'supabase' && supabaseClient) {
        const { error } = await supabaseClient
          .from('products')
          .delete()
          .eq('id', targetId);

        if (error) {
          setStatus('adminProductStatus', 'No se pudo eliminar el producto.', 'error');
          return;
        }
      }

      adminState.activeMenu = adminState.activeMenu.filter((item) => item.id !== targetId);
      writeStorage(STORAGE_KEYS.menu, adminState.activeMenu);
      renderProducts();
      updateSummary();
      setStatus('adminProductStatus', 'Producto eliminado.', 'ok');
    });
  });
}

async function showDashboard() {
  $('adminLoginPanel')?.classList.add('hidden');
  $('adminDashboard')?.classList.remove('hidden');
  setModeBadge();
  await refreshAdminData();
}

async function loginWithSupabase(email, password) {
  if (!supabaseClient) return false;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setStatus('adminLoginStatus', error.message || 'No se pudo iniciar sesión.', 'error');
    return false;
  }

  adminState.mode = 'supabase';
  adminState.user = data.user;
  writeStorage(STORAGE_KEYS.adminSession, { mode: 'supabase' });
  return true;
}

function loginLocal() {
  adminState.mode = 'local';
  adminState.user = null;
  writeStorage(STORAGE_KEYS.adminSession, { mode: 'local' });
  setStatus('adminLoginStatus', 'Entraste en modo local de prueba.', 'ok');
  showDashboard();
}

async function setupAuth() {
  const savedSession = readStorage(STORAGE_KEYS.adminSession, null);

  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.user) {
      adminState.mode = 'supabase';
      adminState.user = data.session.user;
      await showDashboard();
      return;
    }
  }

  if (savedSession?.mode === 'local') {
    adminState.mode = 'local';
    showDashboard();
  }

  $('adminLoginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = $('adminEmail')?.value.trim();
    const password = $('adminPassword')?.value || '';

    if (supabaseClient && email && password) {
      const ok = await loginWithSupabase(email, password);
      if (ok) {
        setStatus('adminLoginStatus', '', '');
        showDashboard();
      }
      return;
    }

    setStatus('adminLoginStatus', 'Completa correo y contraseña o usa modo local.', 'error');
  });

  $('showLocalAccess')?.addEventListener('click', loginLocal);

  $('logoutAdmin')?.addEventListener('click', async () => {
    if (supabaseClient && adminState.mode === 'supabase') {
      await supabaseClient.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEYS.adminSession);
    window.location.reload();
  });
}

function setupProducts() {
  $('productForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = $('productTitle')?.value.trim();
    const description = $('productDescription')?.value.trim();
    const price = Number($('productPrice')?.value || 0);
    const image = $('productImage')?.value || '/images/hero-fresas.svg';
    const category = $('productCategory')?.value || 'fresas';

    if (!title || !description || price <= 0) {
      setStatus('adminProductStatus', 'Completa nombre, descripción y precio válido.', 'error');
      return;
    }

    adminState.activeMenu.push(
      normalizeProduct({
        id: crypto.randomUUID(),
        title,
        description,
        price,
        image,
        category,
        active: true
      })
    );

    await persistMenu();
    $('productForm')?.reset();
  });

  $('resetProducts')?.addEventListener('click', async () => {
    adminState.activeMenu = [...adminState.baseMenu].map(normalizeProduct);

    if (adminState.mode === 'supabase' && supabaseClient) {
      const { error: deleteError } = await supabaseClient
        .from('products')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        setStatus('adminProductStatus', 'No se pudo restaurar la base.', 'error');
        return;
      }
    }

    await persistMenu();
    setStatus('adminProductStatus', 'Se restauró el menú base.', 'ok');
  });
}

function setupOrders() {
  $('clearOrders')?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEYS.orders);
    loadOrders().then(() => {
      renderOrders();
      updateSummary();
    });
  });

  $('orderStatusFilter')?.addEventListener('change', (event) => {
    adminState.orderFilter = event.target.value;
    renderOrders();
  });

  $('syncAdminData')?.addEventListener('click', refreshAdminData);
}

async function refreshAdminData() {
  await Promise.all([loadOrders(), loadMenu()]);
  setModeBadge();
  updateSummary();
  renderOrders();
  renderProducts();
}

async function initAdmin() {
  const contentRes = await fetch('/data/site-content.json');
  if (!contentRes.ok) throw new Error('No se pudo cargar el menú base.');

  const content = await contentRes.json();
  adminState.baseMenu = safeArray(content.menu).map(normalizeProduct);

  setupProducts();
  setupOrders();
  await setupAuth();
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.orders) {
    loadOrders().then(() => {
      renderOrders();
      updateSummary();
    });
  }

  if (event.key === STORAGE_KEYS.menu) {
    loadMenu().then(() => {
      renderProducts();
      updateSummary();
    });
  }
});

initAdmin().catch((error) => {
  console.error(error);
  setStatus('adminLoginStatus', 'No se pudo cargar el panel.', 'error');
});
