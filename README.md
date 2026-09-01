# Pitch The AI

Pitch The AI is a live, theatrical pitch simulator controlled by a browser AI through WebMCP. The founder speaks or types while four distinct AI investors question the pitch, react to evidence, lose patience, leave the room, make competing offers, and deliver a final verdict.

Visit [pitchtheai.com](https://pitchtheai.com), then enter the arena at [pitchtheai.com/play](https://pitchtheai.com/play).

## The experience

1. Set the founder name, venture, ask, equity, and difficulty: Easy, Medium, Hard, or Legendary.
2. Write or dictate the opening pitch, optionally attach evidence, and take an opt-in founder photo.
3. Copy the generated panel prompt into a WebMCP-capable browser agent. The arena verifies the room code, runs a 3–2–1 countdown, changes the soundtrack, and starts a twenty-minute session.
4. One investor takes the floor at a time. Their card moves center stage with the question while the other judges remain visible.
5. The founder clicks **Respond**, then has 45 seconds to answer by voice or text. The countdown grows and pulses while a heartbeat replaces the room music.
6. The agent evaluates the exact answer and any inspected evidence before the next investor speaks.
7. Judges can laugh, become exasperated, demand a presentation reset, or leave with a specific reason. A one-use **Wait, don’t go!** lifeline gives the founder ten seconds to rescue an eliminated judge.
8. Interested judges can make visible bids and compete. The founder—not the agent—accepts, counters, or rejects each offer.
9. The room closes with a large, candid verdict, a score grounded in what actually happened, and an optional public leaderboard entry.

Equity set to zero activates competition mode, which judges the WebMCP experience, implementation, originality, resilience, and human–agent collaboration instead of pretending there is a startup equity transaction.

## Why WebMCP

This is more than an AI chat displayed beside a webpage. WebMCP lets the visiting agent operate a shared, stateful arena while the human keeps control of the decisions that matter:

- The agent controls the four investor personas, timing gates, reactions, offers, exits, rescues, and final verdict.
- The site owns the durable room state, transcript, timer, evidence status, audiovisual cues, negotiation controls, and leaderboard.
- The founder owns every spoken or typed answer, optional camera evidence, rescue appeal, counteroffer, and deal decision.
- Tool-enforced response and evidence gates prevent the agent from inventing a founder answer, skipping an upload, or accepting its own offer.

The result is a live performance that neither the human nor the AI could create alone.

## WebMCP tools

The page registers thirteen narrow tools with `document.modelContext.registerTool`:

1. `start_pitch` — configure and start a new twenty-minute session.
2. `update_pitch_details` — update the company, ask, equity, favorability, room mood, and soundtrack.
3. `get_pitch_context` — read the transcript, evidence queue, panel state, and game directives.
4. `review_pitch_evidence` — confirm that uploaded evidence was actually inspected.
5. `post_judge_turn` — give exactly one judge the floor and optionally ask one question.
6. `wait_for_founder_response` — hold the panel at the shared 45-second response gate.
7. `wait_for_founder_readiness_photo` — pause the room for a judge-requested photo retake.
8. `wait_for_judge_rescue` — hold an eliminated judge for the founder’s ten-second appeal.
9. `post_judge_round` — run an optional four-judge montage without opening response gates.
10. `post_bid_round` — place one or more offers on the founder’s deal table.
11. `wait_for_founder_offer_decision` — wait while the founder accepts, counters, or rejects.
12. `post_panel_verdict` — close the room and record only an explicitly accepted deal.
13. `get_leaderboard` — read the public rankings.

The arena still renders in an ordinary browser, but a WebMCP-capable agent is required to run the panel.

## Voice, evidence, and recording

- Browser speech recognition captures founder responses when supported; typing is always available.
- Server-side ElevenLabs streaming gives each judge a distinct voice without exposing the API key.
- Browser speech synthesis automatically takes over when streamed voices are unavailable or the daily character budget is reached.
- Each judge has skeptical, intrigued, impressed, laughing, exasperated, and exit presentation states.
- The soundtrack reacts to the room, with separate countdown, heartbeat, tension, fear, excitement, and triumph cues.
- JPG, PNG, WebP, PDF, text, Markdown, and PPTX evidence can be attached. Files are stored in R2 and exposed to the agent as inspectable links.
- The camera is opt-in. A captured still becomes evidence only after the founder submits it.
- Optional session recording downloads locally as WebM with the arena, founder picture-in-picture, microphone, and available game audio. Recording is not uploaded by default.

## Scoring and leaderboard

Difficulty changes how forgiving the panel is, not just the visual theme. Judges score answer quality, specificity, evidence, consistency, and whether the founder actually answered the question. Silence, repetition, contradictions, and evasions burn patience. Accepted deals and final scores can be submitted to the public leaderboard with the session duration.

## Data and privacy boundary

Pitch The AI uses its own project-scoped Sites storage. It does not use or write
to a Promethios database.

- The leaderboard stores only founder name, venture name, score, amount raised,
  ask, pitch duration, and timestamp.
- Pitch transcripts, camera video, microphone audio, and session recordings are
  not uploaded with leaderboard entries.
- **Share result** creates a branded final-verdict image in the browser. It is
  shared or downloaded locally and is not stored by the site.
- Uploaded pitch evidence uses the Pitch The AI project bucket and is separate
  from leaderboard rows.

## Architecture

- React 19 + Vinext
- OpenAI Sites hosting and custom-domain routing
- Cloudflare D1 for leaderboard and upload metadata
- Cloudflare R2 for pitch evidence
- Server-side ElevenLabs voice proxy with browser speech fallback
- WebMCP site tools for the live panel protocol

The browser-agent handoff is deliberately vendor-neutral: the site copies a room-bound prompt that can be pasted into a compatible agent attached to the same page.

The landing page also labels and links to BringMy.ai as an optional external beta for testing WebMCP with other AI providers. It is a separate product, is not required to play, and is not part of this repository or its MIT license.

## Local development

```bash
npm install
```

Copy `.env.example` to `.env.local` and add an ElevenLabs API key to enable streamed judge voices. Without it, browser speech synthesis is used automatically.

```bash
npm run dev
```

Then open `http://localhost:3000`.

Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Project provenance

This standalone project was created for the 2026 OpenAI WebMCP Challenge after August 25, 2026. The WebMCP architecture, browser-agent panel, original judge identities, evidence flow, negotiation system, public leaderboard, and application code were created for this project. The included ElevenLabs-generated soundtrack was purchased by the project owner and is documented separately from the MIT-licensed source code.

## License

MIT. See [LICENSE](./LICENSE).
