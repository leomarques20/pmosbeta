# Environment Configuration

This project requires environment variables to be configured for deployment.

## Local Development

1. Copy `env.example.json` to `env.json`:
   ```bash
   cp env.example.json env.json
   ```

2. Fill in your Firebase web configuration values in `env.json`.
   `env.json` is served to the browser as a fallback, so do **not** put
   `GEMINI_API_KEY` (or any other secret) in it. To test the AI functions
   locally, run `netlify dev` with `GEMINI_API_KEY` set in your shell or `.env`.

## Netlify Deployment

The `env.json` file is excluded from version control for security. For Netlify deployment, configure the environment variables in the Netlify dashboard:

### Required Environment Variables

1. Go to: **Site settings** → **Environment variables**
2. Add the following variables:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`  
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_MEASUREMENT_ID`
- `GEMINI_API_KEY` (secret — server-side only)
- `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

Only the `FIREBASE_*` values are exposed to the browser, via the
`/.netlify/functions/env` serverless function. `GEMINI_API_KEY` and
`GEMINI_MODEL` are read only by the AI functions (`/.netlify/functions/ai-proxy`,
used by the app, and `/.netlify/functions/ai`).

## Security Note

**Never commit `env.json` or any files containing real API keys to version control.**
