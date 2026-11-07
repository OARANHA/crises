<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## VigiaElus â€” project instructions (scan, 2026-11-07)
- Before editing, read .claude/pipeline/project-doc.md and AGENTS.md; preserve the Next.js 16 agent rules above.
- For auth/tenant/client work: no writes without a verified session and project authorization. Client role sees only client_project_access entries; do not include shared internal projects.
- All client endpoints use an allowlisted project ID from getProjects; avoid unfiltered project reads.
- NEVER expose RADAR_MCP_TOKEN to browsers, embed credentials in JS or use /api/mcp as a customer data API.
- Keep login redirect by server-authenticated role, never an unvalidated client-provided return URL.
- Before committing: run lint, tsc, tests and webpack build; inspect git diff for secrets and unrelated local changes.
- Documentation updates are reviewable PR changes; Docent is optional and must never stage changes or write to main automatically.
- Review newly introduced route access, cookie revocation, SSR/UTF-8 and empty states.
