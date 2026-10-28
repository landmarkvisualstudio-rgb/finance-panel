// تبدیل تاریخ شمسی ↔ میلادی (بر پایه الگوریتم jalaali-js)
const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

function jalCal(jy) {
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jm, jump = 0, n, i;
  for (i = 1; i < breaks.length; i++) {
    jm = breaks[i]; jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1; k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

export const toJalali = (gy, gm, gd) => d2j(g2d(gy, gm, gd));
export const toGregorian = (jy, jm, jd) => d2g(j2d(jy, jm, jd));
export const isLeap = (jy) => jalCal(jy).leap === 0;
export const monthLength = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : isLeap(jy) ? 30 : 29);

export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

// تعطیلات رسمی با تاریخ ثابت شمسی (تعطیلات قمری هر سال جابه‌جا می‌شوند)
export const SOLAR_HOLIDAYS = {
  '1/1': 'عید نوروز', '1/2': 'عید نوروز', '1/3': 'عید نوروز', '1/4': 'عید نوروز',
  '1/12': 'روز جمهوری اسلامی', '1/13': 'روز طبیعت', '3/14': 'رحلت امام خمینی',
  '3/15': 'قیام ۱۵ خرداد', '11/22': 'پیروزی انقلاب', '12/29': 'ملی شدن صنعت نفت',
};

// شنبه = ۰
export function weekdayIndex(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  return (new Date(Date.UTC(g.gy, g.gm - 1, g.gd)).getUTCDay() + 1) % 7;
}

// امروز به وقت تهران
export function todayJ() {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
  const [gy, gm, gd] = s.split('-').map(Number);
  return toJalali(gy, gm, gd);
}

const pad = (n) => String(n).padStart(2, '0');
export const jStr = ({ jy, jm, jd }) => `${jy}/${pad(jm)}/${pad(jd)}`;
export function parseJ(s) {
  const [jy, jm, jd] = String(s).split('/').map(Number);
  return { jy, jm, jd };
}
export const todayStr = () => jStr(todayJ());

export function addMonths(jy, jm, delta) {
  let m = jm - 1 + delta;
  jy += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return { jy, jm: m + 1 };
}

export function tsToJ(ts) {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date(ts));
  const [gy, gm, gd] = s.split('-').map(Number);
  return toJalali(gy, gm, gd);
}
