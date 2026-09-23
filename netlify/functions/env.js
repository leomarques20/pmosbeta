// Netlify serverless function to expose PUBLIC client configuration.
// Only the Firebase *web* config is returned (these values are public by design
// and end up in the browser anyway). NEVER add secrets here — in particular
// GEMINI_API_KEY must stay server-side (used only by ai-proxy/ai functions).

const PUBLIC_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID',
];

exports.handler = async function(event, context) {
  const method = event && event.httpMethod;
  if (method && method !== 'GET' && method !== 'HEAD') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, HEAD' },
      body: JSON.stringify({ error: 'Method not allowed. Use GET.' }),
    };
  }

  const env = {};
  for (const key of PUBLIC_KEYS) {
    if (process.env[key]) env[key] = process.env[key];
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: method === 'HEAD' ? '' : JSON.stringify(env),
  };
};
