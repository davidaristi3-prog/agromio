-- ============================================================
-- AGROMIO · Permiso para que el trabajador corrija y reenvíe
--           sus reportes rechazados (reportes_trabajador).
--
-- Problema: al rechazar un reporte, el trabajador lo corrige y pulsa
-- "Reenviar corregido", pero el UPDATE no afectaba ninguna fila porque
-- faltaba una política RLS que le permitiera modificar su propio reporte.
-- Resultado: parecía que el botón "no hacía nada".
--
-- Esta política es ADITIVA (se suma con OR a las que ya existan para
-- mayordomo/propietario), así que NO toca el flujo de aprobación ni los
-- permisos de ver/crear, que ya funcionan.
--
-- Cómo usarlo: Supabase > SQL Editor > New query > pega todo > Run.
-- Es idempotente (se puede correr varias veces sin problema).
-- ============================================================

alter table reportes_trabajador enable row level security;

-- El trabajador puede actualizar (corregir y reenviar) los reportes que él creó.
drop policy if exists reportes_trab_update_propias on reportes_trabajador;
create policy reportes_trab_update_propias on reportes_trabajador
  for update to authenticated
  using ( creado_por = auth.uid() )
  with check ( creado_por = auth.uid() );

-- Fin · permiso de corrección reportes_trabajador · AGROMIO
