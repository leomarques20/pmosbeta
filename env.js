// This script loads environment variables from a Netlify function
// and exposes them to client-side code via `window.env`.

// Immediately invoke a function to fetch environment variables synchronously
// before other modules (like auth.js) execute. This ensures that Firebase
// configuration values are available when the app initializes.
(function () {
  // Provide a default empty object in case the fetch fails
  window.env = {};
  try {
    var xhr = new XMLHttpRequest();
    // The Netlify function at `/.netlify/functions/env` returns the
    // Firebase configuration stored in Netlify environment variables.
    xhr.open('GET', '/.netlify/functions/env', false); // synchronous request
    xhr.send(null);
    if (xhr.status === 200) {
      // Parse the JSON response and assign it to window.env
      window.env = JSON.parse(xhr.responseText);
    } else {
      console.warn('Failed to load environment variables from Netlify function. Trying env.json...');
      // Fallback: Try loading from env.json
      var xhrLocal = new XMLHttpRequest();
      xhrLocal.open('GET', '/env.json', false);
      xhrLocal.send(null);
      if (xhrLocal.status === 200) {
        window.env = JSON.parse(xhrLocal.responseText);
        console.log('Loaded environment variables from env.json');
      } else {
        console.error('Failed to load environment variables from env.json: HTTP', xhrLocal.status);
      }
    }
  } catch (e) {
    console.error('Error fetching environment variables:', e);
  }
})();