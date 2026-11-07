// Service worker del punto de venta (bloque 3.2c): que /vender abra aunque se recargue sin internet.
// Escrito a mano, sin librerías. Lo registra src/components/registrar-sw.tsx solo en producción.
//
// - Archivos de la app (/_next/static, fuentes, /vendor): se guardan la primera vez que se usan y
//   después se sirven desde la copia. Tienen hash en el nombre, así que nunca quedan viejos.
// - /vender: primero la red; si responde bien, se guarda como la última copia. Sin red, se muestra
//   esa copia y se cobra con la cola sin conexión (src/lib/cola-ventas.ts).
// - Cualquier otra pantalla sin red: un aviso con un enlace a Vender.
// - Lo que no es GET (las acciones del servidor, el cobro) no pasa por acá.
//
// La copia de /vender tiene el catálogo y el nombre del usuario: se borra al cerrar sesión
// (CACHE_PAGINAS en src/lib/service-worker.ts tiene que coincidir con PAGINAS).

const VERSION = "v1";
const ARCHIVOS = `pos-archivos-${VERSION}`;
const PAGINAS = "pos-paginas";
const VENDER = "/vender";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n.startsWith("pos-archivos-") && n !== ARCHIVOS)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

function esArchivoDeLaApp(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/vendor/")
  );
}

async function desdeLaCopia(request) {
  const guardada = await caches.match(request);
  if (guardada) return guardada;
  const respuesta = await fetch(request);
  if (respuesta.ok) {
    const cache = await caches.open(ARCHIVOS);
    await cache.put(request, respuesta.clone());
  }
  return respuesta;
}

async function guardarVender(respuesta) {
  // Solo una respuesta completa: un redirect al login o un error no reemplazan la copia buena.
  if (respuesta.status === 200 && !respuesta.redirected) {
    const cache = await caches.open(PAGINAS);
    await cache.put(VENDER, respuesta.clone());
  }
}

function avisoSinConexion(hayCopia) {
  const enlace = hayCopia
    ? '<p><a href="/vender">Abrí Vender</a>: se puede cobrar sin conexión.</p>'
    : "<p>Volvé a intentar cuando vuelva internet.</p>";
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sin conexión</title><style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#1f2937}h1{font-size:1.25rem}a{color:#2f54eb;font-weight:600}</style></head><body><h1>Sin conexión</h1><p>Esta pantalla necesita internet.</p>${enlace}</body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function navegar(request, url) {
  try {
    const respuesta = await fetch(request);
    if (url.pathname === VENDER) await guardarVender(respuesta);
    return respuesta;
  } catch {
    const copia = await caches.match(VENDER, { cacheName: PAGINAS });
    if (url.pathname === VENDER && copia) return copia;
    return avisoSinConexion(Boolean(copia));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navegar(request, url));
  } else if (esArchivoDeLaApp(url)) {
    event.respondWith(desdeLaCopia(request));
  }
});

// La primera vez, la página cargó antes de que existiera el service worker: la app le pasa los
// archivos que ya usó y, si está en /vender, le pide guardar la copia.
self.addEventListener("message", (event) => {
  const datos = event.data;
  if (!datos || datos.tipo !== "precargar") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ARCHIVOS);
      const urls = (datos.archivos || []).filter((u) => {
        try {
          const url = new URL(u, self.location.origin);
          return url.origin === self.location.origin && esArchivoDeLaApp(url);
        } catch {
          return false;
        }
      });
      await Promise.all(
        urls.map(async (u) => {
          if (await cache.match(u)) return;
          try {
            const respuesta = await fetch(u);
            if (respuesta.ok) await cache.put(u, respuesta);
          } catch {
            // Sin red: se guarda la próxima vez que se use.
          }
        }),
      );
      if (datos.guardarVender) {
        try {
          await guardarVender(
            await fetch(VENDER, { credentials: "same-origin" }),
          );
        } catch {
          // Sin red: queda la copia anterior, si había.
        }
      }
    })(),
  );
});
