// This script loads environment variables from a Netlify function
// and exposes them to client-side code via `window.env`.

// Immediately invoke a function to fetch environment variables synchronously
// before other modules (like auth.js) execute. This ensures that Firebase
// configuration values are available when the app initializes.
(function () {
  window.env = {};

  function isValidJson(xhr) {
    const contentType = xhr.getResponseHeader("content-type");
    return xhr.status === 200 && contentType && contentType.includes("application/json");
  }

  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/.netlify/functions/env', false);
    xhr.send(null);

    if (isValidJson(xhr)) {
      try {
        window.env = JSON.parse(xhr.responseText);
        console.log('Loaded env from Netlify Function');
      } catch (e) {
        console.warn('Failed to parse Netlify Function response', e);
      }
    }

    // Fallback if function failed or returned empty/invalid
    if (!window.env.FIREBASE_API_KEY) {
      console.warn('Netlify Function failed or empty. Trying env.json...');
      var xhrLocal = new XMLHttpRequest();
      xhrLocal.open('GET', '/env.json', false);
      xhrLocal.send(null);

      if (isValidJson(xhrLocal)) {
        try {
          window.env = JSON.parse(xhrLocal.responseText);
          console.log('Loaded env from env.json');
        } catch (e) {
          console.error('Failed to parse env.json', e);
        }
      } else {
        console.error('env.json not found or not JSON (likely 404 rewrite)');
      }
    }
  } catch (e) {
    console.error('Error fetching environment variables:', e);
  }
})();