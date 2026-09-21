import './hub.css';
// Update installed copies to the new shared home screen.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(registration => registration.update()).catch(() => {});
}
