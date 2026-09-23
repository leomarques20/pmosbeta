// This script loads environment variables from a Netlify function
// and exposes them to client-side code via `window.env`.

// Immediately invoke a function to fetch environment variables synchronously
// before other modules (like auth.js) execute. This ensures that Firebase
// configuration values are available when the app initializes.
// Qualquer falha aqui é tratada: `window.env` sempre termina como um objeto
// (possivelmente vazio) e o PMOS inicia em modo convidado.
(function () {
  window.env = {};

  function isValidJson(xhr) {
    const contentType = xhr.getResponseHeader("content-type");
    return xhr.status === 200 && contentType && contentType.includes("application/json");
  }

  // Faz uma requisição síncrona e devolve o objeto JSON, ou null em caso de falha.
  function loadJsonSync(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      if (!isValidJson(xhr)) return null;
      var parsed = JSON.parse(xhr.responseText);
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : null;
    } catch (e) {
      console.warn('Falha ao carregar ' + url + ':', e);
      return null;
    }
  }

  var fromFunction = loadJsonSync('/.netlify/functions/env');
  if (fromFunction && fromFunction.FIREBASE_API_KEY) {
    window.env = fromFunction;
    console.log('Loaded env from Netlify Function');
    return;
  }

  // Fallback if function failed or returned empty/invalid
  console.warn('Netlify Function failed or empty. Trying env.json...');
  var fromLocal = loadJsonSync('/env.json');
  if (fromLocal) {
    window.env = fromLocal;
    console.log('Loaded env from env.json');
  } else {
    if (fromFunction) window.env = fromFunction;
    console.warn('env.json not found or not JSON (likely 404 rewrite). O PMOS seguirá em modo convidado.');
  }
})();
