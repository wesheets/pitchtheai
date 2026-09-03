'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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
  return (
    <Dialog>
      <DialogTrigger className="landing-how-trigger">How it works</DialogTrigger>
      <DialogContent className="landing-how-dialog">
        <DialogHeader>
          <span className="landing-how-eyebrow">The WebMCP game loop</span>
          <DialogTitle>One live room. Four judges. Real page tools.</DialogTitle>
          <DialogDescription>
            Your attached AI operates the arena through 14 page-native WebMCP
            tools. The founder still controls every answer and deal decision.
          </DialogDescription>
        </DialogHeader>

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

        <div className="landing-how-footer">
          <p>
            The AI changes the visible game through these tools; it cannot
            invent your response or accept an offer for you.
          </p>
          <Link href="/play">
            Enter the arena <ArrowRight />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
