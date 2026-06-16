-- ============================================================
-- AGROMIO · Seguridad por rol (RLS) · para Supabase / PostgreSQL
-- ------------------------------------------------------------
-- Ejecutar DESPUÉS de haber creado las tablas (esquema v2).
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- Nota: córrelo UNA sola vez. Si lo repites y ves "policy already
-- exists", es porque ya estaba aplicado: no pasa nada.
-- ============================================================


-- ============================================================
-- 1) FUNCIONES AYUDANTES
-- (security definer = pueden consultar usuarios/asignaciones sin
--  chocar con la propia seguridad. Así evitamos bucles.)
-- ============================================================

-- ¿Qué rol tiene el usuario conectado?
create or replace function public.mi_rol()
returns text
language sql security definer set search_path = public stable
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

-- ¿El usuario conectado es propietario?
create or replace function public.es_propietario()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'propietario'
  );
$$;

-- ¿Puede VER esta finca? (propietario, o está asignado a ella)
create or replace function public.tiene_acceso_finca(p_finca uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.es_propietario()
    or exists (
      select 1 from public.asignaciones_finca
      where usuario_id = auth.uid() and finca_id = p_finca
    );
$$;

-- ¿Puede GESTIONAR esta finca? (propietario, o mayordomo asignado a ella)
create or replace function public.puede_gestionar_finca(p_finca uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.es_propietario()
    or (
      public.mi_rol() = 'mayordomo'
      and exists (
        select 1 from public.asignaciones_finca
        where usuario_id = auth.uid() and finca_id = p_finca
      )
    );
$$;


-- ============================================================
-- 2) ASEGURAR QUE RLS ESTÁ ACTIVO (idempotente)
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


-- ============================================================
-- 3) POLÍTICAS POR TABLA
-- ============================================================

-- ---------- FINCAS ----------
create policy fincas_select on fincas for select to authenticated
  using ( public.tiene_acceso_finca(id) );
create policy fincas_insert on fincas for insert to authenticated
  with check ( public.es_propietario() );
create policy fincas_update on fincas for update to authenticated
  using ( public.es_propietario() ) with check ( public.es_propietario() );
create policy fincas_delete on fincas for delete to authenticated
  using ( public.es_propietario() );

-- ---------- USUARIOS ----------
-- Todos los del equipo pueden ver la lista de usuarios (nombres/roles).
-- Solo el propietario los crea/edita/elimina (evita auto-ascensos de rol).
create policy usuarios_select on usuarios for select to authenticated
  using ( true );
create policy usuarios_insert on usuarios for insert to authenticated
  with check ( public.es_propietario() );
create policy usuarios_update on usuarios for update to authenticated
  using ( public.es_propietario() ) with check ( public.es_propietario() );
create policy usuarios_delete on usuarios for delete to authenticated
  using ( public.es_propietario() );

-- ---------- ASIGNACIONES_FINCA ----------
create policy asig_select on asignaciones_finca for select to authenticated
  using ( public.es_propietario() or usuario_id = auth.uid() );
create policy asig_insert on asignaciones_finca for insert to authenticated
  with check ( public.es_propietario() );
create policy asig_update on asignaciones_finca for update to authenticated
  using ( public.es_propietario() ) with check ( public.es_propietario() );
create policy asig_delete on asignaciones_finca for delete to authenticated
  using ( public.es_propietario() );

-- ---------- LOTES ----------
create policy lotes_select on lotes for select to authenticated
  using ( public.tiene_acceso_finca(finca_id) );
create policy lotes_insert on lotes for insert to authenticated
  with check ( public.puede_gestionar_finca(finca_id) );
create policy lotes_update on lotes for update to authenticated
  using ( public.puede_gestionar_finca(finca_id) )
  with check ( public.puede_gestionar_finca(finca_id) );
create policy lotes_delete on lotes for delete to authenticated
  using ( public.puede_gestionar_finca(finca_id) );

-- ---------- ANIMALES ----------
create policy animales_select on animales for select to authenticated
  using ( public.tiene_acceso_finca(finca_id) );
create policy animales_insert on animales for insert to authenticated
  with check ( public.puede_gestionar_finca(finca_id) );
create policy animales_update on animales for update to authenticated
  using ( public.puede_gestionar_finca(finca_id) )
  with check ( public.puede_gestionar_finca(finca_id) );
-- Eliminar animales: solo propietario (mejor marcarlos como inactivos).
create policy animales_delete on animales for delete to authenticated
  using ( public.es_propietario() );

-- ---------- TAREAS_RECURRENTES (plantillas) ----------
create policy trec_select on tareas_recurrentes for select to authenticated
  using ( public.tiene_acceso_finca(finca_id) );
create policy trec_insert on tareas_recurrentes for insert to authenticated
  with check ( public.puede_gestionar_finca(finca_id) );
create policy trec_update on tareas_recurrentes for update to authenticated
  using ( public.puede_gestionar_finca(finca_id) )
  with check ( public.puede_gestionar_finca(finca_id) );
create policy trec_delete on tareas_recurrentes for delete to authenticated
  using ( public.puede_gestionar_finca(finca_id) );

-- ---------- TAREAS ----------
-- Ver: propietario, el asignado (ve lo suyo), o el mayordomo de esa finca.
create policy tareas_select on tareas for select to authenticated
  using (
    public.es_propietario()
    or asignado_a = auth.uid()
    or public.puede_gestionar_finca(finca_id)
  );
create policy tareas_insert on tareas for insert to authenticated
  with check ( public.puede_gestionar_finca(finca_id) );
-- Editar: el asignado (para completarla) o quien gestiona la finca.
create policy tareas_update on tareas for update to authenticated
  using ( asignado_a = auth.uid() or public.puede_gestionar_finca(finca_id) )
  with check ( asignado_a = auth.uid() or public.puede_gestionar_finca(finca_id) );
create policy tareas_delete on tareas for delete to authenticated
  using ( public.puede_gestionar_finca(finca_id) );

-- ---------- ORDENOS ----------
create policy ordenos_select on ordenos for select to authenticated
  using ( public.tiene_acceso_finca(finca_id) );
-- Registrar: cualquiera asignado a la finca (incluye trabajadores).
create policy ordenos_insert on ordenos for insert to authenticated
  with check ( public.tiene_acceso_finca(finca_id) );
create policy ordenos_update on ordenos for update to authenticated
  using ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() )
  with check ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() );
create policy ordenos_delete on ordenos for delete to authenticated
  using ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() );

-- ---------- EVENTOS_SANITARIOS ----------
create policy esan_select on eventos_sanitarios for select to authenticated
  using ( public.tiene_acceso_finca(finca_id) );
create policy esan_insert on eventos_sanitarios for insert to authenticated
  with check ( public.tiene_acceso_finca(finca_id) );
create policy esan_update on eventos_sanitarios for update to authenticated
  using ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() )
  with check ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() );
create policy esan_delete on eventos_sanitarios for delete to authenticated
  using ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() );

-- ---------- EVENTOS_REPRODUCTIVOS ----------
create policy erep_select on eventos_reproductivos for select to authenticated
  using ( public.tiene_acceso_finca(finca_id) );
create policy erep_insert on eventos_reproductivos for insert to authenticated
  with check ( public.tiene_acceso_finca(finca_id) );
create policy erep_update on eventos_reproductivos for update to authenticated
  using ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() )
  with check ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() );
create policy erep_delete on eventos_reproductivos for delete to authenticated
  using ( public.puede_gestionar_finca(finca_id) or registrado_por = auth.uid() );

-- ---------- MOVIMIENTOS_HATO (usa finca origen o destino) ----------
create policy mov_select on movimientos_hato for select to authenticated
  using ( public.tiene_acceso_finca(finca_origen_id)
       or public.tiene_acceso_finca(finca_destino_id) );
create policy mov_insert on movimientos_hato for insert to authenticated
  with check ( public.tiene_acceso_finca(finca_origen_id)
            or public.tiene_acceso_finca(finca_destino_id) );
create policy mov_update on movimientos_hato for update to authenticated
  using ( public.puede_gestionar_finca(finca_origen_id)
       or public.puede_gestionar_finca(finca_destino_id)
       or registrado_por = auth.uid() )
  with check ( public.puede_gestionar_finca(finca_origen_id)
            or public.puede_gestionar_finca(finca_destino_id)
            or registrado_por = auth.uid() );
create policy mov_delete on movimientos_hato for delete to authenticated
  using ( public.puede_gestionar_finca(finca_origen_id)
       or public.puede_gestionar_finca(finca_destino_id)
       or registrado_por = auth.uid() );

-- ---------- COMENTARIOS ----------
create policy com_select on comentarios for select to authenticated
  using ( true );
create policy com_insert on comentarios for insert to authenticated
  with check ( autor_id = auth.uid() );
create policy com_update on comentarios for update to authenticated
  using ( autor_id = auth.uid() ) with check ( autor_id = auth.uid() );
create policy com_delete on comentarios for delete to authenticated
  using ( autor_id = auth.uid() or public.es_propietario() );

-- Fin de la seguridad por rol · AGROMIO
