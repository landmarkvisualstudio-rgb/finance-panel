// وضعیت برنامه: داده‌های همگام‌شونده + تنظیمات محلی هر دستگاه
const DATA_KEY = 'fp.data.v1';
const SETTINGS_KEY = 'fp.settings.v1';

export const DEFAULT_CATEGORIES = ['خوراک', 'رفت‌وآمد', 'قبوض', 'اجاره و مسکن', 'خرید', 'سلامت', 'تفریح', 'آموزش', 'پوشاک', 'بازپرداخت بدهی', 'سایر'];

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === 'object' ? { ...fallback, ...v } : fallback;
  } catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('storage', e); }
}

const emptyData = () => ({
  entries: [],      // {id, kind: expense|income|receivable|debt, amount, reason, category, date, done, linkedId, linkedFrom, updatedAt, deleted}
  purchases: [],    // {id, title, desc, usd, done, linkedId, updatedAt, deleted}
  categories: { list: DEFAULT_CATEGORIES.slice(), updatedAt: 0 },
  history: {},      // {SYMBOL: [[ts, price], ...]}
});

export const store = {
  data: read(DATA_KEY, emptyData()),
  settings: read(SETTINGS_KEY, { theme: 'system', style: 'liquid', brsKey: '', gistToken: '', gistId: '', pinHash: '' }),
  listeners: new Set(),
  on(fn) { this.listeners.add(fn); },
  emit(type) { this.listeners.forEach((fn) => fn(type)); },
  // source: 'local' = تغییر کاربر (باعث ارسال به سرور می‌شود)، 'remote' = دریافت از سرور
  save(source = 'local') { write(DATA_KEY, this.data); this.emit(source); },
  saveSettings() { write(SETTINGS_KEY, this.settings); this.emit('settings'); },
  replaceData(d) { this.data = { ...emptyData(), ...d }; this.save('remote'); },
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const live = (coll) => store.data[coll].filter((x) => !x.deleted);
export const byId = (coll, id) => store.data[coll].find((x) => x.id === id && !x.deleted);

export function upsert(coll, item) {
  item.updatedAt = Date.now();
  const arr = store.data[coll];
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  return item;
}
export function softDelete(coll, id) {
  const it = store.data[coll].find((x) => x.id === id);
  if (it) { it.deleted = true; it.updatedAt = Date.now(); }
}

// ادغام دو نسخه داده: برای هر رکورد، نسخه‌ای که دیرتر ویرایش شده برنده است
function mergeColl(a = [], b = []) {
  const m = new Map();
  for (const x of [...a, ...b]) {
    const cur = m.get(x.id);
    if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) m.set(x.id, x);
  }
  return [...m.values()];
}
function mergeHistory(a = {}, b = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const m = new Map();
    for (const p of [...(a[k] || []), ...(b[k] || [])]) m.set(p[0], p);
    out[k] = compactSeries([...m.values()].sort((x, y) => x[0] - y[0]));
  }
  return out;
}
export function mergeData(a, b) {
  if (!b) return a;
  const ca = a.categories || { list: DEFAULT_CATEGORIES, updatedAt: 0 };
  const cb = b.categories || { list: DEFAULT_CATEGORIES, updatedAt: 0 };
  return {
    entries: mergeColl(a.entries, b.entries),
    purchases: mergeColl(a.purchases, b.purchases),
    categories: (cb.updatedAt || 0) > (ca.updatedAt || 0) ? cb : ca,
    history: mergeHistory(a.history, b.history),
  };
}

// تاریخچه قیمت: ۷ روز اخیر با فاصله ۳۰ دقیقه، قبل‌تر از آن روزی یک نقطه
export function compactSeries(series) {
  const now = Date.now(), week = 7 * 864e5;
  const out = [], seenDay = new Set();
  for (let i = series.length - 1; i >= 0; i--) {
    const p = series[i];
    if (now - p[0] < week) { out.push(p); continue; }
    const day = Math.floor(p[0] / 864e5);
    if (!seenDay.has(day)) { seenDay.add(day); out.push(p); }
  }
  return out.reverse().slice(-1200);
}
export function recordPrice(sym, price, ts = Date.now()) {
  if (!price || !isFinite(price)) return false;
  const s = (store.data.history[sym] ||= []);
  const last = s[s.length - 1];
  if (last && ts - last[0] < 30 * 60e3) return false;
  s.push([ts, price]);
  store.data.history[sym] = compactSeries(s);
  return true;
}
