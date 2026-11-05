-- Fase 7b: reglas para administrar medios de pago y categorías desde la pantalla de configuración.
--
-- Un medio de pago no se borra, se desactiva: las ventas y los cierres pasados lo siguen usando.
-- Siempre queda un medio de efectivo activo, porque el fondo de la caja y sus retiros van ahí. El tipo
-- no cambia una vez que tuvo pagos: alteraría el arqueo de esas ventas.
--
-- Una categoría con productos o promociones no se borra: la clave foránea lo impide.
--
--   PV022 cambio no permitido sobre un medio de pago

revoke delete on public.medios_pago from authenticated;

alter table public.medios_pago
  add constraint medios_pago_nombre_largo check (char_length(btrim(nombre)) between 1 and 60);
alter table public.categorias
  add constraint categorias_nombre_largo check (char_length(btrim(nombre)) between 1 and 60);

create unique index medios_pago_comercio_nombre_key
  on public.medios_pago (comercio_id, lower(btrim(nombre)));
create unique index categorias_comercio_nombre_key
  on public.categorias (comercio_id, lower(btrim(nombre)));

create function public.medios_pago_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo <> old.tipo and exists (
    select 1 from public.venta_pagos p where p.medio_pago_id = old.id
  ) then
    raise exception 'El tipo de un medio con pagos no se puede cambiar' using errcode = 'PV022';
  end if;

  if old.activo and old.tipo = 'efectivo' and (not new.activo or new.tipo <> 'efectivo') then
    -- Bloquea los medios de efectivo: dos desactivaciones a la vez no pueden dejar el comercio sin
    -- ninguno.
    perform 1 from public.medios_pago m
      where m.comercio_id = old.comercio_id and m.tipo = 'efectivo'
        for update;
    if not exists (
      select 1 from public.medios_pago m
       where m.comercio_id = old.comercio_id and m.tipo = 'efectivo' and m.activo and m.id <> old.id
    ) then
      raise exception 'Tiene que quedar un medio de efectivo activo' using errcode = 'PV022';
    end if;
  end if;

  return new;
end
$$;

revoke execute on function public.medios_pago_proteger() from public, anon, authenticated;

create trigger medios_pago_proteger
  before update on public.medios_pago
  for each row execute function public.medios_pago_proteger();
