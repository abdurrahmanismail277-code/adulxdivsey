# Firebase Contact Backend

A Node.js backend server for handling contact form submissions with Supabase integration.

## Features

- REST API for contact form submissions
- Supabase database integration
- Local JSON fallback when Supabase is not configured
- CORS enabled for frontend integration
- Automatic UUID generation for submissions

## Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your actual Supabase credentials.

4. **Start the server**
   ```bash
   npm start
   ```

The server will run on port 3000 by default.

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/contact` - Submit contact form

### Contact Form Data Structure

```json
{
  "name": "string",
  "phone": "string",
  "email": "string",
  "course": "string",
  "billing": "string",
  "amount": "number"
}
```

## Deployment

This backend is designed to work with Netlify Functions for production deployment. The `netlify.toml` file in the root directory handles the routing.

## Environment Variables

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `CONTACT_TABLE` - Table name for contacts (default: 'contacts')
- `PORT` - Server port (default: 3000)