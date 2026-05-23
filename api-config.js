// GitHub Pages cannot run server.js or /api routes.
// After deploying the backend to Vercel, Netlify, or Render, put that URL here.
// Example: window.CONTACT_API_BASE_URL = "https://your-backend.vercel.app";
window.CONTACT_API_STATIC_HOSTING = true;
const isLocalContactPreview = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
const isVercelContactPreview = window.location.hostname.endsWith(".vercel.app");
window.CONTACT_API_BASE_URL = isLocalContactPreview
  ? "http://localhost:3000"
  : isVercelContactPreview
  ? window.location.origin
  : "https://adulxdivsey.vercel.app";
