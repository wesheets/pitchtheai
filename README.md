# Pitch The AI

Pitch your company to four AI judges. A weak pitch burns their patience until they say “I’m out.” A strong pitch can trigger competing offers, reversals, and a live bidding war.

The twist is that the visitor’s browser agent plays the whole panel. The website provides the arena, transcript, timer, evidence tray, spoken reactions, adaptive score, founder-controlled negotiation, and public leaderboard; WebMCP gives ChatGPT or Codex eleven narrow tools for operating the live session.

## WebMCP tools

1. `start_pitch` — configure and start a new eight-minute session.
2. `update_pitch_details` — update the company, ask, equity, immediate favorability, mood emoji, and soundtrack.
3. `get_pitch_context` — read the transcript, uploaded evidence, panel state, and hidden game directives.
4. `review_pitch_evidence` — confirm that every uploaded artifact was actually inspected.
5. `post_judge_turn` — give exactly one judge the floor and optionally ask one question.
6. `wait_for_founder_response` — hold the panel at the shared 45-second response gate.
7. `post_judge_round` — run the optional four-judge opening montage without questions.
8. `post_bid_round` — put one or more visible offers on the founder’s deal table.
9. `wait_for_founder_offer_decision` — wait while the founder accepts, counters, or rejects.
10. `post_panel_verdict` — finish, speak the verdict, and save only an explicitly accepted deal.
11. `get_leaderboard` — read the public rankings.

Tools are registered from the top-level page with `document.modelContext.registerTool`. The app remains usable in ordinary browsers without WebMCP.

## Voice and evidence

- Browser speech recognition captures the founder’s spoken pitch when supported.
- A server-side ElevenLabs Flash stream gives each judge a distinct voice and starts playback as chunks arrive. The API key never reaches the browser.
- Browser speech synthesis is an automatic fallback when ElevenLabs is not configured, its daily character budget is reached, or playback fails.
- A ChatGPT voice session can run the WebMCP panel while the arena—not ChatGPT—speaks the four judge parts, allowing all four voices in one live pitch.
- Each judge has skeptical, intrigued, and impressed portrait states; the active speaker glows and drives a live waveform.
- The project owner’s purchased ElevenLabs cinematic track is available alongside original Web Audio heartbeat, tension, fear, excitement, and triumph cues.
- Optional captions keep the experience accessible and demo-friendly.
- JPG, PNG, WebP, PDF, text, Markdown, and PPTX evidence can be attached to a pitch. Files are stored in R2 and their inspectable links are included in pitch context.

## Stack

- React 19 + Vinext
- OpenAI Sites hosting
- Cloudflare D1 for the leaderboard and upload metadata
- Cloudflare R2 for pitch evidence
- WebMCP site tools

## Local development

```bash
npm install
```

Copy `.env.example` to `.env.local` and add an ElevenLabs API key to enable streamed judge voices. Without it, the browser voice fallback works automatically.

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

## Challenge provenance

This standalone project was created for the 2026 OpenAI WebMCP Challenge after August 25, 2026. It adapts the interaction premise of an earlier private pitch-game prototype, but the WebMCP architecture, browser-agent panel, original judge identities, evidence flow, public leaderboard, and this codebase were created for the challenge. It contains no Bring My AI or Promethios source code, secrets, trademarks, or third-party character likenesses. The included ElevenLabs-generated soundtrack was purchased by the project owner and is documented separately from the MIT-licensed code.

## License

MIT. See [LICENSE](./LICENSE).
