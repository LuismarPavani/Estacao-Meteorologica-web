-- Rode no Supabase > SQL Editor (depois do migration-v2.sql). Não apaga nada.
-- Notificações push: aparelhos registrados, regras de alerta por usuário e ESP, e o estado de cada alerta.

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
