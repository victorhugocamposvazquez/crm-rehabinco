const enviados = new Set();

function aviso(texto) {
  const previo = document.getElementById("rehabinco-aviso");
  if (previo) previo.remove();
  const nodo = document.createElement("div");
  nodo.id = "rehabinco-aviso";
  nodo.textContent = texto;
  nodo.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#0B7461;color:#fff;padding:8px 12px;border-radius:8px;font:13px/1.3 sans-serif;";
  document.documentElement.appendChild(nodo);
  setTimeout(() => nodo.remove(), 4000);
}

function idDeFicha() {
  return (location.pathname.match(/\/inmueble\/(\d+)/) || [])[1] || null;
}

function telefonoVisible() {
  const tel = document.querySelector('a[href^="tel:"]');
  if (tel) return tel.getAttribute("href").replace(/^tel:/i, "");
  const texto = document.querySelector(".hidden-contact-phones_formatted-phone, .phone-number");
  return texto ? texto.textContent.trim() : "";
}

function actualizadoVisible() {
  const nodo = document.body?.innerText || "";
  const match = nodo.match(/Anuncio actualizado el\s+([^\n]+)/i);
  return match ? match[1].trim() : "";
}

function guardarTelefono() {
  const externoId = idDeFicha();
  const telefono = telefonoVisible();
  const actualizado = actualizadoVisible();
  if (!externoId || (!telefono && !actualizado)) return;
  const clave = `${externoId}|${telefono}|${actualizado}`;
  if (enviados.has(clave)) return;
  enviados.add(clave);
  chrome.runtime.sendMessage(
    {
      tipo: "crm",
      method: "POST",
      ruta: "/api/captacion/telefono",
      body: { externo_id: externoId, portal_id: "idealista", telefono, actualizado, url: location.href },
    },
    (respuesta) => {
      if (respuesta?.ok && respuesta.json?.ok) aviso("guardado en CRM");
      else {
        enviados.delete(clave);
        aviso(respuesta?.json?.error || respuesta?.error || "no se ha guardado");
      }
    }
  );
}

function marcarListado() {
  const tarjetas = [...document.querySelectorAll("article.item")];
  const ids = [];
  for (const tarjeta of tarjetas) {
    const href = tarjeta.querySelector("a.item-link")?.getAttribute("href") || "";
    const id = (href.match(/\/inmueble\/(\d+)/) || [])[1];
    if (id) ids.push(id);
  }
  if (ids.length === 0) return;
  chrome.runtime.sendMessage(
    { tipo: "crm", method: "GET", ruta: `/api/captacion/existen?ids=${ids.join(",")}` },
    (respuesta) => {
      const anuncios = respuesta?.json?.anuncios || {};
      for (const tarjeta of tarjetas) {
        const href = tarjeta.querySelector("a.item-link")?.getAttribute("href") || "";
        const id = (href.match(/\/inmueble\/(\d+)/) || [])[1];
        const dato = id ? anuncios[id] : null;
        let marca = tarjeta.querySelector(".rehabinco-marca");
        if (!dato) {
          if (marca) marca.remove();
          continue;
        }
        if (!marca) {
          marca = document.createElement("span");
          marca.className = "rehabinco-marca";
          marca.style.cssText = "display:inline-block;margin:4px 0;padding:2px 6px;border-radius:6px;background:#E7F5F1;color:#0B7461;font:12px/1.3 sans-serif;";
          tarjeta.querySelector(".item-info-container, .item-link")?.prepend(marca);
        }
        marca.textContent = dato.telefono ? "En el CRM · con teléfono" : "En el CRM · sin teléfono";
      }
    }
  );
}

if (idDeFicha()) {
  guardarTelefono();
  new MutationObserver(() => guardarTelefono()).observe(document.documentElement, { childList: true, subtree: true });
} else if (location.pathname.includes("venta-viviendas")) {
  let timer;
  const programar = () => {
    clearTimeout(timer);
    timer = setTimeout(marcarListado, 500);
  };
  programar();
  new MutationObserver((mutaciones) => {
    const propia = mutaciones.every((cambio) =>
      [...cambio.addedNodes].every((nodo) => nodo.classList && nodo.classList.contains("rehabinco-marca"))
    );
    if (!propia) programar();
  }).observe(document.documentElement, { childList: true, subtree: true });
}
