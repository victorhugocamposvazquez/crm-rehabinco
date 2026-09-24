chrome.runtime.onMessage.addListener((mensaje, _sender, responder) => {
  if (mensaje?.tipo !== "crm") return;
  chrome.storage.sync.get(["crmUrl", "token"], (guardado) => {
    const base = String(guardado.crmUrl || "").replace(/\/$/, "");
    const token = String(guardado.token || "");
    if (!base || !token) {
      responder({ ok: false, error: "Falta la URL o el token en las opciones." });
      return;
    }
    const url = mensaje.ruta.startsWith("http") ? mensaje.ruta : `${base}${mensaje.ruta}`;
    fetch(url, {
      method: mensaje.method || "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: mensaje.body ? JSON.stringify(mensaje.body) : undefined,
    })
      .then(async (res) => responder({ ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) }))
      .catch((error) => responder({ ok: false, error: String(error) }));
  });
  return true;
});
