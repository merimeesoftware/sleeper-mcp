# sleeper-mcp

Self-hosted **remote MCP** for [Sleeper](https://docs.sleeper.com/) fantasy football.
Deploy your own Cloudflare Worker. Paste one URL into Grok, Cursor, Claude, or any MCP client.

This repo does **not** host a public multi-tenant proxy. You run it. You pay your Worker. Sleeper rate limits hit your account, not ours.

No Sleeper login. The public API is read-only. Identity is `username` + `league_id`.

## Why this exists

Most Sleeper MCPs are local `npx` / stdio. Grok connectors and most remote harnesses want:

```text
https://sleeper-mcp.<your-account>.workers.dev/mcp
```

Free agents are computed here (NFL player map minus every rostered ID). Do not recommend a player unless `get_free_agents` returns them.

## Tools

| Tool | Purpose |
|------|---------|
| `get_nfl_state` | Week / season |
| `get_user` | Profile by username |
| `list_leagues` | User leagues for a season |
| `get_league_snapshot` | Owners + named rosters |
| `get_free_agents` | True waiver list by position |
| `get_transactions` | Adds / drops / trades for a week |
| `get_traded_picks` | Future pick movement |
| `find_trade_fits` | Position counts per team |

## Deploy (Cloudflare Workers)

```bash
npm install
npx wrangler kv namespace create sleeper-mcp-cache
```

Put the returned id in `wrangler.toml` under `kv_namespaces[0].id`.

Optional defaults (or pass IDs on every tool call):

```bash
npx wrangler secret put SLEEPER_USERNAME
npx wrangler secret put SLEEPER_LEAGUE_ID
```

League ID is the number in `https://sleeper.com/leagues/<id>/...`.

```bash
npm run deploy
```

MCP URL:

```text
https://sleeper-mcp.<your-subdomain>.workers.dev/mcp
```

## Connect

**Grok:** grok.com → Connectors → New → Custom → paste `/mcp` URL.

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "sleeper": {
      "url": "https://sleeper-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

**Grok CLI:**

```bash
grok mcp add --transport http sleeper https://sleeper-mcp.<your-subdomain>.workers.dev/mcp
```

## Local

```bash
npm run dev
```

Inspector: `npx @modelcontextprotocol/inspector@latest` → `http://localhost:8787/mcp`

## Limits

- Sleeper: stay under ~1000 req/min. Player dump is cached 24h in KV.
- Read-only. Cannot add, drop, or trade.
- Do not point a public Worker at the world without your own rate limit.

## License

MIT
