// Service worker PWA: instalación + avisos (Web Push / cron Vercel)


self.addEventListener("install", () => {
  // Espera a que el usuario pulse «Actualizar» en el CRM antes de tomar el control.
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/calendario";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      const abierto = clientes.find((c) => "focus" in c);
      if (abierto) {
        abierto.navigate?.(url);
        return abierto.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
// BUILD_STAMP: dev
