const isBackendHost =
  ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
  window.location.port === '3000';
const renderBackendUrl = 'https://adulxdivsey-4.onrender.com';

window.CONTACT_API_URL =
  window.CONTACT_API_URL ||
  (isBackendHost ? '/api/contact' : `${renderBackendUrl}/api/contact`);
