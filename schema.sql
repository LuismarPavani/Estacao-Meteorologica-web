-- Instalação nova. (Para um banco que já existe, use migration.sql.)
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('admin','user')),
  owm_key text,
  created_at timestamptz default now()
);

create table devices (
  id text primary key,
  name text not null default '',
  description text,
  ip text, rssi int,
  battery int, battery_voltage real, battery_active boolean,
  firmware text,
  is_public boolean not null default false,   -- aparece na página pública
  city_id int, city_name text,
  last_temperature real, last_humidity real,
  last_seen timestamptz,
  created_at timestamptz default now()
);

create table user_devices (
  user_id uuid references users(id) on delete cascade,
  device_id text references devices(id) on delete cascade,
  primary key (user_id, device_id)
);

create table readings (
  id bigint generated always as identity primary key,
  device_id text not null references devices(id) on delete cascade,
  temperature real not null,
  humidity real not null,
  city_id int, city_name text,
  created_at timestamptz default now()
);
create index on readings (device_id, city_id, created_at desc);

create table device_cities (
  device_id text references devices(id) on delete cascade,
  city_id int,
  city_name text,
  last_seen timestamptz default now(),
  primary key (device_id, city_id)
);

alter table users enable row level security;
alter table devices enable row level security;
alter table user_devices enable row level security;
alter table readings enable row level security;
alter table device_cities enable row level security;

-- Notificações push
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);

create table alert_rules (
  user_id uuid references users(id) on delete cascade,
  device_id text references devices(id) on delete cascade,
  enabled boolean not null default true,
  temp_min real, temp_max real,
  hum_min real, hum_max real,
  battery_min int,                              -- avisa quando a bateria cair a esse % ou menos
  notify_recovery boolean not null default true, -- avisa também quando voltar ao normal
  primary key (user_id, device_id)
);

-- Evita repetir o mesmo aviso a cada leitura
create table alert_state (
  user_id uuid,
  device_id text,
  metric text,                                  -- temp_low, temp_high, hum_low, hum_high, battery_low
  active boolean not null default false,
  last_sent timestamptz,
  primary key (user_id, device_id, metric),
  foreign key (user_id, device_id) references alert_rules(user_id, device_id) on delete cascade
);

alter table push_subscriptions enable row level security;
alter table alert_rules enable row level security;
alter table alert_state enable row level security;
