// Service worker do site (PWA): deixa o app ser instalado e abrir sem internet.
// Registrado só no navegador, em produção (src/native/index.ts); nunca dentro do app Android/iOS.
//
// Estratégia: REDE PRIMEIRO, cache de reserva. Com o Vite os arquivos têm hash no nome
// (assets/index-AbC123.js), então não há lista fixa: o que o site usa entra no cache quando é baixado.
// O node montar-site.js acrescenta ao CACHE um resumo do conteúdo a cada montagem; não precisa mexer à mão.
const CACHE = 'simplificando-financas-v2-142c86efab';
// v2: leitor de PDF ("Ler PDF ou foto") guardado na instalação, para ler extratos e faturas sem internet.
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'config.js', 'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // a página inicial e os arquivos que ela cita (descobertos no próprio index.html)
      const res = await fetch('index.html', {cache: 'reload'});
      if (res.ok) {
        const html = await res.clone().text();
        await cache.put('index.html', res);
        const citados = [...html.matchAll(/(?:src|href)="(?:\.\/)?(assets\/[^"?#]+)"/g)].map((m) => m[1]);
        await Promise.all([...new Set([...BASE.filter((u) => u !== 'index.html'), ...citados])].map((u) => cache.add(u).catch(() => {})));
      }
    } catch { /* sem internet na instalação: o cache se forma no uso */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter((n) => n.startsWith('simplificando-financas') && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Só GET do próprio site; Supabase, Firebase e outros endereços passam direto.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    } catch (erro) {
      const cache = await caches.open(CACHE);
      const salvo = await cache.match(req, {ignoreSearch: true});
      if (salvo) return salvo;
      // navegação sem internet: abre o app (index.html) do cache
      if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      throw erro;
    }
  })());
});
