import type {
  Bid,
  JudgeId,
  JudgeMood,
  JudgeReaction,
  LeaderboardEntry,
  OfferDecision,
  PanelMood,
  PitchDetailsUpdate,
  EvidenceReview,
  FounderTurnState,
  JudgeLifelineState,
  JudgeRescueState,
  PitchDifficulty,
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
    difficulty: PitchDifficulty;
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
    reactionStyle?: 'neutral' | 'laughing' | 'exasperated';
    answerQuality?:
      | 'unrated'
      | 'unanswered'
      | 'evasive'
      | 'weak'
      | 'credible'
      | 'exceptional';
    outReason?: string;
  }>;
  bids: Bid[];
  offerDecision: OfferDecision;
  acceptedBid: Bid | null;
  materials: PitchMaterial[];
  conversation: PitchFeedEntry[];
  founderTurn: FounderTurnState;
  judgeRescue: JudgeRescueState;
  judgeLifeline: JudgeLifelineState;
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

type PitchToolOptions = {
  getSnapshot: () => PitchSnapshot;
  startPitch: (next?: Partial<PitchSnapshot['pitch']>) => Promise<void>;
  updatePitchDetails: (update: PitchDetailsUpdate) => void;
  applyJudgeRound: (roundSummary: string, reactions: JudgeReaction[]) => void;
  applyJudgeTurn: (roundSummary: string, reaction: JudgeReaction) => void;
  reviewPitchEvidence: (reviews: EvidenceReview[]) => void;
  waitForFounderResponse: (
    timeoutSeconds?: number,
  ) => Promise<Record<string, unknown>>;
  waitForJudgeRescue: () => Promise<Record<string, unknown>>;
  waitForFounderOfferDecision: (
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
  onToolEvent: (event: {
    toolName: string;
    phase: 'called' | 'complete' | 'error';
    createdAt: number;
  }) => void;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: RegisterToolArgs) => Promise<void> | void;
      unregisterTool?: (name: string) => Promise<void> | void;
    };
  }
}

type ModelContext = NonNullable<Document['modelContext']>;
type ActivePitchToolRegistration = {
  modelContext: ModelContext;
  optionsRef: { current: PitchToolOptions };
  registered: Set<string>;
  leases: number;
  disposeTimer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
};

let activePitchToolRegistration: ActivePitchToolRegistration | null = null;

function disposePitchToolRegistration(
  registration: ActivePitchToolRegistration,
) {
  if (registration.disposed) return;
  registration.disposed = true;
  if (registration.disposeTimer) clearTimeout(registration.disposeTimer);
  if (activePitchToolRegistration === registration)
    activePitchToolRegistration = null;
  for (const name of registration.registered)
    void registration.modelContext.unregisterTool?.(name);
  registration.registered.clear();
}

function releasePitchToolRegistration(
  registration: ActivePitchToolRegistration,
) {
  registration.leases = Math.max(0, registration.leases - 1);
  if (registration.leases > 0 || registration.disposed) return;
  registration.disposeTimer = setTimeout(() => {
    if (registration.leases === 0) disposePitchToolRegistration(registration);
  }, 100);
}

const judgeIdSchema = {
  type: 'string',
  enum: ['maya', 'julian', 'priya', 'theo'],
};
const reactionSchema = {
  type: 'object',
  required: [
    'judgeId',
    'state',
    'interest',
    'mood',
    'spoken',
    'reactionStyle',
    'answerQuality',
  ],
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
    reactionStyle: {
      type: 'string',
      enum: ['neutral', 'laughing', 'exasperated'],
    },
    answerQuality: {
      type: 'string',
      enum: [
        'unrated',
        'unanswered',
        'evasive',
        'weak',
        'credible',
        'exceptional',
      ],
    },
    outReason: { type: 'string', maxLength: 240 },
  },
  additionalProperties: false,
};

export function registerPitchTools(options: PitchToolOptions) {
  if (
    typeof document === 'undefined' ||
    typeof document.modelContext?.registerTool !== 'function'
  ) {
    options.onStatus('browser-only');
    return () => undefined;
  }

  const modelContext = document.modelContext;
  const existing = activePitchToolRegistration;
  if (
    existing &&
    existing.modelContext === modelContext &&
    !existing.disposed
  ) {
    if (existing.disposeTimer) {
      clearTimeout(existing.disposeTimer);
      existing.disposeTimer = null;
    }
    existing.optionsRef.current = options;
    existing.leases += 1;
    return () => releasePitchToolRegistration(existing);
  }
  if (existing) disposePitchToolRegistration(existing);

  const registration: ActivePitchToolRegistration = {
    modelContext,
    optionsRef: { current: options },
    registered: new Set<string>(),
    leases: 1,
    disposeTimer: null,
    disposed: false,
  };
  activePitchToolRegistration = registration;
  const optionsRef = registration.optionsRef;
  const add = async (tool: RegisterToolArgs) => {
    await modelContext.registerTool({
      ...tool,
      execute: async (args) => {
        optionsRef.current.onToolEvent({
          toolName: tool.name,
          phase: 'called',
          createdAt: Date.now(),
        });
        try {
          const result = await tool.execute(args);
          optionsRef.current.onToolEvent({
            toolName: tool.name,
            phase: 'complete',
            createdAt: Date.now(),
          });
          return result;
        } catch (error) {
          optionsRef.current.onToolEvent({
            toolName: tool.name,
            phase: 'error',
            createdAt: Date.now(),
          });
          throw error;
        }
      },
    });
    if (registration.disposed) {
      await modelContext.unregisterTool?.(tool.name);
      return;
    }
    registration.registered.add(tool.name);
  };
  const requireEvidenceReview = () => {
    const pending =
      optionsRef.current.getSnapshot().evidenceReview.pendingMaterialIds;
    if (pending.length) {
      throw new Error(
        `Review every uploaded pitch file before bringing in the judges. Pending material ids: ${pending.join(', ')}`,
      );
    }
  };
  const requireFounderTurnComplete = () => {
    if (
      optionsRef.current.getSnapshot().founderTurn.status === 'presenting' ||
      optionsRef.current.getSnapshot().founderTurn.status === 'awaiting'
    ) {
      throw new Error(
        'The founder has not answered the current judge. Call wait_for_founder_response before posting another turn.',
      );
    }
  };
  const requireOfferDecisionComplete = () => {
    if (optionsRef.current.getSnapshot().offerDecision.status === 'choosing') {
      throw new Error(
        'The founder is choosing between live offers. Call wait_for_founder_offer_decision before continuing the panel.',
      );
    }
  };
  const requireJudgeRescueComplete = (nextJudgeId?: JudgeId) => {
    const rescue = optionsRef.current.getSnapshot().judgeRescue;
    if (rescue.status === 'offered' || rescue.status === 'awaiting') {
      throw new Error(
        'A judge is halfway out of the room. Call wait_for_judge_rescue before another judge speaks.',
      );
    }
    if (
      rescue.status === 'answered' &&
      rescue.judgeId &&
      nextJudgeId !== rescue.judgeId
    ) {
      throw new Error(
        `The founder appealed to ${rescue.judgeId}. That same judge must answer the appeal before anyone else speaks.`,
      );
    }
  };
  const requireJudgeLifelineComplete = (nextJudgeId?: JudgeId) => {
    const lifeline = optionsRef.current.getSnapshot().judgeLifeline;
    if (
      lifeline.status === 'pending' &&
      lifeline.judgeId &&
      nextJudgeId !== lifeline.judgeId
    ) {
      throw new Error(
        `The founder used Second Chance on ${lifeline.judgeId}. That recalled judge must speak next and ask one final question before anyone else gets the floor.`,
      );
    }
  };
  const requireNoAcceptedDeal = () => {
    if (optionsRef.current.getSnapshot().acceptedBid) {
      throw new Error(
        'The founder already accepted an offer. Close the pitch with post_panel_verdict using that exact deal.',
      );
    }
  };
  const tools: RegisterToolArgs[] = [
    {
      name: 'start_pitch',
      description:
        'Start or replace the visible Pitch The AI session in the room already verified through get_pitch_context. Use when the founder gives a company name and ask. Equity may be 0 for a prize or non-equity contest ask. Set difficulty to easy, medium, hard, or legendary; it controls response time, pressure, scoring severity, rescue tolerance, and bid standards. This resets prior rounds, secretly varies judge patience, runs the visible 3-2-1 launch, then starts the twenty-minute clock.',
      inputSchema: {
        type: 'object',
        required: ['companyName', 'askAmount', 'equity'],
        properties: {
          founderName: { type: 'string', maxLength: 80 },
          companyName: { type: 'string', minLength: 1, maxLength: 100 },
          askAmount: { type: 'number', minimum: 0, maximum: 1000000000 },
          equity: { type: 'number', minimum: 0, maximum: 100 },
          openingPitch: { type: 'string', maxLength: 6000 },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard', 'legendary'],
            default: 'medium',
          },
        },
        additionalProperties: false,
      },
      execute: async (args) => {
        await optionsRef.current.startPitch({
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
              : optionsRef.current.getSnapshot().openingDraft,
          difficulty:
            typeof args.difficulty === 'string'
              ? (args.difficulty as PitchDifficulty)
              : optionsRef.current.getSnapshot().pitch.difficulty,
        });
        return {
          started: true,
          roomCode: optionsRef.current.getSnapshot().roomCode,
          companyName: args.companyName,
          askAmount: args.askAmount,
          equity: args.equity,
          difficulty:
            typeof args.difficulty === 'string'
              ? args.difficulty
              : optionsRef.current.getSnapshot().pitch.difficulty,
        };
      },
    },
    {
      name: 'update_pitch_details',
      description:
        'Update the visible pitch brief and the panel’s immediate room read after extracting details from the founder’s speech or text. Call as soon as the company name and ask are known, then whenever those facts or the panel mood materially change. Equity may be 0 for a prize or non-equity contest ask. Select a soundtrack that matches the tension; the founder controls whether browser audio is enabled.',
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
          equity: { type: 'number', minimum: 0, maximum: 100 },
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
        optionsRef.current.updatePitchDetails(update);
        return { updated: true, details: update };
      },
    },
    {
      name: 'get_pitch_context',
      description:
        "Read this tab's unique room code, opening draft, live pitch transcript, difficulty, founder/judge dialogue, response gate, judge-rescue gate, offer-decision gate, timer, ask, uploaded evidence links, prior offers, accepted deal, and all four judges. Equity 0 means competition mode: judge WebMCP fit, user experience, human-agent collaboration, implementation, originality, and resilience instead of pretending it is a normal investment. Verify the room code supplied by the handoff before calling start_pitch so a duplicate browser tab cannot receive the game. Before any judge enters, open and inspect every uploaded file, then call review_pitch_evidence with a grounded summary for each pending material. Run the pitch interactively: post one judge question, then call wait_for_founder_response in consecutive 12-second slices while the founder reads, clicks Respond, and answers. The response clock begins only when they click Respond, and any submitted answer remains available across slices. If a judge goes out, immediately call wait_for_judge_rescue; the founder may appeal once and the same judge must answer it. After posting offers, call wait_for_founder_offer_decision the same way and honor the founder's exact choice or counter. Never invent a founder answer or choose their deal. While the pitch is live, communicate only through Pitch The AI WebMCP tools: do not narrate tool selection, repeat judge dialogue, summarize founder answers, or post routine progress updates in chat. The host may show normal tool activity. Use chat only for a tool failure, unreadable evidence, an unrecoverable founder answer, or response latency over 10 seconds. After the final verdict, provide one concise performance report.",
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => optionsRef.current.getSnapshot(),
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
        const pending =
          optionsRef.current.getSnapshot().evidenceReview.pendingMaterialIds;
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
        optionsRef.current.reviewPitchEvidence(reviews);
        return { reviewed: true, reviews };
      },
    },
    {
      name: 'post_judge_turn',
      description:
        "Post exactly one judge turn. The arena moves that investor to a large center-stage card above the pitch controls while the other three mounted screens stay in place. The founder must click Respond before the input returns and before the difficulty-based answer clock begins. Keep it focused and under 90 spoken words. Respect pitch.difficulty: Easy coaches, Medium balances, Hard presses, Legendary is ruthless and makes offers rare. When equity is 0, use competition criteria—WebMCP fit, UX, human-agent collaboration, implementation, originality, and resilience—not ordinary investment traction. Set answerQuality to rate the founder's immediately preceding answer, or unrated for the first question. Use laughing when the pitch or answer is genuinely ridiculous; use exasperated for repetition, evasion, or silence; otherwise use neutral. When the judge asks a question, include the exact question field, then immediately call wait_for_founder_response in consecutive 12-second slices. If a slice returns waiting, call it again immediately without analysis; submitted answers persist across slices. Never post another judge while the founder gate is open. Do not politely accept a response that did not answer the question: say so directly, including “you never answered my question” when true. If state is out, outReason is required and must name the specific unanswered, disproven, or unacceptable issue; then call wait_for_judge_rescue. If judgeLifeline is pending, the recalled judge named there must speak next and ask one final question.",
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
        requireOfferDecisionComplete();
        requireNoAcceptedDeal();
        const judge = args.judge as JudgeReaction;
        requireJudgeRescueComplete(judge.judgeId);
        requireJudgeLifelineComplete(judge.judgeId);
        if (
          judge.state === 'out' &&
          (!judge.outReason || !judge.outReason.trim())
        ) {
          throw new Error(
            'An out judge must include outReason so the founder can see exactly why the investor left.',
          );
        }
        optionsRef.current.applyJudgeTurn(String(args.roundSummary), judge);
        return {
          posted: true,
          judge,
          next: judge.question
            ? 'Call wait_for_founder_response now.'
            : judge.state === 'out'
              ? 'Call wait_for_judge_rescue now. The founder has one chance to stop this judge from leaving.'
              : 'The founder may continue, or another judge may speak.',
        };
      },
    },
    {
      name: 'wait_for_founder_response',
      description:
        'Wait up to 12 seconds while the human reads the active judge, clicks Respond, and answers by voice or text. The difficulty-based response clock starts only on Respond, not when the judge speaks. A submitted answer persists across calls, and a five-second transport grace reconciles answers already in flight. If the result is waiting, call this again immediately without analysis or another judge turn. If answered, evaluate the exact response; if timed_out, burn patience.',
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
        optionsRef.current.waitForFounderResponse(
          typeof args.timeoutSeconds === 'number' ? args.timeoutSeconds : 12,
        ),
    },
    {
      name: 'wait_for_judge_rescue',
      description:
        "Wait while an out judge hangs halfway above the room. The founder may click “Wait, don't go!”, then gets exactly ten seconds to give one concrete reason the judge should stay. If answered, the same judge must respond next with post_judge_turn and may return to pressing/listening or say no and remain out. Never invent the appeal and never let another judge speak while this gate is open.",
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      execute: () => optionsRef.current.waitForJudgeRescue(),
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
        requireOfferDecisionComplete();
        requireNoAcceptedDeal();
        const judges = args.judges as JudgeReaction[];
        if (new Set(judges.map((judge) => judge.judgeId)).size !== 4) {
          throw new Error('Provide exactly one reaction for each judge.');
        }
        if (judges.some((judge) => judge.question)) {
          throw new Error(
            'Questions require post_judge_turn followed by wait_for_founder_response.',
          );
        }
        optionsRef.current.applyJudgeRound(String(args.roundSummary), judges);
        return {
          posted: true,
          round: optionsRef.current.getSnapshot().pitch.round + 1,
          judges,
        };
      },
    },
    {
      name: 'post_bid_round',
      description:
        'Put one or more visible offers on the founder’s deal table. Two or more offers create a competitive bidding round; one offer may answer a founder counter. The founder—not the agent—must then choose a judge, counter one offer, or reject them all. Immediately call wait_for_founder_offer_decision in consecutive short slices and do not continue until it returns answered or timed_out. Judges may steal, improve, or form a joint offer, but every offer must be earned by the live pitch.',
      inputSchema: {
        type: 'object',
        required: ['bids'],
        properties: {
          bids: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              required: ['judgeId', 'amount', 'equity', 'spoken'],
              properties: {
                judgeId: judgeIdSchema,
                amount: { type: 'number', minimum: 1, maximum: 1000000000 },
                equity: { type: 'number', minimum: 0, maximum: 100 },
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
        requireOfferDecisionComplete();
        requireNoAcceptedDeal();
        const bids = args.bids as Bid[];
        if (new Set(bids.map((bid) => bid.judgeId)).size !== bids.length) {
          throw new Error(
            'Each bidding judge may submit only one offer per round.',
          );
        }
        optionsRef.current.applyBidRound(bids);
        return {
          posted: true,
          bids,
          next: 'Call wait_for_founder_offer_decision now. The founder controls the deal.',
        };
      },
    },
    {
      name: 'wait_for_founder_offer_decision',
      description:
        'Wait up to 12 seconds for the founder to accept one judge’s offer, counter a specific judge with exact amount and equity, or reject every offer. The deal table keeps one shared 45-second deadline across calls. If the result is waiting, call this tool again immediately. Never choose a deal for the founder. If the founder accepts, close with post_panel_verdict using the exact accepted judge, amount, and equity. If the founder counters, let that judge accept, reject, or improve the deal through another post_bid_round.',
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
        optionsRef.current.waitForFounderOfferDecision(
          typeof args.timeoutSeconds === 'number' ? args.timeoutSeconds : 12,
        ),
    },
    {
      name: 'post_panel_verdict',
      description:
        "End the visible pitch with a 0–100 score, capital raised, and a concise roast-style arena verdict. The verdict is displayed large, so write like a ruthless game-show judge, not a professional investment memo. Call out the founder's actual evasions and unanswered questions in plain language. Repeated evasion or silence with no credible answers belongs below 15; if every judge is out and the founder never answered the core questions, score 0–8. The app enforces these caps from the turn ratings. Use amountRaised 0 when no offer is accepted or all judges are out.",
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
        requireOfferDecisionComplete();
        const snapshot = optionsRef.current.getSnapshot();
        const acceptedBid = snapshot.acceptedBid;
        const amountRaised = Number(args.amountRaised);
        const winningJudgeId = args.winningJudgeId as JudgeId | undefined;
        if (acceptedBid) {
          if (
            amountRaised !== acceptedBid.amount ||
            winningJudgeId !== acceptedBid.judgeId
          ) {
            throw new Error(
              `The founder accepted ${acceptedBid.judgeId}'s exact offer of ${acceptedBid.amount} for ${acceptedBid.equity}%. Use that amountRaised and winningJudgeId.`,
            );
          }
        } else if (amountRaised > 0) {
          throw new Error(
            'No offer was accepted by the founder. amountRaised must be 0.',
          );
        }
        const result = await optionsRef.current.finalizePitch({
          score: Number(args.score),
          summary: String(args.summary),
          amountRaised,
          winningJudgeId,
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
      execute: async () => ({
        entries: await optionsRef.current.fetchLeaderboard(),
      }),
    },
  ];

  void Promise.all(tools.map(add))
    .then(() => {
      if (!registration.disposed) optionsRef.current.onStatus('ready');
    })
    .catch(() => {
      if (!registration.disposed) optionsRef.current.onStatus('browser-only');
    });

  return () => releasePitchToolRegistration(registration);
}
