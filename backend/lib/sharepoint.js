// Descarga un archivo de SharePoint/OneDrive a partir de un enlace de "compartir"
// anónimo (tipo .../:x:/g/personal/.../IQ...?e=XXXX), sin Microsoft Graph ni login.
//
// SharePoint no entrega el binario directamente: el enlace primero redirige a un
// visor web y, de paso, asigna una cookie anónima (FedAuth, urn:spo:tenantanon).
// El truco es seguir ese enlace con un "cookie jar", y luego volver a pedir la
// misma URL con &download=1 reutilizando la cookie, lo que devuelve el .xlsx.
//
// Limitaciones: requiere que el tenant permita acceso por enlace ("cualquiera con
// el enlace"). Si el enlace caduca o se restringe, fallará con un 401/403 claro.

// Une las cookies recibidas (Set-Cookie) en un mapa nombre->valor.
function mergeSetCookies(jar, res) {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const sc of list) {
    const first = sc.split(';', 1)[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

// fetch que sigue redirecciones manualmente acumulando cookies en `jar`, para
// emular `curl -L -c jar -b jar`. Devuelve la respuesta final (no redirección).
async function fetchFollowing(url, jar, { maxRedirects = 10, method = 'GET', timeoutMs = 60_000 } = {}) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        cookie: cookieHeader(jar),
        // Un user-agent de navegador evita respuestas degradadas de SharePoint.
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ControlDocSync/1.0',
        accept: '*/*',
      },
    });
    mergeSetCookies(jar, res);
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      const loc = res.headers.get('location');
      current = new URL(loc, current).toString();
      // Agota el cuerpo de la redirección para liberar el socket.
      await res.arrayBuffer().catch(() => {});
      continue;
    }
    return res;
  }
  throw new Error('Demasiadas redirecciones al descargar el archivo de SharePoint');
}

// Descarga el archivo y devuelve { buffer, contentType }.
async function downloadSharePointFile(shareUrl) {
  if (!shareUrl) throw new Error('Falta la URL de SharePoint (SYNC_SHARE_URL)');
  const jar = new Map();
  // Paso 1: seguir el enlace para obtener la cookie anónima (FedAuth).
  const warm = await fetchFollowing(shareUrl, jar);
  await warm.arrayBuffer().catch(() => {});
  if (!jar.size) {
    throw new Error('SharePoint no entregó cookie de acceso; el enlace puede requerir inicio de sesión');
  }
  // Paso 2: pedir el binario con &download=1 reutilizando las cookies.
  // Timeout generoso (3 min) para archivos grandes.
  const dlUrl = shareUrl + (shareUrl.includes('?') ? '&' : '?') + 'download=1';
  const res = await fetchFollowing(dlUrl, jar, { timeoutMs: 180_000 });
  if (!res.ok) {
    throw new Error(`Descarga falló (HTTP ${res.status}). ¿El enlace sigue compartido como "cualquiera con el enlace"?`);
  }
  const contentType = res.headers.get('content-type') || '';
  const buffer = Buffer.from(await res.arrayBuffer());
  // Si volvió HTML en vez del Excel, casi siempre es una página de login.
  if (/text\/html/i.test(contentType) || (buffer[0] === 0x3c /* '<' */)) {
    throw new Error('SharePoint devolvió una página web en vez del Excel (probable login requerido)');
  }
  return { buffer, contentType };
}

module.exports = { downloadSharePointFile };
