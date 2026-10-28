// سرویس ورکر: پوسته برنامه آفلاین کار می‌کند؛ قیمت‌ها و همگام‌سازی همیشه از شبکه
const VERSION = 'fp-v1.1.0';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'js/store.js', 'js/sync.js', 'js/prices.js', 'js/charts.js', 'js/format.js', 'js/jalali.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // API ها: فقط شبکه
  if (/api\.github\.com|nobitex|brsapi|er-api/i.test(url.host)) return;
  // فایل‌های خود برنامه: اول شبکه (برای دریافت نسخه جدید)، در صورت قطعی از کش
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  // فونت: اول کش
  if (/jsdelivr/.test(url.host)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })));
  }
});
