const RAILWAY_API_ORIGIN = '';
const currentContactApiUrl = window.CONTACT_API_URL || '';
const isOldRenderApi = currentContactApiUrl.includes('arresalah-institute-api.onrender.com');

window.CONTACT_API_URL = RAILWAY_API_ORIGIN
  ? `${RAILWAY_API_ORIGIN.replace(/\/$/, '')}/api/contact`
  : (!currentContactApiUrl || isOldRenderApi ? '/api/contact' : currentContactApiUrl);
