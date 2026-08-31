import type {
  Bid,
  JudgeId,
  JudgeReaction,
  LeaderboardEntry,
  PanelMood,
  PitchDetailsUpdate,
  PitchMaterial,
} from '@/app/pitch-arena';
import type { Soundtrack } from '@/lib/soundtrack';

type ToolStatus = 'checking' | 'ready' | 'browser-only';
type PitchSnapshot = {
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
  required: ['judgeId', 'state', 'interest', 'spoken'],
  properties: {
    judgeId: judgeIdSchema,
    state: {
      type: 'string',
      enum: ['listening', 'pressing', 'bidding', 'out'],
    },
    interest: { type: 'number', minimum: 0, maximum: 100 },
    spoken: { type: 'string', minLength: 1, maxLength: 500 },
    question: { type: 'string', maxLength: 300 },
  },
  additionalProperties: false,
};

export function registerPitchTools(options: {
  getSnapshot: () => PitchSnapshot;
  startPitch: (next?: Partial<PitchSnapshot['pitch']>) => void;
  updatePitchDetails: (update: PitchDetailsUpdate) => void;
  applyJudgeRound: (roundSummary: string, reactions: JudgeReaction[]) => void;
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
  const tools: RegisterToolArgs[] = [
    {
      name: 'start_pitch',
      description:
        'Start or replace the visible Pitch The AI session. Use when the founder gives a company name, funding ask, and equity offer. This resets prior rounds, secretly varies judge patience, and starts the eight-minute clock.',
      inputSchema: {
        type: 'object',
        required: ['companyName', 'askAmount', 'equity'],
        properties: {
          founderName: { type: 'string', maxLength: 80 },
          companyName: { type: 'string', minLength: 1, maxLength: 100 },
          askAmount: { type: 'number', minimum: 0, maximum: 1000000000 },
          equity: { type: 'number', minimum: 0.1, maximum: 100 },
        },
        additionalProperties: false,
      },
      execute: (args) => {
        options.startPitch({
          founderName:
            typeof args.founderName === 'string'
              ? args.founderName
              : 'Guest founder',
          companyName: String(args.companyName),
          askAmount: Number(args.askAmount),
          equity: Number(args.equity),
        });
        return {
          started: true,
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
        'Read the live pitch transcript, timer, ask, uploaded evidence links, prior offers, and all four judges. Inspect relevant pitch images or documents before judging. Role-play all four distinct judges: get impatient with vague repetition, move a judge to out when patience is exhausted, and reward specific evidence with rising interest.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => options.getSnapshot(),
    },
    {
      name: 'post_judge_round',
      description:
        'Post one visible and spoken reaction from each AI judge. Make personalities disagree. Vague, evasive, repetitive, or time-wasting answers should lower interest, become pressing, and eventually say exactly “I’m out.” Strong new evidence may raise interest or earn one surprising reversal. Occasionally introduce a plausible curveball, but never make outcomes arbitrary.',
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
        const judges = args.judges as JudgeReaction[];
        if (new Set(judges.map((judge) => judge.judgeId)).size !== 4) {
          throw new Error('Provide exactly one reaction for each judge.');
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
        'Create a visible, spoken competitive bid round when at least two judges strongly want the deal. Judges may counter, steal, or form a joint offer. Keep offers coherent with the founder’s ask and prior reactions; use escalating counteroffers only when the pitch earned genuine competition.',
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
        'End the visible pitch with a fair 0–100 score, capital raised, and concise spoken panel verdict. This saves the result to the public leaderboard. Use amountRaised 0 when no offer is accepted or all judges are out.',
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
