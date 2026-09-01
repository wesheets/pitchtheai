/* oxlint-disable next/no-html-link-for-pages -- Vinext client routing is bypassed intentionally for reliable hard navigation. */
import type { Metadata } from 'next';
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Clock3,
  Trophy,
} from 'lucide-react';

import { listLeaderboard } from '@/db/leaderboard';

export const metadata: Metadata = {
  title: 'Pitch Board — Pitch The AI',
  description: 'Real completed pitches ranked by score and capital raised.',
};

export const dynamic = 'force-dynamic';

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function duration(seconds: number) {
  if (!seconds) return '—';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export default async function LeaderboardPage() {
  let entries: Awaited<ReturnType<typeof listLeaderboard>> = [];
  let unavailable = false;
  try {
    entries = await listLeaderboard(100);
  } catch {
    unavailable = true;
  }

  return (
    <main className="leaderboard-page">
      <div className="leaderboard-vignette" aria-hidden="true" />
      <header className="leaderboard-header">
        <a href="/" className="leaderboard-brand">
          <span className="brand-mark">
            <AudioLines className="size-5" />
          </span>
          <span>
            <strong>PITCH THE AI</strong>
            <small>Four minds. One deal.</small>
          </span>
        </a>
        <a href="/" className="leaderboard-back">
          <ArrowLeft className="size-4" /> Back to the arena
        </a>
      </header>

      <section className="leaderboard-shell">
        <div className="leaderboard-intro">
          <p>
            <Trophy className="size-4" /> Live pitch board
          </p>
          <h1>The room remembers.</h1>
          <span>
            Every row is a completed pitch. Scores lead; capital raised breaks
            the tie.
          </span>
        </div>

        <div className="leaderboard-card">
          <div className="leaderboard-card-topline">
            <div>
              <strong>{entries.length}</strong>
              <span>recorded pitches</span>
            </div>
            <div>
              <strong>
                {money(
                  entries.reduce(
                    (total, entry) => total + entry.amountRaised,
                    0,
                  ),
                )}
              </strong>
              <span>capital raised</span>
            </div>
            <div>
              <strong>
                {entries.length
                  ? Math.round(
                      entries.reduce((total, entry) => total + entry.score, 0) /
                        entries.length,
                    )
                  : '—'}
              </strong>
              <span>average score</span>
            </div>
          </div>

          {unavailable ? (
            <div className="leaderboard-empty">
              <Trophy />
              <strong>The board is temporarily offline.</strong>
              <span>The arena remains open for pitching.</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="leaderboard-empty">
              <Trophy />
              <strong>First deal takes the board.</strong>
              <span>Completed panel verdicts appear here automatically.</span>
            </div>
          ) : (
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Pitch</th>
                    <th>Founder</th>
                    <th>Score</th>
                    <th>Raised</th>
                    <th>Ask</th>
                    <th>
                      <Clock3 className="size-3.5" /> Duration
                    </th>
                    <th>Date</th>
                    <th>Replay</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr key={entry.id}>
                      <td>
                        <span className={`leaderboard-rank rank-${index + 1}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td>
                        <a
                          className="leaderboard-pitch-link"
                          href={`/leaderboard/${entry.id}`}
                          aria-label={`Open ${entry.companyName} pitch record`}
                        >
                          <strong>{entry.companyName}</strong>
                        </a>
                      </td>
                      <td>{entry.founderName}</td>
                      <td>
                        <b>{entry.score}</b>
                        <small>/100</small>
                      </td>
                      <td className="leaderboard-raised">
                        {money(entry.amountRaised)}
                      </td>
                      <td>{money(entry.askAmount)}</td>
                      <td>{duration(entry.durationSeconds)}</td>
                      <td>
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(entry.createdAt))}
                      </td>
                      <td>
                        <a
                          className="leaderboard-open-link"
                          href={`/leaderboard/${entry.id}`}
                          aria-label={`Open ${entry.companyName} pitch record`}
                        >
                          Open pitch <ArrowUpRight />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
