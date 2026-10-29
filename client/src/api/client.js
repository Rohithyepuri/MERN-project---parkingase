const TOKEN_KEY = 'parkease.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Cannot reach the ParkEase API. Is the server running?', 0, 'network_error');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = data?.error?.message || `Request failed with status ${response.status}`;
    const code = data?.error?.code || 'request_failed';
    if (response.status === 401 && auth) {
      setToken(null);
      window.dispatchEvent(new CustomEvent('parkease:unauthorized'));
    }
    throw new ApiError(message, response.status, code, data?.error?.details);
  }

  return data;
}

export async function download(path) {
  const token = getToken();
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = 'Download failed';
    try {
      const data = await response.json();
      message = data?.error?.message || message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, response.status, 'download_failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || 'parkease-export.csv';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
