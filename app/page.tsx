/* oxlint-disable next/no-html-link-for-pages -- Vinext client routing is bypassed intentionally for reliable hard navigation. */
import type { CSSProperties } from 'react';
import { ArrowUpRight, Sparkles, Trophy, Zap } from 'lucide-react';
import { LandingHowItWorks } from './landing-how-it-works';
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
        <span>
          <b>AI judge</b> · {judge.role}
        </span>
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
        <a className="landing-brand" href="/" aria-label="Pitch The AI home">
          <span className="landing-brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>PITCH THE AI</strong>
            <small>Four minds. One deal.</small>
          </span>
        </a>

        <nav aria-label="Main navigation">
          <LandingHowItWorks />
          <a href="#modes">Game modes</a>
          <a href="/leaderboard">Leaderboard</a>
          <LandingSound />
          <div className="external-beta">
            <a
              href="https://bringmy.ai"
              target="_blank"
              rel="noreferrer"
              aria-describedby="external-beta-note"
            >
              BringMy.ai beta <ArrowUpRight />
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
          <a className="landing-nav-play" href="/play">
            Play now
          </a>
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
            Pitch your idea to four distinct AI judges. Answer hard questions,
            defend your choices, and earn a deal or a competition score.
          </p>
          <div className="landing-modes" id="modes" aria-label="Game modes">
            <div>
              <strong>Investment</strong>
              <span>Pitch for a deal and negotiate the terms.</span>
            </div>
            <div>
              <strong>Competition</strong>
              <span>Pitch for a score or prize with 0% equity.</span>
            </div>
          </div>
          <div className="landing-actions">
            <a className="landing-primary-cta" href="/play">
              Play now <Zap />
            </a>
            <a className="landing-secondary-cta" href="/leaderboard">
              Leaderboard <Trophy />
            </a>
          </div>
          <button className="landing-copitch-cta" type="button" disabled>
            <span>
              Co-Pitch <b>Coming Soon</b>
            </span>
            <small>Pitch alongside a human teammate.</small>
          </button>
          <p className="landing-start-note">
            <strong>One prompt starts the room.</strong> Add your pitch, copy its
            room prompt into Codex, ChatGPT, or BringMy.ai, and your AI runs all
            four judges while you answer.
          </p>
          <div className="landing-proof">
            <div className="landing-proof-faces" aria-hidden="true">
              {judges.map((judge) => (
                <span
                  key={judge.id}
                  style={
                    {
                      backgroundImage: `url(${judge.portrait})`,
                      '--proof-color': judge.color,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <p>
              Four distinct judges. One shared room history. Your answers.
            </p>
          </div>
          <div className="landing-microphone" aria-hidden="true" />
        </div>

        <div className="landing-judge-pair landing-judge-pair-right">
          <JudgePreview judge={judges[2]} />
          <JudgePreview judge={judges[3]} />
        </div>
      </section>

      <footer className="landing-footer">
        <div>
          <strong>PITCH THE AI</strong>
          <span>Four minds. One deal—or one final score.</span>
        </div>
        <nav aria-label="Footer navigation">
          <a
            href="https://github.com/wesheets/pitchtheai"
            target="_blank"
            rel="noreferrer"
          >
            MIT source <ArrowUpRight />
          </a>
          <a
            href="https://github.com/wesheets/pitchtheai#data-and-privacy-boundary"
            target="_blank"
            rel="noreferrer"
          >
            Privacy &amp; data
          </a>
          <a
            href="https://openai.com/webmcp-challenge/"
            target="_blank"
            rel="noreferrer"
          >
            WebMCP Challenge <ArrowUpRight />
          </a>
        </nav>
      </footer>

    </main>
  );
}
