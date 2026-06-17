-- ============================================================
-- AGROMIO · Módulo Potreros (mapa satelital)
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- Se puede correr varias veces sin problema (es idempotente).
-- ============================================================

create table if not exists potreros (
  id           uuid primary key default gen_random_uuid(),
  finca_id     uuid not null references fincas(id) on delete cascade,
  nombre       text not null,
  color        text not null default '#22c55e',
  coordenadas  jsonb not null,            -- anillo del polígono: [[lng,lat], [lng,lat], ...]
  area_ha      numeric,                   -- área calculada en hectáreas
  lote_id      uuid references lotes(id), -- opcional: vincular con un lote para ver animales
  activo       boolean not null default true,
  creado_por   uuid references usuarios(id),
  created_at   timestamptz not null default now()
);

create index if not exists idx_potreros_finca on potreros(finca_id);

alter table potreros enable row level security;

-- Ver: propietario ve todo; los demás ven los potreros de sus fincas asignadas.
drop policy if exists potreros_select on potreros;
create policy potreros_select on potreros for select to authenticated
  using (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
    or finca_id in (select finca_id from asignaciones_finca where usuario_id = auth.uid())
  );

-- Crear / editar / eliminar: propietario, o mayordomo de esa finca.
drop policy if exists potreros_insert on potreros;
create policy potreros_insert on potreros for insert to authenticated
  with check (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
    or (
      (select rol from usuarios where id = auth.uid()) = 'mayordomo'
      and finca_id in (select finca_id from asignaciones_finca where usuario_id = auth.uid())
    )
  );

drop policy if exists potreros_update on potreros;
create policy potreros_update on potreros for update to authenticated
  using (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
    or (
      (select rol from usuarios where id = auth.uid()) = 'mayordomo'
      and finca_id in (select finca_id from asignaciones_finca where usuario_id = auth.uid())
    )
  )
  with check (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
    or (
      (select rol from usuarios where id = auth.uid()) = 'mayordomo'
      and finca_id in (select finca_id from asignaciones_finca where usuario_id = auth.uid())
    )
  );

drop policy if exists potreros_delete on potreros;
create policy potreros_delete on potreros for delete to authenticated
  using (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
    or (
      (select rol from usuarios where id = auth.uid()) = 'mayordomo'
      and finca_id in (select finca_id from asignaciones_finca where usuario_id = auth.uid())
    )
  );

-- Fin del módulo Potreros · AGROMIO
