const STORAGE_KEYS = {
  menu: 'kfresita_menu_override',
  orders: 'kfresita_orders',
  adminSession: 'kfresita_admin_session'
};

const state = {
  config: {},
  content: {},
  dynamicCart: [],
  activeCategory: 'all',
  productsSource: 'local',
  remoteMenu: []
};

const supabaseConfig = window.KFRESITA_SUPABASE || null;
const supabaseClient = (window.supabase && supabaseConfig?.url && supabaseConfig?.anonKey)
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;

function $(id) { return document.getElementById(id); }
function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function safeArray(value) { return Array.isArray(value) ? value : []; }

function setText(id, value, fallback = '') {
  const el = $(id);
  if (el) el.textContent = value ?? fallback;
}

function createTag(text) {
  const span = document.createElement('span');
  span.className = 'tag';
  span.textContent = text;
  return span;
}

function createValueCard(text) {
  const article = document.createElement('article');
  article.className = 'card';
  article.innerHTML = `<p>${text}</p>`;
  return article;
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

function mapCategory(title = '') {
  const text = String(title).toLowerCase();
  if (text.includes('bebida') || text.includes('smoothie') || text.includes('malteada')) return 'bebidas';
  if (text.includes('caja') || text.includes('regalo')) return 'regalos';
  if (text.includes('arreglo') || text.includes('especial')) return 'especiales';
  return 'fresas';
}

function normalizeProduct(item = {}) {
  return {
    id: item.id || item.product_id || crypto.randomUUID(),
    title: item.title || item.name || 'Producto',
    description: item.description || '',
    price: Number(item.price || 0),
    image: item.image || '/images/hero-fresas.svg',
    category: item.category || mapCategory(item.title || item.name || ''),
    active: item.active !== false
  };
}

function getActiveMenu() {
  if (safeArray(state.remoteMenu).length) {
    return state.remoteMenu
      .map(normalizeProduct)
      .filter((item) => item.active !== false);
  }

  const overrideMenu = readStorage(STORAGE_KEYS.menu, null);
  if (safeArray(overrideMenu).length) {
    return overrideMenu
      .map(normalizeProduct)
      .filter((item) => item.active !== false);
  }

  return safeArray(state.content.menu)
    .map(normalizeProduct)
    .filter((item) => item.active !== false);
}

function renderValues() {
  const grid = $('valuesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  safeArray(state.content.values).forEach((item) => {
    grid.appendChild(createValueCard(item));
  });
}

function renderToppings() {
  const list = $('toppingsList');
  if (!list) return;
  list.innerHTML = '';
  safeArray(state.content.toppings).forEach((item) => {
    list.appendChild(createTag(item));
  });
}

function renderHours() {
  const card = $('hoursCard');
  if (!card) return;
  card.innerHTML = '';
  safeArray(state.content.hours).forEach((item) => {
    const row = document.createElement('div');
    row.className = 'hours-row';
    row.innerHTML = `<span class="hours-day">${item.day || ''}</span><span class="hours-time">${item.time || ''}</span>`;
    card.appendChild(row);
  });
}

function renderMenu() {
  const grid = $('menuGrid');
  if (!grid) return;

  grid.innerHTML = '';

  getActiveMenu().forEach((item, index) => {
    const article = document.createElement('article');
    article.className = 'menu-card glass-liquid-card';

    const imageSrc = item.image || '/images/hero-fresas.svg';
    const hueClass = `liquid-tone-${(index % 4) + 1}`;

    article.innerHTML = `
      <div class="glass-media ${hueClass}">
        <div class="glass-orb orb-1"></div>
        <div class="glass-orb orb-2"></div>
        <div class="glass-orb orb-3"></div>
        <img src="${imageSrc}" alt="${item.title || 'Producto'}" class="menu-card-image glass-product-image" />
        <div class="glass-price-pill">${money(item.price)}</div>
      </div>
      <div class="menu-card-body glass-body">
        <div class="menu-card-top">
          <h3>${item.title || 'Producto'}</h3>
        </div>
        <p>${item.description || ''}</p>
      </div>
    `;

    grid.appendChild(article);
  });
}

function renderHeroAndContent() {
  const hero = state.content.hero || {};
  const about = state.content.about || {};

  setText('heroBadge', hero.badge, 'Explosión de sabores');
  setText('heroTitle', hero.title, 'Fresas con chocolate que enamoran desde la primera compra.');
  setText('heroDescription', hero.description, 'K-Fresita es una propuesta premium de fresas con chocolate.');
  setText('aboutTitle', about.title, 'Una experiencia premium, accesible y memorable.');
  setText('aboutDescription', about.description, 'K-Fresita busca cautivar a sus consumidores desde la primera compra.');
  setText('missionText', state.content.mission, '');
  setText('visionText', state.content.vision, '');
  setText('contactText', state.content.contactText, '');
  setText('contactEmail', state.config.email, '');
  setText('contactPhone', state.config.phone, '');
  setText('contactModel', state.config.model, '');

  const brand = document.querySelector('.brand');
  if (brand && state.config.brandName) brand.textContent = state.config.brandName;

  const ctaButton = $('ctaButton');
  if (ctaButton && state.config.ctaText) ctaButton.textContent = state.config.ctaText;

  renderValues();
  renderMenu();
  renderToppings();
  renderHours();
}

function renderDynamicOrderProducts() {
  const grid = $('dynamicOrderGrid');
  if (!grid) return;

  const allProducts = getActiveMenu();
  const filtered = allProducts.filter((item) =>
    state.activeCategory === 'all'
      ? true
      : item.category === state.activeCategory || mapCategory(item.title) === state.activeCategory
  );

  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = `
      <article class="panel">
        <p class="empty-cart">No hay productos disponibles en esta categoría.</p>
      </article>
    `;
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'order-product-card';

    const imageSrc = item.image || '/images/hero-fresas.svg';

    card.innerHTML = `
      <div class="order-product-media">
        <img src="${imageSrc}" alt="${item.title || 'Producto'}">
      </div>

      <div class="order-product-content">
        <h3>${item.title || 'Producto'}</h3>
        <p class="order-product-description">${item.description || ''}</p>

        <div class="order-product-bottom">
          <strong>${money(item.price)}</strong>

          <div class="order-product-actions compact-actions">
            <button type="button" class="qty-btn qty-minus">−</button>
            <span class="qty-display">0</span>
            <button type="button" class="qty-btn qty-plus">+</button>
          </div>
        </div>
      </div>
    `;

    const qtyDisplay = card.querySelector('.qty-display');
    const plusBtn = card.querySelector('.qty-plus');
    const minusBtn = card.querySelector('.qty-minus');

    function getCartItem() {
      return state.dynamicCart.find((product) => product.id === item.id);
    }

    function syncQtyUI() {
      const cartItem = getCartItem();
      qtyDisplay.textContent = String(cartItem ? cartItem.quantity : 0);
    }

    plusBtn?.addEventListener('click', () => {
      const existing = getCartItem();
      if (existing) {
        existing.quantity += 1;
      } else {
        state.dynamicCart.push({ ...item, quantity: 1 });
      }
      syncQtyUI();
      renderCart();
    });

    minusBtn?.addEventListener('click', () => {
      const existing = getCartItem();
      if (!existing) return;

      existing.quantity -= 1;

      if (existing.quantity <= 0) {
        state.dynamicCart = state.dynamicCart.filter((product) => product.id !== item.id);
      }

      syncQtyUI();
      renderCart();
    });

    syncQtyUI();
    grid.appendChild(card);
  });
}

function getDeliveryFee() {
  const mode = $('deliveryMode')?.value || 'domicilio';
  return mode === 'domicilio' ? 35 : 0;
}

function renderCart() {
  const list = $('cartItems');
  const count = $('cartCount');
  const subtotalEl = $('cartSubtotal');
  const deliveryEl = $('cartDelivery');
  const totalEl = $('cartTotal');

  if (!list || !count || !subtotalEl || !deliveryEl || !totalEl) return;

  list.innerHTML = '';

  if (!state.dynamicCart.length) {
    list.innerHTML = '<p class="empty-cart">Aún no agregas productos.</p>';
  }

  state.dynamicCart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';

    row.innerHTML = `
      <div class="cart-item-main">
        <strong>${item.title}</strong>
        <p>${money(item.price)} c/u</p>
      </div>

      <div class="cart-item-side">
        <div class="cart-qty-controls">
          <button type="button" class="qty-btn cart-minus">−</button>
          <span class="qty-display">${item.quantity}</span>
          <button type="button" class="qty-btn cart-plus">+</button>
        </div>
        <strong>${money(item.quantity * item.price)}</strong>
      </div>
    `;

    row.querySelector('.cart-plus')?.addEventListener('click', () => {
      item.quantity += 1;
      renderCart();
      renderDynamicOrderProducts();
    });

    row.querySelector('.cart-minus')?.addEventListener('click', () => {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        state.dynamicCart = state.dynamicCart.filter((product) => product.id !== item.id);
      }
      renderCart();
      renderDynamicOrderProducts();
    });

    list.appendChild(row);
  });

  const subtotal = state.dynamicCart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const delivery = getDeliveryFee();

  count.textContent = `${state.dynamicCart.reduce((sum, item) => sum + Number(item.quantity), 0)} productos`;
  subtotalEl.textContent = money(subtotal);
  deliveryEl.textContent = money(delivery);
  totalEl.textContent = money(subtotal + delivery);
}

function setupCategoryPills() {
  document.querySelectorAll('#categoryPills .pill').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeCategory = button.dataset.category || 'all';
      document.querySelectorAll('#categoryPills .pill').forEach((pill) => pill.classList.remove('active'));
      button.classList.add('active');
      renderDynamicOrderProducts();
    });
  });
}

async function saveOrder(orderPayload) {
  if (!supabaseClient) {
    const currentOrders = safeArray(readStorage(STORAGE_KEYS.orders, []));
    currentOrders.unshift(orderPayload);
    writeStorage(STORAGE_KEYS.orders, currentOrders);
    return { mode: 'local' };
  }

  const dbOrder = {
    customer_name: orderPayload.customerName,
    customer_phone: orderPayload.customerPhone,
    delivery_mode: orderPayload.deliveryMode,
    delivery_address: orderPayload.deliveryAddress,
    delivery_when: orderPayload.deliveryWhen,
    delivery_date: orderPayload.deliveryDate || null,
    delivery_time: orderPayload.deliveryTime || null,
    notes: orderPayload.notes,
    subtotal: orderPayload.subtotal,
    delivery_fee: orderPayload.deliveryFee,
    total: orderPayload.total,
    status: orderPayload.status,
    items: orderPayload.items
  };

  const { error } = await supabaseClient.from('orders').insert(dbOrder);

  if (error) {
    console.error('Error guardando pedido en Supabase', error);
    const currentOrders = safeArray(readStorage(STORAGE_KEYS.orders, []));
    currentOrders.unshift(orderPayload);
    writeStorage(STORAGE_KEYS.orders, currentOrders);
    return { mode: 'fallback-local', error };
  }

  return { mode: 'supabase' };
}

async function submitWhatsAppOrder() {
  const status = $('orderStatus');

  if (!state.dynamicCart.length) {
    status.textContent = 'Agrega al menos un producto antes de enviar.';
    status.className = 'status error';
    return;
  }

  const customerName = $('customerName')?.value.trim() || 'Cliente';
  const customerPhone = $('customerPhone')?.value.trim() || '';
  const deliveryAddress = $('deliveryAddress')?.value.trim() || 'Sin dirección';
  const deliveryMode = $('deliveryMode')?.value || 'domicilio';
  const deliveryWhen = $('deliveryWhen')?.value || 'ahora';
  const deliveryDate = $('deliveryDate')?.value || '';
  const deliveryTime = $('deliveryTime')?.value || '';
  const notes = $('orderNotes')?.value.trim() || '';

  const subtotal = state.dynamicCart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;
  const orderId = `KF-${Date.now().toString().slice(-8)}`;

  const payload = {
    id: orderId,
    createdAt: new Date().toISOString(),
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryMode,
    deliveryWhen,
    deliveryDate,
    deliveryTime,
    notes,
    subtotal,
    deliveryFee,
    total,
    status: 'nuevo',
    items: state.dynamicCart.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
      category: item.category
    }))
  };

  const saveResult = await saveOrder(payload);
  const phoneNumber = String(state.config.whatsapp || '').replace(/\D/g, '');

  const lines = [
    'Hola, quiero hacer un pedido en K-Fresita.',
    `Pedido: ${orderId}`,
    `Cliente: ${customerName}`,
    `Teléfono: ${customerPhone || 'No proporcionado'}`,
    `Entrega: ${deliveryMode} - ${deliveryAddress}`,
    `Horario: ${deliveryWhen}${deliveryDate ? ` / ${deliveryDate}` : ''}${deliveryTime ? ` ${deliveryTime}` : ''}`,
    '',
    'Productos:'
  ];

  state.dynamicCart.forEach((item) => {
    lines.push(`- ${item.title} x${item.quantity} (${money(item.price * item.quantity)})`);
  });

  lines.push('', `Subtotal: ${money(subtotal)}`, `Envío: ${money(deliveryFee)}`, `Total: ${money(total)}`);
  if (notes) lines.push(`Notas: ${notes}`);

  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url, '_blank');

  status.textContent = saveResult.mode === 'supabase'
    ? 'Tu pedido quedó guardado en la base de datos y se abrió WhatsApp para confirmarlo.'
    : 'Tu pedido se guardó en modo local y se abrió WhatsApp para confirmarlo.';
  status.className = 'status ok';

  state.dynamicCart = [];
  renderCart();
  renderDynamicOrderProducts();
}

function setupDynamicOrderExperience() {
  if (!$('dynamicOrderGrid')) return;

  renderDynamicOrderProducts();
  renderCart();
  setupCategoryPills();

  $('deliveryMode')?.addEventListener('change', renderCart);

  $('clearCart')?.addEventListener('click', () => {
    state.dynamicCart = [];
    renderCart();
    renderDynamicOrderProducts();
  });

  $('submitDynamicOrder')?.addEventListener('click', submitWhatsAppOrder);
}

async function syncProductsFromSupabase() {
  if (!supabaseClient) return false;

  const { data, error } = await supabaseClient
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('No se pudieron cargar productos remotos', error);
    return false;
  }

  if (Array.isArray(data)) {
    state.remoteMenu = data.map(normalizeProduct);
    writeStorage(STORAGE_KEYS.menu, state.remoteMenu);
    state.productsSource = 'supabase';
    return true;
  }

  state.remoteMenu = [];
  return false;
}

async function loadSite() {
  const [configRes, contentRes] = await Promise.all([
    fetch('/data/config.json'),
    fetch('/data/site-content.json')
  ]);

  if (!configRes.ok || !contentRes.ok) {
    throw new Error('No se pudo cargar la configuración del sitio.');
  }

  state.config = await configRes.json();
  state.content = await contentRes.json();

  await syncProductsFromSupabase();

  renderHeroAndContent();
  setupDynamicOrderExperience();
  renderMenu();
  renderDynamicOrderProducts();
  renderCart();
}

function showLoadError() {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <section class="section">
      <div class="container">
        <article class="panel">
          <h2>No se pudo cargar el sitio.</h2>
          <p>Revisa que existan /data/config.json, /data/site-content.json y la carpeta /images.</p>
        </article>
      </div>
    </section>
  `;
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEYS.menu) {
    renderMenu();
    renderDynamicOrderProducts();
    renderCart();
  }
});

loadSite().catch((error) => {
  console.error(error);
  showLoadError();
});
