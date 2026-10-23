# Firebase Contact Backend (Railway deployment)

## Static website

The institute website is published from this repository as a GitHub Pages site (the repository has a `CNAME` and `.nojekyll`). Its source page is `templates/source.html`; shared navigation and footer markup live in `templates/partials/`. Run `npm run build` to generate the static pages directly in the repository root using the `folder/index.html` layout. GitHub Pages serves the generated clean URLs and `404.html`.

Run `npm run dev` to build the site and serve it locally at `http://localhost:4173`. The local server returns a real 404 for unknown paths.

The current GitHub Pages host does not support per-path 301 rules or a custom host redirect config in this repo. Configure apex-to-`www` and HTTP-to-HTTPS at the domain/GitHub Pages settings; `CNAME` keeps the canonical Pages host at `www.arresalahinstitute.com`. Legacy section hashes are redirected by the homepage JavaScript.

Update `templates/source.html` and the shared partials, then rebuild before publishing. Keep the backend `npm start` and `npm run dev:backend` scripts for Railway.

A Node.js backend for handling contact form submissions with optional Supabase integration. This README focuses on deploying the backend to Railway.

## Features

- REST API for contact form submissions
- Supabase integration (optional)
- Local JSON fallback when Supabase is not configured
- CORS enabled for frontend integration
- Automatic UUID generation for submissions

## Quick local setup

1. Clone the repository and change into the backend folder:

```bash
git clone <your-repo-url>
cd backend
```

2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in the values for local development:

```bash
cp .env.example .env
# edit .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
```

4. Start the server locally:

```bash
npm start
```

By default the server listens on `process.env.PORT || 3000`.

## Railway deployment

Railway makes deploying Node.js apps simple. You can deploy via the Railway web UI (GitHub integration) or the Railway CLI.

Using the Railway web dashboard (recommended):

1. Create a new project on Railway and connect your GitHub repository or push the code to a new GitHub repo.
2. Set the project root to the `backend` folder (if you connected a monorepo).
3. In Railway's Environment variables panel, add the required variables (see below).
4. Railway will detect the Node app and run the `start` script from `package.json`.

Using the Railway CLI:

```bash
# from the workspace root or inside backend/
railway init            # create or link a Railway project
railway up              # deploy the app
# set environment variables with Railway CLI if desired
railway variables set SUPABASE_URL=<your-url> SUPABASE_SERVICE_ROLE_KEY=<your-key> CONTACT_TABLE=contacts
```

Notes:

- Railway exposes your app on a dynamic port via `process.env.PORT`. The app must use `process.env.PORT` (this project does).
- For persistent storage (like the local JSON fallback), prefer using an external DB or Railway Plugins. The local `contacts.json` is for local/dev only and is not suitable for production.

## Environment variables

Set the following environment variables in Railway (or locally in `.env`):

- `SUPABASE_URL` - Your Supabase project URL (optional)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (required for server-side writes when using Supabase)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` - Cloudflare Turnstile site key; the backend returns this public key to the page
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile secret key; backend only, never put this in website JavaScript
- `CONTACT_TABLE` - Table name for contacts (default: `contacts`)
- `NOTIFICATION_TABLE` - Table for application update signups (default: `application_notifications`)
- `PORT` - Optional override of the port (Railway provides this automatically)

For server-side contact endpoints, provide Supabase credentials through the hosting provider's secure environment variables.

## API Endpoints

- `GET /api/health` — Health check
- `GET /api/turnstile-config` — Returns the public Turnstile site key
- `POST /api/contact` — Submit contact form

### Application opening notifications

Both the homepage's **Notify me** form and the enrollment form require a valid Cloudflare Turnstile token. The backend verifies each token with Cloudflare before writing to Supabase or the local fallback. Run [`supabase/application-notifications.sql`](./supabase/application-notifications.sql) in the Supabase SQL Editor to enable notification signups.

Create a Turnstile widget in Cloudflare in Managed mode with the dark theme, then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in the backend hosting environment. The frontend loads the public site key from `GET /api/turnstile-config`; the secret is only used by `turnstile.js`. The homepage and API must be served from the same origin, or the frontend's `CONTACT_API_URL` must point to this backend. Configure the backend CORS policy for the website origin if they are hosted separately.

Signups are stored for follow-up. The form does not send an email or WhatsApp message automatically when applications open.

### Contact payload example

```json
{
	"name": "string",
	"phone": "string",
	"email": "string",
	"course": "string",
	"billing": "string",
	"amount": 0
}
```

## Serving frontend from the same backend

If you want to serve frontend assets from this backend, place them in `backend/public` and configure `index.js` to use `express.static('public')` before your API routes.

## Troubleshooting & tips

- Check Railway logs in the project dashboard or with `railway logs` to debug startup/runtime errors.
- Confirm environment variables are present in Railway's Environment panel.
- For production, prefer Supabase or another hosted DB instead of the local JSON fallback.

### Railway health check failures

If you see a message like: "The health check endpoint didn't respond as expected", try the following:

- **Set the health check path to** `/api/health` in the Railway project settings (or update the health-check URL to match your app).
- **Ensure project root is `backend`** if your repository is a monorepo so Railway runs the correct `package.json` and `start` script.
- **Verify the `start` script** in `backend/package.json` is `node server.js` (Railway runs this to start the app).
- **Check logs** in the Deploy Logs tab or run `railway logs` for stack traces or startup errors.
- **Confirm `process.env.PORT` usage** — Railway provides a dynamic port; the app must listen on `process.env.PORT` (this project does).
- **Node version / fetch:** the code uses the global `fetch` API in server requests; if your Railway environment uses Node < 18, install a fetch polyfill or set `engines.node` to `>=18` in `package.json`.

If you want, I can add `engines.node` to `backend/package.json` to recommend Node 18+ or add a small `node-fetch` polyfill for older Node versions.

If you'd like, I can also update the `package.json` `start` script or add a `Procfile`/Railway-specific notes — tell me which you'd prefer.

