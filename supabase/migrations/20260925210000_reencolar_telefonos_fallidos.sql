-- Reintentar pedidos de teléfono que fallaron con la regla de bytes del listado.
update public.captacion_paginas_pendientes
set estado = 'pendiente',
    intentos = 0,
    reintentar_en = null
where tipo = 'telefono'
  and estado <> 'hecha'
  and coalesce(intentos, 0) > 0;
