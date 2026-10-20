# Publicación en Idealista

El CRM publica los inmuebles marcados **Publicar en Idealista** por la **API en tiempo real**. El alta de esa API está pedida a Idealista (`datafeed@idealista.com`). El código ILC identifica la cuenta; las credenciales de la API llegan aparte.

La Search API de captación (`IDEALISTA_API_KEY`) no publica anuncios.

## En el CRM

1. **Ajustes → Idealista**: pegar el ILC y, cuando Idealista los envíe, el cliente, el secreto y la URL base.
2. **Probar credenciales** comprueba el acceso. **Publicar marcados** envía la cartera.
3. En cada inmueble, al guardar con el interruptor marcado, el CRM intenta el envío. Si la API aún no está activa, la ficha queda en «Idealista · esperando API».

El anuncio usa el formato de ficha v6 (precio, dirección, fotos, certificado). Venta y alquiler del mismo inmueble salen como dos anuncios.

## Respaldo por fichero

Si Idealista entrega FTP en lugar de API, los datos están en el desplegable de Ajustes. Especificación: https://feeds.idealista.com/v6/specs/properties.html
