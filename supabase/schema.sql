-- Rode no Supabase > SQL Editor.
-- Se você já criou as tabelas do exemplo anterior e não tem dados a manter, este drop as recria.
drop table if exists readings;
drop table if exists devices;

create table devices (
  id text primary key,                -- mesmo device_id configurado no ESP
  name text not null,
  description text,
  ip text,
  rssi int,                           -- dBm
  battery int,                        -- %
  battery_voltage real,               -- volts
  battery_active boolean,             -- true = bateria detectada/em uso
  firmware text,
  last_temperature real,
  last_humidity real,
  last_seen timestamptz,
  created_at timestamptz default now()
);

create table readings (
  id bigint generated always as identity primary key,
  device_id text not null references devices(id) on delete cascade,
  temperature real not null,
  humidity real not null,
  created_at timestamptz default now()
);
create index on readings (device_id, created_at desc);

-- Só a API (service role) acessa as tabelas
alter table devices enable row level security;
alter table readings enable row level security;
