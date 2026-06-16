// Token storage + a one-time fetch wrapper that attaches the Bearer token to
// every /api request and signals a logout on any 401.
const TOKEN_KEY = 'cd_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export function installAuthFetch() {
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const isApi = url.includes('/api/');
    const token = getToken();
    if (isApi && token) {
      init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } };
    }
    const res = await orig(input, init);
    if (res.status === 401 && isApi && !url.includes('/api/auth/login')) {
      clearToken();
      window.dispatchEvent(new Event('cd-unauthorized'));
    }
    return res;
  };
}
