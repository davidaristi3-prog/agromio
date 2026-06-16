-- ============================================================
-- AGROMIO · Esquema de base de datos (Supabase / PostgreSQL) · v2
-- Fase 0 (Cimientos) + Fase 1 (Esencial)
-- ------------------------------------------------------------
-- Cambios de la v2 (según aclaraciones de arquitectura):
--   1 y 5. Usuarios (mayordomos y trabajadores) pueden estar en
--          VARIAS fincas y moverse  -> tabla "asignaciones_finca".
--   2.     Animales con o sin lote  -> lote_id ya es opcional.
--   3.     Movimientos entre lotes  -> lote_origen/destino en movimientos_hato.
--   4.     Tareas puntuales vs cíclicas -> tabla "tareas_recurrentes"
--          + campos "tipo" y "recurrente_id" en "tareas".
-- ------------------------------------------------------------
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- ============================================================


-- ============================================================
-- FASE 0 · CIMIENTOS
-- ============================================================

-- Fincas
create table fincas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  ubicacion   text,
  hectareas   numeric,
  activa      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Usuarios (perfil ligado al login de Supabase Auth).
-- Nota: la finca ya NO va aquí; ahora se maneja en "asignaciones_finca".
create table usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  email       text,
  rol         text not null default 'trabajador'
              check (rol in ('propietario','mayordomo','trabajador','veterinario')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Asignaciones usuario <-> finca (muchos a muchos).
-- Un mayordomo o trabajador puede estar en varias fincas; moverlo = cambiar filas aquí.
create table asignaciones_finca (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references usuarios(id) on delete cascade,
  finca_id     uuid not null references fincas(id) on delete cascade,
  es_principal boolean not null default false,   -- marca la finca base (opcional)
  created_at   timestamptz not null default now(),
  unique (usuario_id, finca_id)
);

-- Lotes / potreros / grupos dentro de una finca
create table lotes (
  id          uuid primary key default gen_random_uuid(),
  finca_id    uuid not null references fincas(id) on delete cascade,
  nombre      text not null,
  tipo        text,
  created_at  timestamptz not null default now()
);

-- Animales (inventario del hato). finca_id y lote_id = ubicación ACTUAL.
-- lote_id es opcional: un animal puede no tener lote.
create table animales (
  id                    uuid primary key default gen_random_uuid(),
  identificacion        text not null,
  nombre                text,
  tipo                  text check (tipo in ('vaca','novilla','ternera','ternero','toro')),
  sexo                  text check (sexo in ('hembra','macho')),
  raza                  text,
  finca_id              uuid references fincas(id),
  lote_id               uuid references lotes(id),     -- opcional
  fecha_nacimiento      date,
  madre_id              uuid references animales(id),
  padre_id              uuid references animales(id),
  estado_reproductivo   text,
  estado_productivo     text check (estado_productivo in
                          ('en_ordeno','seca','pre_parto','no_aplica')),
  en_retiro_leche       boolean not null default false,
  fecha_fin_retiro      date,
  activa                boolean not null default true,
  foto_url              text,
  created_at            timestamptz not null default now()
);

-- Plantillas de tareas recurrentes / cíclicas (ej. ordeño diario, revisión semanal).
create table tareas_recurrentes (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  descripcion   text,
  finca_id      uuid references fincas(id),
  lote_id       uuid references lotes(id),
  animal_id     uuid references animales(id),
  asignado_a    uuid references usuarios(id),
  frecuencia    text not null check (frecuencia in ('diaria','semanal','mensual','personalizada')),
  intervalo     smallint not null default 1,    -- cada N (días / semanas / meses)
  dias_semana   text,                            -- ej. 'L,X,V' (para frecuencia semanal)
  hora          time,                            -- hora sugerida
  activa        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Tareas (las que el trabajador completa). Pueden ser puntuales o instancias
-- generadas desde una plantilla recurrente.
create table tareas (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null,
  descripcion         text,
  tipo                text not null default 'puntual'
                      check (tipo in ('puntual','recurrente')),
  recurrente_id       uuid references tareas_recurrentes(id),  -- de qué plantilla salió
  finca_id            uuid references fincas(id),
  asignado_a          uuid references usuarios(id),
  creado_por          uuid references usuarios(id),
  fecha_vencimiento   date,
  prioridad           text check (prioridad in ('alta','media','baja')),
  completada          boolean not null default false,
  fecha_completada    timestamptz,
  foto_evidencia_url  text,
  nota_voz_url        text,
  created_at          timestamptz not null default now()
);


-- ============================================================
-- FASE 1 · ESENCIAL
-- ============================================================

-- Ordeños (producción de leche) — alto volumen
create table ordenos (
  id              uuid primary key default gen_random_uuid(),
  finca_id        uuid not null references fincas(id),
  animal_id       uuid references animales(id),
  lote_id         uuid references lotes(id),
  fecha           date not null,
  numero_ordeno   smallint,
  litros          numeric not null,
  registrado_por  uuid references usuarios(id),
  created_at      timestamptz not null default now()
);

-- Eventos sanitarios (salud + retiro de leche)
create table eventos_sanitarios (
  id                uuid primary key default gen_random_uuid(),
  animal_id         uuid references animales(id),
  finca_id          uuid references fincas(id),
  fecha             date not null,
  tipo              text check (tipo in
                      ('tratamiento','vacuna','diagnostico','desparasitacion','otro')),
  diagnostico       text,
  medicamento       text,
  requiere_retiro   boolean not null default false,
  fecha_fin_retiro  date,
  descripcion       text,
  foto_url          text,
  registrado_por    uuid references usuarios(id),
  created_at        timestamptz not null default now()
);

-- Eventos reproductivos
create table eventos_reproductivos (
  id                    uuid primary key default gen_random_uuid(),
  animal_id             uuid not null references animales(id),
  finca_id              uuid references fincas(id),
  fecha                 date not null,
  tipo                  text check (tipo in
                          ('celo','servicio','diagnostico_prenez','parto','aborto','secado')),
  metodo                text check (metodo in
                          ('inseminacion','monta','transferencia_embrion')),
  toro_o_semen          text,
  resultado             text,
  fecha_probable_parto  date,
  descripcion           text,
  registrado_por        uuid references usuarios(id),
  created_at            timestamptz not null default now()
);

-- Movimientos del hato (incluye traslado entre fincas Y entre lotes)
create table movimientos_hato (
  id                  uuid primary key default gen_random_uuid(),
  animal_id           uuid not null references animales(id),
  fecha               date not null,
  tipo                text check (tipo in
                        ('nacimiento','cambio_categoria','traslado','compra','venta','muerte','descarte')),
  finca_origen_id     uuid references fincas(id),
  finca_destino_id    uuid references fincas(id),
  lote_origen_id      uuid references lotes(id),   -- NUEVO: rastro del cambio de lote
  lote_destino_id     uuid references lotes(id),   -- NUEVO
  categoria_anterior  text,
  categoria_nueva     text,
  valor               numeric,
  descripcion         text,
  registrado_por      uuid references usuarios(id),
  created_at          timestamptz not null default now()
);

-- Comentarios (por ahora sobre tareas)
create table comentarios (
  id           uuid primary key default gen_random_uuid(),
  tarea_id     uuid references tareas(id) on delete cascade,
  autor_id     uuid references usuarios(id),
  texto        text,
  nota_voz_url text,
  created_at   timestamptz not null default now()
);


-- ============================================================
-- ÍNDICES
-- ============================================================
create index idx_asignaciones_usuario on asignaciones_finca (usuario_id);
create index idx_asignaciones_finca   on asignaciones_finca (finca_id);
create index idx_ordenos_finca_fecha   on ordenos (finca_id, fecha);
create index idx_ordenos_animal_fecha   on ordenos (animal_id, fecha);
create index idx_animales_finca         on animales (finca_id);
create index idx_animales_lote          on animales (lote_id);
create index idx_eventos_san_animal     on eventos_sanitarios (animal_id, fecha);
create index idx_eventos_rep_animal     on eventos_reproductivos (animal_id, fecha);
create index idx_tareas_asignado        on tareas (asignado_a, completada);
create index idx_tareas_recurrente      on tareas (recurrente_id);


-- ============================================================
-- SEGURIDAD (RLS) — activada en todas las tablas.
-- Datos BLOQUEADOS por defecto hasta definir las políticas por rol (paso siguiente).
-- ============================================================
alter table fincas                enable row level security;
alter table usuarios              enable row level security;
alter table asignaciones_finca    enable row level security;
alter table lotes                 enable row level security;
alter table animales              enable row level security;
alter table tareas_recurrentes    enable row level security;
alter table tareas                enable row level security;
alter table ordenos               enable row level security;
alter table eventos_sanitarios    enable row level security;
alter table eventos_reproductivos enable row level security;
alter table movimientos_hato      enable row level security;
alter table comentarios           enable row level security;

-- Fin del esquema · AGROMIO v2
