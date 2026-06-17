-- ============================================================
-- AGROMIO · Módulo Metas (indicadores / objetivos)
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- Córrelo UNA sola vez. Si ves "already exists", ya estaba aplicado.
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

-- Ver: metas globales (finca_id null) o de fincas a las que tiene acceso.
create policy metas_select on metas for select to authenticated
  using ( finca_id is null or public.tiene_acceso_finca(finca_id) );

-- Crear / editar / eliminar: solo el propietario.
create policy metas_insert on metas for insert to authenticated
  with check ( public.es_propietario() );
create policy metas_update on metas for update to authenticated
  using ( public.es_propietario() ) with check ( public.es_propietario() );
create policy metas_delete on metas for delete to authenticated
  using ( public.es_propietario() );

-- Fin del módulo Metas · AGROMIO
