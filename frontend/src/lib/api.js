const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error(`Cannot connect to the SoloOps backend at ${API_BASE}. Start FastAPI and try again.`);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === 'string') message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((x) => x.msg || JSON.stringify(x)).join('; ');
    } catch { /* response wasn't JSON */ }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response;
}

export async function getHealth() {
  return (await request('/health')).json();
}

export async function getExpenses({ status, limit = 500 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status && status !== 'all') params.set('status', status);
  return (await request(`/expenses?${params.toString()}`)).json();
}

export async function uploadDocuments(files) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  return (await request('/documents', { method: 'POST', body: form })).json();
}

export async function updateExpense(id, payload) {
  return (await request(`/expenses/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })).json();
}

export async function approveExpense(id) {
  return (await request(`/expenses/${id}/approve`, { method: 'POST' })).json();
}

export async function deleteExpense(id) {
  return request(`/expenses/${id}`, { method: 'DELETE' });
}

export function exportCsvUrl() {
  return `${API_BASE}/export.csv`;
}

export function apiBaseUrl() {
  return API_BASE;
}
