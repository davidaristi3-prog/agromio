-- ============================================================
-- AGROMIO · Módulo Finanzas
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run
-- ============================================================

create table if not exists transacciones (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default current_date,
  tipo        text not null check (tipo in ('ingreso','gasto')),
  categoria   text not null,
  descripcion text,
  valor       numeric not null check (valor >= 0),
  finca_id    uuid references fincas(id),
  creado_por  uuid references usuarios(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_transacciones_fecha   on transacciones(fecha);
create index if not exists idx_transacciones_finca   on transacciones(finca_id);

alter table transacciones enable row level security;

-- Propietario: acceso total
create policy "propietario_transacciones_todo" on transacciones
  for all using (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
  );

-- Mayordomo: ve y crea en sus fincas asignadas
create policy "mayordomo_transacciones_ver" on transacciones
  for select using (
    (select rol from usuarios where id = auth.uid()) = 'mayordomo'
    and (
      finca_id is null
      or finca_id in (
        select finca_id from asignaciones_finca where usuario_id = auth.uid()
      )
    )
  );

create policy "mayordomo_transacciones_crear" on transacciones
  for insert with check (
    (select rol from usuarios where id = auth.uid()) in ('mayordomo','propietario')
    and (
      finca_id is null
      or finca_id in (
        select finca_id from asignaciones_finca where usuario_id = auth.uid()
      )
    )
  );
