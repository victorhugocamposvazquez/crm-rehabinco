const url = document.getElementById("crmUrl");
const token = document.getElementById("token");
const estado = document.getElementById("estado");

chrome.storage.sync.get(["crmUrl", "token"], (guardado) => {
  url.value = guardado.crmUrl || "https://crm.rehabinco.es";
  token.value = guardado.token || "";
});

document.getElementById("guardar").addEventListener("click", () => {
  chrome.storage.sync.set({ crmUrl: url.value.trim(), token: token.value.trim() }, () => {
    estado.textContent = "Guardado.";
  });
});
