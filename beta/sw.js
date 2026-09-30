// Run Base — service worker: guarda a "casca" do app para abrir rápido e funcionar com internet ruim.
// Dados do Supabase nunca são guardados aqui: sempre vêm da rede.
var VERSION = 'rb-v2.2.0';
var SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/app.css?v=2.2.0',
  'js/config.js?v=2.2.0', 'js/core.js?v=2.2.0', 'js/charts.js?v=2.2.0', 'js/threads.js?v=2.2.0',
  'js/reports.js?v=2.2.0', 'js/strength.js?v=2.2.0', 'js/milestones.js?v=2.2.0', 'js/athlete.js?v=2.2.0', 'js/coach.js?v=2.2.0',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'
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
