# Extensión Rehabinco Captación

Manifest V3, sin build. En Idealista guarda el teléfono que revelas y marca los anuncios que ya están en el CRM.

El nivel 3 (cola asistida que abre fichas sola) queda pendiente. No está implementado.

## Instalar en modo desarrollador

1. En el CRM, Ajustes → genera el token de la extensión.
2. Chrome → `chrome://extensions` → activa **Modo de desarrollador**.
3. **Cargar descomprimida** y elige esta carpeta `extension/`.
4. Abre los detalles de la extensión → **Opciones de la extensión**.
5. URL del CRM: `https://crm.rehabinco.es`. Token: el del paso 1. Guardar.
6. Abre una ficha de Idealista y revela el teléfono. Debe salir «guardado en CRM» si ese anuncio ya está en Captación.
