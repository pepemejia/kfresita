const productsEditor = document.getElementById('productsEditor');
const saveContentButton = document.getElementById('saveContentButton');
const addProductButton = document.getElementById('addProductButton');
const refreshOrdersButton = document.getElementById('refreshOrdersButton');
const refreshSalesButton = document.getElementById('refreshSalesButton');
const contentStatus = document.getElementById('contentStatus');
const ordersList = document.getElementById('ordersList');
const salesList = document.getElementById('salesList');
const logoutButton = document.getElementById('logoutButton');

let currentContent = null;

function productEditorItem(item = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'editor-card';
  wrapper.innerHTML = `
    <label>Título<input type="text" class="product-title" value="${item.title || ''}" /></label>
    <label>Descripción<textarea class="product-description">${item.description || ''}</textarea></label>
    <label>Precio<input type="number" min="0" step="0.01" class="product-price" value="${Number(item.price || 0)}" /></label>
    <label>Imagen<input type="text" class="product-image" value="${item.image || ''}" placeholder="./images/archivo.svg" /></label>
    <button type="button" class="button outline remove-product">Eliminar</button>
  `;
  wrapper.querySelector('.remove-product').addEventListener('click', () => wrapper.remove());
  return wrapper;
}

async function loadContent() {
  const res = await fetch('/api/content');
  const content = await res.json();
  currentContent = content;
  productsEditor.innerHTML = '';
  (content.menu || []).forEach((item) => productsEditor.appendChild(productEditorItem(item)));
}

function collectMenu() {
  return [...productsEditor.querySelectorAll('.editor-card')].map((card) => ({
    title: card.querySelector('.product-title').value.trim(),
    description: card.querySelector('.product-description').value.trim(),
    price: Number(card.querySelector('.product-price').value || 0),
    image: card.querySelector('.product-image').value.trim()
  })).filter((item) => item.title);
}

async function saveContent() {
  contentStatus.textContent = 'Guardando cambios...';
  contentStatus.className = 'status';
  try {
    const payload = { ...currentContent, menu: collectMenu() };
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'No se pudo guardar el contenido.');
    contentStatus.textContent = 'Contenido actualizado correctamente.';
    contentStatus.className = 'status ok';
    currentContent = payload;
  } catch (error) {
    contentStatus.textContent = error.message;
    contentStatus.className = 'status error';
  }
}

function orderCard(order) {
  const article = document.createElement('article');
  article.className = 'admin-item';
  article.innerHTML = `
    <div class="admin-item-head">
      <strong>${order.customerName}</strong>
      <span>$${Number(order.total || 0).toFixed(2)}</span>
    </div>
    <p>${order.product} · ${order.quantity} pza(s)</p>
    <p>${order.phone}</p>
    <p>${order.deliveryDate || 'Sin fecha'} ${order.deliveryTime || ''}</p>
    <p>${order.notes || 'Sin notas'}</p>
    <div class="inline-actions">
      <select class="order-status">
        ${['nuevo','preparando','listo','entregado','cancelado'].map((status) => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
      <button class="button gold save-order-status" type="button">Guardar estado</button>
    </div>
  `;
  article.querySelector('.save-order-status').addEventListener('click', async () => {
    const status = article.querySelector('.order-status').value;
    const res = await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const result = await res.json();
    if (!res.ok) {
      alert(result.error || 'No se pudo actualizar el pedido.');
      return;
    }
    loadOrders();
    loadSales();
  });
  return article;
}

async function loadOrders() {
  const res = await fetch('/api/orders');
  const orders = await res.json();
  ordersList.innerHTML = '';
  if (!orders.length) {
    ordersList.innerHTML = '<p class="empty">Aún no hay pedidos.</p>';
    return;
  }
  orders.forEach((order) => ordersList.appendChild(orderCard(order)));
}

async function loadSales() {
  const res = await fetch('/api/sales');
  const sales = await res.json();
  salesList.innerHTML = '';
  if (!sales.length) {
    salesList.innerHTML = '<p class="empty">Aún no hay ventas registradas.</p>';
    return;
  }
  sales.forEach((sale) => {
    const article = document.createElement('article');
    article.className = 'admin-item';
    article.innerHTML = `
      <div class="admin-item-head">
        <strong>${sale.customerName}</strong>
        <span>$${Number(sale.total || 0).toFixed(2)}</span>
      </div>
      <p>${sale.product} · ${sale.quantity} pza(s)</p>
      <p>${new Date(sale.date).toLocaleString()}</p>
    `;
    salesList.appendChild(article);
  });
}

saveContentButton?.addEventListener('click', saveContent);
addProductButton?.addEventListener('click', () => productsEditor.appendChild(productEditorItem()));
refreshOrdersButton?.addEventListener('click', loadOrders);
refreshSalesButton?.addEventListener('click', loadSales);
logoutButton?.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin-login';
});

Promise.all([loadContent(), loadOrders(), loadSales()]).catch(() => {
  document.body.innerHTML = '<main style="padding:24px;font-family:Arial,sans-serif;">No se pudo cargar el panel.</main>';
});
