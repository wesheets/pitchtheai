/* oxlint-disable next/no-html-link-for-pages, next/no-img-element -- Hard navigation and the authenticated material route are intentional. */
import type { Metadata } from 'next';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Bot,
  Clock3,
  Gauge,
  Image as ImageIcon,
  LifeBuoy,
  MapPin,
  Pause,
  Trophy,
} from 'lucide-react';

import { getLeaderboardEntry } from '@/db/leaderboard';

export const dynamic = 'force-dynamic';

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const entry = await getLeaderboardEntry(id).catch(() => null);
  return entry
    ? {
        title: `${entry.companyName} — Pitch The AI`,
        description: `${entry.founderName} scored ${entry.score}/100 in the Pitch The AI arena.`,
      }
    : { title: 'Pitch record — Pitch The AI' };
}

export default async function PitchRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entry = await getLeaderboardEntry(id).catch(() => null);

  if (!entry) {
    return (
      <main className="leaderboard-page pitch-record-page">
        <div className="leaderboard-vignette" aria-hidden="true" />
        <section className="pitch-record-missing">
          <Trophy />
          <h1>The room lost this receipt.</h1>
          <p>This pitch record could not be found.</p>
          <a href="/leaderboard">
            <ArrowLeft /> Back to the leaderboard
          </a>
        </section>
      </main>
    );
  }

  const totalToolCalls = entry.toolCalls.reduce(
    (total, item) => total + item.count,
    0,
  );
  const hasReplay = Boolean(
    entry.openingPitch || entry.transcript || entry.verdictSummary,
  );

  return (
    <main className="leaderboard-page pitch-record-page">
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
        <a href="/leaderboard" className="leaderboard-back">
          <ArrowLeft className="size-4" /> Back to the leaderboard
        </a>
      </header>

      <article className="pitch-record-shell">
        <header className="pitch-record-hero">
          <div>
            <p>
              <Trophy /> Recorded pitch · {entry.difficulty}
            </p>
            <h1>{entry.companyName}</h1>
            <span>Presented by {entry.founderName}</span>
          </div>
          <div className="pitch-record-score">
            <span>Final score</span>
            <strong>{entry.score}</strong>
            <small>/100</small>
          </div>
        </header>

        <section className="pitch-agent-signature" aria-label="Agent signature">
          <div>
            <Bot />
            <span>
              Agent behind the tools
              <strong>{entry.agentSignature}</strong>
            </span>
          </div>
          <div>
            <MapPin />
            <span>
              Pitch took place in
              <strong>{entry.pitchVenue}</strong>
            </span>
          </div>
          <small>Self-reported by the visiting WebMCP agent</small>
        </section>

        <section className="pitch-record-stats">
          <div>
            <span>Raised</span>
            <strong>{money(entry.amountRaised)}</strong>
          </div>
          <div>
            <span>Ask</span>
            <strong>
              {money(entry.askAmount)}
              {entry.equity > 0 ? ` for ${entry.equity}%` : ''}
            </strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>
              <Clock3 /> {duration(entry.durationSeconds)}
            </strong>
          </div>
          <div>
            <span>Date</span>
            <strong>
              {new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date(entry.createdAt))}
            </strong>
          </div>
          <div>
            <span>Difficulty</span>
            <strong className="pitch-record-difficulty">
              <Gauge /> {entry.difficulty}
            </strong>
          </div>
          <div>
            <span>Lifeline</span>
            <strong>
              <LifeBuoy />
              {entry.lifelinesUsed ? 'Second Chance used' : 'Not used'}
            </strong>
          </div>
          <div>
            <span>Founder pause</span>
            <strong>
              <Pause />
              {entry.pauseSeconds
                ? `${duration(entry.pauseSeconds)} recorded`
                : 'Not used'}
            </strong>
          </div>
        </section>

        <div className="pitch-record-grid">
          <aside className="pitch-record-founder">
            <span>Founder</span>
            {entry.founderPhotoMaterialId ? (
              <img
                src={`/api/materials?id=${encodeURIComponent(entry.founderPhotoMaterialId)}`}
                alt={`${entry.founderName} founder portrait`}
              />
            ) : (
              <div>
                <ImageIcon />
                <p>No public founder photo</p>
                <small>Founder photos appear only with explicit consent.</small>
              </div>
            )}
            <strong>{entry.founderName}</strong>
          </aside>

          <div className="pitch-record-content">
            {!hasReplay && (
              <section className="pitch-record-legacy">
                <Activity />
                <div>
                  <strong>Score saved. Full replay not captured.</strong>
                  <p>
                    This pitch finished before detailed pitch receipts were
                    enabled. New sessions include the opening pitch,
                    transcript, verdict, and WebMCP call history.
                  </p>
                </div>
              </section>
            )}

            {entry.verdictSummary && (
              <section className="pitch-record-section pitch-record-verdict">
                <span>The room&apos;s verdict</span>
                <h2>{entry.amountRaised > 0 ? 'Deal.' : 'No deal.'}</h2>
                <blockquote>{entry.verdictSummary}</blockquote>
              </section>
            )}

            {entry.openingPitch && (
              <section className="pitch-record-section">
                <span>Original opening pitch</span>
                <h2>What entered the room</h2>
                <pre>{entry.openingPitch}</pre>
              </section>
            )}

            {entry.transcript && (
              <section className="pitch-record-section">
                <span>Full transcript</span>
                <h2>Everything the room heard</h2>
                <pre>{entry.transcript}</pre>
              </section>
            )}

            {entry.toolCalls.length > 0 && (
              <section className="pitch-record-section pitch-record-tools">
                <span>WebMCP receipt</span>
                <h2>{totalToolCalls} tool calls ran this room</h2>
                <div>
                  {entry.toolCalls.map((item) => (
                    <b key={item.name}>
                      {item.name} <strong>×{item.count}</strong>
                    </b>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="pitch-record-footer">
          <a href="/leaderboard">
            <ArrowLeft /> Leaderboard
          </a>
          <a href="/play">
            Pitch your own idea <ArrowUpRight />
          </a>
        </footer>
      </article>
    </main>
  );
}
