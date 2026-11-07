# VigiaElus — Identidade visual global v1 (2026-11-07)

## Objetivo
Aplicar em toda a aplicação uma identidade visual inspirada na imagem de referência: interface SaaS clara, arejada, menu lateral compacto, navegação superior, cartões arredondados, tons pastel e tema escuro incorporado. A referência é estética, não funcional: VigiaElus permanece uma ferramenta privada de monitoramento de reputação.

## Superfícies
- Casca global: app/layout.tsx, components/sidebar.tsx, components/shell-topbar.tsx.
- Temas: components/theme-toggle.tsx e tokens CSS em app/globals.css.
- Componentes reutilizáveis, cartões KPI e gráficos: components/ui.tsx, components/charts.tsx e components/export-bar.tsx.
- Página inicial e monitoramento piloto: app/page.tsx e app/vigia/page.tsx.
- As demais rotas herdam os temas, componentes compartilhados e navegação; não foram individualmente reescritas.

## Contratos de UI
1. Modo Operar: estado e fatos importantes antes de gráficos. Abas superiores Visão geral, Monitoramento, Análises, Relatórios, Projetos.
2. Desktop >=1024px usa trilho de ícones (74px); tablets e celulares usam cabeçalho móvel e drawer. Todos os destinos de lib/nav.ts permanecem no menu completo.
3. Claro padrão: background #f5f5fa, cartões #ffffff, accent #7866d8. Escuro: background #111521, cartões #1b2131, accent #ada0ff.
4. Tema persistido no armazenamento local, sem alteração de banco e sem credenciais.
5. Indicadores reais oriundos de dashboardData e getTrends. Estado não analisado explícito. Data de publicação distinguida da data de coleta.
6. A central CRF-RS preserva botão de coleta real, falhas por fonte, entidades, consultas, filtros, links e histórico.
7. Estados de erro/parcial/pendente aparecem com texto e cores; foco por teclado, navegação touch e redução de movimento preservados.
8. Nenhuma API, fonte, credencial, banco operacional ou tarefa de agendamento foi alterada nesta mudança visual.

## Homologação
Lint, TypeScript, smoke HTTP e inspeção visual devem ser avaliados separadamente. Alterações locais não equivalem a PR aprovado, CI verde ou deploy.
