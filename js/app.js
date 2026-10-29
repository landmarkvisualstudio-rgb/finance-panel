import { store, uid, live, byId, upsert, softDelete, DEFAULT_CATEGORIES } from './store.js';
import { sync, onSync, connect, syncNow, schedulePush, startAutoSync, disconnect, enabled as syncEnabled } from './sync.js';
import { ASSETS, prices, refreshPrices, usdRate, getHistory, RANGES } from './prices.js';
import { sparkline, lineChart, monthlyBars, categoryBars } from './charts.js';
import { fmt, fmtUsd, pct, faNum, parseAmount, formatAmountInput, amountWords, toLatin } from './format.js';
import * as J from './jalali.js';

/* ---------------- ابزار ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  ledger: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M16 15h2"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L22 7H6"/>',
  market: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.6 6.6 0 0 0 10 10z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.7-4.3L4 8M4 4v4h4M4 13a8 8 0 0 0 14.7 4.3L20 16M20 20v-4h-4"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18H7z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  next: '<path d="M15 6l-6 6 6 6"/>',
  prev: '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  back: '<path d="M10 5l7 7-7 7"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const KINDS = {
  expense: { label: 'هزینه', plural: 'هزینه‌ها', hint: 'خرج‌ها' },
  income: { label: 'درآمد', plural: 'دریافتی‌ها', hint: 'دریافتی' },
  receivable: { label: 'طلب', plural: 'طلب‌ها', hint: 'پولی که قراره بگیری', doneLabel: 'وصول شد', target: 'income' },
  debt: { label: 'بدهی', plural: 'بدهی‌ها', hint: 'پولی که باید بدی', doneLabel: 'پرداخت شد', target: 'expense' },
};
const KIND_ORDER = ['expense', 'income', 'receivable', 'debt'];
const cats = () => store.data.categories?.list?.length ? store.data.categories.list : DEFAULT_CATEGORIES;

function todayLabel() {
  const t = J.todayJ();
  return `${J.WEEKDAYS[J.weekdayIndex(t.jy, t.jm, t.jd)]} ${faNum(t.jd)} ${J.MONTHS[t.jm - 1]} ${faNum(t.jy)}`;
}
function dateLabel(s, withYear = false) {
  const d = J.parseJ(s);
  if (!d.jy) return '';
  return `${faNum(d.jd)} ${J.MONTHS[d.jm - 1]}${withYear ? ' ' + faNum(d.jy) : ''}`;
}
function ago(ts) {
  if (!ts) return 'هرگز';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'همین الان';
  if (s < 3600) return faNum(Math.floor(s / 60)) + ' دقیقه پیش';
  if (s < 86400) return faNum(Math.floor(s / 3600)) + ' ساعت پیش';
  return faNum(Math.floor(s / 86400)) + ' روز پیش';
}
const monthKey = (s) => s.slice(0, 7);
const sum = (arr) => arr.reduce((a, e) => a + (+e.amount || 0), 0);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- تم ---------------- */
function applyTheme() {
  const pref = store.settings.theme;
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const glass = store.settings.style === 'glass';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.style = glass ? 'glass' : 'liquid';
  $('meta[name=theme-color]')?.setAttribute('content', glass ? (dark ? '#140a33' : '#e9e6ff') : (dark ? '#050506' : '#f2f2f4'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------------- منطق مالی ---------------- */
function entriesOf(kind) { return live('entries').filter((e) => e.kind === kind); }

function setDone(entry, done) {
  const meta = KINDS[entry.kind];
  if (!meta.target) return;
  if (done && !entry.done) {
    const linked = upsert('entries', {
      id: uid(), kind: meta.target, amount: entry.amount,
      reason: (entry.kind === 'receivable' ? 'وصول طلب: ' : 'پرداخت بدهی: ') + entry.reason,
      category: entry.kind === 'debt' ? 'بازپرداخت بدهی' : '', date: J.todayStr(), linkedFrom: entry.id,
    });
    entry.done = true; entry.linkedId = linked.id; entry.doneDate = J.todayStr();
    toast(entry.kind === 'receivable' ? 'به دریافتی‌ها اضافه شد' : 'به هزینه‌ها اضافه شد');
  } else if (!done && entry.done) {
    if (entry.linkedId) softDelete('entries', entry.linkedId);
    entry.done = false; entry.linkedId = null; entry.doneDate = null;
    toast('برگشت داده شد');
  }
  upsert('entries', entry);
  store.save();
}
function setPurchased(p, done) {
  if (done && !p.done) {
    const rate = usdRate();
    if (!rate) { toast('نرخ دلار در دسترس نیست'); return; }
    const linked = upsert('entries', { id: uid(), kind: 'expense', amount: Math.round(p.usd * rate), reason: 'خرید: ' + p.title, category: 'خرید', date: J.todayStr(), linkedFrom: p.id });
    p.done = true; p.linkedId = linked.id; p.boughtRate = rate;
    toast('به هزینه‌ها اضافه شد');
  } else if (!done && p.done) {
    if (p.linkedId) softDelete('entries', p.linkedId);
    p.done = false; p.linkedId = null;
  }
  upsert('purchases', p);
  store.save();
}
function deleteEntry(e) {
  if (e.linkedFrom) {
    const src = byId('entries', e.linkedFrom) || byId('purchases', e.linkedFrom);
    if (src) { src.done = false; src.linkedId = null; upsert(src.kind ? 'entries' : 'purchases', src); }
  }
  softDelete('entries', e.id);
  store.save();
}

function monthTotals(jy, jm) {
  const key = `${jy}/${String(jm).padStart(2, '0')}`;
  const es = live('entries').filter((e) => monthKey(e.date) === key);
  return { income: sum(es.filter((e) => e.kind === 'income')), expense: sum(es.filter((e) => e.kind === 'expense')), list: es };
}

/* ---------------- مسیریابی ---------------- */
const NAV = [
  { id: 'home', label: 'خانه', icon: 'home' },
  { id: 'ledger', label: 'دفتر', icon: 'ledger' },
  { id: 'purchases', label: 'خریدها', icon: 'cart' },
  { id: 'market', label: 'بازار', icon: 'market' },
  { id: 'calendar', label: 'تقویم', icon: 'calendar' },
];
const ui = { route: 'home', kind: 'expense', search: '', cat: '', cal: null, calSel: J.todayStr(), chartRange: '1m' };

function parseHash() {
  const [r, q] = location.hash.replace(/^#\/?/, '').split('?');
  ui.route = ['home', 'ledger', 'purchases', 'market', 'calendar', 'settings'].includes(r) ? r : 'home';
  const k = new URLSearchParams(q || '').get('k');
  if (k && KINDS[k]) ui.kind = k;
}
const go = (r) => { location.hash = '#/' + r; };

/* ---------------- اسکلت ---------------- */
function renderShell() {
  $('#topbar').innerHTML = `
    <div class="brand">
      <div class="logo" aria-hidden="true"><span></span></div>
      <div>
        <div class="brand-title">پنل مالی</div>
        <div class="brand-date" id="today">${todayLabel()}</div>
      </div>
    </div>
    <div class="top-actions">
      <button class="icon-btn sync-btn" id="syncBtn" aria-label="همگام‌سازی">${ic('cloud')}<i class="sync-dot"></i></button>
      <button class="icon-btn" id="themeBtn" aria-label="تغییر تم">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
      ${isStandalone() ? '' : `<button class="icon-btn install-btn" id="installBtn" aria-label="نصب اپ" title="نصب اپ">${ic('download')}</button>`}
      <button class="icon-btn" id="settingsBtn" aria-label="تنظیمات">${ic('settings')}</button>
    </div>`;
  $('#nav').innerHTML = `<div class="nav-pill" aria-hidden="true"></div>` + NAV.map((n) => `
    <a href="#/${n.id}" class="nav-item" data-route="${n.id}">${ic(n.icon)}<span>${n.label}</span></a>`).join('');
  $('#themeBtn').onclick = () => {
    store.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store.saveSettings(); applyTheme(); renderShell(); updateNav(); updateSyncDot();
  };
  $('#settingsBtn').onclick = () => go('settings');
  $('#installBtn')?.addEventListener('click', installApp);
  $('#syncBtn').onclick = () => {
    if (!syncEnabled()) { go('settings'); toast('برای همگام‌سازی، توکن گیت‌هاب را وارد کن'); return; }
    syncNow(true).then(() => toast(sync.status === 'ok' ? 'همگام شد' : 'خطا: ' + sync.error));
  };
  updateSyncDot();
}
function updateNav() {
  const items = $$('.nav-item');
  let active = null;
  items.forEach((a) => { const on = a.dataset.route === ui.route; a.classList.toggle('active', on); if (on) active = a; a.setAttribute('aria-current', on ? 'page' : 'false'); });
  const pill = $('.nav-pill');
  if (pill) {
    if (active) {
      const nr = $('#nav').getBoundingClientRect(), ar = active.getBoundingClientRect();
      pill.style.opacity = 1;
      const nav = $('#nav'); pill.style.transform = `translate(${ar.left - nr.left - nav.clientLeft}px, ${ar.top - nr.top - nav.clientTop}px)`;
      pill.style.width = ar.width + 'px'; pill.style.height = ar.height + 'px';
    } else pill.style.opacity = 0;
  }
}
function updateSyncDot() {
  const b = $('#syncBtn');
  if (!b) return;
  b.dataset.state = syncEnabled() ? sync.status : 'off';
  b.title = !syncEnabled() ? 'همگام‌سازی خاموش' : sync.status === 'ok' ? 'همگام — ' + ago(sync.lastSync) : sync.status === 'syncing' ? 'در حال همگام‌سازی…' : sync.status === 'error' ? 'خطا: ' + sync.error : '';
}

function render() {
  const v = $('#view');
  const views = { home: viewHome, ledger: viewLedger, purchases: viewPurchases, market: viewMarket, calendar: viewCalendar, settings: viewSettings };
  v.innerHTML = '';
  v.className = 'view view-' + ui.route;
  views[ui.route](v);
  updateNav();
  if (!reduceMotion) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
}

/* ---------------- نوار قیمت‌ها (بالای خانه) ---------------- */
function rateChip(a) {
  const it = prices.items[a.sym];
  const ch = it?.change;
  return `<button class="rate-chip" data-sym="${a.sym}">
    <span class="rate-name">${a.short}</span>
    <span class="rate-price num">${it ? fmt(it.price) : '—'}</span>
    <span class="rate-foot"><span class="chg ${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${pct(ch)}</span>${sparkline((store.data.history[a.sym] || []).slice(-48), 56, 18)}</span>
  </button>`;
}

/* ---------------- خانه ---------------- */
function viewHome(v) {
  const t = J.todayJ();
  const m = monthTotals(t.jy, t.jm);
  const openRecv = entriesOf('receivable').filter((e) => !e.done);
  const openDebt = entriesOf('debt').filter((e) => !e.done);
  const allIncome = sum(entriesOf('income')), allExpense = sum(entriesOf('expense'));
  const futureUsd = live('purchases').filter((p) => !p.done).reduce((s, p) => s + (+p.usd || 0), 0);
  const balance = m.income - m.expense;

  v.innerHTML = `
    <section class="rates-strip" aria-label="قیمت‌های لحظه‌ای">
      <div class="strip-head"><h2>بازار امروز</h2><button class="link-btn" data-go="market">همه ${ic('back')}</button></div>
      <div class="chips">${ASSETS.map(rateChip).join('')}</div>
    </section>

    <section class="hero card">
      <div class="hero-label">تراز ${J.MONTHS[t.jm - 1]}</div>
      <div class="hero-value num ${balance < 0 ? 'neg' : ''}">${fmt(balance)} <small>تومان</small></div>
      <div class="hero-sub">موجودی کل (درآمد منهای هزینه): <b class="num">${fmt(allIncome - allExpense)}</b> تومان</div>
    </section>

    <section class="kpis">
      ${kpi('income', 'درآمد این ماه', m.income, 'ledger?k=income')}
      ${kpi('expense', 'هزینه این ماه', m.expense, 'ledger?k=expense')}
      ${kpi('receivable', `طلب باز (${faNum(openRecv.length)})`, sum(openRecv), 'ledger?k=receivable')}
      ${kpi('debt', `بدهی باز (${faNum(openDebt.length)})`, sum(openDebt), 'ledger?k=debt')}
      ${kpi('future', 'خریدهای آینده', futureUsd * usdRate(), 'purchases', `$${fmtUsd(futureUsd)}`)}
    </section>

    <div class="two-col">
      <section class="card">
        <div class="card-head"><h3>درآمد و هزینه ۶ ماه اخیر</h3>
          <div class="legend"><span class="lg income">درآمد</span><span class="lg expense">هزینه</span></div></div>
        <div id="monthly"></div>
      </section>
      <section class="card">
        <div class="card-head"><h3>هزینه‌های ${J.MONTHS[t.jm - 1]} بر اساس دسته</h3></div>
        <div id="cats"></div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h3>آخرین تراکنش‌ها</h3><button class="link-btn" data-go="ledger">دفتر ${ic('back')}</button></div>
      <div class="list" id="recent"></div>
    </section>
    <button class="fab" id="fab" aria-label="ثبت جدید">${ic('plus')}</button>`;

  const rows = [];
  for (let i = 5; i >= 0; i--) {
    const mm = J.addMonths(t.jy, t.jm, -i);
    const tt = monthTotals(mm.jy, mm.jm);
    rows.push({ label: J.MONTHS[mm.jm - 1], income: tt.income, expense: tt.expense });
  }
  monthlyBars($('#monthly', v), rows);
  const byCat = {};
  m.list.filter((e) => e.kind === 'expense').forEach((e) => { const c = e.category || 'سایر'; byCat[c] = (byCat[c] || 0) + +e.amount; });
  categoryBars($('#cats', v), Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value));
  const recent = live('entries').sort((a, b) => (b.date + b.updatedAt).localeCompare(a.date + a.updatedAt) || b.updatedAt - a.updatedAt).slice(0, 7);
  $('#recent', v).innerHTML = recent.length ? recent.map(entryRow).join('') : emptyState('هنوز چیزی ثبت نشده', 'با دکمه + اولین خرج یا درآمدت رو ثبت کن.');
  bindCommon(v);
  $('#fab', v).onclick = () => openEntrySheet({ kind: 'expense' });
}
function kpi(kind, label, value, route, extra = '') {
  return `<button class="kpi k-${kind}" data-go="${route}">
    <span class="kpi-bar"></span><span class="kpi-label">${label}</span>
    <span class="kpi-value num">${fmt(value, true)}</span><span class="kpi-unit">${extra || 'تومان'}</span></button>`;
}
function emptyState(title, sub) { return `<div class="empty"><b>${title}</b><span>${sub}</span></div>`; }

function entryRow(e) {
  const meta = KINDS[e.kind];
  const checkable = !!meta.target;
  return `<div class="row k-${e.kind} ${e.done ? 'is-done' : ''}" data-id="${e.id}">
    ${checkable ? `<button class="check ${e.done ? 'on' : ''}" data-check="${e.id}" aria-label="${meta.doneLabel}" aria-pressed="${!!e.done}">${ic('check')}</button>` : `<span class="dot-kind"></span>`}
    <div class="row-main" data-edit="${e.id}">
      <div class="row-title">${esc(e.reason) || '<span class="muted">بدون توضیح</span>'}</div>
      <div class="row-meta"><span class="tag">${meta.label}</span>${e.category ? `<span>${esc(e.category)}</span>` : ''}<span>${dateLabel(e.date)}</span>${e.done ? `<span class="done-tag">${meta.doneLabel}</span>` : ''}${e.linkedFrom ? '<span class="muted">خودکار</span>' : ''}</div>
    </div>
    <div class="row-amt num" data-edit="${e.id}">${e.kind === 'expense' || e.kind === 'debt' ? '−' : '+'}${fmt(e.amount)}</div>
  </div>`;
}
function bindCommon(root) {
  $$('[data-go]', root).forEach((b) => (b.onclick = () => go(b.dataset.go)));
  $$('[data-sym]', root).forEach((b) => (b.onclick = () => openChart(b.dataset.sym)));
  $$('[data-check]', root).forEach((b) => (b.onclick = (ev) => { ev.stopPropagation(); const e = byId('entries', b.dataset.check); if (e) setDone(e, !e.done); }));
  $$('[data-edit]', root).forEach((b) => (b.onclick = () => { const e = byId('entries', b.dataset.edit); if (e) openEntrySheet(e); }));
}

/* ---------------- دفتر ---------------- */
function viewLedger(v) {
  const kind = ui.kind, meta = KINDS[kind];
  let list = entriesOf(kind);
  const q = ui.search.trim();
  if (q) list = list.filter((e) => (e.reason + ' ' + (e.category || '')).includes(q) || toLatin(String(e.amount)).includes(toLatin(q)));
  if (ui.cat && kind === 'expense') list = list.filter((e) => (e.category || 'سایر') === ui.cat);
  list.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
  const isDebtLike = !!meta.target;
  const openSum = sum(list.filter((e) => !e.done)), doneSum = sum(list.filter((e) => e.done));
  const t = J.todayJ(), m = monthTotals(t.jy, t.jm);

  const groups = {};
  list.forEach((e) => (groups[monthKey(e.date)] ||= []).push(e));

  v.innerHTML = `
    <div class="page-head"><h1>دفتر حساب</h1></div>
    <div class="segmented kinds" role="tablist">
      <div class="seg-pill" aria-hidden="true"></div>
      ${KIND_ORDER.map((k) => `<button role="tab" class="seg k-${k} ${k === kind ? 'active' : ''}" data-kind="${k}" aria-selected="${k === kind}">${KINDS[k].plural}</button>`).join('')}
    </div>
    <section class="summary card k-${kind}">
      <div class="sum-bar"></div>
      ${isDebtLike ? `
        <div><span class="muted small">${kind === 'receivable' ? 'باید بگیری' : 'باید بدی'}</span><b class="num">${fmt(openSum)}</b><small>تومان</small></div>
        <div><span class="muted small">${meta.doneLabel}</span><b class="num">${fmt(doneSum)}</b><small>تومان</small></div>
        <p class="hint">با تیک زدن هر مورد، خودکار به ${kind === 'receivable' ? 'دریافتی‌ها' : 'هزینه‌ها'} منتقل می‌شه.</p>` : `
        <div><span class="muted small">این ماه</span><b class="num">${fmt(kind === 'income' ? m.income : m.expense)}</b><small>تومان</small></div>
        <div><span class="muted small">مجموع ${q || ui.cat ? 'نتایج' : 'کل'}</span><b class="num">${fmt(sum(list))}</b><small>تومان</small></div>`}
    </section>
    <div class="toolbar">
      <label class="search">${ic('search')}<input id="q" type="search" placeholder="جستجو در ${meta.plural}" value="${esc(ui.search)}"></label>
      ${kind === 'expense' ? `<select id="catFilter" class="select" aria-label="دسته"><option value="">همه دسته‌ها</option>${cats().map((c) => `<option ${c === ui.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
    </div>
    <div id="groups">${Object.keys(groups).length ? Object.entries(groups).map(([mk, es]) => {
      const d = J.parseJ(mk + '/01');
      return `<section class="group"><div class="group-head"><span>${J.MONTHS[d.jm - 1]} ${faNum(d.jy)}</span><span class="num">${fmt(sum(es))}</span></div><div class="list card">${es.map(entryRow).join('')}</div></section>`;
    }).join('') : `<div class="card">${emptyState(q || ui.cat ? 'نتیجه‌ای پیدا نشد' : `هنوز ${meta.label}ی ثبت نشده`, meta.hint)}</div>`}</div>
    <button class="fab k-${kind}" id="fab" aria-label="ثبت ${meta.label}">${ic('plus')}</button>`;

  $$('.seg', v).forEach((b) => (b.onclick = () => { ui.kind = b.dataset.kind; ui.cat = ''; history.replaceState(null, '', '#/ledger?k=' + ui.kind); render(); }));
  placeSegPill($('.segmented', v));
  const qi = $('#q', v);
  qi.oninput = () => { ui.search = qi.value; clearTimeout(qi._t); qi._t = setTimeout(() => { render(); const n = $('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  const cf = $('#catFilter', v); if (cf) cf.onchange = () => { ui.cat = cf.value; render(); };
  bindCommon(v);
  $('#fab', v).onclick = () => openEntrySheet({ kind });
}
function placeSegPill(seg) {
  requestAnimationFrame(() => {
    const a = $('.seg.active', seg), pill = $('.seg-pill', seg);
    if (!a || !pill) return;
    const sr = seg.getBoundingClientRect(), ar = a.getBoundingClientRect();
    pill.style.width = ar.width + 'px';
    pill.style.transform = `translateX(${ar.left - sr.left - seg.clientLeft}px)`;
    pill.className = 'seg-pill ' + [...a.classList].filter((c) => c.startsWith('k-')).join(' ');
  });
}

/* ---------------- شیت (پنجره پایین) ---------------- */
function openSheet(html, { onMount, wide = false } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim"></div><div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  root.hidden = false;
  requestAnimationFrame(() => root.classList.add('open'));
  const close = () => { root.classList.remove('open'); setTimeout(() => { root.hidden = true; root.innerHTML = ''; }, reduceMotion ? 0 : 280); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('.scrim', root).onclick = close;
  $$('[data-close]', root).forEach((b) => (b.onclick = close));
  onMount?.($('.sheet', root), close);
  return close;
}

function datePicker(container, value, onPick) {
  let sel = J.parseJ(value), view = { jy: sel.jy, jm: sel.jm };
  const draw = () => {
    container.innerHTML = calendarGrid(view.jy, view.jm, jStrOf(sel), { compact: true });
    $('[data-cal-prev]', container).onclick = () => { view = J.addMonths(view.jy, view.jm, -1); draw(); };
    $('[data-cal-next]', container).onclick = () => { view = J.addMonths(view.jy, view.jm, 1); draw(); };
    $$('[data-day]', container).forEach((b) => (b.onclick = () => { sel = J.parseJ(b.dataset.day); onPick(b.dataset.day); draw(); }));
  };
  draw();
}
const jStrOf = (d) => J.jStr(d);

function openEntrySheet(entry) {
  const isNew = !entry.id;
  const e = { kind: 'expense', amount: '', reason: '', category: '', date: J.todayStr(), ...entry };
  openSheet(`
    <form class="form" id="entryForm" autocomplete="off">
      <div class="sheet-head"><h2>${isNew ? 'ثبت جدید' : 'ویرایش ' + KINDS[e.kind].label}</h2><button type="button" class="icon-btn" data-close aria-label="بستن">${ic('x')}</button></div>
      ${isNew ? `<div class="segmented kinds small" role="radiogroup"><div class="seg-pill"></div>${KIND_ORDER.map((k) => `<button type="button" class="seg k-${k} ${k === e.kind ? 'active' : ''}" data-k="${k}">${KINDS[k].label}</button>`).join('')}</div>` : ''}
      <label class="field">
        <span>مبلغ (تومان)</span>
        <input id="fAmount" inputmode="numeric" required placeholder="مثلاً ۲۵۰٬۰۰۰" value="${e.amount ? Number(e.amount).toLocaleString('en-US') : ''}">
        <small class="words" id="fWords">${amountWords(+e.amount)}</small>
      </label>
      <label class="field"><span id="reasonLabel">علت</span><input id="fReason" required maxlength="120" value="${esc(e.reason)}" placeholder="مثلاً خرید هفتگی"></label>
      <div class="field" id="catField"><span>دسته‌بندی</span><div class="chips-select">${cats().map((c) => `<button type="button" class="chip ${c === e.category ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>
      <div class="field"><span>تاریخ</span><button type="button" class="date-btn" id="fDateBtn">${ic('calendar')}<b id="fDate">${dateLabel(e.date, true)}</b></button><div id="fCal" class="mini-cal" hidden></div></div>
      ${!isNew && KINDS[e.kind].target ? `<label class="toggle-row"><input type="checkbox" id="fDone" ${e.done ? 'checked' : ''}><span>${KINDS[e.kind].doneLabel}</span></label>` : ''}
      <div class="form-actions">
        ${!isNew ? `<button type="button" class="btn danger" id="fDel">${ic('trash')} حذف</button>` : ''}
        <button type="submit" class="btn primary k-${e.kind}" id="fSave">${isNew ? 'ثبت' : 'ذخیره'}</button>
      </div>
    </form>`, {
    onMount(sheet, close) {
      const amt = $('#fAmount', sheet), words = $('#fWords', sheet);
      const syncKindUI = () => {
        $('#catField', sheet).hidden = e.kind !== 'expense';
        $('#reasonLabel', sheet).textContent = { expense: 'علت خرج', income: 'علت دریافتی', receivable: 'از چه کسی / بابت چی', debt: 'به چه کسی / بابت چی' }[e.kind];
        $('#fSave', sheet).className = `btn primary k-${e.kind}`;
        const seg = $('.segmented', sheet);
        if (seg) { $$('.seg', seg).forEach((b) => b.classList.toggle('active', b.dataset.k === e.kind)); placeSegPill(seg); }
      };
      syncKindUI();
      $$('[data-k]', sheet).forEach((b) => (b.onclick = () => { e.kind = b.dataset.k; syncKindUI(); }));
      amt.oninput = () => { formatAmountInput(amt); words.textContent = amountWords(parseAmount(amt.value)); };
      $$('[data-cat]', sheet).forEach((b) => (b.onclick = () => { e.category = e.category === b.dataset.cat ? '' : b.dataset.cat; $$('[data-cat]', sheet).forEach((x) => x.classList.toggle('on', x.dataset.cat === e.category)); }));
      const cal = $('#fCal', sheet);
      $('#fDateBtn', sheet).onclick = () => { cal.hidden = !cal.hidden; if (!cal.hidden) datePicker(cal, e.date, (d) => { e.date = d; $('#fDate', sheet).textContent = dateLabel(d, true); cal.hidden = true; }); };
      if (isNew) setTimeout(() => amt.focus(), 300);
      $('#fDel', sheet)?.addEventListener('click', () => { if (confirm('این مورد حذف بشه؟')) { deleteEntry(byId('entries', e.id)); close(); toast('حذف شد'); } });
      $('#entryForm', sheet).onsubmit = (ev) => {
        ev.preventDefault();
        const amount = parseAmount(amt.value);
        if (!amount) { amt.focus(); toast('مبلغ را وارد کن'); return; }
        const doneWanted = $('#fDone', sheet)?.checked;
        const rec = isNew ? { id: uid(), done: false } : byId('entries', e.id);
        Object.assign(rec, { kind: e.kind, amount, reason: $('#fReason', sheet).value.trim(), category: e.kind === 'expense' ? e.category : '', date: e.date });
        upsert('entries', rec);
        // همسان‌سازی مورد خودکارِ وابسته
        if (rec.done && rec.linkedId) { const l = byId('entries', rec.linkedId); if (l) { l.amount = amount; upsert('entries', l); } }
        store.save();
        if (doneWanted !== undefined && doneWanted !== !!rec.done) setDone(rec, doneWanted);
        close();
        if (isNew) toast(KINDS[e.kind].label + ' ثبت شد');
      };
    },
  });
}

/* ---------------- خریدهای آینده ---------------- */
function viewPurchases(v) {
  const rate = usdRate();
  const list = live('purchases').sort((a, b) => (a.done - b.done) || b.updatedAt - a.updatedAt);
  const open = list.filter((p) => !p.done);
  const totalUsd = open.reduce((s, p) => s + (+p.usd || 0), 0);
  const usdItem = prices.items.USD;
  v.innerHTML = `
    <div class="page-head"><h1>خریدهای آینده</h1></div>
    <section class="summary card k-future">
      <div class="sum-bar"></div>
      <div><span class="muted small">جمع (دلار)</span><b class="num">$${fmtUsd(totalUsd)}</b></div>
      <div><span class="muted small">معادل امروز</span><b class="num">${rate ? fmt(totalUsd * rate) : '—'}</b><small>تومان</small></div>
      <button class="rate-line" data-sym="USD">نرخ دلار: <b class="num">${rate ? fmt(rate) : 'نامشخص'}</b> تومان ${usdItem ? `<span class="muted">· ${esc(usdItem.src)} · ${ago(usdItem.ts)}</span>` : ''}</button>
    </section>
    <div class="cards-grid">${list.length ? list.map((p) => `
      <article class="buy card ${p.done ? 'is-done' : ''}">
        <button class="check ${p.done ? 'on' : ''}" data-buy="${p.id}" aria-label="خریدم" aria-pressed="${!!p.done}">${ic('check')}</button>
        <div class="buy-main" data-pedit="${p.id}">
          <h3>${esc(p.title)}</h3>
          ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
          <div class="buy-prices"><span class="usd num">$${fmtUsd(p.usd)}</span><span class="toman num">${p.done ? fmt(byId('entries', p.linkedId)?.amount ?? p.usd * (p.boughtRate || rate)) + ' تومان · خریده شد' : rate ? '≈ ' + fmt(p.usd * rate) + ' تومان' : ''}</span></div>
        </div>
      </article>`).join('') : `<div class="card">${emptyState('لیست خریدت خالیه', 'محصولی که قصد خریدش رو داری با قیمت دلاری اضافه کن تا معادل تومانی‌اش همیشه به‌روز باشه.')}</div>`}</div>
    <button class="fab k-future" id="fab" aria-label="افزودن خرید">${ic('plus')}</button>`;
  bindCommon(v);
  $$('[data-buy]', v).forEach((b) => (b.onclick = () => { const p = byId('purchases', b.dataset.buy); if (p) setPurchased(p, !p.done); }));
  $$('[data-pedit]', v).forEach((b) => (b.onclick = () => openPurchaseSheet(byId('purchases', b.dataset.pedit))));
  $('#fab', v).onclick = () => openPurchaseSheet({});
}
function openPurchaseSheet(p) {
  const isNew = !p.id;
  openSheet(`
    <form class="form" id="pForm" autocomplete="off">
      <div class="sheet-head"><h2>${isNew ? 'خرید جدید' : 'ویرایش خرید'}</h2><button type="button" class="icon-btn" data-close aria-label="بستن">${ic('x')}</button></div>
      <label class="field"><span>نام محصول</span><input id="pTitle" required maxlength="80" value="${esc(p.title)}" placeholder="مثلاً هدفون"></label>
      <label class="field"><span>توضیحات</span><textarea id="pDesc" rows="3" maxlength="400" placeholder="مدل، رنگ، لینک فروشگاه…">${esc(p.desc)}</textarea></label>
      <label class="field"><span>قیمت (دلار)</span><input id="pUsd" inputmode="decimal" required placeholder="مثلاً 199.99" value="${p.usd ? p.usd : ''}" dir="ltr"><small class="words" id="pToman"></small></label>
      <div class="form-actions">
        ${!isNew ? `<button type="button" class="btn danger" id="pDel">${ic('trash')} حذف</button>` : ''}
        <button type="submit" class="btn primary k-future">${isNew ? 'افزودن' : 'ذخیره'}</button>
      </div>
    </form>`, {
    onMount(sheet, close) {
      const usd = $('#pUsd', sheet), out = $('#pToman', sheet);
      const upd = () => { const r = usdRate(), n = parseAmount(usd.value); out.textContent = r && n ? `≈ ${fmt(n * r)} تومان (هر دلار ${fmt(r)})` : r ? '' : 'نرخ دلار هنوز دریافت نشده'; };
      usd.oninput = () => { formatAmountInput(usd, true); upd(); };
      upd();
      $('#pDel', sheet)?.addEventListener('click', () => { if (confirm('حذف بشه؟')) { softDelete('purchases', p.id); store.save(); close(); } });
      $('#pForm', sheet).onsubmit = (ev) => {
        ev.preventDefault();
        const n = parseAmount(usd.value);
        if (!n) { toast('قیمت دلاری را وارد کن'); return; }
        const rec = isNew ? { id: uid(), done: false } : p;
        Object.assign(rec, { title: $('#pTitle', sheet).value.trim(), desc: $('#pDesc', sheet).value.trim(), usd: n });
        upsert('purchases', rec); store.save(); close();
      };
    },
  });
}

/* ---------------- بازار ---------------- */
function viewMarket(v) {
  v.innerHTML = `
    <div class="page-head"><h1>بازار</h1>
      <button class="btn ghost" id="refresh">${ic('refresh')} به‌روزرسانی</button></div>
    <p class="muted small" id="mstatus">${prices.ts ? 'آخرین به‌روزرسانی: ' + ago(prices.ts) : 'در حال دریافت…'}</p>
    <div class="market-grid">${ASSETS.map((a) => {
      const it = prices.items[a.sym];
      const hist = (store.data.history[a.sym] || []).slice(-96);
      const noKeyIdx = a.sym === 'TEDPIX' && !it;
      return `<button class="asset card" data-sym="${a.sym}">
        <div class="asset-top"><span class="glyph">${a.glyph}</span><span class="asset-name">${a.name}</span></div>
        <div class="asset-price num">${it ? fmt(it.price) : '—'} <small>${a.unit}</small></div>
        <div class="asset-foot"><span class="chg ${it?.change > 0 ? 'up' : it?.change < 0 ? 'down' : ''}">${it ? pct(it.change) : ''}</span>${sparkline(hist, 110, 30)}</div>
        <div class="asset-src muted">${noKeyIdx ? 'برای شاخص بورس، کلید BrsApi را در تنظیمات وارد کن' : it ? esc(it.src) + (it.approx ? ' · تقریبی' : '') : ''}</div>
      </button>`;
    }).join('')}</div>
    ${prices.errors?.length ? `<p class="muted small err">${esc(prices.errors.join(' · '))}</p>` : ''}
    ${ASSETS.some((a) => !prices.items[a.sym] || prices.items[a.sym].approx) ? `<div class="card note"><b>بعضی قیمت‌ها کامل نیستن</b><p>قیمت‌ها هر ۱۵ دقیقه از سرور گیت‌هاب به‌روز می‌شن. اگه موردی خالی یا تقریبیه، با وارد کردن کلید رایگان BrsApi.ir در تنظیمات دقیق می‌شه.</p><button class="btn ghost" data-go="settings">رفتن به تنظیمات</button></div>` : ''}`;
  bindCommon(v);
  $('#refresh', v).onclick = async () => {
    $('#refresh', v).classList.add('spin');
    await refreshPrices();
    if (ui.route === 'market') render();
  };
}
function openChart(sym) {
  const a = ASSETS.find((x) => x.sym === sym);
  const it = prices.items[sym];
  openSheet(`
    <div class="sheet-head"><div><h2>${a.name}</h2><div class="chart-price"><b class="num">${it ? fmt(it.price) : '—'}</b> <small>${a.unit}</small> <span class="chg ${it?.change > 0 ? 'up' : it?.change < 0 ? 'down' : ''}">${it ? pct(it.change) : ''}</span></div></div>
      <button class="icon-btn" data-close aria-label="بستن">${ic('x')}</button></div>
    <div class="segmented ranges"><div class="seg-pill"></div>${RANGES.map((r) => `<button class="seg ${r.id === ui.chartRange ? 'active' : ''}" data-r="${r.id}">${r.label}</button>`).join('')}</div>
    <div class="chart-box" id="chartBox"><div class="skeleton"></div></div>
    <p class="muted small" id="chartSrc"></p>`, {
    wide: true,
    onMount(sheet) {
      const seg = $('.segmented', sheet);
      const load = async () => {
        placeSegPill(seg);
        const box = $('#chartBox', sheet);
        box.innerHTML = '<div class="skeleton"></div>';
        const { points, source } = await getHistory(sym, ui.chartRange);
        lineChart(box, points, { unit: a.unit });
        $('#chartSrc', sheet).textContent = 'منبع: ' + source;
      };
      $$('[data-r]', sheet).forEach((b) => (b.onclick = () => { ui.chartRange = b.dataset.r; $$('[data-r]', sheet).forEach((x) => x.classList.toggle('active', x === b)); load(); }));
      load();
    },
  });
}

/* ---------------- تقویم ---------------- */
function calendarGrid(jy, jm, selected, { compact = false } = {}) {
  const today = J.todayStr();
  const first = J.weekdayIndex(jy, jm, 1), len = J.monthLength(jy, jm);
  const byDay = {};
  if (!compact) live('entries').forEach((e) => { if (e.date.startsWith(`${jy}/${String(jm).padStart(2, '0')}`)) (byDay[e.date] ||= new Set()).add(e.kind); });
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span class="cal-cell blank"></span>';
  for (let d = 1; d <= len; d++) {
    const s = J.jStr({ jy, jm, jd: d });
    const wd = (first + d - 1) % 7;
    const hol = J.SOLAR_HOLIDAYS[`${jm}/${d}`];
    const g = J.toGregorian(jy, jm, d);
    const kinds = byDay[s] ? [...byDay[s]] : [];
    cells += `<button type="button" class="cal-cell ${s === today ? 'today' : ''} ${s === selected ? 'sel' : ''} ${wd === 6 || hol ? 'off' : ''}" data-day="${s}" ${hol ? `title="${hol}"` : ''}>
      <b>${faNum(d)}</b>${compact ? '' : `<small>${g.gd}</small>`}
      ${kinds.length ? `<span class="cal-dots">${KIND_ORDER.filter((k) => kinds.includes(k)).map((k) => `<i class="k-${k}"></i>`).join('')}</span>` : ''}
    </button>`;
  }
  const g1 = J.toGregorian(jy, jm, 1), gl = J.toGregorian(jy, jm, len);
  const gm = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { month: 'long' });
  const gLabel = `${gm.format(new Date(g1.gy, g1.gm - 1, 1))}${g1.gm !== gl.gm ? ' – ' + gm.format(new Date(gl.gy, gl.gm - 1, 1)) : ''} ${faNum(gl.gy)}`;
  return `<div class="cal ${compact ? 'compact' : ''}">
    <div class="cal-head">
      <button type="button" class="icon-btn" data-cal-prev aria-label="ماه قبل">${ic('prev')}</button>
      <div class="cal-title"><b>${J.MONTHS[jm - 1]} ${faNum(jy)}</b>${compact ? '' : `<small>${gLabel}</small>`}</div>
      <button type="button" class="icon-btn" data-cal-next aria-label="ماه بعد">${ic('next')}</button>
    </div>
    <div class="cal-week">${J.WEEKDAYS_SHORT.map((w, i) => `<span class="${i === 6 ? 'off' : ''}">${w}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
  </div>`;
}
function viewCalendar(v) {
  if (!ui.cal) { const t = J.todayJ(); ui.cal = { jy: t.jy, jm: t.jm }; }
  const { jy, jm } = ui.cal;
  const sel = J.parseJ(ui.calSel);
  const dayEntries = live('entries').filter((e) => e.date === ui.calSel).sort((a, b) => b.updatedAt - a.updatedAt);
  const m = monthTotals(jy, jm);
  const hol = J.SOLAR_HOLIDAYS[`${sel.jm}/${sel.jd}`];
  const g = J.toGregorian(sel.jy, sel.jm, sel.jd);
  const gLabel = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(g.gy, g.gm - 1, g.gd));
  v.innerHTML = `
    <div class="page-head"><h1>تقویم</h1><button class="btn ghost" id="toToday">امروز</button></div>
    <div class="cal-layout">
      <section class="card cal-card">${calendarGrid(jy, jm, ui.calSel)}
        <div class="cal-month-sum"><span class="lg income">درآمد <b class="num">${fmt(m.income, true)}</b></span><span class="lg expense">هزینه <b class="num">${fmt(m.expense, true)}</b></span></div>
      </section>
      <section class="card day-card">
        <div class="card-head"><div><h3>${J.WEEKDAYS[J.weekdayIndex(sel.jy, sel.jm, sel.jd)]} ${dateLabel(ui.calSel, true)}</h3><div class="muted small">${gLabel}${hol ? ' · <span class="holiday">' + hol + '</span>' : ''}</div></div>
          <button class="btn ghost small-btn" id="addOnDay">${ic('plus')} ثبت</button></div>
        <div class="list">${dayEntries.length ? dayEntries.map(entryRow).join('') : emptyState('برای این روز چیزی ثبت نشده', '')}</div>
      </section>
    </div>`;
  $('[data-cal-prev]', v).onclick = () => { ui.cal = J.addMonths(jy, jm, -1); render(); };
  $('[data-cal-next]', v).onclick = () => { ui.cal = J.addMonths(jy, jm, 1); render(); };
  $$('[data-day]', v).forEach((b) => (b.onclick = () => { ui.calSel = b.dataset.day; render(); }));
  $('#toToday', v).onclick = () => { const t = J.todayJ(); ui.cal = { jy: t.jy, jm: t.jm }; ui.calSel = J.todayStr(); render(); };
  $('#addOnDay', v).onclick = () => openEntrySheet({ kind: 'expense', date: ui.calSel });
  bindCommon(v);
}

/* ---------------- تنظیمات ---------------- */
function viewSettings(v) {
  const s = store.settings;
  v.innerHTML = `
    <div class="page-head"><button class="icon-btn" data-go="home" aria-label="بازگشت">${ic('back')}</button><h1>تنظیمات</h1></div>
    ${isStandalone() ? '' : `<section class="card settings">
      <h3>نصب به صورت اپ</h3>
      <p class="muted small">پنل رو مثل یک اپ روی صفحه‌ی اصلی گوشی یا لپ‌تاپ نصب کن تا بدون مرورگر و تمام‌صفحه باز بشه.</p>
      <button class="btn primary" id="installBtn2">${ic('download')} نصب اپ</button>
    </section>`}
    <section class="card settings">
      <h3>سبک ظاهر</h3>
      <div class="style-pick">
        <button class="style-opt ${s.style !== 'glass' ? 'on' : ''}" data-ui-style="liquid" aria-pressed="${s.style !== 'glass'}">
          <span class="sw sw-liquid"><i></i></span><b dir="ltr">Liquid Glass</b><small>سیاه و سفید، مینیمال</small></button>
        <button class="style-opt ${s.style === 'glass' ? 'on' : ''}" data-ui-style="glass" aria-pressed="${s.style === 'glass'}">
          <span class="sw sw-glass"><i></i></span><b dir="ltr">Glassmorphism</b><small>شیشه‌ی مات روی پس‌زمینه‌ی رنگی</small></button>
      </div>
      <h3>حالت روشن / تیره</h3>
      <div class="segmented theme-seg"><div class="seg-pill"></div>${[['system', 'خودکار'], ['light', 'روشن'], ['dark', 'تیره']].map(([k, l]) => `<button class="seg ${s.theme === k ? 'active' : ''}" data-theme="${k}">${l}</button>`).join('')}</div>
    </section>

    <section class="card settings">
      <h3>همگام‌سازی لپ‌تاپ و موبایل</h3>
      ${syncEnabled() && s.gistId ? `
        <p class="ok-line">${ic('cloud')} متصل · ${sync.status === 'error' ? '<span class="err">' + esc(sync.error) + '</span>' : 'آخرین همگام‌سازی ' + ago(sync.lastSync)}</p>
        <p class="muted small">شناسه Gist: <code dir="ltr">${esc(s.gistId)}</code></p>
        <div class="row-btns"><button class="btn primary" id="syncNow">${ic('refresh')} همگام‌سازی الان</button><button class="btn ghost" id="syncOff">قطع اتصال</button></div>` : `
        <p class="muted small">داده‌ها در یک Gist خصوصی در حساب گیت‌هابت ذخیره می‌شن. روی هر دستگاه یک بار همین توکن رو وارد کن.</p>
        <ol class="steps small">
          <li>در گیت‌هاب: Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token</li>
          <li>در بخش Account permissions، دسترسی <b>Gists</b> را روی <b>Read and write</b> بگذار (هیچ دسترسی دیگری لازم نیست)</li>
          <li>توکن را کپی کن و اینجا وارد کن</li>
        </ol>
        <label class="field"><span>توکن گیت‌هاب</span><input id="tok" dir="ltr" type="password" placeholder="github_pat_…" value=""></label>
        <label class="field"><span>شناسه Gist (اختیاری)</span><input id="gid" dir="ltr" placeholder="خالی بگذار تا خودکار پیدا یا ساخته شود" value="${esc(s.gistId)}"></label>
        <button class="btn primary" id="syncOn">${ic('cloud')} اتصال</button>`}
    </section>

    <section class="card settings">
      <h3>منبع قیمت‌ها</h3>
      <p class="muted small">بدون کلید، قیمت‌ها از نوبیتکس به صورت تقریبی محاسبه می‌شن. با کلید رایگان <b dir="ltr">BrsApi.ir</b> قیمت دقیق بازار آزاد و شاخص بورس دریافت می‌شه.</p>
      <label class="field"><span>کلید BrsApi</span><input id="brs" dir="ltr" placeholder="API key" value="${esc(s.brsKey)}"></label>
      <button class="btn ghost" id="saveBrs">ذخیره و به‌روزرسانی قیمت‌ها</button>
    </section>

    <section class="card settings">
      <h3>قفل با رمز</h3>
      <p class="muted small">${s.pinHash ? 'قفل فعال است. با باز کردن پنل، رمز پرسیده می‌شه.' : 'یک رمز ۴ تا ۶ رقمی بگذار تا کسی بدون اجازه پنلت رو نبینه.'}</p>
      <div class="row-btns"><button class="btn ghost" id="setPin">${ic('lock')} ${s.pinHash ? 'تغییر رمز' : 'تنظیم رمز'}</button>${s.pinHash ? '<button class="btn ghost" id="rmPin">حذف رمز</button>' : ''}</div>
    </section>

    <section class="card settings">
      <h3>دسته‌بندی هزینه‌ها</h3>
      <div class="chips-select" id="catList">${cats().map((c) => `<span class="chip on">${esc(c)}<button class="chip-x" data-rmcat="${esc(c)}" aria-label="حذف ${esc(c)}">${ic('x')}</button></span>`).join('')}</div>
      <form class="inline-add" id="catAdd"><input id="newCat" maxlength="24" placeholder="دسته جدید"><button class="btn ghost">${ic('plus')} افزودن</button></form>
    </section>

    <section class="card settings">
      <h3>پشتیبان</h3>
      <div class="row-btns">
        <button class="btn ghost" id="exp">${ic('download')} خروجی JSON</button>
        <label class="btn ghost">${ic('upload')} ورود از فایل<input type="file" id="imp" accept="application/json" hidden></label>
      </div>
    </section>
    <p class="muted small center">پنل مالی · نسخه ۱٫۰</p>`;

  bindCommon(v);
  $$('[data-theme]', v).forEach((b) => (b.onclick = () => { s.theme = b.dataset.theme; store.saveSettings(); applyTheme(); renderShell(); render(); }));
  placeSegPill($('.theme-seg', v));
  $$('[data-ui-style]', v).forEach((b) => (b.onclick = () => { s.style = b.dataset.uiStyle; store.saveSettings(); applyTheme(); renderShell(); render(); }));
  $('#syncOn', v)?.addEventListener('click', async () => {
    const tok = $('#tok', v).value.trim();
    if (!tok) { toast('توکن را وارد کن'); return; }
    s.gistToken = tok; s.gistId = $('#gid', v).value.trim(); store.saveSettings();
    try { await connect(); toast('متصل شد'); } catch (e) { s.gistToken = ''; store.saveSettings(); toast('خطا: ' + e.message); }
    render();
  });
  $('#syncNow', v)?.addEventListener('click', async () => { await syncNow(true); render(); toast(sync.status === 'ok' ? 'همگام شد' : 'خطا: ' + sync.error); });
  $('#syncOff', v)?.addEventListener('click', () => { if (confirm('اتصال قطع بشه؟ داده‌های این دستگاه می‌مونه.')) { disconnect(); render(); } });
  $('#saveBrs', v).onclick = async () => { s.brsKey = $('#brs', v).value.trim(); store.saveSettings(); toast('در حال دریافت قیمت…'); await refreshPrices(); toast(prices.errors?.length ? prices.errors[0] : 'قیمت‌ها به‌روز شد'); };
  $('#setPin', v).onclick = () => pinSetup();
  $('#installBtn2', v)?.addEventListener('click', installApp);
  $('#rmPin', v)?.addEventListener('click', () => { s.pinHash = ''; store.saveSettings(); render(); toast('رمز حذف شد'); });
  $$('[data-rmcat]', v).forEach((b) => (b.onclick = () => { store.data.categories = { list: cats().filter((c) => c !== b.dataset.rmcat), updatedAt: Date.now() }; store.save(); render(); }));
  $('#catAdd', v).onsubmit = (e) => { e.preventDefault(); const n = $('#newCat', v).value.trim(); if (n && !cats().includes(n)) { store.data.categories = { list: [...cats(), n], updatedAt: Date.now() }; store.save(); render(); } };
  $('#exp', v).onclick = () => {
    const blob = new Blob([JSON.stringify(store.data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `finance-panel-${J.todayStr().replaceAll('/', '-')}.json`; a.click();
  };
  $('#imp', v).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!Array.isArray(d.entries)) throw new Error();
      const { mergeData } = await import('./store.js');
      store.data = mergeData(store.data, d); store.save(); toast('داده‌ها وارد شد'); render();
    } catch { toast('فایل نامعتبر است'); }
  };
}

/* ---------------- قفل رمز ---------------- */
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('fp:' + pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function keypad(title, onDone, { allowCancel = false, subtitle = '' } = {}) {
  const lock = $('#lock');
  let pin = '';
  lock.hidden = false;
  lock.innerHTML = `<div class="lock-box">
    <div class="lock-ic">${ic('lock')}</div><h2>${title}</h2><p class="muted small" id="lockSub">${subtitle}</p>
    <div class="pin-dots">${'<i></i>'.repeat(6)}</div>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'ok', 0, 'del'].map((k) => `<button class="key ${typeof k === 'string' ? 'fn' : ''}" data-key="${k}" aria-label="${k === 'del' ? 'پاک کردن' : k === 'ok' ? 'تایید' : k}">${k === 'del' ? ic('back') : k === 'ok' ? ic('check') : faNum(k)}</button>`).join('')}</div>
    ${allowCancel ? '<button class="link-btn" id="lockCancel">انصراف</button>' : ''}
  </div>`;
  const dots = $$('.pin-dots i', lock);
  const draw = () => dots.forEach((d, i) => d.classList.toggle('on', i < pin.length));
  const submit = async () => { if (pin.length >= 4) { const r = await onDone(pin); if (r === false) { lock.querySelector('.pin-dots').classList.add('shake'); setTimeout(() => lock.querySelector('.pin-dots')?.classList.remove('shake'), 400); pin = ''; draw(); } } };
  const press = (k) => {
    if (k === 'del') pin = pin.slice(0, -1);
    else if (k === 'ok') return submit();
    else if (pin.length < 6) pin += k;
    draw();
    if (pin.length === 6) submit();
  };
  $$('[data-key]', lock).forEach((b) => (b.onclick = () => press(b.dataset.key)));
  lock._key = (e) => { const k = toLatin(e.key); if (/^\d$/.test(k)) press(k); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('ok'); };
  document.addEventListener('keydown', lock._key);
  $('#lockCancel', lock)?.addEventListener('click', closeLock);
}
function closeLock() { const l = $('#lock'); document.removeEventListener('keydown', l._key); l.hidden = true; l.innerHTML = ''; }
function showLock() {
  if (!store.settings.pinHash) return;
  keypad('پنل قفل است', async (pin) => {
    if ((await hashPin(pin)) === store.settings.pinHash) { closeLock(); return true; }
    $('#lockSub').textContent = 'رمز اشتباه است';
    return false;
  }, { subtitle: 'رمز را وارد کن' });
}
function pinSetup() {
  keypad('رمز جدید', (p1) => {
    keypad('تکرار رمز', async (p2) => {
      if (p1 !== p2) { $('#lockSub').textContent = 'رمزها یکسان نیستند'; return false; }
      store.settings.pinHash = await hashPin(p1); store.saveSettings(); closeLock(); toast('رمز تنظیم شد'); render();
      return true;
    }, { allowCancel: true, subtitle: 'دوباره وارد کن' });
  }, { allowCancel: true, subtitle: '۴ تا ۶ رقم — بعد از ۴ رقم با ✓ تایید کن' });
}

/* ---------------- راه‌اندازی ---------------- */
/* ---------------- نصب اپ (PWA) ---------------- */
let deferredPrompt = null;
function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn')?.classList.add('ready'); });
window.addEventListener('appinstalled', () => { deferredPrompt = null; toast('اپ نصب شد'); renderShell(); updateNav(); });
async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') return;
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const iosOther = ios && /CriOS|FxiOS|EdgiOS/.test(ua);
  const android = /Android/.test(ua);
  const inApp = /Instagram|FBAN|FBAV|Telegram|WhatsApp|Line\//.test(ua);
  let steps;
  if (inApp) steps = ['این صفحه داخل مرورگر یک اپ دیگه (مثل تلگرام یا اینستاگرام) باز شده و اونجا نصب ممکن نیست.', 'از منوی ⋮ یا ··· گزینه‌ی «Open in browser» رو بزن تا در Chrome یا Safari باز بشه.', 'بعد دوباره دکمه‌ی نصب رو بزن.'];
  else if (iosOther) steps = ['در آیفون فقط Safari امکان نصب داره.', 'لینک رو کپی کن و در Safari باز کن.', 'بعد مراحل نصب Safari رو انجام بده.'];
  else if (ios) steps = ['پایین صفحه‌ی Safari دکمه‌ی <b>Share</b> (مربع با فلش رو به بالا) رو بزن.', 'کمی پایین برو و <b>Add to Home Screen</b> رو انتخاب کن.', 'بالا سمت راست <b>Add</b> رو بزن. آیکون پنل روی صفحه‌ی اصلی میاد.'];
  else if (android) steps = ['در Chrome، منوی <b>⋮</b> بالا سمت راست رو باز کن.', 'گزینه‌ی <b>Install app</b> یا <b>Add to Home screen</b> رو بزن.', '<b>Install</b> رو تایید کن.', 'اگه این گزینه نبود، مطمئن شو در Chrome هستی (نه مرورگر دیگه) و صفحه رو یک بار رفرش کن.'];
  else steps = ['در Chrome یا Edge، سمت راست نوار آدرس یک آیکون نصب (مانیتور با فلش) هست، روش بزن.', 'یا از منوی <b>⋮</b> گزینه‌ی <b>Cast, save and share ← Install page as app</b> (یا <b>Apps ← Install</b>) رو بزن.', 'در Safari مک: منوی <b>File ← Add to Dock</b>.', 'Firefox دسکتاپ امکان نصب نداره؛ از Chrome یا Edge استفاده کن.'];
  openSheet(`
    <div class="sheet-head"><h2>نصب پنل به صورت اپ</h2><button class="icon-btn" data-close aria-label="بستن">${ic('x')}</button></div>
    <ol class="install-steps">${steps.map((t) => `<li>${t}</li>`).join('')}</ol>
    <button class="btn primary" data-close>متوجه شدم</button>`);
}

function boot() {
  applyTheme();
  parseHash();
  renderShell();
  render();
  showLock();

  window.addEventListener('hashchange', () => { parseHash(); render(); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });
  window.addEventListener('resize', () => { updateNav(); const seg = $('.view .segmented'); if (seg) placeSegPill(seg); });

  store.on((type) => {
    if (type === 'local') schedulePush();
    if (type === 'local' || type === 'remote') { if (!$('#sheet-root').classList.contains('open') || type === 'local') render(); }
  });
  onSync(() => { updateSyncDot(); });

  // قیمت‌ها: الان و هر ۵ دقیقه
  const pull = async () => { await refreshPrices(); if (['home', 'market', 'purchases'].includes(ui.route) && !$('#sheet-root').classList.contains('open')) render(); };
  pull();
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 5 * 60e3);

  // تاریخ امروز (بعد از نیمه‌شب) و قفل بعد از ۵ دقیقه دوری
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else {
      const td = $('#today'); if (td) td.textContent = todayLabel();
      if (hiddenAt && Date.now() - hiddenAt > 5 * 60e3 && $('#lock').hidden) showLock();
    }
  });
  setInterval(() => { const td = $('#today'); if (td) td.textContent = todayLabel(); }, 60e3);

  startAutoSync();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
