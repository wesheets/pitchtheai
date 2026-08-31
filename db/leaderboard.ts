import { env } from 'cloudflare:workers';

export type StoredLeaderboardEntry = {
  id: string;
  founderName: string;
  companyName: string;
  score: number;
  amountRaised: number;
  askAmount: number;
  durationSeconds: number;
  createdAt: number;
};

async function ensureLeaderboard() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id TEXT PRIMARY KEY,
      founder_name TEXT NOT NULL,
      company_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      amount_raised INTEGER NOT NULL DEFAULT 0,
      ask_amount INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `).run();
  const columns = await env.DB.prepare('PRAGMA table_info(leaderboard)').all<{
    name: string;
  }>();
  if (!columns.results.some((column) => column.name === 'duration_seconds')) {
    await env.DB.prepare(
      'ALTER TABLE leaderboard ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0',
    ).run();
  }
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_leaderboard_score_capital
    ON leaderboard(score DESC, amount_raised DESC, created_at ASC)
  `).run();
}

export async function listLeaderboard(limit = 20) {
  await ensureLeaderboard();
  const result = await env.DB.prepare(
    `SELECT id, founder_name AS founderName, company_name AS companyName,
      score, amount_raised AS amountRaised, ask_amount AS askAmount,
      duration_seconds AS durationSeconds, created_at AS createdAt
     FROM leaderboard
     ORDER BY score DESC, amount_raised DESC, created_at ASC
     LIMIT ?`,
  )
    .bind(limit)
    .all<StoredLeaderboardEntry>();
  return result.results;
}

export async function saveLeaderboardEntry(input: {
  founderName: string;
  companyName: string;
  score: number;
  amountRaised: number;
  askAmount: number;
  durationSeconds: number;
}) {
  await ensureLeaderboard();
  const entry = {
    id: crypto.randomUUID(),
    founderName: input.founderName.slice(0, 80),
    companyName: input.companyName.slice(0, 100),
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    amountRaised: Math.max(
      0,
      Math.min(1_000_000_000, Math.round(input.amountRaised)),
    ),
    askAmount: Math.max(
      0,
      Math.min(1_000_000_000, Math.round(input.askAmount)),
    ),
    durationSeconds: Math.max(
      0,
      Math.min(8 * 60 * 60, Math.round(input.durationSeconds)),
    ),
    createdAt: Date.now(),
  };
  await env.DB.prepare(
    `INSERT INTO leaderboard
      (id, founder_name, company_name, score, amount_raised, ask_amount, duration_seconds, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      entry.id,
      entry.founderName,
      entry.companyName,
      entry.score,
      entry.amountRaised,
      entry.askAmount,
      entry.durationSeconds,
      entry.createdAt,
    )
    .run();
  return entry;
}
