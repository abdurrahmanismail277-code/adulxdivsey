const isBackendHost =
  ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
  window.location.port === '3000';
const isLocalStaticPreview =
  window.location.protocol === 'file:' ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.location.port !== '3000');

window.CONTACT_API_URL =
  window.CONTACT_API_URL ||
  'https://adulxdivsey-3.onrender.com/api/contact';
