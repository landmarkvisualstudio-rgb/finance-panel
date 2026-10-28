// قیمت لحظه‌ای ارز، طلا و شاخص بورس (همه به تومان)
// منبع اصلی: BrsApi.ir (با کلید رایگان) — منبع جایگزین بدون کلید: نوبیتکس + نرخ‌های جهانی
import { store, recordPrice } from './store.js';

export const ASSETS = [
  { sym: 'USD', name: 'دلار آمریکا', short: 'دلار', unit: 'تومان', glyph: '$' },
  { sym: 'EUR', name: 'یورو', short: 'یورو', unit: 'تومان', glyph: '€' },
  { sym: 'GBP', name: 'پوند انگلیس', short: 'پوند', unit: 'تومان', glyph: '£' },
  { sym: 'AED', name: 'درهم امارات', short: 'درهم', unit: 'تومان', glyph: 'د.إ' },
  { sym: 'G18', name: 'طلای ۱۸ عیار (گرم)', short: 'طلا ۱۸', unit: 'تومان', glyph: '۱۸' },
  { sym: 'G24', name: 'طلای ۲۴ عیار (گرم)', short: 'طلا ۲۴', unit: 'تومان', glyph: '۲۴' },
  { sym: 'TEDPIX', name: 'شاخص کل بورس تهران', short: 'شاخص بورس', unit: 'واحد', glyph: 'TSE' },
];

const CACHE_KEY = 'fp.prices.v1';
const OZ = 31.1034768;
export const prices = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || { items: {}, ts: 0 }; } catch { return { items: {}, ts: 0 }; } })();

const num = (v) => {
  if (v == null) return NaN;
  const s = String(v).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\d.\-]/g, '');
  return parseFloat(s);
};
async function getJSON(url, timeout = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ---------- BrsApi ----------
function findIn(arrays, test) {
  for (const arr of arrays) for (const o of arr || []) if (test(o)) return o;
  return null;
}
function brsItem(o) {
  if (!o) return null;
  let price = num(o.price ?? o.value ?? o.p);
  if (/ریال|rial/i.test(o.unit || '')) price /= 10;
  const change = num(o.change_percent ?? o.changePercent ?? o.dp);
  return isFinite(price) && price > 0 ? { price, change: isFinite(change) ? change : null, src: 'BrsApi' } : null;
}
async function fromBrs(key) {
  const out = {};
  const d = await getJSON(`https://BrsApi.ir/Api/Market/Gold_Currency.php?key=${encodeURIComponent(key)}`);
  const arrays = [d.gold, d.currency, d.cryptocurrency, Array.isArray(d) ? d : null];
  const bySym = (s) => findIn(arrays, (o) => String(o.symbol || '').toUpperCase() === s);
  out.USD = brsItem(bySym('USD'));
  out.EUR = brsItem(bySym('EUR'));
  out.GBP = brsItem(bySym('GBP'));
  out.AED = brsItem(bySym('AED'));
  out.G18 = brsItem(bySym('IR_GOLD_18K') || findIn(arrays, (o) => /18/.test(o.name_en || '') && /gold/i.test(o.name_en || '')));
  out.G24 = brsItem(bySym('IR_GOLD_24K') || findIn(arrays, (o) => /24/.test(o.name_en || '') && /gold/i.test(o.name_en || '')));
  try {
    const idx = await getJSON(`https://BrsApi.ir/Api/Tsetmc/Index.php?key=${encodeURIComponent(key)}&type=1`);
    const list = Array.isArray(idx) ? idx : Object.values(idx).find(Array.isArray) || [];
    const o = list.find((x) => /شاخص\s*(کل|كل)/.test(x.name || x.title || '') && !/هم\s*وزن/.test(x.name || '')) || list[0];
    if (o) {
      const v = num(o.index ?? o.value ?? o.last ?? o.close);
      const ch = num(o.index_change_percent ?? o.change_percent ?? o.percent);
      if (isFinite(v)) out.TEDPIX = { price: v, change: isFinite(ch) ? ch : null, src: 'BrsApi' };
    }
  } catch (e) { console.warn('TEDPIX', e); }
  return out;
}

// ---------- منبع جایگزین بدون کلید ----------
async function fromPublic() {
  const out = {};
  const nb = await getJSON('https://api.nobitex.ir/market/stats?srcCurrency=usdt,paxg&dstCurrency=rls');
  const st = nb.stats || {};
  const usdt = st['usdt-rls'], paxg = st['paxg-rls'];
  const usd = usdt ? num(usdt.latest) / 10 : NaN;
  if (isFinite(usd)) out.USD = { price: usd, change: num(usdt.dayChange), src: 'نوبیتکس (تتر)', approx: true };
  if (paxg) {
    const g24 = num(paxg.latest) / 10 / OZ;
    out.G24 = { price: g24, change: num(paxg.dayChange), src: 'نوبیتکس (PAXG)', approx: true };
    out.G18 = { price: g24 * 0.75, change: num(paxg.dayChange), src: 'نوبیتکس (PAXG)', approx: true };
  }
  if (isFinite(usd)) {
    let rates = null;
    try { rates = (await getJSON('https://open.er-api.com/v6/latest/USD')).rates; } catch (e) { console.warn('fx', e); }
    const cross = (c, fixed) => (rates && rates[c] ? usd / rates[c] : fixed ? usd / fixed : NaN);
    const mk = (v) => (isFinite(v) ? { price: v, change: out.USD.change, src: 'محاسبه از دلار', approx: true } : null);
    out.EUR = mk(cross('EUR'));
    out.GBP = mk(cross('GBP'));
    out.AED = mk(cross('AED', 3.6725));
  }
  return out;
}

let inflight = null;
export function refreshPrices() {
  if (inflight) return inflight;
  inflight = (async () => {
    let got = {}, errors = [];
    if (store.settings.brsKey) {
      try { got = await fromBrs(store.settings.brsKey); } catch (e) { errors.push('BrsApi: ' + e.message); }
    }
    const missing = ASSETS.filter((a) => a.sym !== 'TEDPIX' && !got[a.sym]);
    if (missing.length) {
      try {
        const pub = await fromPublic();
        for (const a of missing) if (pub[a.sym]) got[a.sym] = pub[a.sym];
      } catch (e) { errors.push('نوبیتکس: ' + e.message); }
    }
    const now = Date.now();
    let changed = false;
    for (const [sym, v] of Object.entries(got)) {
      if (!v) continue;
      prices.items[sym] = { ...v, ts: now };
      if (recordPrice(sym, v.price, now)) changed = true;
    }
    if (Object.keys(got).length) prices.ts = now;
    prices.errors = errors;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(prices)); } catch {}
    if (changed) store.save('local');
    return prices;
  })().finally(() => { inflight = null; });
  return inflight;
}

export const usdRate = () => prices.items.USD?.price || 0;

// ---------- تاریخچه برای نمودار ----------
const NB_SYMBOL = { USD: 'USDTIRT', G24: 'PAXGIRT', G18: 'PAXGIRT', EUR: 'USDTIRT', GBP: 'USDTIRT', AED: 'USDTIRT' };
export const RANGES = [
  { id: '1d', label: '۲۴ ساعت', days: 1, res: '60' },
  { id: '1w', label: 'هفته', days: 7, res: '240' },
  { id: '1m', label: 'ماه', days: 30, res: 'D' },
  { id: '3m', label: '۳ ماه', days: 90, res: 'D' },
  { id: '1y', label: 'سال', days: 365, res: 'D' },
];
export async function getHistory(sym, rangeId) {
  const range = RANGES.find((r) => r.id === rangeId) || RANGES[2];
  const from = Date.now() - range.days * 864e5;
  const recorded = (store.data.history[sym] || []).filter((p) => p[0] >= from);
  const nbSym = NB_SYMBOL[sym];
  if (nbSym) {
    try {
      const to = Math.floor(Date.now() / 1000);
      const d = await getJSON(`https://api.nobitex.ir/market/udf/history?symbol=${nbSym}&resolution=${range.res}&from=${Math.floor(from / 1000)}&to=${to}`);
      if (d.s === 'ok' && d.t?.length > 1) {
        // تبدیل ریال به تومان و مقیاس‌کردن با قیمت فعلی تا با منبع اصلی هم‌تراز شود
        let pts = d.t.map((t, i) => [t * 1000, d.c[i] / 10]);
        if (sym === 'G24' || sym === 'G18') pts = pts.map(([t, v]) => [t, (v / OZ) * (sym === 'G18' ? 0.75 : 1)]);
        const cur = prices.items[sym]?.price;
        const lastNb = pts[pts.length - 1][1];
        if (cur && lastNb) { const k = cur / lastNb; pts = pts.map(([t, v]) => [t, v * k]); }
        return { points: pts, source: 'نوبیتکس' + (sym === 'USD' ? '' : ' (هم‌ترازشده با قیمت فعلی)') };
      }
    } catch (e) { console.warn('history', e); }
  }
  return { points: recorded, source: 'قیمت‌های ثبت‌شده توسط پنل' };
}
