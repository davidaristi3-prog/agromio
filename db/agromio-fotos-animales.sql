create table if not exists fotos_animales (
  id          uuid primary key default gen_random_uuid(),
  animal_id   uuid not null references animales(id) on delete cascade,
  url         text not null,
  descripcion text,
  fecha       date not null default current_date,
  creado_por  uuid references usuarios(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_fotos_animales_animal on fotos_animales(animal_id);

alter table fotos_animales enable row level security;

create policy "propietario_fotos_todo" on fotos_animales
  for all using (
    (select rol from usuarios where id = auth.uid()) = 'propietario'
  );

create policy "mayordomo_fotos_ver" on fotos_animales
  for select using (
    (select rol from usuarios where id = auth.uid()) in ('mayordomo','trabajador')
  );

create policy "mayordomo_fotos_crear" on fotos_animales
  for insert with check (
    (select rol from usuarios where id = auth.uid()) in ('mayordomo','trabajador','propietario')
  );
