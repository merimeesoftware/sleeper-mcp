# Tech Stack — sleeper-mcp

> Machine-readable stack card for agents and humans.

**Last updated:** 2026-09-16
**Repo:** https://github.com/merimeesoftware/sleeper-mcp
**Owner account:** merimeesoftware

---

## 1. One-line summary

Cloudflare Worker MCP that reads the public Sleeper API and exposes league snapshot, free agents, and trade-fit tools over Streamable HTTP.

## 2. Languages & runtime

| Layer | Choice | Notes |
|-------|--------|-------|
| Primary language | TypeScript | Worker |
| Package manager | npm | |
| Runtime / framework | Cloudflare Workers + agents MCP handler | Streamable HTTP `/mcp` |

## 3. Frontend (if any)

- none

## 4. Backend / agent orchestration (if any)

- Sleeper HTTP API (`api.sleeper.app/v1`)
- KV cache for `/players/nfl` (24h)

## 5. Models & routing (agent projects)

N/A — data plane only.

## 6. Deploy & hosting

- **Current deploy target:** Cloudflare Workers
- **Preferred target (universal):** Cloudflare Workers
- Config files: `wrangler.toml`
- Domain / URL: per-deployer `*.workers.dev/mcp`

## 7. CI/CD

- GitHub Actions: `ci.yml` typechecks only
- Deploy: Cloudflare Workers Builds (GitHub `main` → `npx wrangler deploy`). Same as porkbun-mcp. No GitHub API token.

## 8. MCP servers & skills in use

### MCP (IDE / agent context)
- This repo *is* the MCP server

### Skills / personas (repo-local)
- none

## 9. Key directories

```
src/index.ts      MCP tools + fetch handler
src/sleeper.ts    Sleeper client + KV cache
wrangler.toml     Worker + KV binding
```

## 10. Mismatch vs universal Merimee stack

| Area | Current | Target | Priority to fix |
|------|---------|--------|-----------------|
| CI | Workers Builds on `main` | same | none |
| Custom domain | workers.dev | optional later | none |
