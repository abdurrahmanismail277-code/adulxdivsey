// Netlify production uses same-origin API routes from netlify.toml:
// /api/contact -> /.netlify/functions/contact
const CONTACT_NETLIFY_BACKEND_URL = "https://arresalahinstitute.netlify.app";
window.CONTACT_API_BASE_URL = CONTACT_NETLIFY_BACKEND_URL;
