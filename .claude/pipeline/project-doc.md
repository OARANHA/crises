# Project Documentation â€” VigiaElus
> Generated: 2026-11-07 | Mode: FULL (scan via native tools; optional plugins absent)

## Tech Stack
- Runtime: Node.js, Next.js 16.2.10 (App Router), React 19.2.4
- Language: TypeScript (strict type checks via tsc)
- Database: Drizzle ORM over PostgreSQL/Neon in production, PGlite embedded locally
- UI: Tailwind CSS plus app CSS modules; Lucide React, Recharts
- Integration: MCP Streamable HTTP, read-only Radar MCP server

## Dependencies
- Core: @electric-sql/pglite ^0.5.4, @modelcontextprotocol/sdk ^1.30.0, @neondatabase/serverless ^1.1.0, drizzle-orm ^0.45.2, next 16.2.10, react 19.2.4, react-dom 19.2.4, recharts ^3.9.1
- Dev/test: eslint ^9, tsx ^4.22.5, typescript ^5

## Architecture Pattern
Next App Router pages + server actions / API route handlers; reusable SQL business functions in lib/; components/ client UI. Authentication uses signed httpOnly cookie with DB-backed session version. Server API checks do not trust proxy signature alone.

## Folder Structure
- app/: dashboard, listening, settings, alerts, login and client portal routes
- app/api/: HTTP endpoints, authenticated data and connectors
- components/: shared UI, charts, login, customer shell
- lib/db/: Drizzle schema and idempotent DDL/migrations
- lib/connectors/: social/news source adapters
- lib/data.ts: project-scoped dashboard, listening and report SQL
- lib/client-portal.ts: read-only customer DTOs reused by portal and REST API
- lib/project-access.ts: project visibility rules; external client accounts use explicit client_project_access assignments
- tests/: Node test runner with tsx
- scripts/: CI/security, documentation and integration helpers

## Code Style Conventions
- Next.js App Router page.tsx exports default async server component; API route.ts exports HTTP verb functions.
- Shared business logic lives in lib/, not duplicated inside route handlers.
- Use server-side session checks and explicit project_id access control before any customer query.
- Preserve existing data and branches; always inspect local git status before staging.

## Modularity Practices
Authenticated customer API routes use getCurrentUser + authorizedClientProject and clientOverview/clientMentions; MCP /api/mcp uses a single administrative bearer token and MUST NOT be exposed to customers. Do not treat the MCP token as a customer credential.

## Data Architecture
Main tables include users (roles admin/member/client), projects, mentions, trends, briefs, alerts, api_usage, and client_project_access (user_id,project_id PK). Admin sees all projects; internal member sees owned/shared; external client sees ONLY explicit associations.

## Cross-Cutting Concerns
- Signed sr_session cookie, HMAC + session_version revocation validated against DB.
- Read-only client queries; no client write permissions in API guards; first login forces password change.
- MCP current legacy endpoint disabled without RADAR_MCP_TOKEN and globally scoped: no customer access.
- UTF-8 required end-to-end; previous mojibake incidents are documented in UI work.
- Demo mode read-only; keys never committed; API spending constraints and source usage must be measured per customer before commercial launch.

## Service Communication
- REST endpoints /api/auth, /api/cliente/overview, /api/cliente/mentions and source collection APIs
- Next server components consume shared lib/data.ts business logic
- MCP Streamable HTTP /api/mcp for existing administrative integrations; customer integration requires scoped credentials in a future iteration

## Test Coverage
- Test files currently present: 31
- HTTP routes currently present: 56
- Coverage percentage: not measured; do not infer from test counts.
- Testing: Node --import tsx --test plus CI lint, tsc, Next production build and security E2E.
- Critical tests: no cross-project reads; unauthorized clients 401/403/404; session revocation; data migrations; client form changes; login redirect.

## Entry Points
- app/layout.tsx, app/login/page.tsx, app/cliente/page.tsx, app/clientes/page.tsx
- app/api/mcp/route.ts, app/api/cliente/overview/route.ts
- lib/auth.ts, lib/session.ts, lib/api-guard.ts, lib/project-access.ts, lib/db/index.ts
- package.json, .env.example, .github/workflows/ci.yml

## Last Scanned
2026-11-07
