# Estação meteorológica: painel web

Painel web para acompanhar uma ou mais estações meteorológicas com **ESP8266**. Os ESPs enviam temperatura, umidade, sinal Wi-Fi e bateria por uma API REST; o painel guarda tudo no banco, mostra o histórico em gráficos e compara com o **tempo atual e a previsão** da cidade pela OpenWeatherMap.

Feito com **Next.js** (hospedado no **Vercel**) e **Supabase** (Postgres).

## Recursos

**Página pública (tela inicial)**
- A tela inicial (`/`) abre **sem login** e mostra os ESPs que o admin marcou como públicos: tempo da cidade, previsão, temperatura e umidade do sensor e o gráfico.
- Não expõe IP, firmware, Wi-Fi nem bateria dos dispositivos.
- Botão **Entrar** no canto superior direito abre a tela de login (vira **Painel** se você já estiver logado).

**Painel (com login, em `/painel`)**
- Tempo atual da cidade em destaque (temperatura, sensação, umidade, vento, pressão, nascer e pôr do sol), com fundo de dia ou de noite conforme o ícone da OpenWeatherMap.
- Previsão dos próximos 4 dias: máxima, mínima, descrição, ícone e chance de chuva.
- Leituras do sensor do ESP: temperatura e umidade (com casa decimal), sinal Wi-Fi em % e dBm, e bateria.
- Bateria com ícone estilo celular, percentual, tensão em volts, estado **ativa** ou **inativa** (bateria detectada ou não) e aviso de bateria baixa.
- Status **online/offline** de cada ESP e tempo desde a última leitura.
- Gráfico de temperatura e umidade do ESP selecionado, com período de **24 horas, 7 dias ou 30 dias**.
- Seleção de **dispositivo** e de **cidade** (o painel lembra a última escolha de cada um neste navegador): cada leitura guarda a cidade (código da OpenWeatherMap), e o gráfico e o tempo seguem a cidade escolhida.
- **Sensação térmica** (índice de calor) e **ponto de orvalho** com indicador de conforto, calculados a partir da temperatura e da umidade do sensor.
- **Estatísticas do período**: mínima, máxima (com data e hora) e média de temperatura e umidade.
- Gráfico com médias por hora nos períodos de 7 e 30 dias (mais leve no celular) e **exportação CSV** das leituras.
- Informações do dispositivo: ID, IP, firmware, cidade e horário da última leitura.
- **Diagnóstico do ESP** (para quem tem acesso): alimentação (energia externa ou bateria), estado do sensor, tempo ligado, motivo do último reinício (travamentos aparecem em vermelho), memória livre, intervalo de envio, tela do OLED e ID do chip.
- **Sensor com defeito**: se o ESP informa `sensor_ok: false`, o painel avisa, não grava a leitura (que viria como 0,0) e mantém a última leitura boa.
- **Atalho para a página do ESP**: para admins, o IP do dispositivo é um link que abre `http://IP/` (a tela inicial do próprio ESP, com o atalho para as configurações) em outra aba. Funciona com o navegador na mesma rede do ESP. Os demais usuários veem apenas o IP.
- **Tema claro e escuro**, com o botão no topo (lembra a escolha e, na primeira visita, segue o tema do sistema).
- Layout responsivo para celular.

**Notificações push (alertas)**
- Cada usuário define, **para cada ESP**, limites de **temperatura mínima e máxima**, **umidade mínima e máxima** e um **percentual de bateria** para o aviso de bateria baixa (em *Minha conta*).
- Ao receber uma leitura, a API compara com os limites de cada usuário que tem acesso ao ESP e envia a notificação para os aparelhos dele, mesmo com o app fechado.
- Também avisa **eventos do ESP**: queda de energia (energia externa para bateria), falha do sensor e reinício inesperado (exceção ou watchdog). Cada tipo pode ser ligado ou desligado por ESP.
- A bateria não gera aviso enquanto o ESP está na energia externa.
- O aviso sai quando o valor passa do limite e se repete depois de 2 horas (6 horas na bateria) se continuar fora; opcionalmente avisa quando **voltar ao normal**. Uma folga evita avisos repetidos quando o valor oscila no limite.
- Cada celular ou navegador ativa as notificações uma vez, com botão de teste. No iPhone (iOS 16.4 ou mais novo) é preciso instalar o app pela Tela de Início.

**App instalável (PWA)**
- Pode ser instalado no celular ou no computador (botão **Instalar app** no topo, quando o navegador permite; no iPhone, use *Compartilhar → Adicionar à Tela de Início*).
- Ícone próprio, abre em tela cheia e mostra uma página amigável quando está sem internet. Os dados nunca ficam em cache, para não exibir leituras antigas como se fossem atuais.

**Dispositivos**
- Cadastro de ESPs pelo ID, com nome e descrição.
- **Cadastro automático**: se um ESP envia uma leitura com um ID novo, ele é criado sozinho, com nome e descrição em branco, e o admin completa depois.
- Quem tem acesso a um ESP pode editar nome e descrição; só o admin cadastra, exclui e define quais ESPs aparecem na página pública.

**Usuários e permissões**
- Login com usuário e senha (senha com hash `scrypt`, sessão em cookie `httpOnly` de 7 dias).
- Dois tipos de usuário:
  - **Admin**: vê todos os ESPs e gerencia usuários.
  - **Normal**: vê só os ESPs que um admin liberou para ele.
- O admin escolhe, na criação ou depois, **quais ESPs cada usuário normal pode acessar**.
- **Chave da OpenWeatherMap por usuário**, cadastrada em *Minha conta* (ou pelo admin). A consulta ao tempo é feita no servidor, e a chave nunca vai para o navegador. As chaves aparecem mascaradas na interface (por exemplo, `************56f5`): só os 4 últimos caracteres, e o valor mascarado nunca é regravado.
- **Usuário principal** (`ADMIN_USER` do ambiente): sempre admin, não pode ser excluído nem rebaixado, e a senha é a `ADMIN_PASSWORD`. Serve de acesso de emergência.
- Troca de senha pelo próprio usuário.

## Como funciona

```mermaid
flowchart LR
  ESP[ESP8266<br/>a cada 15 min] -- "POST /api/readings<br/>x-device-key" --> API[Next.js no Vercel]
  Browser[Navegador] -- "login + painel" --> API
  API -- service role --> DB[(Supabase<br/>Postgres)]
  API -- chave do usuário --> OWM[OpenWeatherMap<br/>tempo e previsão]
```

O navegador e o ESP nunca falam direto com o banco: todo acesso passa pela API, que guarda as chaves.

## Tecnologias

Next.js 15 (App Router), React 19, TypeScript, Recharts, Supabase (`@supabase/supabase-js`), `jose` (JWT da sessão) e a API da OpenWeatherMap.

## Estrutura

```
app/
  page.tsx                 página pública (tela inicial, sem login)
  painel/page.tsx          painel com login (tempo, previsão, sensor, gráfico)
  devices/page.tsx         dispositivos
  users/page.tsx           usuários e acesso (admin)
  account/page.tsx         minha conta (chave OpenWeatherMap, senha)
  login/page.tsx           login
  api/
    login, logout, me     sessão e dados do usuário logado
    users, users/[id]     gestão de usuários (admin)
    devices, devices/[id] gestão de dispositivos
    readings              ESP envia (POST) e painel consulta (GET)
    cities                cidades já enviadas por um ESP
    weather, forecast     tempo atual e previsão (OpenWeatherMap)
    public/*              rotas sem login, só para ESPs marcados como públicos
    push/*                registro do aparelho, chave pública e teste
    alerts, alerts/[id]   regras de alerta por usuário e ESP
components/                Dashboard (público e privado), TopBar, PublicBar, ThemeToggle, Battery, Notifications, PWA
lib/                       auth (JWT), password (scrypt), session, supabase, owm, readings, readingSchema (zod), public, push, alerts, format
public/                    sw.js, offline.html e ícones do app
app/manifest.ts            manifesto do PWA
esp8266/WeatherApi.h       exemplo de envio para o firmware do ESP
schema.sql                 banco novo
migration.sql              atualização de um banco existente
migration-v2.sql           adiciona a página pública (coluna is_public)
migration-v3.sql           adiciona as notificações push (aparelhos, regras e estado dos alertas)
migration-v4.sql           adiciona os campos de diagnóstico do ESP e os eventos de alerta
middleware.ts              protege páginas e API (exceto página pública, login e POST de leituras)
```

## Instalação

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, rode `schema.sql` (banco novo). Para atualizar um banco existente, rode `migration.sql`, `migration-v2.sql`, `migration-v3.sql` e `migration-v4.sql`, nessa ordem, pulando os que já rodou; todos mantêm os dados.
3. Em **Project Settings → API**, copie a **URL do projeto**. Em **API Keys**, copie a chave secreta (`sb_secret_...`) ou, na aba *Legacy API Keys*, a `service_role`.

### 2. Vercel

1. Suba este repositório para o GitHub e importe em [vercel.com](https://vercel.com) (**Add New → Project**). O preset deve ser Next.js.
2. Em **Settings → Environment Variables**, crie as variáveis abaixo e faça o deploy (ou um *Redeploy*, pois variáveis só valem para deploys novos).

| Variável | Para que serve |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de servidor do Supabase (nunca use o prefixo `NEXT_PUBLIC_`) |
| `DEVICE_KEY` | Senha longa que o ESP envia no cabeçalho `x-device-key` |
| `ADMIN_USER` | Usuário principal (sempre admin) |
| `ADMIN_PASSWORD` | Senha do usuário principal |
| `AUTH_SECRET` | Segredo para assinar a sessão (`openssl rand -base64 32`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Chaves das notificações push (gere com `npx web-push generate-vapid-keys`; o assunto é `mailto:seu@email`) |
| `OWM_PUBLIC_KEY` | Opcional: chave da OpenWeatherMap da página pública. Se vazia, usa a do usuário principal e, na falta dela, a de outro admin |

O arquivo `.env.example` tem um modelo. Nunca envie o `.env` real para o GitHub.

### 3. Primeiro acesso

1. Abra o endereço do Vercel, clique em **Entrar** e use `ADMIN_USER` e `ADMIN_PASSWORD`.
2. Em **Minha conta**, cadastre sua chave da [OpenWeatherMap](https://openweathermap.org/api). Chaves novas podem levar um tempo para ativar.
3. Em **Usuários**, crie os demais usuários e marque os ESPs de cada um.
4. Os ESPs aparecem em **Dispositivos** no primeiro envio, ou você os cadastra pelo ID.
5. Para receber alertas, abra **Minha conta**, toque em **Ativar notificações neste aparelho** e defina os limites de cada ESP.
6. Para mostrar um ESP na página pública, marque **Mostrar na página pública** nele e clique em Salvar.

### Desenvolvimento local

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev                  # http://localhost:3000
```

## Firmware do ESP8266

O ESP faz um `POST` HTTPS a cada **15 minutos**. O arquivo `esp8266/WeatherApi.h` é um exemplo pronto: configure `API_URL`, `DEVICE_KEY`, `DEVICE_ID`, `CITY_ID` e `CITY_NAME`, e chame `sendReading(temperatura, umidade)`.

- O `DEVICE_ID` é a identidade do ESP no painel. Cada ESP precisa de um ID próprio.
- O `CITY_ID` é o código da cidade na OpenWeatherMap (por exemplo, Franca = `3463011`).
- A umidade e a temperatura são enviadas com uma casa decimal (por exemplo, com um sensor DHT22).
- **Bateria**: o exemplo lê a tensão no pino `A0`. Uma LiPo chega a 4,2 V, mais do que o `A0` aguenta, então use um divisor de tensão externo e ajuste `BATTERY_DIVIDER` (calibre com um multímetro). Se a leitura fica abaixo de 2,5 V, o ESP envia `battery_active: false` (bateria inativa).
- O exemplo usa `setInsecure()` no TLS por simplicidade, porque o ESP8266 tem pouca memória para validar certificados.

## API

### Enviar leitura (ESP)

`POST /api/readings`, com o cabeçalho `x-device-key: <DEVICE_KEY>` e `Content-Type: application/json`.

```json
{
  "device_id": "esp8266-sala",
  "temperature": 24.5,
  "humidity": 61.3,
  "city_id": 3463011,
  "city_name": "Franca",
  "ip": "192.168.0.50",
  "rssi": -62,
  "firmware": "2.8",
  "battery_active": true,
  "battery": 83,
  "battery_voltage": 4.02,
  "external_power": false,
  "sensor_ok": true,
  "uptime_s": 86400,
  "reset_reason": "Power on",
  "free_heap": 24120,
  "chip_id": "A1B2C3",
  "send_interval_s": 900,
  "display_on": true,
  "rssi_pct": 76
}
```

Só `device_id`, `temperature` e `humidity` são obrigatórios; todo o resto é opcional, então um ESP com firmware antigo continua sendo aceito. Campos desconhecidos são ignorados. O horário da leitura é o da chegada no servidor.

| Campo | Tipo | Descrição |
|---|---|---|
| `device_id` | texto | **Obrigatório.** Até 32 caracteres: letras, números, `-`, `_` e `.` |
| `temperature` | número | **Obrigatório.** °C, de -40 a 85 |
| `humidity` | número | **Obrigatório.** %, de 0 a 100 |
| `ip`, `rssi`, `firmware` | texto, inteiro, texto | Dados do dispositivo (`rssi` em dBm) |
| `city_id`, `city_name` | inteiro, texto | Cidade na OpenWeatherMap (`city_id` pode ser `null`; `city_name` pode ser vazio) |
| `battery_active` | booleano | `true` se há bateria detectada |
| `battery`, `battery_voltage` | inteiro, número | Carga em % (0 a 100) e tensão em V |
| `external_power` | booleano ou `null` | `true` = energia externa, `false` = bateria, `null` = ESP sem placa UPS |
| `sensor_ok` | booleano | `false` = o sensor parou de ler (a leitura não é gravada) |
| `uptime_s` | inteiro | Segundos desde o último boot |
| `reset_reason` | texto | Motivo do último reinício (por exemplo, `Power on`, `Exception`, `Hardware Watchdog`) |
| `free_heap` | inteiro | Memória livre em bytes |
| `chip_id` | texto | ID do chip em hexadecimal |
| `send_interval_s` | inteiro | Segundos entre envios (o painel marca offline depois de 2,5 vezes esse intervalo) |
| `display_on` | booleano | Tela do OLED acesa |
| `rssi_pct` | inteiro | Aceito, mas ignorado: o painel calcula o percentual pelo `rssi` |

Respostas: `200 {"ok":true}`, `400 invalid payload` (com a lista `details` dizendo qual campo está errado), `401 unauthorized` (chave errada) e `500 db error`.

Teste rápido:

```bash
curl -X POST https://SEU-PROJETO.vercel.app/api/readings \
  -H "Content-Type: application/json" -H "x-device-key: SUA_DEVICE_KEY" \
  -d '{"device_id":"esp8266-sala","temperature":24.5,"humidity":61.3,"city_id":3463011,"city_name":"Franca","external_power":true,"sensor_ok":true}'
```

### Demais rotas (exigem login)

| Rota | Quem | Função |
|---|---|---|
| `GET /api/readings?device=ID&hours=24&city=CODIGO` | com acesso ao ESP | Leituras do período (até 720 horas); `city` é opcional |
| `GET /api/cities?device=ID` | com acesso ao ESP | Cidades já enviadas pelo ESP |
| `GET /api/weather?city=CODIGO` | logado | Tempo atual, com a chave do usuário |
| `GET /api/forecast?city=CODIGO` | logado | Previsão dos próximos 4 dias |
| `GET /api/public/devices`, `/cities`, `/readings`, `/weather`, `/forecast` | qualquer pessoa | Mesmas consultas, só para ESPs públicos e sem dados sensíveis |
| `GET /api/alerts`, `PUT/DELETE /api/alerts/[id]` | logado | Regras de alerta do usuário, uma por ESP |
| `POST/DELETE /api/push/subscribe`, `POST /api/push/test`, `GET /api/push/config` | logado | Registro do aparelho, teste e chave pública |
| `GET /api/devices` | logado | Lista os ESPs visíveis ao usuário |
| `POST /api/devices` | admin | Cadastra ESP |
| `PATCH /api/devices/[id]` | com acesso ao ESP | Edita nome e descrição (admin também define se é público) |
| `DELETE /api/devices/[id]` | admin | Exclui ESP e suas leituras |
| `GET/POST /api/users` | admin | Lista e cria usuários |
| `PATCH/DELETE /api/users/[id]` | admin | Edita (tipo, chave, senha, ESPs liberados) ou exclui |
| `GET/PATCH /api/me` | logado | Dados do usuário; troca chave e senha |
| `POST /api/login`, `POST /api/logout` | público, logado | Sessão |

## Banco de dados

| Tabela | Conteúdo |
|---|---|
| `users` | Usuários, hash da senha, tipo (`admin` ou `user`) e chave da OpenWeatherMap |
| `push_subscriptions` | Aparelhos registrados para receber notificações |
| `alert_rules` | Limites de alerta de cada usuário em cada ESP |
| `alert_state` | Quais alertas estão ativos e quando foi o último aviso (evita repetição) |
| `devices` | ESPs: nome, descrição, se é público, IP, Wi-Fi, bateria, firmware, cidade, última leitura e diagnóstico (alimentação, sensor, tempo ligado, reinício, memória, chip, intervalo e tela) |
| `user_devices` | Quais ESPs cada usuário normal pode ver |
| `readings` | Histórico de temperatura, umidade e cidade, com alimentação, tempo ligado, motivo do reinício e memória livre |
| `device_cities` | Cidades já usadas por cada ESP (alimenta o seletor) |

As tabelas têm RLS ligado e nenhuma policy: só a API, com a chave de servidor, acessa os dados.

## Segurança e limites

- A chave do Supabase e a da OpenWeatherMap ficam só no servidor.
- A página pública só expõe os ESPs que o admin marcou, sem IP, firmware, Wi-Fi nem bateria. As consultas de tempo da página pública só aceitam cidades já enviadas por um ESP público e ficam em cache por 5 minutos, para proteger a cota da OpenWeatherMap.
- Existe uma única `DEVICE_KEY` para todos os ESPs. Quem a tiver consegue enviar leituras e criar dispositivos, então guarde-a e troque-a se vazar.
- As chaves da OpenWeatherMap ficam gravadas em texto no banco e não são mostradas de volta na interface.
- Não há limitação de tentativas de login: use uma senha forte no `ADMIN_PASSWORD`.
- A previsão usa o plano gratuito da OpenWeatherMap (até 5 dias, em blocos de 3 horas).

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| `404 DEPLOYMENT_NOT_FOUND` | Endereço errado ou deploy que falhou: confira em **Deployments** no Vercel |
| `400 invalid payload` | Corpo vazio ou campo fora do formato; a resposta traz `details` com o campo errado (por exemplo, `device_id` com mais de 32 caracteres ou temperatura fora de -40 a 85) |
| `401 unauthorized` na API do ESP | `x-device-key` diferente de `DEVICE_KEY` |
| `500 db error` | Variáveis do Supabase erradas, falta de *Redeploy* ou `schema.sql` / `migration.sql` não executado |
| "A OpenWeatherMap recusou a chave" | Chave errada, ou nova demais e ainda não ativada |
| ESP aparece offline | Sem leitura há mais de 2,5 vezes o intervalo de envio (37 minutos, se o ESP não informar `send_interval_s` e enviar a cada 15) |
| Usuário normal não vê nenhum ESP | Um admin precisa liberar os ESPs em **Usuários** |
| Página pública vazia | Nenhum ESP marcado como público em **Dispositivos** (e falta rodar `migration-v2.sql`) |
| Não chegam notificações | Confira as variáveis `VAPID_*` e o `migration-v3.sql`, use **Enviar teste** em Minha conta e, no Android, desative a economia de bateria agressiva para o navegador |
| Botão "Instalar app" não aparece | O navegador só oferece em HTTPS e quando o app ainda não está instalado; no iPhone use *Adicionar à Tela de Início* |
| Gráfico sem dados | Nenhuma leitura no período, ou a cidade selecionada não tem leituras |
