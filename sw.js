/* SESMT Grantel - deixa o app abrir sem internet.
   Tela do app: tenta a internet primeiro (até 4 s); sem sinal, usa a cópia guardada no celular.
   Os dados (Apps Script) não passam por aqui. */
const CACHE = 'sesmt-v2';
const ARQUIVOS = ['./', './index.html', './manifest.json', './icone.svg'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) { e.respondWith(guardadoPrimeiro(req)); return; }
  if (url.origin !== self.location.origin) return;
  e.respondWith(redePrimeiro(req));
});

// Fontes: usa a cópia guardada e só busca na internet se não tiver
async function guardadoPrimeiro(req) {
  const cache = await caches.open(CACHE);
  const c = await cache.match(req);
  if (c) return c;
  const r = await fetch(req);
  if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
  return r;
}

// Tela do app: internet primeiro; se demorar mais de 4 s ou não tiver sinal, a cópia guardada
async function redePrimeiro(req) {
  const cache = await caches.open(CACHE);
  const daRede = fetch(req).then(function (r) {
    if (r && r.ok) cache.put(req, r.clone());
    return r;
  });
  const guardado = function () {
    return cache.match(req, { ignoreSearch: true }).then(function (c) {
      return c || (req.mode === 'navigate' ? cache.match('./index.html') : null);
    });
  };
  try {
    return await Promise.race([daRede, new Promise(function (_, nao) { setTimeout(function () { nao(new Error('lento')); }, 4000); })]);
  } catch (e) {
    const c = await guardado();
    if (c) return c;
    return daRede;
  }
}
