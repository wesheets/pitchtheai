import type {
  Bid,
  JudgeId,
  JudgeMood,
  JudgeReaction,
  LeaderboardEntry,
  PanelMood,
  PitchDetailsUpdate,
  EvidenceReview,
  FounderTurnState,
  PitchFeedEntry,
  PitchMaterial,
} from '@/app/pitch-arena';
import type { Soundtrack } from '@/lib/soundtrack';

type ToolStatus = 'checking' | 'ready' | 'browser-only';
type PitchSnapshot = {
  roomCode: string;
  openingDraft: string;
  pitch: {
    founderName: string;
    companyName: string;
    askAmount: number;
    equity: number;
    transcript: string;
    status: 'lobby' | 'live' | 'final';
    round: number;
    secondsLeft: number;
    favorability: number;
    mood: PanelMood;
    soundtrack: Soundtrack;
    summary?: string;
    score?: number;
    amountRaised?: number;
    durationSeconds?: number;
    startedAt?: number;
  };
  judges: Array<{
    id: JudgeId;
    name: string;
    role: string;
    judgeId: JudgeId;
    state: 'listening' | 'pressing' | 'bidding' | 'out';
    interest: number;
    spoken: string;
    question?: string;
  }>;
  bids: Bid[];
  materials: PitchMaterial[];
  conversation: PitchFeedEntry[];
  founderTurn: FounderTurnState;
  evidenceReview: {
    pendingMaterialIds: string[];
    reviews: EvidenceReview[];
    ready: boolean;
  };
  panelDirectives: {
    rivalry: string;
    curveball: string;
    judges: Record<
      JudgeId,
      { patience: 'short' | 'medium' | 'long'; secretHook: string }
    >;
  };
};
type RegisterToolArgs = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  execute: (args: Record<string, unknown>) => unknown;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: RegisterToolArgs) => Promise<void> | void;
      unregisterTool?: (name: string) => Promise<void> | void;
    };
  }
}

const judgeIdSchema = {
  type: 'string',
  enum: ['maya', 'julian', 'priya', 'theo'],
};
const reactionSchema = {
  type: 'object',
  required: ['judgeId', 'state', 'interest', 'mood', 'spoken'],
  properties: {
    judgeId: judgeIdSchema,
    state: {
      type: 'string',
      enum: ['listening', 'pressing', 'bidding', 'out'],
    },
    interest: { type: 'number', minimum: 0, maximum: 100 },
    mood: {
      type: 'string',
      enum: ['skeptical', 'intrigued', 'impressed'] satisfies JudgeMood[],
    },
    spoken: { type: 'string', minLength: 1, maxLength: 500 },
    question: { type: 'string', maxLength: 300 },
  },
  additionalProperties: false,
};

export function registerPitchTools(options: {
  getSnapshot: () => PitchSnapshot;
  startPitch: (next?: Partial<PitchSnapshot['pitch']>) => Promise<void>;
  updatePitchDetails: (update: PitchDetailsUpdate) => void;
  applyJudgeRound: (roundSummary: string, reactions: JudgeReaction[]) => void;
  applyJudgeTurn: (roundSummary: string, reaction: JudgeReaction) => void;
  reviewPitchEvidence: (reviews: EvidenceReview[]) => void;
  waitForFounderResponse: (
    timeoutSeconds?: number,
  ) => Promise<Record<string, unknown>>;
  applyBidRound: (bids: Bid[]) => void;
  finalizePitch: (result: {
    score: number;
    summary: string;
    amountRaised: number;
    winningJudgeId?: JudgeId;
  }) => Promise<PitchSnapshot['pitch']>;
  fetchLeaderboard: () => Promise<LeaderboardEntry[]>;
  onStatus: (status: ToolStatus) => void;
}) {
  if (
    typeof document === 'undefined' ||
    typeof document.modelContext?.registerTool !== 'function'
  ) {
    options.onStatus('browser-only');
    return () => undefined;
  }

  const registered: string[] = [];
  const add = async (tool: RegisterToolArgs) => {
    await document.modelContext?.registerTool(tool);
    registered.push(tool.name);
  };
  const requireEvidenceReview = () => {
    const pending = options.getSnapshot().evidenceReview.pendingMaterialIds;
    if (pending.length) {
      throw new Error(
        `Review every uploaded pitch file before bringing in the judges. Pending material ids: ${pending.join(', ')}`,
      );
    }
  };
  const requireFounderTurnComplete = () => {
    if (options.getSnapshot().founderTurn.status === 'awaiting') {
      throw new Error(
        'The founder has not answered the current judge. Call wait_for_founder_response before posting another turn.',
      );
    }
  };
  const tools: RegisterToolArgs[] = [
    {
      name: 'start_pitch',
      description: `Start or replace the visible Pitch The AI session in room ${options.getSnapshot().roomCode}. Use when the founder gives a company name, funding ask, and equity offer. This resets prior rounds, secretly varies judge patience, runs the visible 3-2-1 launch, then starts the eight-minute clock.`,
      inputSchema: {
        type: 'object',
        required: ['companyName', 'askAmount', 'equity'],
        properties: {
          founderName: { type: 'string', maxLength: 80 },
          companyName: { type: 'string', minLength: 1, maxLength: 100 },
          askAmount: { type: 'number', minimum: 0, maximum: 1000000000 },
          equity: { type: 'number', minimum: 0.1, maximum: 100 },
          openingPitch: { type: 'string', maxLength: 6000 },
        },
        additionalProperties: false,
      },
      execute: async (args) => {
        await options.startPitch({
          founderName:
            typeof args.founderName === 'string'
              ? args.founderName
              : 'Guest founder',
          companyName: String(args.companyName),
          askAmount: Number(args.askAmount),
          equity: Number(args.equity),
          transcript:
            typeof args.openingPitch === 'string'
              ? args.openingPitch
              : options.getSnapshot().openingDraft,
        });
        return {
          started: true,
          roomCode: options.getSnapshot().roomCode,
          companyName: args.companyName,
          askAmount: args.askAmount,
          equity: args.equity,
        };
      },
    },
    {
      name: 'update_pitch_details',
      description:
        'Update the visible pitch brief and the panel’s immediate room read after extracting details from the founder’s speech or text. Call as soon as the company name, funding ask, and equity are known, then whenever those facts or the panel mood materially change. Select a soundtrack that matches the tension; the founder controls whether browser audio is enabled.',
      inputSchema: {
        type: 'object',
        required: [
          'companyName',
          'askAmount',
          'equity',
          'favorability',
          'mood',
          'soundtrack',
        ],
        properties: {
          founderName: { type: 'string', maxLength: 80 },
          companyName: { type: 'string', minLength: 1, maxLength: 100 },
          askAmount: { type: 'number', minimum: 0, maximum: 1000000000 },
          equity: { type: 'number', minimum: 0.1, maximum: 100 },
          favorability: { type: 'number', minimum: 0, maximum: 100 },
          mood: {
            type: 'string',
            enum: [
              'skeptical',
              'surprised',
              'impressed',
              'tense',
              'confused',
              'excited',
              'disappointed',
            ],
          },
          soundtrack: {
            type: 'string',
            enum: [
              'silence',
              'cinematic',
              'game',
              'heartbeat',
              'tense',
              'fear',
              'excitement',
              'triumph',
            ],
          },
        },
        additionalProperties: false,
      },
      execute: (args) => {
        const update: PitchDetailsUpdate = {
          founderName:
            typeof args.founderName === 'string' ? args.founderName : undefined,
          companyName: String(args.companyName),
          askAmount: Number(args.askAmount),
          equity: Number(args.equity),
          favorability: Number(args.favorability),
          mood: args.mood as PanelMood,
          soundtrack: args.soundtrack as Soundtrack,
        };
        options.updatePitchDetails(update);
        return { updated: true, details: update };
      },
    },
    {
      name: 'get_pitch_context',
      description:
        'Read this tab\'s unique room code, opening draft, live pitch transcript, founder/judge dialogue, current response gate, timer, ask, uploaded evidence links, prior offers, and all four judges. Verify the room code supplied by the handoff before calling start_pitch so a duplicate browser tab cannot receive the game. Before any judge enters, open and inspect every uploaded file, then call review_pitch_evidence with a grounded summary for each pending material. Run the pitch interactively: post one judge question, then call wait_for_founder_response in consecutive short slices until it returns answered or timed_out. Evaluate the exact answer before continuing. Never invent a founder answer. While the pitch is live, communicate only through Pitch The AI WebMCP tools: do not narrate tool selection, repeat judge dialogue, summarize founder answers, or post routine progress updates in chat. The host may show normal tool activity. Use chat only for a tool failure, unreadable evidence, an unrecoverable founder answer, or response latency over 10 seconds. After the final verdict, provide one concise performance report.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => options.getSnapshot(),
    },
    {
      name: 'review_pitch_evidence',
      description:
        'Confirm that every currently pending uploaded pitch file has actually been opened and reviewed. Supply a concise grounded summary for each pending material id. Judge tools remain blocked until this gate is complete; uploading a new file creates a new pending review.',
      inputSchema: {
        type: 'object',
        required: ['reviews'],
        properties: {
          reviews: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: {
              type: 'object',
              required: ['materialId', 'summary'],
              properties: {
                materialId: { type: 'string', minLength: 1, maxLength: 120 },
                summary: { type: 'string', minLength: 10, maxLength: 700 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      execute: (args) => {
        const pending = options.getSnapshot().evidenceReview.pendingMaterialIds;
        const incoming = args.reviews as Array<{
          materialId: string;
          summary: string;
        }>;
        const supplied = new Set(incoming.map((review) => review.materialId));
        const missing = pending.filter((id) => !supplied.has(id));
        const invalid = incoming.filter(
          (review) => !pending.includes(review.materialId),
        );
        if (missing.length || invalid.length) {
          throw new Error(
            `Evidence review must match all pending materials exactly. Missing: ${missing.join(', ') || 'none'}. Invalid: ${invalid.map((item) => item.materialId).join(', ') || 'none'}.`,
          );
        }
        const reviews: EvidenceReview[] = incoming.map((review) => ({
          ...review,
          reviewedAt: Date.now(),
        }));
        options.reviewPitchEvidence(reviews);
        return { reviewed: true, reviews };
      },
    },
    {
      name: 'post_judge_turn',
      description:
        'Post exactly one visible and spoken judge turn. Keep it focused and under 90 spoken words. When the judge asks a question, include the exact question field, then immediately call wait_for_founder_response in consecutive short slices until it returns answered or timed_out. Never post another judge while the founder gate is open. Reward specific evidence and genuine answers; lower interest for evasive replies. A timeout should make the next turn sharper and more ruthless, not fabricate an answer.',
      inputSchema: {
        type: 'object',
        required: ['roundSummary', 'judge'],
        properties: {
          roundSummary: { type: 'string', minLength: 1, maxLength: 500 },
          judge: reactionSchema,
        },
        additionalProperties: false,
      },
      execute: (args) => {
        requireEvidenceReview();
        requireFounderTurnComplete();
        const judge = args.judge as JudgeReaction;
        options.applyJudgeTurn(String(args.roundSummary), judge);
        return {
          posted: true,
          judge,
          next: judge.question
            ? 'Call wait_for_founder_response now.'
            : 'The founder may continue, or another judge may speak.',
        };
      },
    },
    {
      name: 'wait_for_founder_response',
      description:
        'Wait up to 12 seconds for the human founder to answer the active judge by voice or text. The question keeps one shared 45-second deadline across calls. If the result is waiting, call this tool again immediately; if answered, evaluate the exact response; if timed_out, burn patience. Never post another judge while the founder gate is open.',
      inputSchema: {
        type: 'object',
        properties: {
          timeoutSeconds: {
            type: 'number',
            minimum: 1,
            maximum: 12,
            default: 12,
          },
        },
        additionalProperties: false,
      },
      execute: (args) =>
        options.waitForFounderResponse(
          typeof args.timeoutSeconds === 'number' ? args.timeoutSeconds : 12,
        ),
    },
    {
      name: 'post_judge_round',
      description:
        'Legacy opening montage only: post one brief non-question reaction from each judge before interactive questioning begins. Do not use this tool for Q&A. Every reaction must omit question; use post_judge_turn plus wait_for_founder_response for the actual pitch.',
      inputSchema: {
        type: 'object',
        required: ['roundSummary', 'judges'],
        properties: {
          roundSummary: { type: 'string', minLength: 1, maxLength: 500 },
          judges: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: reactionSchema,
          },
        },
        additionalProperties: false,
      },
      execute: (args) => {
        requireEvidenceReview();
        requireFounderTurnComplete();
        const judges = args.judges as JudgeReaction[];
        if (new Set(judges.map((judge) => judge.judgeId)).size !== 4) {
          throw new Error('Provide exactly one reaction for each judge.');
        }
        if (judges.some((judge) => judge.question)) {
          throw new Error(
            'Questions require post_judge_turn followed by wait_for_founder_response.',
          );
        }
        options.applyJudgeRound(String(args.roundSummary), judges);
        return {
          posted: true,
          round: options.getSnapshot().pitch.round + 1,
          judges,
        };
      },
    },
    {
      name: 'post_bid_round',
      description:
        'Create a visible, spoken competitive bid round when at least two judges strongly want the deal. In a voice chat, let the arena speak the offers instead of reading them yourself, and write amounts as natural spoken words. Judges may counter, steal, or form a joint offer. Keep offers coherent with the founder’s ask and prior reactions; use escalating counteroffers only when the pitch earned genuine competition.',
      inputSchema: {
        type: 'object',
        required: ['bids'],
        properties: {
          bids: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['judgeId', 'amount', 'equity', 'spoken'],
              properties: {
                judgeId: judgeIdSchema,
                amount: { type: 'number', minimum: 1, maximum: 1000000000 },
                equity: { type: 'number', minimum: 0.1, maximum: 100 },
                conditions: { type: 'string', maxLength: 300 },
                spoken: { type: 'string', minLength: 1, maxLength: 500 },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
      execute: (args) => {
        requireEvidenceReview();
        requireFounderTurnComplete();
        const bids = args.bids as Bid[];
        if (new Set(bids.map((bid) => bid.judgeId)).size !== bids.length) {
          throw new Error(
            'Each bidding judge may submit only one offer per round.',
          );
        }
        options.applyBidRound(bids);
        return { posted: true, bids };
      },
    },
    {
      name: 'post_panel_verdict',
      description:
        'End the visible pitch with a fair 0–100 score, capital raised, and concise spoken panel verdict. In a voice chat, let the arena speak the verdict instead of reading it yourself. This saves the result to the public leaderboard. Use amountRaised 0 when no offer is accepted or all judges are out.',
      inputSchema: {
        type: 'object',
        required: ['score', 'summary', 'amountRaised'],
        properties: {
          score: { type: 'number', minimum: 0, maximum: 100 },
          summary: { type: 'string', minLength: 1, maxLength: 700 },
          amountRaised: { type: 'number', minimum: 0, maximum: 1000000000 },
          winningJudgeId: judgeIdSchema,
        },
        additionalProperties: false,
      },
      execute: async (args) => {
        requireEvidenceReview();
        requireFounderTurnComplete();
        const result = await options.finalizePitch({
          score: Number(args.score),
          summary: String(args.summary),
          amountRaised: Number(args.amountRaised),
          winningJudgeId: args.winningJudgeId as JudgeId | undefined,
        });
        return { saved: true, verdict: result };
      },
    },
    {
      name: 'get_leaderboard',
      description:
        'Read the public Pitch The AI leaderboard, ranked by pitch score and then capital raised.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async () => ({ entries: await options.fetchLeaderboard() }),
    },
  ];

  void Promise.all(tools.map(add))
    .then(() => options.onStatus('ready'))
    .catch(() => options.onStatus('browser-only'));

  return () => {
    for (const name of registered)
      void document.modelContext?.unregisterTool?.(name);
  };
}
