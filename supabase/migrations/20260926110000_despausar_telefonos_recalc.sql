-- Despausa y reinicia fallidos de hoy: la tasa antigua mezclaba solo_mensaje/HTML con fallos reales.
update public.captacion_telefono_config
set pausado = false, pausado_en = null
where id = 1;

update public.captacion_telefono_diario
set fallidos = 0
where dia = (timezone('utc', now()))::date;
