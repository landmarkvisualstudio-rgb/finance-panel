// قالب‌بندی اعداد فارسی
const FA = '۰۱۲۳۴۵۶۷۸۹';
export const faNum = (s) => String(s).replace(/\d/g, (d) => FA[d]);
export const toLatin = (s) => String(s)
  .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));

const nf = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

// compact=true → «۱۲٫۵ م» (میلیون) / «۱٫۲ ه» (هزار)
export function fmt(n, compact = false) {
  if (n == null || !isFinite(n)) return '—';
  if (compact) {
    const a = Math.abs(n);
    if (a >= 1e9) return nf2.format(+(n / 1e9).toFixed(2)) + ' میلیارد';
    if (a >= 1e6) return nf2.format(+(n / 1e6).toFixed(1)) + ' میلیون';
    if (a >= 1e4) return nf2.format(+(n / 1e3).toFixed(0)) + ' هزار';
  }
  return Math.abs(n) < 100 && n % 1 ? nf2.format(n) : nf.format(Math.round(n));
}
export const fmtUsd = (n) => (n == null || !isFinite(n) ? '—' : nf2.format(n));
export const pct = (n) => (n == null || !isFinite(n) ? '' : (n > 0 ? '+' : n < 0 ? '−' : '') + nf2.format(Math.abs(+n.toFixed(2))) + '٪');

// ورودی مبلغ: تبدیل ارقام فارسی، حذف حروف، جداکننده هزارگان
export function parseAmount(s) {
  const v = parseFloat(toLatin(s).replace(/[^\d.]/g, ''));
  return isFinite(v) ? v : 0;
}
export function formatAmountInput(input, allowDecimal = false) {
  const raw = toLatin(input.value).replace(allowDecimal ? /[^\d.]/g : /[^\d]/g, '');
  const [i, d] = raw.split('.');
  const intPart = i ? Number(i).toLocaleString('en-US') : '';
  input.value = allowDecimal && d !== undefined ? `${intPart}.${d.slice(0, 2)}` : intPart;
}

// مبلغ به حروف (تقریبی، برای راهنمای ورودی)
export function amountWords(n) {
  if (!n) return '';
  const parts = [];
  const units = [[1e9, 'میلیارد'], [1e6, 'میلیون'], [1e3, 'هزار']];
  let rest = Math.floor(n);
  for (const [v, w] of units) {
    if (rest >= v) { parts.push(faNum(Math.floor(rest / v)) + ' ' + w); rest %= v; }
  }
  if (rest) parts.push(faNum(rest));
  return parts.join(' و ') + ' تومان';
}
