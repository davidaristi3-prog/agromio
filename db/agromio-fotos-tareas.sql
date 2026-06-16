create table if not exists fotos_tareas (
  id         uuid primary key default gen_random_uuid(),
  tarea_id   uuid not null references tareas(id) on delete cascade,
  url        text not null,
  created_at timestamptz not null default now()
);

alter table fotos_tareas enable row level security;

create policy "todos_fotos_tareas_ver" on fotos_tareas
  for select using (auth.uid() is not null);

create policy "todos_fotos_tareas_crear" on fotos_tareas
  for insert with check (auth.uid() is not null);
