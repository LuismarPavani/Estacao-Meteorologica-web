-- Rode no Supabase > SQL Editor (depois do migration-v5.sql). Não apaga nada.
-- Limite de tentativas de login: cada senha errada vira uma linha, com o usuário digitado e o IP.
-- O painel bloqueia o IP por 15 min depois de 5 erros no mesmo usuário ou 20 erros no total,
-- e apaga sozinho as linhas com mais de 1 dia.
create table if not exists login_failures (
  id bigserial primary key,
  username text not null,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists login_failures_ip_at on login_failures (ip, at desc);
create index if not exists login_failures_user_ip_at on login_failures (username, ip, at desc);
create index if not exists login_failures_at on login_failures (at);
alter table login_failures enable row level security;
