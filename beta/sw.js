// Run Base — service worker: guarda a "casca" do app para abrir rápido e funcionar com internet ruim.
// Dados do Supabase nunca são guardados aqui: sempre vêm da rede.
var VERSION = 'rb-v2.4.3';
var SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css?v=2.4.3',
  'js/config.js?v=2.4.3', 'js/core.js?v=2.4.3', 'js/charts.js?v=2.4.3', 'js/threads.js?v=2.4.3',
  'js/reports.js?v=2.4.3', 'js/strength.js?v=2.4.3', 'js/pace.js?v=2.4.3', 'js/push.js?v=2.4.3', 'js/events.js?v=2.4.3', 'js/editor.js?v=2.4.3', 'js/share.js?v=2.4.3', 'js/milestones.js?v=2.4.3', 'js/athlete.js?v=2.4.3', 'js/coach.js?v=2.4.3',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png', 'fonts/aileron-latin-800-italic.woff2', 'fonts/aileron-latin-800-normal.woff2', 'fonts/aileron-latin-700-normal.woff2', 'fonts/aileron-latin-400-normal.woff2'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  var isLib = url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !isFont && !isLib) return; // Supabase e o resto: sempre rede
  if (req.mode === 'navigate') {
    // página: tenta a rede primeiro (pega atualizações), cai para o cache se estiver offline
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
      return res;
    }).catch(function () { return caches.match('index.html'); }));
    return;
  }
  // arquivos estáticos: cache primeiro, atualiza em segundo plano
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res.ok || res.type === 'opaque') { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

// ---- notificações ----
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Run Base', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Run Base', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: 'icons/icon-192.png', badge: 'icons/favicon.png', data: { tab: d.tab || '' }
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var tab = (e.notification.data && e.notification.data.tab) || '';
  var url = self.registration.scope + (tab ? '#' + tab : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf(self.registration.scope) === 0) { list[i].postMessage({ tab: tab }); return list[i].focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
