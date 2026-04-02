const state = {
  config: {},
  content: {},
  dynamicCart: [],
  activeCategory: 'all'
};
function $(id) { return document.getElementById(id); }
function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function setText(id, value, fallback = '') { const el = $(id); if (el) el.textContent = value ?? fallback; }
function createTag(text) { const span = document.createElement('span'); span.className = 'tag'; span.textContent = text; return span; }
function createValueCard(text) { const article = document.createElement('article'); article.className = 'card'; article.innerHTML = `<p>${text}</p>`; return article; }
function renderValues() { const grid = $('valuesGrid'); if (!grid) return; grid.innerHTML = ''; safeArray(state.content.values).forEach((item) => grid.appendChild(createValueCard(item))); }
function renderToppings() { const list = $('toppingsList'); if (!list) return; list.innerHTML = ''; safeArray(state.content.toppings).forEach((item) => list.appendChild(createTag(item))); }
function renderHours() { const card = $('hoursCard'); if (!card) return; card.innerHTML = ''; safeArray(state.content.hours).forEach((item) => { const row = document.createElement('div'); row.className = 'hours-row'; row.innerHTML = `<span class="hours-day">${item.day || ''}</span><span class="hours-time">${item.time || ''}</span>`; card.appendChild(row); }); }
function mapCategory(title = '') { const text = String(title).toLowerCase(); if (text.includes('bebida')) return 'bebidas'; if (text.includes('caja') || text.includes('regalo')) return 'regalos'; if (text.includes('arreglo') || text.includes('especial')) return 'especiales'; return 'fresas'; }
function renderMenu() {
  const grid = $('menuGrid'); if (!grid) return; grid.innerHTML = '';
  safeArray(state.content.menu).forEach((item, index) => {
    const article = document.createElement('article'); article.className = 'menu-card glass-liquid-card';
    const imageSrc = item.image || '/images/hero-fresas.svg'; const hueClass = `liquid-tone-${(index % 4) + 1}`;
    article.innerHTML = `<div class="glass-media ${hueClass}"><div class="glass-orb orb-1"></div><div class="glass-orb orb-2"></div><div class="glass-orb orb-3"></div><img src="${imageSrc}" alt="${item.title || 'Producto'}" class="menu-card-image glass-product-image" /><div class="glass-price-pill">${money(item.price)}</div></div><div class="menu-card-body glass-body"><div class="menu-card-top"><h3>${item.title || 'Producto'}</h3></div><p>${item.description || ''}</p></div>`;
    grid.appendChild(article);
  });
}
function renderHeroAndContent() {
  const hero = state.content.hero || {}; const about = state.content.about || {};
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
  const brand = document.querySelector('.brand'); if (brand && state.config.brandName) brand.textContent = state.config.brandName;
  const ctaButton = $('ctaButton'); if (ctaButton && state.config.ctaText) ctaButton.textContent = state.config.ctaText;
  renderValues(); renderMenu(); renderToppings(); renderHours();
}
function renderDynamicOrderProducts() {
  const grid = $('dynamicOrderGrid'); if (!grid) return;
  const allProducts = safeArray(state.content.menu); const filtered = allProducts.filter((item) => state.activeCategory === 'all' ? true : mapCategory(item.title) === state.activeCategory);
  grid.innerHTML = '';
  filtered.forEach((item) => {
    const card = document.createElement('article'); card.className = 'order-product-card';
    const safeTitle = (item.title || 'Producto').replace(/\s+/g, '_'); const qtyId = `qty_${safeTitle}_${Math.random().toString(36).slice(2, 6)}`; const imageSrc = item.image || '/images/hero-fresas.svg';
    card.innerHTML = `<img src="${imageSrc}" alt="${item.title || 'Producto'}"><div class="order-product-body"><div class="order-product-top"><div><h3>${item.title || 'Producto'}</h3><p>${item.description || ''}</p></div><strong>${money(item.price)}</strong></div><div class="product-actions"><div class="qty-stepper"><button type="button" class="qty-btn" data-action="minus" data-target="${qtyId}">−</button><span id="${qtyId}" class="qty-value">0</span><button type="button" class="qty-btn" data-action="plus" data-target="${qtyId}">+</button></div><button type="button" class="add-cart-btn" data-title="${item.title || 'Producto'}" data-qty-target="${qtyId}">Agregar</button></div></div>`;
    grid.appendChild(card);
  });
  grid.querySelectorAll('.qty-stepper button').forEach((btn) => { btn.addEventListener('click', () => { const target = $(btn.dataset.target); if (!target) return; const current = Number(target.textContent || 0); target.textContent = btn.dataset.action === 'plus' ? String(current + 1) : String(Math.max(0, current - 1)); }); });
  grid.querySelectorAll('.add-cart-btn').forEach((btn) => { btn.addEventListener('click', () => { const product = safeArray(state.content.menu).find((item) => item.title === btn.dataset.title); if (!product) return; const qtyEl = $(btn.dataset.qtyTarget); const qty = Number(qtyEl?.textContent || 0); if (qty <= 0) return; addToCart(product, qty); qtyEl.textContent = '0'; }); });
}
function addToCart(item, qty) { const found = state.dynamicCart.find((line) => line.title === item.title); if (found) { found.quantity += qty; } else { state.dynamicCart.push({ title: item.title || 'Producto', price: Number(item.price || 0), quantity: qty }); } renderCart(); }
function renderCart() {
  const cartItems = $('cartItems'); const cartCount = $('cartCount'); const subtotalEl = $('cartSubtotal'); const deliveryEl = $('cartDelivery'); const totalEl = $('cartTotal');
  if (!cartItems || !cartCount || !subtotalEl || !deliveryEl || !totalEl) return;
  const subtotal = state.dynamicCart.reduce((sum, item) => sum + item.price * item.quantity, 0); const deliveryMode = $('deliveryMode')?.value || 'domicilio'; const deliveryFee = state.dynamicCart.length === 0 ? 0 : deliveryMode === 'domicilio' ? 35 : 0; const total = subtotal + deliveryFee; const count = state.dynamicCart.reduce((sum, item) => sum + item.quantity, 0);
  cartItems.innerHTML = '';
  if (!state.dynamicCart.length) { cartItems.innerHTML = `<p class="empty-cart">Aún no agregas productos.</p>`; }
  else {
    state.dynamicCart.forEach((item, index) => { const line = document.createElement('div'); line.className = 'cart-line'; line.innerHTML = `<div><strong>${item.title}</strong><small>${item.quantity} × ${money(item.price)}</small></div><div><strong>${money(item.quantity * item.price)}</strong><button type="button" class="remove-line-btn small-btn" data-index="${index}">Quitar</button></div>`; cartItems.appendChild(line); });
    cartItems.querySelectorAll('.remove-line-btn').forEach((btn) => { btn.addEventListener('click', () => { state.dynamicCart.splice(Number(btn.dataset.index), 1); renderCart(); }); });
  }
  cartCount.textContent = `${count} producto${count === 1 ? '' : 's'}`; subtotalEl.textContent = money(subtotal); deliveryEl.textContent = money(deliveryFee); totalEl.textContent = money(total);
}
function setupCategoryPills() { document.querySelectorAll('#categoryPills .pill').forEach((btn) => { btn.addEventListener('click', () => { document.querySelectorAll('#categoryPills .pill').forEach((pill) => pill.classList.remove('active')); btn.classList.add('active'); state.activeCategory = btn.dataset.category || 'all'; renderDynamicOrderProducts(); }); }); }
function submitWhatsAppOrder() {
  const status = $('orderStatus'); if (!status) return;
  if (!state.dynamicCart.length) { status.textContent = 'Agrega al menos un producto.'; status.className = 'status error'; return; }
  const customerName = $('customerName')?.value.trim() || ''; const phone = $('customerPhone')?.value.trim() || '';
  if (!customerName || !phone) { status.textContent = 'Completa nombre y teléfono.'; status.className = 'status error'; return; }
  const subtotal = state.dynamicCart.reduce((sum, item) => sum + item.price * item.quantity, 0); const deliveryMode = $('deliveryMode')?.value || 'domicilio'; const deliveryFee = state.dynamicCart.length === 0 ? 0 : deliveryMode === 'domicilio' ? 35 : 0; const total = subtotal + deliveryFee;
  const phoneNumber = String(state.config.whatsapp || '').replace(/\D/g, '');
  if (!phoneNumber) { status.textContent = 'Falta configurar el WhatsApp en data/config.json.'; status.className = 'status error'; return; }
  const lines = ['*Nuevo pedido K-Fresita*', '', `Nombre: ${customerName}`, `Teléfono: ${phone}`, `Tipo: ${deliveryMode}`, `Horario: ${$('deliveryWhen')?.value || ''}`, `Dirección/punto: ${$('deliveryAddress')?.value || ''}`, `Fecha: ${$('deliveryDate')?.value || ''}`, `Hora: ${$('deliveryTime')?.value || ''}`, '', '*Productos:*', ...state.dynamicCart.map((item) => `- ${item.title} x${item.quantity} = ${money(item.price * item.quantity)}`), '', `Subtotal: ${money(subtotal)}`, `Envío estimado: ${money(deliveryFee)}`, `Total: ${money(total)}`, '', `Notas: ${$('orderNotes')?.value || ''}`];
  const url = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
  window.open(url, '_blank'); status.textContent = 'Se abrió WhatsApp con tu pedido.'; status.className = 'status ok';
}
function setupDynamicOrderExperience() { if (!$('dynamicOrderGrid')) return; renderDynamicOrderProducts(); renderCart(); setupCategoryPills(); $('deliveryMode')?.addEventListener('change', renderCart); $('clearCart')?.addEventListener('click', () => { state.dynamicCart = []; renderCart(); }); $('submitDynamicOrder')?.addEventListener('click', submitWhatsAppOrder); }
async function loadSite() {
  const [configRes, contentRes] = await Promise.all([fetch('/data/config.json'), fetch('/data/site-content.json')]);
  if (!configRes.ok || !contentRes.ok) throw new Error('No se pudo cargar la configuración del sitio.');
  state.config = await configRes.json(); state.content = await contentRes.json(); renderHeroAndContent(); setupDynamicOrderExperience();
}
function showLoadError() { const main = document.querySelector('main'); if (!main) return; main.innerHTML = `<section class="section"><div class="container"><article class="panel"><h2>No se pudo cargar el sitio.</h2><p>Revisa que existan /data/config.json, /data/site-content.json y la carpeta /images.</p></article></div></section>`; }
loadSite().catch((error) => { console.error(error); showLoadError(); });
