// همگام‌سازی بین دستگاه‌ها از طریق یک GitHub Gist خصوصی
import { store, mergeData } from './store.js';

const API = 'https://api.github.com';
const FILE = 'finance-panel-data.json';
export const sync = { status: 'off', lastSync: 0, error: '' };
let listeners = new Set(), timer = null, running = null;

export const onSync = (fn) => listeners.add(fn);
function setStatus(status, error = '') {
  sync.status = status; sync.error = error;
  if (status === 'ok') sync.lastSync = Date.now();
  listeners.forEach((fn) => fn(sync));
}

async function gh(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: 'Bearer ' + store.settings.gistToken,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    cache: 'no-store',
  });
  if (!r.ok) {
    const msg = r.status === 401 ? 'توکن نامعتبر است' : r.status === 404 ? 'Gist پیدا نشد' : r.status === 403 ? 'دسترسی توکن کافی نیست' : 'خطای گیت‌هاب ' + r.status;
    throw new Error(msg);
  }
  return r.json();
}

export const enabled = () => !!store.settings.gistToken;

// پیدا کردن Gist قبلی برنامه یا ساخت Gist خصوصی جدید
export async function connect() {
  setStatus('syncing');
  try {
    if (!store.settings.gistId) {
      let found = null;
      for (let page = 1; page <= 5 && !found; page++) {
        const list = await gh(`/gists?per_page=100&page=${page}`);
        found = list.find((g) => g.files && g.files[FILE]);
        if (list.length < 100) break;
      }
      if (found) store.settings.gistId = found.id;
      else {
        const g = await gh('/gists', {
          method: 'POST',
          body: JSON.stringify({ description: 'Finance Panel data (private)', public: false, files: { [FILE]: { content: JSON.stringify(store.data) } } }),
        });
        store.settings.gistId = g.id;
      }
      store.saveSettings();
    }
    await syncNow(true);
  } catch (e) { setStatus('error', e.message); throw e; }
}

async function pull() {
  const g = await gh('/gists/' + store.settings.gistId);
  const f = g.files && g.files[FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
  try { return JSON.parse(text); } catch { return null; }
}
async function push(data) {
  await gh('/gists/' + store.settings.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(data) } } }) });
}

// دریافت → ادغام → ارسال (در صورت تفاوت)
export async function syncNow(force = false) {
  if (!enabled() || !store.settings.gistId) return;
  if (!navigator.onLine && !force) { setStatus('offline'); return; }
  if (running) return running;
  running = (async () => {
    setStatus('syncing');
    try {
      const remote = await pull();
      const merged = mergeData(store.data, remote);
      const mergedStr = JSON.stringify(merged);
      if (mergedStr !== JSON.stringify(store.data)) store.replaceData(merged);
      if (!remote || mergedStr !== JSON.stringify(remote)) await push(merged);
      setStatus('ok');
    } catch (e) { setStatus('error', e.message); }
    finally { running = null; }
  })();
  return running;
}

export function schedulePush() {
  if (!enabled()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 1500);
}

export function startAutoSync() {
  if (enabled() && store.settings.gistId) syncNow();
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  window.addEventListener('online', () => syncNow());
}

export function disconnect() {
  store.settings.gistToken = ''; store.settings.gistId = '';
  store.saveSettings(); setStatus('off');
}
