'use client';

import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

const toolGroups = [
  {
    title: 'Start and understand the room',
    tools: [
      'start_pitch',
      'update_pitch_details',
      'get_pitch_context',
      'review_pitch_evidence',
    ],
  },
  {
    title: 'Run the live conversation',
    tools: [
      'post_judge_turn',
      'wait_for_founder_response',
      'post_judge_round',
    ],
  },
  {
    title: 'Handle recovery and multiple agents',
    tools: [
      'wait_for_founder_readiness_photo',
      'wait_for_judge_rescue',
      'complete_panel_judge_turn',
    ],
  },
  {
    title: 'Close the deal or competition',
    tools: [
      'post_bid_round',
      'wait_for_founder_offer_decision',
      'post_panel_verdict',
      'get_leaderboard',
    ],
  },
] as const;

export function LandingHowItWorks() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="landing-how-trigger"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        How it works
      </button>
      <dialog
        ref={dialogRef}
        className="landing-how-dialog"
        aria-labelledby="landing-how-title"
        aria-describedby="landing-how-description"
      >
        <button
          className="landing-how-close"
          type="button"
          aria-label="Close how it works"
          onClick={() => dialogRef.current?.close()}
        >
          <X />
        </button>
        <header>
          <span className="landing-how-eyebrow">How the game works</span>
          <h2 id="landing-how-title">
            One live room. Four judges. Real page tools.
          </h2>
          <p id="landing-how-description">
            Add your pitch, copy one room prompt into the AI you already use,
            and face four judges that remember what happened before. You still
            control every answer and deal decision.
          </p>
        </header>

        <ol className="landing-how-steps">
          <li>
            <b>01</b>
            <span>
              <strong>Set the pitch</strong>
              Add your terms and opening pitch, then invite your AI into the
              exact room.
            </span>
          </li>
          <li>
            <b>02</b>
            <span>
              <strong>Face the panel</strong>
              Judges question you one turn at a time while the room preserves
              the shared history.
            </span>
          </li>
          <li>
            <b>03</b>
            <span>
              <strong>Get the verdict</strong>
              The panel closes with an earned deal or competition score and a
              public leaderboard result.
            </span>
          </li>
        </ol>

        <details className="landing-how-technical">
          <summary>View the 14 WebMCP tools</summary>
          <p>
            These page-native tools let the AI operate the visible arena while
            the founder remains in control.
          </p>
          <div className="landing-how-tools" aria-label="WebMCP tools">
            {toolGroups.map((group) => (
              <section key={group.title}>
                <h3>{group.title}</h3>
                <div>
                  {group.tools.map((tool) => (
                    <code key={tool}>{tool}</code>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </details>

        <div className="landing-how-footer">
          <p>
            The AI changes the visible game through these tools; it cannot
            invent your response or accept an offer for you.
          </p>
          <Link href="/play">
            Enter the arena <ArrowRight />
          </Link>
        </div>
      </dialog>
    </>
  );
}
