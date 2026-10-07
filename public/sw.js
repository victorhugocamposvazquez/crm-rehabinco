// Service worker PWA: instalación + avisos (Web Push / cron Vercel)


self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "CRM Rehabinco", body: "Tienes avisos de hoy.", url: "/calendario" };
  try {
    data = { ...data, ...(event.data?.json() ?? {}) };
  } catch {
    const texto = event.data?.text();
    if (texto) data.body = texto;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "CRM Rehabinco", {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/calendario" },
    })
  );
});

function urlAviso(ruta) {
  try {
    return new URL(ruta || "/calendario", self.location.origin).href;
  } catch {
    return new URL("/calendario", self.location.origin).href;
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = urlAviso(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientes) => {
      const abierto = clientes.find((cliente) => {
        try {
          return new URL(cliente.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (!abierto) return self.clients.openWindow(destino);
      abierto.postMessage({ type: "abrir-aviso", url: destino });
      if (typeof abierto.navigate === "function") {
        try {
          await abierto.navigate(destino);
        } catch {
          // La página abre la ruta con el mensaje.
        }
      }
      return abierto.focus();
    })
  );
});
// BUILD_STAMP: dev
