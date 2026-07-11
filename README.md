# Firebase Contact Backend (Railway deployment)

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
- `CONTACT_TABLE` - Table name for contacts (default: `contacts`)
- `PORT` - Optional override of the port (Railway provides this automatically)

Only provide Supabase credentials in a secure environment (Railway's env panel or secret store).

## API Endpoints

- `GET /api/health` — Health check
- `POST /api/contact` — Submit contact form

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

If you'd like, I can also update the `package.json` `start` script or add a `Procfile`/Railway-specific notes — tell me which you'd prefer.
