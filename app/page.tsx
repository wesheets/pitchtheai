import type { CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Gauge,
  CodeXml,
  Globe2,
  ShieldQuestion,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { LandingSound } from './landing-sound';

const judges = [
  {
    id: 'maya',
    name: 'Maya Cross',
    role: 'Market realist',
    focus: 'Customer truth',
    copy: 'Cuts through hype. Tests the market, the buyer, and whether anyone actually cares.',
    portrait: '/judges/maya-cross-sprite.png',
    color: '#65e6ff',
  },
  {
    id: 'julian',
    name: 'Julian Voss',
    role: 'Brand contrarian',
    focus: 'Story & differentiation',
    copy: 'Hates forgettable ideas. Pushes the story until the brand earns attention.',
    portrait: '/judges/julian-voss-sprite.png',
    color: '#bc9cff',
  },
  {
    id: 'priya',
    name: 'Priya Nair',
    role: 'Unit economics',
    focus: 'Finance & traction',
    copy: 'Protects the money. Pressure-tests margins, acquisition, retention, and the ask.',
    portrait: '/judges/priya-nair-sprite.png',
    color: '#ffc857',
  },
  {
    id: 'theo',
    name: 'Theo Grant',
    role: 'Scale operator',
    focus: 'Product & execution',
    copy: 'Lives in the details. Challenges the product, the operating plan, and your ability to scale.',
    portrait: '/judges/theo-grant-sprite.png',
    color: '#ff7189',
  },
] as const;

function JudgePreview({ judge }: { judge: (typeof judges)[number] }) {
  return (
    <article
      className="landing-judge-card"
      style={{ '--landing-judge': judge.color } as CSSProperties}
    >
      <div
        className="landing-judge-portrait"
        style={{ backgroundImage: `url(${judge.portrait})` }}
      />
      <div className="landing-judge-copy">
        <span>{judge.role}</span>
        <h3>{judge.name}</h3>
        <p>{judge.copy}</p>
        <small>Focus: {judge.focus}</small>
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <main className="landing-page">
      <div className="landing-vignette" />
      <header className="landing-nav">
        <Link className="landing-brand" href="/" aria-label="Pitch The AI home">
          <span className="landing-brand-mark" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </span>
          <span>
            <strong>PITCH THE AI</strong>
            <small>Four minds. One deal.</small>
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#judges">Judges</a>
          <Link href="/leaderboard">Leaderboard</Link>
          <a href="#faq">FAQ</a>
          <LandingSound />
          <div className="external-beta">
            <a
              href="https://bringmy.ai"
              target="_blank"
              rel="noreferrer"
              aria-describedby="external-beta-note"
            >
              Another WebMCP browser <ArrowUpRight />
            </a>
            <div id="external-beta-note" role="tooltip">
              <strong>Optional external beta</strong>
              <p>
                BringMy.ai is a separate way to test WebMCP with different AI
                providers. It is not part of this open-source repository,
                MIT-licensed submission, or required to play.
              </p>
              <span>Visit the site and join the beta waitlist →</span>
            </div>
          </div>
          <span className="landing-beta-badge">Beta</span>
          <Link className="landing-nav-play" href="/play">Play now</Link>
        </nav>
      </header>

      <section className="landing-hero" id="judges">
        <div className="landing-judge-pair landing-judge-pair-left">
          <JudgePreview judge={judges[0]} />
          <JudgePreview judge={judges[1]} />
        </div>

        <div className="landing-hero-center">
          <p className="landing-eyebrow">
            <Sparkles /> The AI pitch arena <Sparkles />
          </p>
          <h1>
            Make them lean in.
            <span>Before patience runs out.</span>
          </h1>
          <p className="landing-subtitle">
            Pitch your idea to four AI investors. Answer tough questions.
            Defend your vision. Win the deal—or get roasted.
          </p>
          <div className="landing-actions">
            <Link className="landing-primary-cta" href="/play">
              Play now <Zap />
            </Link>
            <Link className="landing-secondary-cta" href="/leaderboard">
              Leaderboard <Trophy />
            </Link>
          </div>
          <div className="landing-proof">
            <div className="landing-proof-faces" aria-hidden="true">
              {judges.map((judge) => (
                <span
                  key={judge.id}
                  style={{
                    backgroundImage: `url(${judge.portrait})`,
                    '--proof-color': judge.color,
                  } as CSSProperties}
                />
              ))}
            </div>
            <p>Built for founders, builders, and dreamers who want the truth.</p>
          </div>
          <div className="landing-microphone" aria-hidden="true" />
        </div>

        <div className="landing-judge-pair landing-judge-pair-right">
          <JudgePreview judge={judges[2]} />
          <JudgePreview judge={judges[3]} />
        </div>
      </section>

      <section className="landing-stage-preview" id="how-it-works">
        <div className="landing-stage-ribbon">
          <span><Globe2 /> Built for the WebMCP Challenge</span>
          <p>Your browser AI runs the panel. You control every answer and every deal.</p>
          <a href="https://github.com/wesheets/pitchtheai" target="_blank" rel="noreferrer">
            <CodeXml /> MIT source <ArrowUpRight />
          </a>
        </div>
        <div className="landing-stage-board">
          <div className="landing-stage-stats">
            <span>Favorability <strong>50<small>/100</small></strong></span>
            <span>Still in <strong>4<small>/4</small></strong></span>
            <span>Round <strong>Seed</strong></span>
            <span>Best offer <strong>—</strong></span>
            <span>Room read <strong>😳 Skeptical</strong></span>
          </div>
          <div className="landing-stage-content">
            <div>
              <p>Your pitch stage</p>
              <h2>Set the terms. Make your case.</h2>
              <div className="landing-field-row">
                <span>Founder name…</span>
                <span>Venture name…</span>
                <span>Ask (USD)…</span>
                <span>Equity (%)…</span>
              </div>
              <div className="landing-difficulty-row">
                <span>Difficulty</span>
                <i>Easy</i>
                <i className="active">Medium</i>
                <i>Hard</i>
                <i>Legendary</i>
                <b>Second Chance · 1 token</b>
              </div>
            </div>
            <aside>
              <span>Room tools</span>
              <small>Reset room</small>
              <small>How it works</small>
              <div className="landing-fake-slider"><i /></div>
            </aside>
          </div>
        </div>
        <div className="landing-feature-row">
          <article><ShieldQuestion /><span><strong>Face the judges</strong>Questions adapt to every answer.</span></article>
          <article><Gauge /><span><strong>Feel the pressure</strong>Timers, music, and patience are live.</span></article>
          <article><Trophy /><span><strong>Earn your rank</strong>Close a deal and climb the board.</span></article>
          <article><Users /><span><strong>Practice at any level</strong>Easy coaching to Legendary heat.</span></article>
        </div>
      </section>

      <section className="landing-faq" id="faq">
        <div>
          <p className="landing-eyebrow">Before you enter the room</p>
          <h2>One pitch. Four memories. No script.</h2>
        </div>
        <div className="landing-faq-grid">
          <article>
            <h3>What do I need?</h3>
            <p>A WebMCP-capable browser agent attached to the play page. Voice, camera, evidence uploads, and session recording are optional.</p>
          </article>
          <article>
            <h3>Is the game open source?</h3>
            <p>Yes. Pitch The AI’s application source is public under the MIT License. External beta links are clearly labeled and separate.</p>
          </article>
          <article>
            <h3>Can the AI invent my answer?</h3>
            <p>No. Response gates hold the panel until you answer or time out, and only you can accept, counter, or reject an offer.</p>
          </article>
        </div>
        <Link className="landing-bottom-cta" href="/play">
          Enter the arena <ArrowRight />
        </Link>
      </section>
    </main>
  );
}
