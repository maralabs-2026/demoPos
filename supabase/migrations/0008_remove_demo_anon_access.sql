-- Fase 2: retiro del acceso anonimo temporal de la demo (0001/0002) ahora que existe
-- autenticacion real. NO se aplica sobre la base compartida: se verifica en base de prueba
-- (set role anon; select * from productos; -> permission denied). No modifica 0001-0007.

-- Politicas temporales de lectura anonima.
drop policy if exists demo_anon_read_comercios on public.comercios;
drop policy if exists demo_anon_read_categorias on public.categorias;
drop policy if exists demo_anon_read_productos on public.productos;
drop policy if exists demo_anon_read_medios_pago on public.medios_pago;

-- Grant de lectura anonima introducido en 0006.
revoke select on public.comercios, public.categorias, public.productos, public.medios_pago from anon;
