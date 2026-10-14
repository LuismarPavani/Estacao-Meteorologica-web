-- Rode no Supabase > SQL Editor (depois do migration-v3.sql). Não apaga nada.
-- Campos novos do ESP: energia externa, sensor, reinícios, memória, chip, intervalo e tela.

-- Último estado de cada ESP (o que o painel mostra)
alter table devices
  add column if not exists external_power  boolean,   -- true = energia externa, false = bateria, null = ESP sem placa UPS
  add column if not exists sensor_ok       boolean,   -- false = o sensor parou de ler
  add column if not exists uptime_s        integer,
  add column if not exists reset_reason    text,
  add column if not exists free_heap       integer,
  add column if not exists chip_id         text,
  add column if not exists send_interval_s integer,
  add column if not exists display_on      boolean;

-- Histórico (permite acompanhar reinícios e queda de memória ao longo dos dias).
-- O horário da leitura é o created_at, preenchido pelo servidor quando recebe.
alter table readings
  add column if not exists external_power boolean,
  add column if not exists uptime_s       integer,
  add column if not exists reset_reason   text,
  add column if not exists free_heap      integer;

-- Quais eventos cada usuário quer receber por notificação
alter table alert_rules
  add column if not exists notify_power   boolean not null default true,   -- queda de energia
  add column if not exists notify_sensor  boolean not null default true,   -- sensor parou de ler
  add column if not exists notify_restart boolean not null default true;   -- reinício inesperado (exceção ou watchdog)
