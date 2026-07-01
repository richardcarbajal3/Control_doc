// Descarga un archivo de SharePoint/OneDrive a partir de un enlace de "compartir"
// anónimo (tipo .../:x:/g/personal/.../IQ...?e=XXXX), sin Microsoft Graph ni login.
//
// SharePoint no entrega el binario directamente: el enlace primero redirige a un
// visor web y, de paso, asigna una cookie anónima (FedAuth, urn:spo:tenantanon).
// El truco es seguir ese enlace con un "cookie jar" y luego pedir el binario
// reutilizando la cookie. Hay dos variantes de enlace:
//
//   * Enlaces "clásicos" (.../:x:/g/personal/.../<archivo>.xlsx?...): basta con
//     volver a pedir la misma URL con &download=1 y devuelve el .xlsx.
//   * Enlaces "nuevos" (.../:x:/g/personal/.../IQ...?e=XXXX): NO llevan el nombre
//     del archivo; redirigen a un visor "Doc.aspx?sourcedoc={GUID}" que solo
//     devuelve HTML. Para estos, tras calentar la cookie, se pide el binario por
//     el endpoint download.aspx?UniqueId=<GUID> (el GUID sale del redirect).
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
// Si se pasa `onRedirect`, se invoca con cada URL de destino intermedia; sirve
// para inspeccionar la cadena (p. ej. capturar el "sourcedoc" del visor).
async function fetchFollowing(url, jar, { maxRedirects = 10, method = 'GET', timeoutMs = 60_000, onRedirect } = {}) {
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
      const next = new URL(loc, current).toString();
      if (typeof onRedirect === 'function') onRedirect(next);
      current = next;
      // Agota el cuerpo de la redirección para liberar el socket.
      await res.arrayBuffer().catch(() => {});
      continue;
    }
    return res;
  }
  throw new Error('Demasiadas redirecciones al descargar el archivo de SharePoint');
}

// Extrae el GUID del documento (sourcedoc) y la ruta personal del tenant a partir
// de una URL de visor "Doc.aspx?sourcedoc={GUID}". Devuelve null si no aplica.
function parseViewerUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!/\/_layouts\/.*Doc\.aspx$/i.test(u.pathname)) return null;
    const sourcedoc = u.searchParams.get('sourcedoc');
    if (!sourcedoc) return null;
    const guid = sourcedoc.replace(/[{}]/g, '').trim();
    if (!guid) return null;
    // personalPath: /personal/user  (todo lo anterior a "/_layouts/")
    const personalPath = u.pathname.replace(/\/_layouts\/.*$/i, '');
    return { guid, host: u.origin, personalPath };
  } catch {
    return null;
  }
}

// Valida que la respuesta traiga un binario de Office y no una página de login.
function assertBinary(res, buffer) {
  const contentType = res.headers.get('content-type') || '';
  // Si volvió HTML en vez del Excel, casi siempre es una página de login.
  if (/text\/html/i.test(contentType) || buffer[0] === 0x3c /* '<' */) {
    throw new Error('SharePoint devolvió una página web en vez del Excel (probable login requerido)');
  }
}

// Descarga el archivo y devuelve { buffer, contentType }.
async function downloadSharePointFile(shareUrl) {
  if (!shareUrl) throw new Error('Falta la URL de SharePoint (SYNC_SHARE_URL)');
  const jar = new Map();

  // Paso 1: seguir el enlace para obtener la cookie anónima (FedAuth). De paso,
  // capturamos si la cadena de redirección pasa por el visor Doc.aspx, del que
  // extraemos el GUID del documento (necesario para los enlaces nuevos "IQ...").
  let viewer = null;
  const warm = await fetchFollowing(shareUrl, jar, {
    onRedirect: (u) => { viewer = viewer || parseViewerUrl(u); },
  });
  await warm.arrayBuffer().catch(() => {});
  // La respuesta final también puede ser el propio visor (200 con la URL de Doc.aspx).
  if (!viewer && warm.url) viewer = parseViewerUrl(warm.url);
  if (!jar.size) {
    throw new Error('SharePoint no entregó cookie de acceso; el enlace puede requerir inicio de sesión');
  }

  // Paso 2a: enlaces nuevos ("IQ...") — descargar por GUID con download.aspx.
  if (viewer) {
    const dlUrl = `${viewer.host}${viewer.personalPath}/_layouts/15/download.aspx?UniqueId=${encodeURIComponent(viewer.guid)}`;
    const res = await fetchFollowing(dlUrl, jar, { timeoutMs: 180_000 });
    if (res.ok) {
      const buffer = Buffer.from(await res.arrayBuffer());
      assertBinary(res, buffer);
      return { buffer, contentType: res.headers.get('content-type') || '' };
    }
    // Si el endpoint por GUID falla, caemos al método clásico (&download=1) por si
    // el enlace admite ambas formas; si también falla, el error de abajo aplica.
    await res.arrayBuffer().catch(() => {});
  }

  // Paso 2b: enlaces clásicos — pedir el binario con &download=1 reutilizando las
  // cookies. Timeout generoso (3 min) para archivos grandes.
  const dlUrl = shareUrl + (shareUrl.includes('?') ? '&' : '?') + 'download=1';
  const res = await fetchFollowing(dlUrl, jar, { timeoutMs: 180_000 });
  if (!res.ok) {
    throw new Error(`Descarga falló (HTTP ${res.status}). ¿El enlace sigue compartido como "cualquiera con el enlace"?`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  assertBinary(res, buffer);
  return { buffer, contentType: res.headers.get('content-type') || '' };
}

module.exports = { downloadSharePointFile };
