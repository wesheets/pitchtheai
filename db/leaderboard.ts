import { env } from 'cloudflare:workers';

export type StoredToolCall = { name: string; count: number };

export type StoredLeaderboardEntry = {
  id: string;
  founderName: string;
  companyName: string;
  agentSignature: string;
  pitchVenue: string;
  score: number;
  amountRaised: number;
  askAmount: number;
  equity: number;
  durationSeconds: number;
  pauseSeconds: number;
  difficulty: string;
  lifelinesUsed: number;
  openingPitch: string;
  transcript: string;
  verdictSummary: string;
  toolCalls: StoredToolCall[];
  founderPhotoMaterialId: string | null;
  createdAt: number;
};

type LeaderboardRow = Omit<StoredLeaderboardEntry, 'toolCalls'> & {
  toolCalls: string;
};

function normalizeToolCalls(value: string): StoredToolCall[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is StoredToolCall =>
          Boolean(item) &&
          typeof item === 'object' &&
          typeof (item as StoredToolCall).name === 'string' &&
          Number.isFinite((item as StoredToolCall).count),
      )
      .map((item) => ({
        name: item.name.slice(0, 80),
        count: Math.max(1, Math.min(999, Math.round(item.count))),
      }));
  } catch {
    return [];
  }
}

function mapRow(row: LeaderboardRow): StoredLeaderboardEntry {
  return { ...row, toolCalls: normalizeToolCalls(row.toolCalls) };
}

async function ensureLeaderboard() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id TEXT PRIMARY KEY,
      founder_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      agent_signature TEXT NOT NULL DEFAULT 'Unspecified WebMCP agent',
      pitch_venue TEXT NOT NULL DEFAULT 'Attached WebMCP browser',
      score INTEGER NOT NULL,
      amount_raised INTEGER NOT NULL DEFAULT 0,
      ask_amount INTEGER NOT NULL DEFAULT 0,
      equity REAL NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      pause_seconds INTEGER NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      lifelines_used INTEGER NOT NULL DEFAULT 0,
      opening_pitch TEXT NOT NULL DEFAULT '',
      transcript TEXT NOT NULL DEFAULT '',
      verdict_summary TEXT NOT NULL DEFAULT '',
      tool_calls TEXT NOT NULL DEFAULT '[]',
      founder_photo_material_id TEXT,
      created_at INTEGER NOT NULL
    )
  `).run();
  const columns = await env.DB.prepare('PRAGMA table_info(leaderboard)').all<{
    name: string;
  }>();
  const existing = new Set(columns.results.map((column) => column.name));
  const additions = [
    ['duration_seconds', 'INTEGER NOT NULL DEFAULT 0'],
    ['pause_seconds', 'INTEGER NOT NULL DEFAULT 0'],
    [
      'agent_signature',
      "TEXT NOT NULL DEFAULT 'Unspecified WebMCP agent'",
    ],
    ['pitch_venue', "TEXT NOT NULL DEFAULT 'Attached WebMCP browser'"],
    ['equity', 'REAL NOT NULL DEFAULT 0'],
    ['difficulty', "TEXT NOT NULL DEFAULT 'medium'"],
    ['lifelines_used', 'INTEGER NOT NULL DEFAULT 0'],
    ['opening_pitch', "TEXT NOT NULL DEFAULT ''"],
    ['transcript', "TEXT NOT NULL DEFAULT ''"],
    ['verdict_summary', "TEXT NOT NULL DEFAULT ''"],
    ['tool_calls', "TEXT NOT NULL DEFAULT '[]'"],
    ['founder_photo_material_id', 'TEXT'],
  ] as const;
  for (const [name, definition] of additions) {
    if (!existing.has(name)) {
      await env.DB.prepare(
        `ALTER TABLE leaderboard ADD COLUMN ${name} ${definition}`,
      ).run();
    }
  }
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_leaderboard_score_capital
    ON leaderboard(score DESC, amount_raised DESC, created_at ASC)
  `).run();
}

const detailSelection = `id, founder_name AS founderName, company_name AS companyName,
  agent_signature AS agentSignature, pitch_venue AS pitchVenue,
  score, amount_raised AS amountRaised, ask_amount AS askAmount, equity,
  duration_seconds AS durationSeconds, pause_seconds AS pauseSeconds,
  difficulty, lifelines_used AS lifelinesUsed,
  opening_pitch AS openingPitch, transcript,
  verdict_summary AS verdictSummary, tool_calls AS toolCalls,
  founder_photo_material_id AS founderPhotoMaterialId, created_at AS createdAt`;

export async function listLeaderboard(limit = 20) {
  await ensureLeaderboard();
  const result = await env.DB.prepare(
    `SELECT ${detailSelection}
     FROM leaderboard
     ORDER BY score DESC, amount_raised DESC, created_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all<LeaderboardRow>();
  return result.results.map(mapRow);
}

export async function getLeaderboardEntry(id: string) {
  await ensureLeaderboard();
  const row = await env.DB.prepare(
    `SELECT ${detailSelection} FROM leaderboard WHERE id = ? LIMIT 1`,
  )
    .bind(id)
    .first<LeaderboardRow>();
  return row ? mapRow(row) : null;
}

export async function saveLeaderboardEntry(input: {
  founderName: string;
  companyName: string;
  agentSignature: string;
  pitchVenue: string;
  score: number;
  amountRaised: number;
  askAmount: number;
  equity: number;
  durationSeconds: number;
  pauseSeconds: number;
  difficulty: string;
  lifelinesUsed: number;
  openingPitch: string;
  transcript: string;
  verdictSummary: string;
  toolCalls: StoredToolCall[];
  founderPhotoMaterialId?: string;
}) {
  await ensureLeaderboard();
  const entry = {
    id: crypto.randomUUID(),
    founderName: input.founderName.slice(0, 80),
    companyName: input.companyName.slice(0, 100),
    agentSignature:
      input.agentSignature.trim().slice(0, 120) ||
      'Unspecified WebMCP agent',
    pitchVenue:
      input.pitchVenue.trim().slice(0, 120) || 'Attached WebMCP browser',
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    amountRaised: Math.max(
      0,
      Math.min(1_000_000_000, Math.round(input.amountRaised)),
    ),
    askAmount: Math.max(
      0,
      Math.min(1_000_000_000, Math.round(input.askAmount)),
    ),
    equity: Math.max(0, Math.min(100, Number(input.equity) || 0)),
    durationSeconds: Math.max(
      0,
      Math.min(8 * 60 * 60, Math.round(input.durationSeconds)),
    ),
    pauseSeconds: Math.max(
      0,
      Math.min(8 * 60 * 60, Math.round(input.pauseSeconds)),
    ),
    difficulty: ['easy', 'medium', 'hard', 'legendary'].includes(
      input.difficulty,
    )
      ? input.difficulty
      : 'medium',
    lifelinesUsed: Math.max(0, Math.min(1, Math.round(input.lifelinesUsed))),
    openingPitch: input.openingPitch.slice(0, 12_000),
    transcript: input.transcript.slice(0, 80_000),
    verdictSummary: input.verdictSummary.slice(0, 4_000),
    toolCalls: input.toolCalls.slice(0, 50),
    founderPhotoMaterialId: input.founderPhotoMaterialId?.slice(0, 80) || null,
    createdAt: Date.now(),
  };
  await env.DB.prepare(
    `INSERT INTO leaderboard
      (id, founder_name, company_name, agent_signature, pitch_venue, score, amount_raised, ask_amount, equity,
       duration_seconds, pause_seconds, difficulty, lifelines_used, opening_pitch, transcript, verdict_summary,
       tool_calls, founder_photo_material_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      entry.id,
      entry.founderName,
      entry.companyName,
      entry.agentSignature,
      entry.pitchVenue,
      entry.score,
      entry.amountRaised,
      entry.askAmount,
      entry.equity,
      entry.durationSeconds,
      entry.pauseSeconds,
      entry.difficulty,
      entry.lifelinesUsed,
      entry.openingPitch,
      entry.transcript,
      entry.verdictSummary,
      JSON.stringify(entry.toolCalls),
      entry.founderPhotoMaterialId,
      entry.createdAt,
    )
    .run();
  return entry;
}
