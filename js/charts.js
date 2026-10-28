// نمودارهای سبک SVG بدون وابستگی
import { fmt, faNum } from './format.js';
import { tsToJ, MONTHS } from './jalali.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function sparkline(points, w = 96, h = 28) {
  if (!points || points.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  const ys = points.map((p) => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const t0 = points[0][0], tspan = points[points.length - 1][0] - t0 || 1;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(((p[0] - t0) / tspan) * w).toFixed(1)},${(h - 2 - ((p[1] - min) / span) * (h - 4)).toFixed(1)}`).join('');
  const up = ys[ys.length - 1] >= ys[0];
  return `<svg class="spark ${up ? 'up' : 'down'}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}

function fmtTime(ts, spanDays) {
  const j = tsToJ(ts);
  if (spanDays <= 2) {
    const s = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
    return s;
  }
  return faNum(`${j.jd} ${MONTHS[j.jm - 1]}`) + (spanDays > 200 ? ' ' + faNum(j.jy) : '');
}

// نمودار خطی تعاملی
export function lineChart(el, points, { unit = 'تومان' } = {}) {
  el.innerHTML = '';
  if (!points || points.length < 2) {
    el.innerHTML = '<div class="empty-chart">داده کافی برای نمودار نیست. پنل با هر بار به‌روزرسانی قیمت، تاریخچه را ثبت می‌کند.</div>';
    return;
  }
  const W = 640, H = 260, P = { l: 8, r: 64, t: 16, b: 28 };
  const ys = points.map((p) => p[1]);
  let min = Math.min(...ys), max = Math.max(...ys);
  const pad = (max - min) * 0.08 || max * 0.01 || 1; min -= pad; max += pad;
  const t0 = points[0][0], t1 = points[points.length - 1][0], tspan = t1 - t0 || 1;
  const X = (t) => P.l + ((t - t0) / tspan) * (W - P.l - P.r);
  const Y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const area = `${line}L${X(t1).toFixed(1)},${H - P.b}L${X(t0).toFixed(1)},${H - P.b}Z`;
  const up = ys[ys.length - 1] >= ys[0];
  const spanDays = tspan / 864e5;
  let grid = '';
  for (let i = 0; i <= 3; i++) {
    const v = min + ((max - min) * i) / 3, y = Y(v);
    grid += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/><text class="axis" x="${W - P.r + 6}" y="${y + 4}">${esc(fmt(v, true))}</text>`;
  }
  for (let i = 0; i <= 3; i++) {
    const t = t0 + (tspan * i) / 3;
    grid += `<text class="axis" text-anchor="middle" x="${X(t)}" y="${H - 8}">${esc(fmtTime(t, spanDays))}</text>`;
  }
  el.innerHTML = `
    <svg class="line-chart ${up ? 'up' : 'down'}" viewBox="0 0 ${W} ${H}" role="img" aria-label="نمودار قیمت">
      <defs><linearGradient id="lcfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <path class="area" d="${area}" fill="url(#lcfill)"/>
      <path class="line" d="${line}"/>
      <line class="cursor" y1="${P.t}" y2="${H - P.b}" x1="-10" x2="-10"/>
      <circle class="dot" r="5" cx="-10" cy="-10"/>
      <rect class="hit" x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent"/>
    </svg>
    <div class="chart-tip" hidden></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.chart-tip');
  const cur = svg.querySelector('.cursor'), dot = svg.querySelector('.dot');
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    const t = t0 + ((x - P.l) / (W - P.l - P.r)) * tspan;
    let best = points[0];
    for (const p of points) if (Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    const px = X(best[0]), py = Y(best[1]);
    cur.setAttribute('x1', px); cur.setAttribute('x2', px);
    dot.setAttribute('cx', px); dot.setAttribute('cy', py);
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(fmt(best[1]))}</b> <span>${unit}</span><small>${esc(fmtTime(best[0], spanDays <= 2 ? 1 : 30))}</small>`;
    const left = (px / W) * r.width;
    tip.style.left = Math.min(Math.max(left, 70), r.width - 70) + 'px';
  };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cur.setAttribute('x1', -10); cur.setAttribute('x2', -10); dot.setAttribute('cx', -10); });
}

// نمودار ستونی ماهانه درآمد/هزینه
export function monthlyBars(el, rows) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  el.innerHTML = `<div class="bars">${rows.map((r) => `
    <div class="bar-group" title="${esc(r.label)}">
      <div class="bar-pair">
        <div class="bar income" style="--h:${((r.income / max) * 100).toFixed(1)}%"><span>${esc(fmt(r.income, true))}</span></div>
        <div class="bar expense" style="--h:${((r.expense / max) * 100).toFixed(1)}%"><span>${esc(fmt(r.expense, true))}</span></div>
      </div>
      <div class="bar-label">${esc(r.label)}</div>
    </div>`).join('')}</div>`;
}

// نمودار افقی دسته‌بندی‌ها
export function categoryBars(el, rows) {
  if (!rows.length) { el.innerHTML = '<p class="muted small">هنوز هزینه‌ای در این ماه ثبت نشده.</p>'; return; }
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  el.innerHTML = rows.map((r) => `
    <div class="cat-row">
      <div class="cat-head"><span>${esc(r.name)}</span><span class="num">${esc(fmt(r.value))} <small>(${faNum(Math.round((r.value / total) * 100))}٪)</small></span></div>
      <div class="cat-track"><div class="cat-fill" style="width:${((r.value / rows[0].value) * 100).toFixed(1)}%"></div></div>
    </div>`).join('');
}
