-- Teléfono y correo de la marca que salen en el informe de valoración y en la web.

update public.agency_branding
set
  phone = '664 85 93 06',
  email = 'info@rehabinco.es',
  updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000001'
  and (
    phone is distinct from '664 85 93 06'
    or email is distinct from 'info@rehabinco.es'
  );
