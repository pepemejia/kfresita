const STORAGE_KEYS = {
  menu: 'kfresita_menu_override',
  orders: 'kfresita_orders',
  adminSession: 'kfresita_admin_session'
};

const adminState = {
  mode: 'local',
  user: null,
  orders: [],
  baseMenu: [],
  activeMenu: [],
  orderFilter: 'all',
  uploadedImageData: ''
};

const supabaseConfig = window.KFRESITA_SUPABASE || null;
const supabaseClient = (window.supabase && supabaseConfig?.url && supabaseConfig?.anonKey)
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

function $(id) { return document.getElementById(id); }
function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function safeArray(value) { return Array.isArray(value) ? value : []; }

function setStatus(id, message, type = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

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

function normalizeOrder(order = {}) {
  return {
    id: order.id || crypto.randomUUID(),
    createdAt: order.createdAt || order.created_at || new Date().toISOString(),
    customerName: order.customerName || order.customer_name || 'Cliente',
    customerPhone: order.customerPhone || order.customer_phone || '',
    deliveryMode: order.deliveryMode || order.delivery_mode || 'domicilio',
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

function normalizeProduct(item = {}) {
  return {
    id: item.id || crypto.randomUUID(),
    title: item.title || item.name || 'Producto',
    description: item.description || '',
    price: Number(item.price || 0),
    image: item.image || '/images/hero-fresas.svg',
    category: item.category || 'fresas',
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

function resetImagePreview() {
  adminState.uploadedImageData = '';
  const previewWrap = $('productImagePreviewWrap');
  const preview = $('productImagePreview');
  const input = $('productImageFile');

  if (preview) preview.src = '';
  if (previewWrap) previewWrap.classList.add('hidden');
  if (input) input.value = '';
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function setupImageUpload() {
  const input = $('productImageFile');
  if (!input) return;

  input.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      resetImagePreview();
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setStatus('adminProductStatus', 'Formato no válido. Usa JPG, PNG o WEBP.', 'error');
      resetImagePreview();
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      setStatus('adminProductStatus', 'La imagen pesa demasiado. Usa una menor a 2 MB.', 'error');
      resetImagePreview();
      return;
    }

    try {
      const dataUrl = await readFileAsDataURL(file);
      adminState.uploadedImageData = dataUrl;

      const preview = $('productImagePreview');
      const previewWrap = $('productImagePreviewWrap');

      if (preview) preview.src = dataUrl;
      if (previewWrap) previewWrap.classList.remove('hidden');

      setStatus('adminProductStatus', 'Imagen cargada correctamente.', 'ok');
    } catch (error) {
      console.error(error);
      setStatus('adminProductStatus', 'No se pudo procesar la imagen.', 'error');
      resetImagePreview();
    }
  });
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
  $('productsCount').textContent = String(adminState.activeMenu.length);
}

function renderOrders() {
  const list = $('ordersList');
  if (!list) return;

  const filtered = adminState.orderFilter === 'all'
    ? adminState.orders
    : adminState.orders.filter((order) => order.status === adminState.orderFilter);

  list.innerHTML = '';

  if (!filtered.length) {
    list.innerHTML = '<p class="empty-cart">No hay pedidos para mostrar.</p>';
    return;
  }

  filtered.forEach((order) => {
    const card = document.createElement('article');
    card.className = 'panel admin-order-card';

    const itemsHtml = safeArray(order.items)
      .map((item) => `<li>${item.title} x${item.quantity} · ${money(Number(item.price) * Number(item.quantity))}</li>`)
      .join('');

    card.innerHTML = `
      <div class="order-admin-head">
        <div>
          <strong>${order.customerName}</strong>
          <p>${new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <select class="admin-status-select" data-order-id="${order.id}">
          <option value="nuevo" ${order.status === 'nuevo' ? 'selected' : ''}>Nuevo</option>
          <option value="en_proceso" ${order.status === 'en_proceso' ? 'selected' : ''}>En proceso</option>
          <option value="listo" ${order.status === 'listo' ? 'selected' : ''}>Listo</option>
          <option value="entregado" ${order.status === 'entregado' ? 'selected' : ''}>Entregado</option>
        </select>
      </div>

      <div class="order-admin-body">
        <p><strong>Tel:</strong> ${order.customerPhone || 'No proporcionado'}</p>
        <p><strong>Entrega:</strong> ${order.deliveryMode} · ${order.deliveryAddress}</p>
        <p><strong>Horario:</strong> ${order.deliveryWhen}${order.deliveryDate ? ` / ${order.deliveryDate}` : ''}${order.deliveryTime ? ` ${order.deliveryTime}` : ''}</p>
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

async function updateOrderStatus(orderId, nextStatus) {
  adminState.orders = adminState.orders.map((order) =>
    order.id === orderId ? { ...order, status: nextStatus } : order
  );

  if (adminState.mode === 'supabase' && supabaseClient) {
    const { error } = await supabaseClient
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId);

    if (error) {
      console.error(error);
      setStatus('adminProductStatus', 'No se pudo actualizar el pedido.', 'error');
      return;
    }
  } else {
    writeStorage(STORAGE_KEYS.orders, adminState.orders);
  }

  renderOrders();
  updateSummary();
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

function loginLocal() {
  adminState.mode = 'local';
  adminState.user = { email: 'modo-local@kfresita.app' };
  writeStorage(STORAGE_KEYS.adminSession, { mode: 'local' });
  showDashboard();
}

async function loginWithSupabase(email, password) {
  if (!supabaseClient) {
    setStatus('adminLoginStatus', 'Supabase no está configurado. Usa modo local.', 'error');
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    console.error(error);
    setStatus('adminLoginStatus', 'No se pudo iniciar sesión.', 'error');
    return;
  }

  adminState.mode = 'supabase';
  adminState.user = data.user || null;
  writeStorage(STORAGE_KEYS.adminSession, {
    mode: 'supabase',
    email: adminState.user?.email || email
  });

  await showDashboard();
}

async function setupAuth() {
  const session = readStorage(STORAGE_KEYS.adminSession, null);

  if (session?.mode === 'local') {
    adminState.mode = 'local';
    adminState.user = { email: 'modo-local@kfresita.app' };
    await showDashboard();
    return;
  }

  if (session?.mode === 'supabase' && supabaseClient) {
    const { data } = await supabaseClient.auth.getUser();
    if (data?.user) {
      adminState.mode = 'supabase';
      adminState.user = data.user;
      await showDashboard();
      return;
    }
  }

  $('adminLoginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = $('adminEmail')?.value.trim();
    const password = $('adminPassword')?.value.trim();

    if (email && password) {
      await loginWithSupabase(email, password);
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
    const category = $('productCategory')?.value || 'fresas';
    const image = adminState.uploadedImageData || '/images/hero-fresas.svg';

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
    resetImagePreview();
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

async function showDashboard() {
  $('adminLoginPanel')?.classList.add('hidden');
  $('adminDashboard')?.classList.remove('hidden');
  setModeBadge();
  await refreshAdminData();
}

async function initAdmin() {
  const contentRes = await fetch('/data/site-content.json');
  if (!contentRes.ok) throw new Error('No se pudo cargar el menú base.');

  const content = await contentRes.json();
  adminState.baseMenu = safeArray(content.menu).map(normalizeProduct);

  setupImageUpload();
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
  setStatus('adminLoginStatus', 'No se pudo iniciar el panel administrativo.', 'error');
});
