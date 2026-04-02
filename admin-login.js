const form = document.getElementById('adminLoginForm');
const codeInput = document.getElementById('adminCode');
const loginStatus = document.getElementById('loginStatus');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Validando...';
  loginStatus.className = 'status';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeInput.value.trim() })
    });
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
    window.location.href = '/admin';
  } catch (error) {
    loginStatus.textContent = error.message;
    loginStatus.className = 'status error';
  }
});
