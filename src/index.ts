import { createMcpHandler } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  type Env,
  getLeague,
  getLeagueUsers,
  getNflState,
  getPlayersMap,
  getRosters,
  getTradedPicks,
  getTransactions,
  getUser,
  getUserLeagues,
  playerName,
  resolveIds,
} from "./sleeper";

function text(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

function leagueIdOf(env: Env, override?: string | null) {
  const id = override || env.SLEEPER_LEAGUE_ID;
  if (!id) throw new Error("Pass league_id or set SLEEPER_LEAGUE_ID on the Worker.");
  return id;
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "sleeper-mcp",
    version: "0.1.0",
  });

  server.tool(
    "get_nfl_state",
    "Current NFL week and season from Sleeper.",
    {},
    async () => text(await getNflState()),
  );

  server.tool(
    "get_user",
    "Look up a Sleeper user by username or user_id.",
    { username: z.string() },
    async ({ username }) => text(await getUser(username)),
  );

  server.tool(
    "list_leagues",
    "List NFL leagues for a Sleeper user in a season.",
    {
      username: z.string().optional(),
      season: z.string().optional(),
    },
    async ({ username, season }) => {
      const uname = username || env.SLEEPER_USERNAME;
      if (!uname) throw new Error("Pass username or set SLEEPER_USERNAME.");
      const user = await getUser(uname);
      const leagues = await getUserLeagues(user.user_id, season || env.SLEEPER_SEASON || "2026");
      return text({ user, leagues });
    },
  );

  server.tool(
    "get_league_snapshot",
    "Full league snapshot: settings, owners, every roster with resolved player names. Use this before waiver or trade advice.",
    { league_id: z.string().optional() },
    async ({ league_id }) => {
      const id = leagueIdOf(env, league_id);
      const [league, rosters, users, map] = await Promise.all([
        getLeague(id),
        getRosters(id),
        getLeagueUsers(id),
        getPlayersMap(env),
      ]);
      const owners = new Map(users.map((u) => [u.user_id, u]));
      const teams = rosters.map((r) => {
        const owner = r.owner_id ? owners.get(r.owner_id) : undefined;
        return {
          roster_id: r.roster_id,
          owner_id: r.owner_id,
          owner_name: owner?.display_name || owner?.username || "Open",
          record: r.settings
            ? `${r.settings.wins || 0}-${r.settings.losses || 0}-${r.settings.ties || 0}`
            : null,
          starters: resolveIds(r.starters, map),
          bench: resolveIds(
            (r.players || []).filter((p) => !(r.starters || []).includes(p)),
            map,
          ),
          ir: resolveIds(r.reserve, map),
          taxi: resolveIds(r.taxi, map),
        };
      });
      return text({ league, teams });
    },
  );

  server.tool(
    "get_free_agents",
    "Players not on any roster in the league. Filter by position. This is the only valid waiver list.",
    {
      league_id: z.string().optional(),
      position: z.string().optional(),
      limit: z.number().optional(),
    },
    async ({ league_id, position, limit }) => {
      const id = leagueIdOf(env, league_id);
      const [rosters, map] = await Promise.all([getRosters(id), getPlayersMap(env)]);
      const owned = new Set<string>();
      for (const r of rosters) {
        for (const p of r.players || []) owned.add(p);
        for (const p of r.reserve || []) owned.add(p);
        for (const p of r.taxi || []) owned.add(p);
      }
      const pos = position?.toUpperCase();
      const max = Math.min(limit || 40, 100);
      const agents = Object.values(map)
        .filter((p) => {
          if (!p || owned.has(p.player_id)) return false;
          if (p.active === false) return false;
          if (p.status && p.status !== "Active") return false;
          if (pos) {
            const positions = (p.fantasy_positions || [p.position]).filter(Boolean);
            if (!positions.includes(pos)) return false;
          }
          return Boolean(p.team || p.position);
        })
        .sort((a, b) => (a.search_rank || 9999) - (b.search_rank || 9999))
        .slice(0, max)
        .map((p) => ({
          id: p.player_id,
          name: playerName(p),
          position: p.position,
          team: p.team,
          injury: p.injury_status || null,
          search_rank: p.search_rank || null,
        }));
      return text({ count: agents.length, position: pos || "ALL", players: agents });
    },
  );

  server.tool(
    "get_transactions",
    "Waiver, free-agent, and trade transactions for a week (round).",
    {
      league_id: z.string().optional(),
      week: z.number().optional(),
    },
    async ({ league_id, week }) => {
      const id = leagueIdOf(env, league_id);
      const state = await getNflState();
      const round = week || state.week || 1;
      return text({ week: round, transactions: await getTransactions(id, round) });
    },
  );

  server.tool(
    "get_traded_picks",
    "All traded future draft picks in the league.",
    { league_id: z.string().optional() },
    async ({ league_id }) => {
      const id = leagueIdOf(env, league_id);
      return text(await getTradedPicks(id));
    },
  );

  server.tool(
    "find_trade_fits",
    "Roster construction by position for every team. Use to spot WR-poor / RB-rich clubs.",
    { league_id: z.string().optional() },
    async ({ league_id }) => {
      const id = leagueIdOf(env, league_id);
      const [rosters, users, map] = await Promise.all([
        getRosters(id),
        getLeagueUsers(id),
        getPlayersMap(env),
      ]);
      const owners = new Map(users.map((u) => [u.user_id, u]));
      const counts = rosters.map((r) => {
        const owner = r.owner_id ? owners.get(r.owner_id) : undefined;
        const byPos: Record<string, string[]> = {};
        for (const id of r.players || []) {
          const p = map[id];
          const pos = p?.position || "UNK";
          byPos[pos] ||= [];
          byPos[pos].push(playerName(p));
        }
        return {
          roster_id: r.roster_id,
          owner: owner?.display_name || owner?.username || "Open",
          counts: Object.fromEntries(Object.entries(byPos).map(([k, v]) => [k, v.length])),
          players: byPos,
        };
      });
      return text(counts);
    },
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({
        name: "sleeper-mcp",
        mcp: "/mcp",
        docs: "https://github.com/merimeesoftware/sleeper-mcp",
      });
    }
    const server = createServer(env);
    return createMcpHandler(server)(request, env, ctx);
  },
};
