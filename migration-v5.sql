-- Rode no Supabase > SQL Editor (depois do migration-v4.sql). Não apaga nada.
-- Coordenadas da cidade (firmware 3.3 ou mais novo envia lat e lon).
-- Com elas o painel consulta o clima por latitude/longitude (a consulta por ID da cidade é obsoleta na
-- OpenWeatherMap) e aceita ESPs sem city_id: a cidade passa a ser identificada por um código interno
-- negativo, calculado a partir das coordenadas (os códigos da OpenWeatherMap são sempre positivos).

alter table devices
  add column if not exists lat real,
  add column if not exists lon real;

alter table device_cities
  add column if not exists lat real,
  add column if not exists lon real;
