const BASE = "https://api.sleeper.app/v1";
const PLAYERS_KEY = "players:nfl";
const PLAYERS_TTL = 60 * 60 * 24;

export type Env = {
  CACHE: KVNamespace;
  SLEEPER_USERNAME?: string;
  SLEEPER_LEAGUE_ID?: string;
};

export type SleeperPlayer = {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  fantasy_positions?: string[];
  team?: string | null;
  status?: string;
  injury_status?: string | null;
  search_rank?: number;
  active?: boolean;
};

export type SleeperUser = {
  user_id: string;
  username?: string;
  display_name?: string;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings?: Record<string, number>;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Sleeper ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export function playerName(p?: SleeperPlayer | null): string {
  if (!p) return "Unknown";
  if (p.full_name) return p.full_name;
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || p.player_id;
}

/** Waiver-eligible: on an NFL roster. Sleeper leaves retired names Active with a stale search_rank. */
export function isWaiverEligible(p?: SleeperPlayer | null): boolean {
  if (!p) return false;
  if (p.active === false) return false;
  if (p.status && p.status !== "Active") return false;
  if (!p.team) return false;
  return Boolean(p.position || p.fantasy_positions?.length);
}

export async function getNflState() {
  return getJson<{ week: number; season: string; season_type: string; display_week: number }>(
    "/state/nfl",
  );
}

export async function getUser(usernameOrId: string) {
  return getJson<SleeperUser>(`/user/${encodeURIComponent(usernameOrId)}`);
}

export async function getUserLeagues(userId: string, season: string) {
  return getJson<Array<{ league_id: string; name: string; season: string; total_rosters: number }>>(
    `/user/${userId}/leagues/nfl/${season}`,
  );
}

export async function getLeague(leagueId: string) {
  return getJson<{
    league_id: string;
    name: string;
    season: string;
    roster_positions: string[];
    scoring_settings?: Record<string, number>;
    settings?: Record<string, number>;
  }>(`/league/${leagueId}`);
}

export async function getRosters(leagueId: string) {
  return getJson<SleeperRoster[]>(`/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId: string) {
  return getJson<SleeperUser[]>(`/league/${leagueId}/users`);
}

export async function getTransactions(leagueId: string, week: number) {
  return getJson<unknown[]>(`/league/${leagueId}/transactions/${week}`);
}

export async function getTradedPicks(leagueId: string) {
  return getJson<unknown[]>(`/league/${leagueId}/traded_picks`);
}

export async function getPlayersMap(env: Env): Promise<Record<string, SleeperPlayer>> {
  const cached = await env.CACHE.get(PLAYERS_KEY, "json");
  if (cached && typeof cached === "object") {
    return cached as Record<string, SleeperPlayer>;
  }
  const data = await getJson<Record<string, SleeperPlayer>>("/players/nfl");
  await env.CACHE.put(PLAYERS_KEY, JSON.stringify(data), { expirationTtl: PLAYERS_TTL });
  return data;
}

export function resolveIds(ids: string[] | null | undefined, map: Record<string, SleeperPlayer>) {
  return (ids || []).map((id) => {
    const p = map[id];
    return {
      id,
      name: playerName(p),
      position: p?.position || null,
      team: p?.team || null,
      injury: p?.injury_status || null,
    };
  });
}
