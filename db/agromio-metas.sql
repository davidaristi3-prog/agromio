-- ============================================================
-- AGROMIO · Módulo Metas (indicadores / objetivos)
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- Se puede correr varias veces sin problema (es idempotente).
-- ============================================================

create table if not exists metas (
  id             uuid primary key default gen_random_uuid(),
  indicador      text not null,            -- clave del indicador (ej. 'litros_dia') o 'personalizada'
  nombre         text not null,            -- texto que ve el usuario
  categoria      text not null default 'otro'
                 check (categoria in ('produccion','reproduccion','sanidad','otro')),
  valor_objetivo numeric not null check (valor_objetivo >= 0),
  unidad         text,                     -- L, nacimientos, animales, %...
  periodo        text not null default 'mensual'
                 check (periodo in ('diario','mensual','anual')),
  direccion      text not null default 'mayor'
                 check (direccion in ('mayor','menor')),  -- mayor: cumplir es alcanzar/superar; menor: no pasarse (ej. mortandad)
  finca_id       uuid references fincas(id),              -- null = todas las fincas
  activa         boolean not null default true,
  creado_por     uuid references usuarios(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_metas_finca on metas(finca_id);

alter table metas enable row level security;

-- Ver: el propietario ve todo; los demás ven metas globales (finca_id null)
-- o de las fincas que tienen asignadas.
drop policy if exists metas_select on metas;
create policy metas_select on metas for select to authenticated
  using (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
    or finca_id is null
    or finca_id in (select finca_id from asignaciones_finca where usuario_id = auth.uid())
  );

-- Crear / editar / eliminar: solo el propietario.
drop policy if exists metas_insert on metas;
create policy metas_insert on metas for insert to authenticated
  with check ( (select rol from usuarios where id = auth.uid()) = 'propietario' );

drop policy if exists metas_update on metas;
create policy metas_update on metas for update to authenticated
  using ( (select rol from usuarios where id = auth.uid()) = 'propietario' )
  with check ( (select rol from usuarios where id = auth.uid()) = 'propietario' );

drop policy if exists metas_delete on metas;
create policy metas_delete on metas for delete to authenticated
  using ( (select rol from usuarios where id = auth.uid()) = 'propietario' );

-- Fin del módulo Metas · AGROMIO
