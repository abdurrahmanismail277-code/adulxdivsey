const isBackendHost =
  ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
  window.location.port === '3000';
const isLocalStaticPreview =
  window.location.protocol === 'file:' ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.location.port !== '3000');
const localBackendOrigin = 'http://localhost:3000';
const productionBackendOrigin = 'https://arresalah-institute-api.onrender.com';

window.CONTACT_API_URL =
  window.CONTACT_API_URL ||
  (isLocalStaticPreview && !isBackendHost
    ? `${localBackendOrigin}/api/contact`
    : `${productionBackendOrigin}/api/contact`);
