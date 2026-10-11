-- Rode no Supabase > SQL Editor (depois do migration.sql). Não apaga nada.
-- Marca quais ESPs aparecem na página pública (a tela inicial, sem login).
alter table devices add column if not exists is_public boolean not null default false;
