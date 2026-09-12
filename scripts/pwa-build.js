import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';

export function pwaBuild() {
  let config;
  return {
    name: 'peremena-offline',
    apply: 'build',
    configResolved(value) { config = value; },
    async closeBundle() {
      const dir = resolve(config.root, config.build.outDir);
      async function list(path) {
        const entries = await readdir(path, { withFileTypes: true });
        return (await Promise.all(entries.map(entry => entry.isDirectory() ? list(resolve(path, entry.name)) : resolve(path, entry.name)))).flat();
      }
      const files = (await list(dir)).filter(path => !path.endsWith('/sw.js')).sort();
      const hash = createHash('sha256');
      hash.update(await readFile(new URL(import.meta.url)));
      for (const path of files) { hash.update(relative(dir, path)); hash.update(await readFile(path)); }
      const base = config.base;
      const urls = files.map(path => base + relative(dir, path).split(sep).join('/'));
      const worker = `const CACHE = 'peremena-escape-${hash.digest('hex').slice(0, 16)}';
const URLS = ${JSON.stringify(urls)};
const BASE = ${JSON.stringify(base)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(URLS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('peremena-escape-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const key = event.request.mode === 'navigate' ? BASE + 'index.html' : event.request;
    return (await cache.match(key, { ignoreVary: true })) || fetch(event.request);
  }));
});
`;
      await writeFile(resolve(dir, 'sw.js'), worker);
    },
  };
}
