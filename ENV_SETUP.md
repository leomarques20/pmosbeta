# Environment Configuration

This project requires environment variables to be configured for deployment.

## Local Development

1. Copy `env.example.json` to `env.json`:
   ```bash
   cp env.example.json env.json
   ```

2. Fill in your actual API keys and configuration values in `env.json`

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
- `GEMINI_API_KEY`

These values will be automatically injected by the `/.netlify/functions/env` serverless function.

## Security Note

**Never commit `env.json` or any files containing real API keys to version control.**
