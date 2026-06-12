const isBackendHost =
  ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
  window.location.port === '3000';
const isLocalStaticPreview =
  window.location.protocol === 'file:' ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.location.port !== '3000');

window.CONTACT_API_URL =
  window.CONTACT_API_URL ||
  (isBackendHost ? '/api/contact' : isLocalStaticPreview ? 'http://localhost:3000/api/contact' : '/api/contact');
