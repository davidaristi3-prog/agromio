-- Agrega columna para guardar el ID de dispositivo OneSignal por usuario
alter table usuarios add column if not exists onesignal_player_id text;
