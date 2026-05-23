// GitHub Pages and other static hosts cannot run server.js or /api routes.
// The deployed backend is hosted on Render.
window.CONTACT_API_STATIC_HOSTING = true;
const isLocalContactPreview = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
window.CONTACT_API_BASE_URL = isLocalContactPreview
  ? "http://localhost:3000"
  : "https://adulxdivsey.onrender.com";
