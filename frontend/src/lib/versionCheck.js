// Detecta cuando se ha desplegado una versión nueva del frontend y avisa para
// recargar, sin que el usuario tenga que adivinar cuándo actualizar.
//
// Cómo: cada build de Vite genera assets con hash (/assets/index-XXXX.js|css)
// referenciados desde index.html. Esos hashes cambian en cada deploy. La app
// que está corriendo guarda la "firma" de los assets con los que se cargó y,
// cada cierto tiempo, vuelve a pedir index.html (que se sirve sin caché) para
// comparar. Si la firma cambió, hay una versión nueva en el servidor.

const ASSET_RE = /\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g;

function signatureFromHtml(html) {
  const m = html.match(ASSET_RE);
  return m ? [...new Set(m)].sort().join('|') : null;
}

// Firma de la versión que está corriendo ahora mismo, leída del DOM vivo
// (los <script src> y <link href> que el navegador ya cargó).
function liveSignature() {
  const urls = [];
  document.querySelectorAll('script[src], link[href]').forEach((el) => {
    const u = el.getAttribute('src') || el.getAttribute('href') || '';
    const found = u.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/);
    if (found) urls.push(found[0]);
  });
  return urls.length ? [...new Set(urls)].sort().join('|') : null;
}

// Llama onNewVersion() una vez cuando detecta un build distinto en el servidor.
// Devuelve una función para detener la vigilancia.
export function startVersionWatch(onNewVersion, intervalMs = 60000) {
  const loaded = liveSignature();
  // Sin firma local fiable no podemos comparar: no arriesgamos falsos positivos.
  if (!loaded) return () => {};

  let stopped = false;
  let timer = null;

  const check = async () => {
    if (stopped) return;
    try {
      const res = await fetch(`/?_v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const latest = signatureFromHtml(await res.text());
        if (latest && latest !== loaded) {
          onNewVersion();
          return; // detectada: dejamos de sondear
        }
      }
    } catch {
      /* sin red / offline: reintentamos en el siguiente ciclo */
    }
    if (!stopped) timer = setTimeout(check, intervalMs);
  };

  // Revisa al volver a la pestaña (típico en móvil al retomar la app) y por intervalo.
  const onVisible = () => { if (document.visibilityState === 'visible') check(); };
  document.addEventListener('visibilitychange', onVisible);
  timer = setTimeout(check, intervalMs);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
