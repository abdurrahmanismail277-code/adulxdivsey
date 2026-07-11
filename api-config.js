const RAILWAY_API_ORIGIN = 'https://adulxdivsey-production.up.railway.app';
const currentContactApiUrl = window.CONTACT_API_URL || '';
const isOldRenderApi = currentContactApiUrl.includes('arresalah-institute-api.onrender.com');
const canUseRelativeContactApi = [
  'localhost',
  '127.0.0.1',
  ''
].includes(window.location.hostname) ||
  window.location.hostname.endsWith('.railway.app') ||
  window.location.hostname.endsWith('.up.railway.app');

window.CONTACT_API_URL = RAILWAY_API_ORIGIN
  ? `${RAILWAY_API_ORIGIN.replace(/\/$/, '')}/api/contact`
  : (!currentContactApiUrl || isOldRenderApi
      ? (canUseRelativeContactApi ? '/api/contact' : '')
      : currentContactApiUrl);
