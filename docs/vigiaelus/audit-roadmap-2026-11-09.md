# VigiaElus — auditoria crítica e roadmap priorizado (2026-11-09)

> **Baseline:** OARANHA/crises, `feat/vigiaelus-client-portal-scan-v8` @ `646b9f9d2e979d1e3fceb8fa639b5c89cd0d4afd`. Inspeção estática dos arquivos e metadados GitHub, não pentest, não auditoria do banco de produção, não validação da máquina Windows. Estados: **confirmado no código**, **risco de arquitetura** ou **dependente de homologação**. Esforço qualitativo: B=baixo, M=médio, A=alto.

## Resumo executivo

**Pontos fortes verificados:** aplicação Next/TypeScript organizada em camadas reutilizáveis; 25 conectores cadastrados; suporte Drizzle/PGlite/Neon; guards de sessão e versão revogável; isolamento de leitura por `client_project_access`; coleta do piloto com trilha de proveniência, deduplicação e diagnósticos por fonte; 11 tools MCP somente leitura com token administrativo fail-closed; CI da branch mais avançada concluído com sucesso nos runs `42415615373` e `42415611478` para o SHA auditado.

**Estado de prontidão:** piloto funcional no código, mas **não homologado para operação multicliente contínua**. Três PRs draft empilhadas; `main` está atrás delas. O controle de coleta de 4 clientes/hora e o isolamento SaaS por workspace são propostas, não capacidades demonstradas. Merge/deploy dependem da autorização expressa do proprietário.

## Achados P0 — antes de produção multicliente/monitoramento contínuo

| ID | Achado e evidência | Natureza | Impacto | Esforço | Ação e critério de aceite |
|---|---|---|---|---|---|
| P0-01 | **Purga irreversível automática**: `lib/pipeline.ts` executa `DELETE FROM mentions WHERE published_at < now() - interval '90 days' AND import_file_id IS NULL`, sem exportação/auditoria prévia. O coletor manual é separado e não faz esta purga. | Confirmado | Crítico | M | Desabilitar exclusão legada; política de retenção explícita; export comprovado por artefato/manifesto antes do purge; testes com menções 91+ dias e rollback |
| P0-02 | **Credenciais administrativas padrão possíveis em produção**: `lib/db/index.ts` cria `admin@example.com / changeme` quando `ADMIN_PASSWORD` não está configurada, embora exija troca posterior. | Confirmado | Crítico | B | Em produção, impedir seed admin sem `ADMIN_EMAIL` e senha forte explícitos; teste fail-closed de banco vazio e logs sem segredos |
| P0-03 | **SSRF em RSS configurável**: `lib/connectors/rss.ts` aceita qualquer URL http(s) do projeto; `lib/connectors/util.ts` faz fetch de URL e segue redirecionamentos por padrão, sem bloquear loopback/RFC1918/link-local/metadata. | Risco técnico fundamentado no fluxo | Alto | M | Bloquear hosts e IPs internos antes e após cada redirecionamento, forçar HTTPS quando aplicável, DNS rebinding defense, timeouts e limite de bytes; testes de 127.0.0.1, 169.254.169.254, IPs RFC1918 e redirects |
| P0-04 | **MCP global não isolado por cliente**: `lib/mcp.ts` lista/projeta registros sem `client_project_access`; `RADAR_MCP_TOKEN` autoriza leitura transversal de instância. | Confirmado; a exposição depende de distribuir token | Crítico se disponibilizado | M/A | Não liberar MCP para cliente; manter admin-only. Antes de API de clientes, token por workspace, escopos e project allowlist, logs de acesso e testes de leitura cruzada |
| P0-05 | **Sem auditoria de segurança de login/rate limit**: `app/api/auth/route.ts` adiciona espera fixa de 400 ms, mas não estabelece rate limiting persistente por IP/conta nem detecção de tentativas repetidas. | Lacuna confirmada no handler | Alto | M | Rate limit compartilhado com storage central, backoff incremental e alertas sem enumerar usuários; testes de tentativas múltiplas e troca de IP |
| P0-06 | **Homologação de fontes não comprovada no HEAD**: código GDELT possui retry de 6 s, mas 429/resposta não JSON continuam estados reais possíveis; CI é majoritariamente determinístico, canary real não bloqueante. | Dependente de homologação | Alto | M | Executar coleta real isolada, amostras de links, status por fonte, duas rodadas para dedupe, retries, fonte degradada e evidências; nenhuma fonte marcada saudável por teste stub |

## Achados P1 — estabilidade, isolamento, manutenção e operação

| ID | Achado e evidência | Natureza | Impacto | Esforço | Ação e aceite |
|---|---|---|---|---|---|
| P1-01 | **Dois motores de coleta com comportamentos divergentes**: `lib/vigia/collection.ts` (sem IA/purga) e `lib/pipeline.ts` (IA e purga); controles operacionais podem ser confundidos | Confirmado | Alto | M/A | Extrair serviço comum de ingestão + jobs distintos `collect`, `analyze`, `report`, `notify`; rótulos explícitos na UI; testes de ausência de efeitos colaterais |
| P1-02 | **Corrida de locks e concorrência cron/manual**: `runPipeline` consulta e depois grava `meta` não atomicamente; locks `pipeline_lock` e `pipeline_lock_p<ID>` não bloqueiam entre si | Risco direto do algoritmo | Alto | M | Job ledger com transição atômica e lease idempotente por projeto, índice único em `running`, heartbeat, recuperação de stale; testar dois workers e cron + refresh simultâneo |
| P1-03 | **Scheduler real ainda ausente**: `vercel.json` agenda cron diário 05:00/07:00 UTC, não uma operação a cada 15 minutos | Confirmado | Alto | M | Agendador por projeto `next_run_at` + worker independente; 4 projetos/h, métricas de execução, anti-overlap e dead-letter |
| P1-04 | **Credenciais, orçamento e estado globais**: `connector_credentials_v1` em `meta`, `api_usage` sem `project_id`, limite Talkwalker com read-modify-write | Confirmado | Alto | A | Separar credenciais/custos por workspace; tabelas próprias, controle por quota, atualizações atômicas e testes A/B |
| P1-05 | **Rotação de segredo pode perder credenciais**: chave AES deriva de `SESSION_SECRET` e `loadStore()` retorna {} após erro ao decifrar | Confirmado | Alto | M | Chave `CREDENTIALS_ENCRYPTION_KEY` independente, versionamento de envelope, rotação dual-key e erro auditável (não tratar falha de decrypt como ausência) |
| P1-06 | **Schema ORM e DDL não inteiramente sincronizados**: PK/FK de `client_project_access` presentes no DDL mas sem declarações explícitas no Drizzle; 36 DDLs + ALTERs em `ensureSchema` no boot | Confirmado | Alto | M/A | Migrations numeradas e reconciliadas, migração compatível e rollback, gate de `drizzle-kit`/schema drift, startup somente leitura no banco de produção |
| P1-07 | **Consulta textual custosa com crescimento**: `lib/data.ts` usa `ILIKE '%q%'` em campos longos e `COUNT(*)` paginado, sem índice trigram identificado na auditoria | Risco de performance | Médio/alto | M | Índices `pg_trgm`/FTS, EXPLAIN ANALYZE com volume representativo, cursor pagination e limite de consultas |
| P1-08 | **Meta Graph versão fixa e token na URL**: Instagram/Facebook usam `graph.facebook.com/v21.0` e `access_token=...` no querystring | Confirmado | Alto | M | Versionamento configurável validado, teste de API vigente, preferir header seguro suportado, impedir logging de URL/token e registrar códigos de erro sanitizados |
| P1-09 | **Piloto hardcoded em código**: `lib/vigia/core.ts` e `sourceJobs()` referenciam entidades/termos CRF-RS diretamente | Confirmado | Médio/alto | M | Transformar em configuração de projeto/entidades, permitir pesquisa parametrizada, casos de teste com dois clientes sem vazamento |
| P1-10 | **Backup/restore e retenção operacional não evidenciados** | Dependente de homologação | Alto | M | Procedimento de snapshot e restauração em banco descartável, RPO/RTO definidos pelo proprietário, teste repetível e manifesto de export |

## Achados P2 — UX, qualidade e produto

| ID | Achado | Impacto | Esforço | Ação e aceite |
|---|---|---|---|---|
| P2-01 | **Mojibake em textos visíveis ao cliente** em `lib/client-portal.ts`: `PublicaÃ`Ã£o sem tÃ­tulo` | Médio | B | Corrigir UTF-8, adicionar teste de strings/renderização com acentos |
| P2-02 | **Fuso fixo Europa/Roma** em `lib/owned.ts` para mapas de horário de publicações | Médio | B | Timezone por projeto `America/Sao_Paulo` por padrão no piloto BR; validar dia/hora perto da meia-noite |
| P2-03 | **Rotas/nomenclatura legadas**: `impostazioni`, `settings`, `vigia`, `listening`; pacote `social-radar` e nomes de token `RADAR_*` | Médio | M | Mapa de rotas e nomenclatura; redirects compatíveis antes de renomear, sem quebrar URLs/API |
| P2-04 | **Falta visualização unificada de saúde** para cron geral, piloto e feeds | Médio | M | Painel de fontes: sucesso recente, 429, latência, novos/duplicados, próximo run, botão de reexecução controlado |
| P2-05 | **Inventário incompleto do ambiente**: `.env.example` omite `OPENAI_API_KEY` e `XAI_API_KEY`, apesar de referências no código | Médio | B | Atualizar exemplo, lint automatizado para variáveis lidas vs documentadas |
| P2-06 | **Muitas telas monolíticas**: `components/import-workspace.tsx` ~93 kB, `lib/world-geo.ts` ~121 kB, `components/insight-charts.tsx` ~53 kB | Médio | M | Dividir por funcionalidades, lazy loading de gráficos/geo, medir bundle antes/depois, preservar testes |
| P2-07 | **Qualidade de sentimento pt-BR não certificada** | Médio | M | Dataset rotulado, matriz de confusão, precision/recall/F1, amostras difíceis de sarcasmo/ironia, sem alegar eficácia sem medição |

## Matriz de prioridade executável

| Etapa | Entrega | Ganho desejado | Dependência | Gate |
|---|---|---|---|---|
| **0 — proteger dados** | P0-01, P0-02, P0-03 | Evitar perda de dados, default admin e SSRF | Branch de correção isolada | Testes negativos + restauração |
| **1 — validar limites de acesso** | P0-04, P0-05, matriz de rotas/ações cliente vs admin | Evitar acesso cruzado/brute force | Etapa 0 | Testes isolados e E2E A/B |
| **2 — tornar coleta confiável** | P0-06, P1-02, P1-03 | 4 clientes/h sem sobreposição; fonte com estado | Etapas 0/1 | Cron de 15 min, logs, 2 coletas reais e dedupe |
| **3 — isolar custos e clientes** | P1-04, P1-05, P1-09 | Preparação SaaS sem segredos/quotas compartilhados | Etapas 1/2 | Testes cross-tenant, custo por projeto |
| **4 — endurecer operação** | P1-06, P1-07, P1-08, P1-10 | Deploy e escala controlados | Etapas 0–3 | Migrations, EXPLAIN, backups, compat API |
| **5 — acabamento de produto** | P2-01 a P2-07 | UX pt-BR confiável e manutenção | Fundações estáveis | Testes UI desktop/mobile + avaliação IA |

### Critérios mínimos de aceite antes de qualquer merge/deploy

- Todas as correções são propostas em branch isolada e PR draft; **merge e deploy somente com autorização expressa do proprietário**.
- Confirmar HEAD e jobs CI obrigatórios daquele commit, não herdar GREEN de SHA anterior.
- Teste de isolamento de usuário cliente de projeto A tentando ler B via página, API e fluxo indireto/export; token MCP administrativo nunca entregue a cliente.
- Pentest focado em RSS URLs e redirect; login default não inicia em produção.
- Banco de teste com menções antigas: `runPipeline` NÃO pode excluí-las sem retenção/exportação registrada. Evidenciar backup/restore.
- Coleta real por Google News, GDELT e RSS validado com auditoria do volume por fonte, links, timestamp, motivo dos descartes e segunda rodada (duplicatas).
- Testar duas execuções simultâneas de mesmo projeto e cron concorrente; exatamente um job ativo, sem duplicar custos ou apagar locks.
- Instrumentar 4 projetos/h por períodos observáveis; não alegar SLA sem medições.
- Conferir encoding pt-BR, timezone BR, dark/light, estados vazios, loading/error e mobile.

## Recomendações de manutenção e governança

1. Manter **monólito modular** no curto prazo: não introduzir microsserviços sem necessidade medida. Separar por responsabilidade dentro do código e interfaces de serviço.
2. Formalizar contratos de API em OpenAPI: autenticação, `projectId`, parâmetros, exemplos 200/400/401/403/404/409/429/500, cache/no-store e rate limit. Não inventar métodos de handlers não inspecionados.
3. Migrar de credenciais/quotas globais para `workspace` como limite de segurança e cobrança antes de venda multicliente; preservar o modelo operador único para o piloto.
4. Definir telemetria por source attempt, run ID, project ID, duração, taxa 429/5xx, novos/duplicados/descartados, último sucesso e fila.
5. Trazer os elementos visuais aprovados para design system reutilizável, evitar CSS e layout paralelos, e não trocar a navegação sem redirects.
6. Documentar riscos de direitos de uso de fontes, proteção de dados (LGPD) e comunicação de conteúdo gerado por IA com revisão especializada; não assumir conformidade regulatória por existir aviso no PDF.
7. Vincular cada achado a issue/PR e teste de regressão; tratar documentação técnica como parte do PR, sem alterações automáticas em `main`.

## Trilhas de evidência

| Evidência | Local |
|---|---|
| Pipeline com DELETE e lock em meta | `lib/pipeline.ts` |
| Coletor manual e histórico por fonte | `lib/vigia/collection.ts` |
| Whitelist de projetos externos | `lib/project-access.ts`, `lib/client-portal.ts` |
| Rotas cliente | `app/api/cliente/overview/route.ts`, `app/api/cliente/mentions/route.ts` |
| Login e seed admin | `app/api/auth/route.ts`, `lib/db/index.ts` |
| SSRF potencial RSS | `lib/connectors/rss.ts`, `lib/connectors/util.ts` |
| Token MCP e projetos globais | `lib/mcp.ts`, `app/api/mcp/route.ts` |
| Credenciais globais e rotação | `lib/connector-credentials.ts` |
| Graph v21 e query tokens | `lib/connectors/instagram.ts`, `lib/connectors/facebook.ts` |
| Timezone e encoding | `lib/owned.ts`, `lib/client-portal.ts` |
| Scheduler | `vercel.json` |
| CI | `.github/workflows/ci.yml`; runs `42415615373`, `42415611478` |

## Decisão arquitetural sugerida

**NO-GO para habilitar clientes em produção agora** até resolver P0, provar isolamento em todas as rotas acessíveis e validar o scheduler. **GO para evolução incremental em branches/PRs draft**: consolidar coleta com regras comuns, preservar piloto e experiências já aprovadas. A documentação e estes achados não autorizam merge/deploy.
