# Arquitetura Recomendada — Plataforma IC (Clínica de Emagrecimento Saudável)

> Documento de planejamento técnico do sistema web da Clínica IC.
> Status: **proposta de arquitetura para o MVP** · Data: 2026-06-05

---

## 1. Visão Geral

A plataforma IC é um sistema web para gestão clínica de pacientes em
tratamento de emagrecimento saudável, com três pilares:

1. **Gestão clínica** — prontuário, evolução, agenda, documentos/exames.
2. **Nutrição** — cardápio do paciente, edição pela equipe, contagem de
   calorias diárias (inclusive via IA analisando foto da refeição).
3. **Acompanhamento remoto** — integração com wearables (relógios) para
   medir atividade física, sono, frequência cardíaca, HRV e aderência,
   com alertas para a equipe médica.

Há dois tipos de usuário principais:

- **Equipe da clínica** (médica/nutróloga, nutricionista, recepção/admin) —
  cria e acompanha pacientes, edita cardápios, recebe alertas e relatórios.
- **Paciente** — acessa portal próprio (login/senha), vê sua evolução,
  agenda, cardápio, envia exames e conecta o relógio.

### Decisões já tomadas (definições do cliente)

| Camada | Escolha | Observação |
|---|---|---|
| Backend | **Node.js + NestJS (TypeScript)** | Mesma linguagem do front, time full-stack TS |
| Frontend | **Next.js + React** | Portal do paciente + painel da clínica |
| Banco / Auth / Storage | **Supabase (PostgreSQL gerenciado)** | Verificar região e DPA p/ LGPD |
| Integração wearables | **Terra API** | Integrador único p/ Garmin, Apple, Samsung, Polar, WHOOP, Oura... |
| IA de calorias | **Modelo multimodal via API (Claude / GPT-4o)** | Análise de foto da refeição |

---

## 2. Diagrama de Arquitetura (alto nível)

```
                          ┌──────────────────────────────┐
                          │        Navegador / Mobile      │
                          │  (Paciente)      (Equipe)      │
                          └───────────────┬───────────────┘
                                          │ HTTPS
                          ┌───────────────▼───────────────┐
                          │   Frontend — Next.js (React)   │
                          │  Portal do paciente + Painel   │
                          │  clínico   (Vercel)            │
                          └───────────────┬───────────────┘
                                          │ REST/JSON + JWT
                          ┌───────────────▼───────────────┐
                          │   Backend — NestJS (Node.js)   │
                          │  ┌──────────────────────────┐  │
                          │  │ Auth   Pacientes  Agenda │  │
                          │  │ Nutrição  Wearables      │  │
                          │  │ Alertas  Relatórios      │  │
                          │  └──────────────────────────┘  │
                          └──┬────────┬────────┬────────┬──┘
                             │        │        │        │
              ┌──────────────▼──┐  ┌──▼─────┐ ┌▼───────┐ ┌▼──────────────┐
              │  Supabase        │  │ Filas/ │ │ IA      │ │ Terra API      │
              │  PostgreSQL+RLS  │  │ Jobs   │ │ Multi-  │ │ (wearables)    │
              │  Auth + Storage  │  │(BullMQ)│ │ modal   │ │  + Webhooks    │
              └──────────────────┘  └────────┘ └─────────┘ └───────┬────────┘
                                                                    │
                                          eventos (novos dados)  ◄──┘
                                          POST /webhooks/terra
```

Fluxo de wearables (conforme desenhado pelo cliente):

1. Paciente abre o portal e clica em **"Conectar meu relógio"**.
2. Escolhe o provedor (Garmin, Apple Health, Samsung, Polar, WHOOP, Oura...).
3. Autoriza o compartilhamento (OAuth via Terra Connect / Widget).
4. A Terra API envia **eventos para o webhook da clínica** quando há dados novos.
5. O backend valida a assinatura, normaliza e **salva no PostgreSQL**.
6. O painel da clínica exibe: calorias gastas, treinos, FC média/máx, passos,
   sono, HRV, aderência semanal e **alertas** de queda de atividade / excesso de carga.

---

## 3. Stack Tecnológico

### Frontend — Next.js (App Router)
- **Next.js + React + TypeScript**, hospedado na **Vercel**.
- **TailwindCSS + shadcn/ui** para UI consistente e rápida.
- **TanStack Query** para data-fetching/cache; **Zustand** para estado local leve.
- **Recharts / visx** para gráficos de evolução (peso, calorias, sono, HRV).
- Dois "espaços" sob o mesmo app (ou dois apps no monorepo):
  - `/portal` → área do paciente.
  - `/clinica` → painel da equipe (acesso por papel).
- **PWA** (instalável no celular) para o paciente — câmera p/ foto da refeição.

### Backend — NestJS
- **NestJS (TypeScript)** modular, com Swagger/OpenAPI automático.
- **Prisma** ou **Drizzle** como ORM sobre o Postgres do Supabase.
- **BullMQ + Redis** para jobs assíncronos (ingestão de webhooks, geração de
  relatórios semanais, chamadas de IA, envio de e-mails/notificações).
- **Zod / class-validator** para validação de DTOs.
- Autenticação por **JWT do Supabase Auth** validado no backend.

### Dados — Supabase
- **PostgreSQL** gerenciado (verificar região e assinar **DPA** — dados de saúde).
- **Supabase Auth** (e-mail/senha, magic link, MFA opcional para a equipe).
- **Supabase Storage** para documentos/exames e fotos de refeição (buckets
  privados com URLs assinadas e expiração curta).
- **Row Level Security (RLS)**: paciente só enxerga os próprios dados.

### Integrações
- **Terra API** — integrador único de wearables + webhooks.
- **IA multimodal** (Claude / GPT-4o) — estimativa de alimentos e calorias por foto.
- **Resend / Amazon SES** — e-mails (relatórios, alertas, recuperação de senha).
- (Opcional) **WhatsApp Cloud API** — lembretes e alertas para o paciente.

---

## 4. Modelo de Dados (MVP)

Esquema PostgreSQL principal (resumido). Todas as tabelas com `created_at`,
`updated_at` e RLS habilitado.

```
clinics            (id, nome, cnpj, config)
users              (id, clinic_id, role[admin|medico|nutri|recepcao|paciente],
                    nome, email, phone, auth_uid)
patients           (id, clinic_id, user_id, data_nasc, sexo, altura_cm,
                    objetivo, condicoes_clinicas, ativo)

-- Evolução clínica
measurements       (id, patient_id, data, peso_kg, imc, percentual_gordura,
                    massa_magra, circ_cintura, pressao, obs)
clinical_notes     (id, patient_id, author_id, data, conteudo)  -- prontuário
documents          (id, patient_id, tipo[exame|receita|outro], storage_path,
                    nome_arquivo, uploaded_by, data)

-- Agenda
appointments       (id, clinic_id, patient_id, profissional_id, inicio, fim,
                    tipo[consulta|retorno|online], status, link_video, obs)

-- Nutrição
meal_plans         (id, patient_id, nutri_id, titulo, vigencia_inicio,
                    vigencia_fim, kcal_meta_dia, ativo)
meal_plan_items    (id, meal_plan_id, refeicao[cafe|almoco|lanche|jantar...],
                    descricao, alimentos(jsonb), kcal_estimada)
food_logs          (id, patient_id, data, refeicao, descricao,
                    foto_path, kcal_estimada, fonte[manual|ia],
                    ia_payload(jsonb), confirmado_por)

-- Wearables (Terra)
wearable_connections (id, patient_id, provedor, terra_user_id,
                      status, escopos, conectado_em)
wearable_daily       (id, patient_id, data, passos, kcal_gastas,
                      fc_media, fc_max, sono_min, hrv, distancia_m,
                      minutos_ativos, fonte, raw(jsonb))
wearable_activities  (id, patient_id, inicio, fim, tipo, kcal,
                      fc_media, fc_max, distancia_m, raw(jsonb))

-- Aderência, alertas e relatórios
adherence_weekly   (id, patient_id, semana, score, treinos_realizados,
                    meta_treinos, kcal_aderencia, detalhes(jsonb))
alerts             (id, clinic_id, patient_id, tipo[queda_atividade|
                    excesso_carga|abaixo_meta|sem_dados], severidade,
                    mensagem, status[aberto|visto|resolvido], data)
reports            (id, patient_id, periodo, storage_path, gerado_em)
audit_log          (id, actor_id, acao, entidade, entidade_id, data, ip)
```

Notas de modelagem:
- `wearable_daily` é a tabela "quente" do painel — indexar por `(patient_id, data)`.
- Guardar sempre o `raw(jsonb)` da Terra para reprocessamento futuro sem reimportar.
- `food_logs.ia_payload` guarda a resposta bruta do modelo (itens, porções,
  confiança) para auditoria e melhoria.

---

## 5. Módulos do Backend (NestJS)

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login, papéis, guard de RLS, MFA da equipe |
| `patients` | CRUD de pacientes, medições, prontuário, documentos |
| `appointments` | Agenda, status, integração c/ Google Calendar (opcional) |
| `nutrition` | Cardápios, itens, food logs, contagem de calorias |
| `ai` | Orquestra chamadas ao modelo multimodal (foto → calorias) |
| `wearables` | Conexão Terra, webhook, normalização, consultas do painel |
| `adherence` | Cálculo de aderência semanal (cron job) |
| `alerts` | Regras de alerta e notificação da equipe |
| `reports` | Geração de relatório semanal por paciente (PDF) |
| `notifications` | E-mail / WhatsApp |
| `audit` | Trilha de auditoria (LGPD) |

---

## 6. Integração com Wearables (Terra API)

**Por que Terra:** um único contrato/SDK cobre Garmin, Apple Health,
Samsung Health, Polar, WHOOP, Oura e dezenas de outros, normalizando os dados
em um schema único e entregando por **webhook**.

### Conexão
- Backend cria um *Terra user* para o paciente e gera o **Widget/Connect URL**.
- O frontend abre esse fluxo no botão "Conectar meu relógio" (OAuth do provedor).
- Ao concluir, persistimos `wearable_connections`.

### Ingestão por Webhook
- Endpoint `POST /webhooks/terra` (rota pública, mas protegida):
  1. **Verifica a assinatura HMAC** do header (`terra-signature`) — rejeita
     payloads não assinados.
  2. Responde **200 rápido** e empurra o payload para uma **fila (BullMQ)**.
  3. Worker normaliza e faz **upsert** em `wearable_daily` /
     `wearable_activities` (idempotente por `patient_id + data + tipo`).
- Tipos de evento tratados: `activity`, `daily`, `sleep`, `body`, `auth`,
  `deauth`, `reauth`. Reagir a `deauth` atualizando o status da conexão.
- **Backfill** inicial: ao conectar, solicitar histórico (ex.: 30 dias).

### Painel exibe
- Calorias gastas (dia/semana), treinos realizados, FC média/máx, passos,
  sono, HRV, aderência semanal.
- Tendências com gráficos; comparação com metas definidas pela equipe.

---

## 7. Módulo de Nutrição + IA de Calorias

### Cardápio (CRUD pela equipe)
- Nutricionista cria `meal_plan` com metas (`kcal_meta_dia`) e itens por refeição.
- Edição direta no painel; paciente visualiza no portal.

### Contagem de calorias por foto (IA multimodal)
Fluxo no MVP:
1. Paciente tira/sobe foto da refeição no portal (PWA, câmera).
2. Upload para bucket privado do Supabase Storage.
3. Backend (módulo `ai`) envia a imagem ao modelo multimodal com um **prompt
   estruturado** pedindo: lista de alimentos, porção estimada, kcal e
   macros, com **nível de confiança** — saída em **JSON** (structured output).
4. Resultado salvo em `food_logs` (`fonte = 'ia'`, `ia_payload` completo).
5. **Revisão humana opcional:** paciente/nutri confirma ou ajusta antes de
   contabilizar (a IA estima, a pessoa valida) — reduz erro e risco clínico.
6. Soma diária comparada à `kcal_meta_dia` do cardápio ativo.

Boas práticas:
- Sempre tratar o número como **estimativa** (mostrar faixa/confiança).
- Permitir correção manual e busca em base nutricional (TACO/USDA) como
  complemento — melhora precisão e serve de *fallback* se a IA falhar.
- Registrar custo por chamada e *rate limit* por paciente.

---

## 8. Alertas e Relatórios

### Relatórios semanais automáticos (cron)
- Job semanal por paciente agrega: peso/medidas, aderência ao cardápio,
  atividade/treinos, sono, HRV, calorias gasto x ingerido.
- Gera **PDF** + resumo, salva em `reports` e notifica a equipe (e paciente).

### Alertas para a equipe
Regras configuráveis, avaliadas por job diário/streaming:
- **Queda de atividade** — passos/minutos ativos abaixo do baseline do paciente.
- **Excesso de carga** — volume/intensidade muito acima do habitual (risco).
- **Abaixo da meta** — aderência semanal < limiar (ex.: < 60%).
- **Sem dados** — relógio sem sincronizar há N dias.
Alertas viram itens em `alerts` no painel + e-mail/WhatsApp para a médica/nutróloga.

---

## 9. Segurança, Privacidade e LGPD

Dados de saúde são **dados sensíveis** (LGPD, art. 11). Requisitos mínimos:

- **Base legal e consentimento** explícito do paciente para tratamento e para
  compartilhamento dos dados do wearable (tela de consentimento + versão/data).
- **DPA com Supabase** e verificação da **região de hospedagem**; preferir
  região que atenda requisitos contratuais. (Se necessário, plano B em cloud BR.)
- **RLS** em todas as tabelas; paciente só acessa o próprio dado; equipe
  limitada ao escopo da clínica.
- **Criptografia** em trânsito (TLS) e em repouso (Supabase). Storage privado
  com **URLs assinadas** de curta duração para exames e fotos.
- **MFA** para contas da equipe; senhas fortes; sessões com expiração.
- **Trilha de auditoria** (`audit_log`) de acessos e alterações em prontuário.
- **Direitos do titular**: exportação e exclusão de dados (right to be
  forgotten) — incluindo `deauth` na Terra.
- **Retenção e minimização**: guardar só o necessário; política de retenção.
- **Segredos** (Terra, IA, e-mail) em variáveis de ambiente / secret manager,
  nunca no repositório.
- ⚠️ A estimativa de calorias por IA é **apoio**, não diagnóstico —
  decisão clínica é sempre da profissional.

---

## 10. Estrutura do Repositório (monorepo)

```
ic/
├── apps/
│   ├── web/                 # Next.js (portal paciente + painel clínica)
│   └── api/                 # NestJS (backend)
├── packages/
│   ├── types/               # tipos/DTOs compartilhados (TS)
│   ├── ui/                  # componentes compartilhados (shadcn)
│   └── config/              # eslint, tsconfig, tailwind base
├── infra/
│   ├── supabase/            # migrations, policies RLS, seed
│   └── docker/              # docker-compose (Redis, etc. p/ dev)
├── docs/
│   └── arquitetura.md       # este documento
└── .github/workflows/       # CI (lint, test, build, migrations)
```

Ferramentas: **pnpm + Turborepo** para o monorepo; **ESLint + Prettier**;
**Vitest/Jest** para testes; **GitHub Actions** para CI.

---

## 11. Roadmap por Fases

### Fase 0 — Fundação (semana 1–2)
- Monorepo, Supabase (projeto, Auth, Storage, migrations base), CI/CD.
- Autenticação + papéis (equipe x paciente) + RLS inicial.
- Layout base do painel e do portal.

### Fase 1 — Núcleo clínico (semana 3–5)
- CRUD de pacientes, medições/evolução (gráfico de peso/IMC).
- Prontuário/notas clínicas.
- Upload de documentos/exames (Storage privado).
- Agenda básica (consultas, status).

### Fase 2 — Nutrição + IA (semana 6–8)
- Cardápio (CRUD pela equipe) + visualização no portal.
- Food log com foto → IA multimodal → estimativa de calorias + revisão.
- Painel diário: ingerido x meta.

### Fase 3 — Wearables (semana 9–11)
- Conexão Terra ("Conectar meu relógio") + webhook + ingestão por fila.
- Painel de atividade: calorias gastas, treinos, FC, passos, sono, HRV.
- Backfill inicial e tratamento de `deauth`.

### Fase 4 — Aderência, alertas e relatórios (semana 12–13)
- Cálculo de aderência semanal.
- Regras de alerta para a equipe.
- Relatório semanal automático (PDF) por paciente.

### Fase 5 — Endurecimento (semana 14+)
- LGPD (consentimento, exportação/exclusão, auditoria), MFA, testes,
  observabilidade (logs/métricas), revisão de segurança.

---

## 12. Riscos e Pontos de Atenção

| Risco | Mitigação |
|---|---|
| Região/compliance do Supabase p/ dados de saúde | Validar DPA e região no início; ter plano B em cloud BR |
| Precisão da IA de calorias | Tratar como estimativa + revisão humana + base TACO/USDA |
| Custo de chamadas de IA | Rate limit por paciente, cache, monitorar custo |
| Limites/custos da Terra API | Confirmar planos, provedores suportados e cotas |
| Webhooks perdidos/duplicados | Idempotência, fila com retry, backfill periódico |
| Apple/Samsung Health (origem mobile) | Confirmar requisitos via Terra (pode exigir app/SDK mobile) |
| Escopo do MVP inflar | Congelar escopo por fase; entregas incrementais |

---

## 13. Próximos Passos Sugeridos

1. **Validar contratos**: criar contas Terra API e do provedor de IA; confirmar
   região/DPA do Supabase.
2. **Aprovar este documento** e o escopo do MVP (Fases 0–3 como mínimo viável).
3. **Bootstrap do repositório** (Fase 0) — posso gerar o esqueleto do monorepo
   (apps/web, apps/api, Supabase migrations, CI) já na próxima etapa.
```
