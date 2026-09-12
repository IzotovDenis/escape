const panel = document.getElementById('install-panel');
const install = document.getElementById('install-app');
const status = document.getElementById('offline-status');
const update = document.getElementById('update-app');
let prompt;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (standalone()) panel.querySelector('summary').textContent = 'Игра на твоём телефоне';
addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); prompt = event;
  if (!standalone()) install.hidden = false;
});
install.addEventListener('click', async () => {
  if (!prompt) return;
  const current = prompt; prompt = null; install.hidden = true;
  await current.prompt(); await current.userChoice;
});
addEventListener('appinstalled', () => {
  install.hidden = true; prompt = null;
  panel.querySelector('summary').textContent = 'Игра установлена';
});
// Cache only production builds, never development source modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => {
    function ready() { status.textContent = 'Сохранено на устройстве — можно играть без интернета.'; }
    function offerUpdate() {
      if (!registration.waiting) return;
      update.hidden = false;
      update.onclick = () => { reloading = true; registration.waiting?.postMessage({ type: 'SKIP_WAITING' }); };
    }
    if (registration.active) ready();
    offerUpdate();
    function watch(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') {
          if (navigator.serviceWorker.controller) offerUpdate(); else ready();
        }
        if (worker.state === 'redundant') status.textContent = 'Для сохранения игры проверь интернет и открой её ещё раз.';
      });
    }
    watch(registration.installing);
    registration.addEventListener('updatefound', () => watch(registration.installing));
  }).catch(() => { status.textContent = 'Сейчас игра доступна с интернетом. Для сохранения открой её в обычном режиме браузера.'; });
} else {
  status.textContent = import.meta.env.DEV ? 'Офлайн-режим появится в опубликованной версии.' : 'Для игры потребуется интернет.';
}
