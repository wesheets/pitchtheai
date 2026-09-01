'use client';

import {
  Activity,
  ArrowUpRight,
  AudioLines,
  Building2,
  Camera,
  CameraOff,
  ChevronDown,
  Clock3,
  CircleStop,
  CircleDollarSign,
  Bug,
  Download,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  LifeBuoy,
  Mic,
  MicOff,
  Music2,
  Paperclip,
  PieChart,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Trophy,
  UserRound,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { requestPitchAgent } from '@/lib/agent-handoff';
import {
  getVoiceProvider,
  speakJudge,
  type VoiceProvider,
} from '@/lib/judge-voice-client';
import { startSoundtrack, type Soundtrack } from '@/lib/soundtrack';
import { registerPitchTools } from '@/lib/webmcp';

export type JudgeId = 'maya' | 'julian' | 'priya' | 'theo';
export type JudgeState = 'listening' | 'pressing' | 'bidding' | 'out';
export type JudgeMood = 'skeptical' | 'intrigued' | 'impressed';
export type JudgeReactionStyle = 'neutral' | 'laughing' | 'exasperated';
export type PitchDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';
export type AnswerQuality =
  | 'unrated'
  | 'unanswered'
  | 'evasive'
  | 'weak'
  | 'credible'
  | 'exceptional';
export type JudgeReaction = {
  judgeId: JudgeId;
  state: JudgeState;
  interest: number;
  mood: JudgeMood;
  spoken: string;
  question?: string;
  reactionStyle?: JudgeReactionStyle;
  answerQuality?: AnswerQuality;
  outReason?: string;
  presentationReset?: boolean;
};
export type Bid = {
  judgeId: JudgeId;
  amount: number;
  equity: number;
  conditions?: string;
  spoken: string;
};
export type OfferDecision = {
  status: 'idle' | 'choosing' | 'answered' | 'timed_out';
  action?: 'accept' | 'counter' | 'pass';
  judgeId?: JudgeId;
  amount?: number;
  equity?: number;
  note?: string;
  deadline?: number;
};
export type LeaderboardEntry = {
  id: string;
  founderName: string;
  companyName: string;
  score: number;
  amountRaised: number;
  askAmount: number;
  durationSeconds: number;
  createdAt: number;
};
export type WebMcpToolCall = {
  name: string;
  count: number;
};
export type PitchMaterial = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: number;
};
export type PitchFeedEntry = {
  id: string;
  kind: 'judge' | 'founder' | 'system';
  author: string;
  text: string;
  judgeId?: JudgeId;
  createdAt: number;
  streaming?: boolean;
};
export type FounderTurnState = {
  status: 'open' | 'presenting' | 'awaiting' | 'answered' | 'timed_out';
  judgeId?: JudgeId;
  question?: string;
  deadline?: number;
  lastResponse?: string;
};
export type JudgeRescueState = {
  status:
    | 'idle'
    | 'offered'
    | 'awaiting'
    | 'answered'
    | 'saved'
    | 'declined'
    | 'timed_out';
  judgeId?: JudgeId;
  outReason?: string;
  response?: string;
  deadline?: number;
};
export type JudgeLifelineState = {
  status: 'available' | 'selecting' | 'pending' | 'resolved';
  judgeId?: JudgeId;
  usedAt?: number;
};
export type PresentationResetState = {
  status: 'idle' | 'awaiting' | 'captured' | 'reviewed';
  judgeId?: JudgeId;
  reason?: string;
  requestedAt?: number;
  materialId?: string;
  usedAt?: number;
};
export type EvidenceReview = {
  materialId: string;
  summary: string;
  reviewedAt: number;
};
type PitchStatus = 'lobby' | 'live' | 'final';
type ArenaToolEvent = {
  id: string;
  toolName: string;
  phase: 'called' | 'complete' | 'error';
  createdAt: number;
};

function summarizeToolCalls(events: ArenaToolEvent[]): WebMcpToolCall[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.phase !== 'called') continue;
    counts.set(event.toolName, (counts.get(event.toolName) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}
export type PanelMood =
  | 'skeptical'
  | 'surprised'
  | 'impressed'
  | 'tense'
  | 'confused'
  | 'excited'
  | 'disappointed';
type PitchState = {
  founderName: string;
  companyName: string;
  agentSignature: string;
  pitchVenue: string;
  askAmount: number;
  equity: number;
  openingPitch: string;
  transcript: string;
  status: PitchStatus;
  round: number;
  secondsLeft: number;
  favorability: number;
  mood: PanelMood;
  soundtrack: Soundtrack;
  difficulty: PitchDifficulty;
  summary?: string;
  score?: number;
  amountRaised?: number;
  durationSeconds?: number;
  startedAt?: number;
};
export type PitchDetailsUpdate = {
  founderName?: string;
  companyName: string;
  askAmount: number;
  equity: number;
  favorability: number;
  mood: PanelMood;
  soundtrack: Soundtrack;
};
type PanelProfile = {
  rivalry: string;
  curveball: string;
  judges: Record<
    JudgeId,
    { patience: 'short' | 'medium' | 'long'; secretHook: string }
  >;
};

type QueuedPitchSession = {
  version: 1;
  roomCode: string;
  founderName: string;
  companyName: string;
  askAmount: number;
  equity: number;
  openingPitch: string;
  handoffMessage: string;
  difficulty?: PitchDifficulty;
};

const JUDGES: Array<{
  id: JudgeId;
  name: string;
  role: string;
  initials: string;
  color: string;
  portrait: string;
}> = [
  {
    id: 'maya',
    name: 'Maya Cross',
    role: 'Market realist',
    initials: 'MC',
    color: '#65e6ff',
    portrait: '/judges/maya-cross-sprite.png',
  },
  {
    id: 'julian',
    name: 'Julian Voss',
    role: 'Brand contrarian',
    initials: 'JV',
    color: '#bc9cff',
    portrait: '/judges/julian-voss-sprite.png',
  },
  {
    id: 'priya',
    name: 'Priya Nair',
    role: 'Unit economics',
    initials: 'PN',
    color: '#ffc857',
    portrait: '/judges/priya-nair-sprite.png',
  },
  {
    id: 'theo',
    name: 'Theo Grant',
    role: 'Scale operator',
    initials: 'TG',
    color: '#ff7189',
    portrait: '/judges/theo-grant-sprite.png',
  },
];

const DEFAULT_PITCH: PitchState = {
  founderName: '',
  companyName: '',
  agentSignature: 'Unspecified WebMCP agent',
  pitchVenue: 'Attached WebMCP browser',
  askAmount: 0,
  equity: 0,
  openingPitch: '',
  transcript: '',
  status: 'lobby',
  round: 0,
  secondsLeft: 20 * 60,
  favorability: 50,
  mood: 'skeptical',
  soundtrack: 'cinematic',
  difficulty: 'medium',
};

const DIFFICULTY_META: Record<
  PitchDifficulty,
  { label: string; responseSeconds: number; description: string }
> = {
  easy: {
    label: 'Easy',
    responseSeconds: 90,
    description: 'Coaching room · generous follow-ups',
  },
  medium: {
    label: 'Medium',
    responseSeconds: 75,
    description: 'Balanced room · honest pressure',
  },
  hard: {
    label: 'Hard',
    responseSeconds: 60,
    description: 'Sharper questions · stricter scoring',
  },
  legendary: {
    label: 'Legendary',
    responseSeconds: 45,
    description: 'No mercy · proof or perish',
  },
};

function responseWindow(difficulty: PitchDifficulty) {
  return DIFFICULTY_META[difficulty].responseSeconds;
}

const ROOM_CODE_STORAGE_KEY = 'pitchtheai.room-code.v1';
const QUEUED_PITCH_STORAGE_KEY = 'pitchtheai.queued-pitch.v1';

function createRoomCode() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
}

function validRoomCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-F0-9]{6}$/.test(value);
}

function readQueuedPitchSession(): QueuedPitchSession | null {
  try {
    const raw = window.sessionStorage.getItem(QUEUED_PITCH_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<QueuedPitchSession>;
    if (
      value.version !== 1 ||
      !validRoomCode(value.roomCode) ||
      typeof value.founderName !== 'string' ||
      typeof value.companyName !== 'string' ||
      typeof value.askAmount !== 'number' ||
      typeof value.equity !== 'number' ||
      typeof value.openingPitch !== 'string' ||
      typeof value.handoffMessage !== 'string' ||
      (value.difficulty !== undefined &&
        !['easy', 'medium', 'hard', 'legendary'].includes(value.difficulty))
    )
      return null;
    return value as QueuedPitchSession;
  } catch {
    return null;
  }
}

function writeRoomCode(roomCode: string) {
  try {
    window.sessionStorage.setItem(ROOM_CODE_STORAGE_KEY, roomCode);
  } catch {
    // The room still works for this page load when browser storage is disabled.
  }
}

function syncRoomAddress(roomCode: string) {
  try {
    const roomHash = `#room=${roomCode}`;
    if (window.location.hash !== roomHash) {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}${roomHash}`,
      );
    }
    document.title = `Pitch The AI — Room ${roomCode}`;
  } catch {
    // The room-code guard still prevents cross-tab starts when URL state is unavailable.
  }
}

function readRoomCode() {
  try {
    return window.sessionStorage.getItem(ROOM_CODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeQueuedPitchSession(session: QueuedPitchSession) {
  writeRoomCode(session.roomCode);
  try {
    window.sessionStorage.setItem(
      QUEUED_PITCH_STORAGE_KEY,
      JSON.stringify(session),
    );
  } catch {
    // The copied handoff remains valid for this page load.
  }
}

function clearQueuedPitchSession() {
  try {
    window.sessionStorage.removeItem(QUEUED_PITCH_STORAGE_KEY);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

const MOOD_META: Record<PanelMood, { emoji: string; label: string }> = {
  skeptical: { emoji: '🤨', label: 'Skeptical' },
  surprised: { emoji: '😮', label: 'Surprised' },
  impressed: { emoji: '🤩', label: 'Impressed' },
  tense: { emoji: '😬', label: 'Tense' },
  confused: { emoji: '🤔', label: 'Confused' },
  excited: { emoji: '🚀', label: 'Excited' },
  disappointed: { emoji: '😑', label: 'Disappointed' },
};
const DEFAULT_REACTIONS = Object.fromEntries(
  JUDGES.map((judge) => [
    judge.id,
    {
      judgeId: judge.id,
      state: 'listening',
      interest: 50,
      mood: 'skeptical',
      spoken: 'Waiting for the pitch.',
    } satisfies JudgeReaction,
  ]),
) as Record<JudgeId, JudgeReaction>;

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}
function createPanelProfile(): PanelProfile {
  const patience = ['short', 'medium', 'long'] as const;
  return {
    rivalry: randomItem([
      'Maya and Julian want to beat each other on this deal.',
      'Priya distrusts Theo’s growth-at-all-costs instincts.',
      'Theo will try to steal any deal Maya validates.',
      'Julian and Priya may surprise everyone with a joint offer.',
    ]),
    curveball: randomItem([
      'Ask how the business survives losing its largest customer.',
      'Demand a version of the pitch that works with half the requested capital.',
      'Challenge the founder to explain the product to a skeptical twelve-year-old.',
      'Reveal a hypothetical fast-follower and ask what remains defensible.',
      'No forced curveball this game; let the pitch create the drama.',
    ]),
    judges: {
      maya: {
        patience: randomItem(patience),
        secretHook:
          'Concrete distribution evidence can reverse her skepticism.',
      },
      julian: {
        patience: randomItem(patience),
        secretHook:
          'A memorable customer story matters more to him than a large market slide.',
      },
      priya: {
        patience: randomItem(patience),
        secretHook:
          'Inconsistent numbers make her leave quickly; crisp margins make her compete.',
      },
      theo: {
        patience: randomItem(patience),
        secretHook:
          'He wants proof the founder can execute under an ugly constraint.',
      },
    },
  };
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}
function pitchAskLabel(askAmount: number, equity: number) {
  return equity <= 0
    ? `${money(askAmount)} prize · no equity`
    : `${money(askAmount)} for ${equity}%`;
}
function clampInterest(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function stateLabel(state: JudgeState) {
  if (state === 'out') return "I'm out";
  if (state === 'bidding') return 'Offer live';
  if (state === 'pressing') return 'Patience fading';
  return 'Listening';
}
function portraitPosition(mood: JudgeMood) {
  if (mood === 'intrigued') return '50%';
  if (mood === 'impressed') return '100%';
  return '0%';
}
function reactionPortraitStyle(
  judge: (typeof JUDGES)[number],
  reaction: JudgeReaction,
) {
  if (!reaction.reactionStyle || reaction.reactionStyle === 'neutral') {
    return {
      backgroundImage: `url(${judge.portrait})`,
      backgroundPositionX: portraitPosition(reaction.mood),
      backgroundPositionY: 'center',
      backgroundSize: '300% 100%',
    };
  }
  const column = JUDGES.findIndex((item) => item.id === judge.id);
  return {
    backgroundImage: 'url(/judges/judge-reactions-sprite.png)',
    backgroundPositionX: `${(column / 3) * 100}%`,
    backgroundPositionY: reaction.reactionStyle === 'laughing' ? '0%' : '100%',
    backgroundSize: '400% 200%',
  };
}

const EMPTY_ANSWER_QUALITY: Record<AnswerQuality, number> = {
  unrated: 0,
  unanswered: 0,
  evasive: 0,
  weak: 0,
  credible: 0,
  exceptional: 0,
};

export function PitchArena() {
  const [pitch, setPitch] = useState<PitchState>(DEFAULT_PITCH);
  const [reactions, setReactions] =
    useState<Record<JudgeId, JudgeReaction>>(DEFAULT_REACTIONS);
  const [bids, setBids] = useState<Bid[]>([]);
  const [offerDecision, setOfferDecision] = useState<OfferDecision>({
    status: 'idle',
  });
  const [acceptedBid, setAcceptedBid] = useState<Bid | null>(null);
  const [counteringJudgeId, setCounteringJudgeId] = useState<JudgeId | null>(
    null,
  );
  const [counterAmount, setCounterAmount] = useState('');
  const [counterEquity, setCounterEquity] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('checking');
  const [speakingJudge, setSpeakingJudge] = useState<JudgeId | null>(null);
  const [focusedJudgeId, setFocusedJudgeId] = useState<JudgeId | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [launchCount, setLaunchCount] = useState<3 | 2 | 1 | null>(null);
  const [roomCode, setRoomCode] = useState('------');
  const [roomReady, setRoomReady] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [panelProfile, setPanelProfile] = useState<PanelProfile>(() =>
    createPanelProfile(),
  );
  const [materials, setMaterials] = useState<PitchMaterial[]>([]);
  const [evidenceReviews, setEvidenceReviews] = useState<
    Record<string, EvidenceReview>
  >({});
  const [feed, setFeed] = useState<PitchFeedEntry[]>([]);
  const [founderTurn, setFounderTurn] = useState<FounderTurnState>({
    status: 'open',
  });
  const [judgeRescue, setJudgeRescue] = useState<JudgeRescueState>({
    status: 'idle',
  });
  const [judgeLifeline, setJudgeLifeline] = useState<JudgeLifelineState>({
    status: 'available',
  });
  const [presentationReset, setPresentationReset] =
    useState<PresentationResetState>({ status: 'idle' });
  const [responseSecondsLeft, setResponseSecondsLeft] = useState(45);
  const [musicLevel, setMusicLevel] = useState(0.42);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [toolStatus, setToolStatus] = useState<
    'checking' | 'ready' | 'browser-only'
  >('checking');
  const [toolEvents, setToolEvents] = useState<ArenaToolEvent[]>([]);
  const [utilityPanel, setUtilityPanel] = useState<
    'activity' | 'transcript' | 'report' | null
  >(null);
  const [issueDraft, setIssueDraft] = useState('');
  const [recordingSession, setRecordingSession] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<
    'off' | 'requesting' | 'live' | 'error'
  >('off');
  const [cameraMode, setCameraMode] = useState<'photo' | 'live' | null>(null);
  const [cameraMessage, setCameraMessage] = useState('');
  const [publishFounderPhoto, setPublishFounderPhoto] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<
    'idle' | 'requesting' | 'waiting' | 'connected' | 'error'
  >('idle');
  const [handoffMessage, setHandoffMessage] = useState('');
  const pitchRef = useRef(pitch);
  const reactionsRef = useRef(reactions);
  const bidsRef = useRef(bids);
  const offerDecisionRef = useRef(offerDecision);
  const acceptedBidRef = useRef(acceptedBid);
  const leaderboardRef = useRef(leaderboard);
  const voiceOnRef = useRef(voiceOn);
  const materialsRef = useRef(materials);
  const draftRef = useRef(draft);
  const evidenceReviewsRef = useRef(evidenceReviews);
  const feedRef = useRef(feed);
  const founderTurnRef = useRef(founderTurn);
  const judgeRescueRef = useRef(judgeRescue);
  const judgeLifelineRef = useRef(judgeLifeline);
  const presentationResetRef = useRef(presentationReset);
  const appealedJudgeIdsRef = useRef<Set<JudgeId>>(new Set());
  const answerQualityRef = useRef<Record<AnswerQuality, number>>({
    ...EMPTY_ANSWER_QUALITY,
  });
  const responseWaiterRef = useRef<{
    resolve: (value: Record<string, unknown>) => void;
    timer: number;
  } | null>(null);
  const offerWaiterRef = useRef<{
    resolve: (value: Record<string, unknown>) => void;
    timer: number;
  } | null>(null);
  const rescueWaiterRef = useRef<{
    resolve: (value: Record<string, unknown>) => void;
    timer: number;
  } | null>(null);
  const presentationResetWaiterRef = useRef<{
    resolve: (value: Record<string, unknown>) => void;
    timer: number;
  } | null>(null);
  const panelProfileRef = useRef(panelProfile);
  const sessionIdRef = useRef(
    typeof window === 'undefined' ? '' : crypto.randomUUID(),
  );
  const launchTokenRef = useRef(0);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundtrackStopRef = useRef<(() => void) | null>(null);
  const heartbeatStopRef = useRef<(() => void) | null>(null);
  const toolEventsRef = useRef<ArenaToolEvent[]>([]);
  const publishFounderPhotoRef = useRef(false);
  const twoMinuteWarningRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const activeVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceProviderRef = useRef<VoiceProvider>('checking');
  const responseInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const displayRecordingStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const recordingDrawTimerRef = useRef<number | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const hydrateRoom = window.setTimeout(() => {
      const queued = readQueuedPitchSession();
      const storedRoomCode = readRoomCode();
      const restoredRoomCode = queued?.roomCode ?? storedRoomCode;
      const nextRoomCode = validRoomCode(restoredRoomCode)
        ? restoredRoomCode
        : createRoomCode();

      writeRoomCode(nextRoomCode);
      syncRoomAddress(nextRoomCode);
      setRoomCode(nextRoomCode);

      if (queued && queued.roomCode === nextRoomCode) {
        const restoredPitch: PitchState = {
          ...DEFAULT_PITCH,
          founderName: queued.founderName,
          companyName: queued.companyName,
          askAmount: queued.askAmount,
          equity: queued.equity,
          difficulty: queued.difficulty ?? 'medium',
        };
        pitchRef.current = restoredPitch;
        draftRef.current = queued.openingPitch;
        setPitch(restoredPitch);
        setDraft(queued.openingPitch);
        setHandoffStatus('waiting');
        setHandoffMessage(queued.handoffMessage);
      }

      setRoomReady(true);
    }, 0);
    return () => window.clearTimeout(hydrateRoom);
  }, []);

  useEffect(() => {
    pitchRef.current = pitch;
  }, [pitch]);
  useEffect(() => {
    reactionsRef.current = reactions;
  }, [reactions]);
  useEffect(() => {
    bidsRef.current = bids;
  }, [bids]);
  useEffect(() => {
    offerDecisionRef.current = offerDecision;
  }, [offerDecision]);
  useEffect(() => {
    acceptedBidRef.current = acceptedBid;
  }, [acceptedBid]);
  useEffect(() => {
    leaderboardRef.current = leaderboard;
  }, [leaderboard]);
  useEffect(() => {
    publishFounderPhotoRef.current = publishFounderPhoto;
  }, [publishFounderPhoto]);
  useEffect(() => {
    materialsRef.current = materials;
  }, [materials]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    evidenceReviewsRef.current = evidenceReviews;
  }, [evidenceReviews]);
  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);
  useEffect(() => {
    founderTurnRef.current = founderTurn;
  }, [founderTurn]);
  useEffect(() => {
    judgeRescueRef.current = judgeRescue;
  }, [judgeRescue]);
  useEffect(() => {
    judgeLifelineRef.current = judgeLifeline;
  }, [judgeLifeline]);
  useEffect(() => {
    presentationResetRef.current = presentationReset;
  }, [presentationReset]);
  useEffect(() => {
    panelProfileRef.current = panelProfile;
  }, [panelProfile]);
  useEffect(() => {
    voiceOnRef.current = voiceOn;
  }, [voiceOn]);
  useEffect(() => {
    voiceProviderRef.current = voiceProvider;
  }, [voiceProvider]);
  useEffect(() => {
    let active = true;
    void getVoiceProvider().then((provider) => {
      if (active) setVoiceProvider(provider);
    });
    return () => {
      active = false;
      voiceAbortRef.current?.abort();
      activeVoiceAudioRef.current?.pause();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    const video = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    if (cameraStatus !== 'live' || !video || !stream) return;
    video.srcObject = stream;
    const handleReady = () => {
      setCameraMessage(
        cameraMode === 'photo'
          ? 'Camera preview ready. Capture a still when you are ready.'
          : 'Founder video is live in the lower-left corner.',
      );
    };
    video.addEventListener('loadeddata', handleReady, { once: true });
    void video.play().catch(() => {
      setCameraMessage(
        'Camera permission opened, but this browser could not display the preview. Use Upload instead or open the game in Chrome.',
      );
    });
    const previewTimer = window.setTimeout(() => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        setCameraMessage(
          'Camera permission opened, but no preview arrived. Use Upload instead or open the game in Chrome.',
        );
      }
    }, 4_000);
    return () => {
      window.clearTimeout(previewTimer);
      video.removeEventListener('loadeddata', handleReady);
    };
  }, [cameraMode, cameraStatus]);

  const enableMusic = useCallback(async () => {
    const AudioContextClass = window.AudioContext;
    if (!audioContextRef.current)
      audioContextRef.current = new AudioContextClass();
    await audioContextRef.current.resume();
    window.sessionStorage.setItem('pitchtheai:music', 'on');
    setMusicOn(true);
  }, []);

  useEffect(() => {
    if (window.sessionStorage.getItem('pitchtheai:music') !== 'on') return;
    const resumeTimer = window.setTimeout(() => void enableMusic(), 0);
    return () => window.clearTimeout(resumeTimer);
  }, [enableMusic]);

  const activeSoundtrack =
    launchCount !== null ? 'cinematic' : pitch.soundtrack;
  const heartbeatActive =
    pitch.status === 'live' &&
    (founderTurn.status === 'awaiting' || pitch.secondsLeft <= 120);

  useEffect(() => {
    soundtrackStopRef.current?.();
    soundtrackStopRef.current = null;
    const context = audioContextRef.current;
    if (!musicOn || !context || activeSoundtrack === 'silence') return;
    const stop = startSoundtrack(context, activeSoundtrack, musicLevel);
    soundtrackStopRef.current = stop;
    return () => {
      stop();
      soundtrackStopRef.current = null;
    };
  }, [activeSoundtrack, musicLevel, musicOn]);

  useEffect(() => {
    heartbeatStopRef.current?.();
    heartbeatStopRef.current = null;
    const context = audioContextRef.current;
    if (!musicOn || !context || !heartbeatActive) return;
    const stop = startSoundtrack(context, 'heartbeat', musicLevel * 0.38);
    heartbeatStopRef.current = stop;
    return () => {
      stop();
      heartbeatStopRef.current = null;
    };
  }, [heartbeatActive, musicLevel, musicOn]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/leaderboard', { cache: 'no-store' });
      if (!response.ok) throw new Error('Leaderboard unavailable');
      const data = (await response.json()) as { entries: LeaderboardEntry[] };
      setLeaderboard(data.entries);
      return data.entries;
    } catch {
      return leaderboardRef.current;
    }
  }, []);
  useEffect(() => {
    const request = window.setTimeout(() => void fetchLeaderboard(), 0);
    return () => window.clearTimeout(request);
  }, [fetchLeaderboard]);

  const stopVoices = useCallback(() => {
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    activeVoiceAudioRef.current?.pause();
    activeVoiceAudioRef.current = null;
    window.speechSynthesis?.cancel();
    setSpeakingJudge(null);
  }, []);

  const appendFeed = useCallback(
    (entry: Omit<PitchFeedEntry, 'id' | 'createdAt'>) => {
      const next = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
      setFeed((current) => [...current.slice(-39), next]);
      return next.id;
    },
    [],
  );

  const speak = useCallback(
    (lines: Array<{ judgeId: JudgeId; text: string }>) => {
      if (typeof window === 'undefined') return;
      stopVoices();
      const controller = new AbortController();
      voiceAbortRef.current = controller;
      void (async () => {
        for (const line of lines) {
          if (controller.signal.aborted) break;
          const judge = JUDGES.find((item) => item.id === line.judgeId)!;
          let feedId = '';
          const beginFeed = () => {
            if (feedId) return;
            setSpeakingJudge(line.judgeId);
            const next = {
              id: crypto.randomUUID(),
              kind: 'judge' as const,
              author: judge.name,
              judgeId: line.judgeId,
              text: voiceOnRef.current ? '' : line.text,
              createdAt: Date.now(),
              streaming: voiceOnRef.current,
            };
            feedId = next.id;
            setFeed((current) => [...current.slice(-39), next]);
          };
          if (!voiceOnRef.current) {
            beginFeed();
            continue;
          }
          try {
            const provider = await speakJudge(
              line.judgeId,
              line.text,
              voiceProviderRef.current,
              controller.signal,
              (audio) => {
                activeVoiceAudioRef.current = audio;
              },
              {
                onStart: beginFeed,
                onProgress: (visibleText) => {
                  beginFeed();
                  setFeed((current) =>
                    current.map((entry) =>
                      entry.id === feedId
                        ? { ...entry, text: visibleText }
                        : entry,
                    ),
                  );
                },
              },
            );
            if (
              provider === 'browser' &&
              voiceProviderRef.current !== 'browser'
            )
              setVoiceProvider('browser');
          } catch {
            if (!controller.signal.aborted) setVoiceProvider('browser');
          } finally {
            beginFeed();
            setFeed((current) =>
              current.map((entry) =>
                entry.id === feedId
                  ? { ...entry, text: line.text, streaming: false }
                  : entry,
              ),
            );
            setSpeakingJudge((current) =>
              current === line.judgeId ? null : current,
            );
          }
        }
        if (voiceAbortRef.current === controller) voiceAbortRef.current = null;
      })();
    },
    [stopVoices],
  );

  const startPitch = useCallback(
    async (next?: Partial<PitchState>) => {
      clearQueuedPitchSession();
      const launchToken = launchTokenRef.current + 1;
      launchTokenRef.current = launchToken;
      if (responseWaiterRef.current) {
        window.clearTimeout(responseWaiterRef.current.timer);
        responseWaiterRef.current.resolve({ status: 'replaced' });
        responseWaiterRef.current = null;
      }
      if (offerWaiterRef.current) {
        window.clearTimeout(offerWaiterRef.current.timer);
        offerWaiterRef.current.resolve({ status: 'replaced' });
        offerWaiterRef.current = null;
      }
      const openingPitch = next?.transcript?.trim() || draftRef.current.trim();
      const nextPitch: PitchState = {
        ...DEFAULT_PITCH,
        ...next,
        openingPitch,
        transcript: openingPitch,
        status: 'live',
        round: 0,
        secondsLeft: 20 * 60,
        soundtrack: next?.soundtrack ?? 'game',
        startedAt: Date.now(),
      };
      reactionsRef.current = DEFAULT_REACTIONS;
      setReactions(DEFAULT_REACTIONS);
      setPanelProfile(createPanelProfile());
      setBids([]);
      offerDecisionRef.current = { status: 'idle' };
      setOfferDecision({ status: 'idle' });
      acceptedBidRef.current = null;
      setAcceptedBid(null);
      setCounteringJudgeId(null);
      setCounterAmount('');
      setCounterEquity('');
      setCounterNote('');
      setDraft('');
      setFocusedJudgeId(null);
      setComposerOpen(false);
      answerQualityRef.current = { ...EMPTY_ANSWER_QUALITY };
      setFeed(
        openingPitch
          ? [
              {
                id: crypto.randomUUID(),
                kind: 'founder',
                author: 'Founder',
                text: openingPitch,
                createdAt: Date.now(),
              },
            ]
          : [],
      );
      setFounderTurn({ status: 'open' });
      judgeRescueRef.current = { status: 'idle' };
      setJudgeRescue({ status: 'idle' });
      judgeLifelineRef.current = { status: 'available' };
      setJudgeLifeline({ status: 'available' });
      presentationResetRef.current = { status: 'idle' };
      setPresentationReset({ status: 'idle' });
      appealedJudgeIdsRef.current.clear();
      setResponseSecondsLeft(responseWindow(nextPitch.difficulty));
      twoMinuteWarningRef.current = false;
      setHandoffStatus('connected');
      setHandoffMessage('Agent connected. Entering the room…');
      stopVoices();
      for (const count of [3, 2, 1] as const) {
        if (launchTokenRef.current !== launchToken) return;
        setLaunchCount(count);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 850));
      }
      if (launchTokenRef.current !== launchToken) return;
      setLaunchCount(null);
      pitchRef.current = nextPitch;
      setPitch(nextPitch);
      setHandoffMessage('Agent connected. The panel is live.');
    },
    [stopVoices],
  );
  const requestAgent = useCallback(async () => {
    if (!roomReady || !validRoomCode(roomCode)) {
      setHandoffStatus('error');
      setHandoffMessage('The room is still initializing. Try again.');
      return;
    }
    const companyName = pitch.companyName.trim();
    const founderName = pitch.founderName.trim();
    if (!founderName) {
      setHandoffStatus('error');
      setHandoffMessage('Type your founder name before entering the room.');
      return;
    }
    if (!companyName) {
      setHandoffStatus('error');
      setHandoffMessage('Type your venture or pitch name first.');
      return;
    }
    if (pitch.askAmount <= 0) {
      setHandoffStatus('error');
      setHandoffMessage('Enter the amount you are asking the room for.');
      return;
    }
    if (!draft.trim()) {
      setHandoffStatus('error');
      setHandoffMessage('Write or dictate your opening pitch first.');
      return;
    }
    setHandoffStatus('requesting');
    setHandoffMessage('Handing the room to your agent…');
    try {
      await enableMusic();
      await requestPitchAgent({
        roomCode,
        roomUrl: window.location.href,
        founderName,
        companyName,
        askAmount: pitch.askAmount,
        equity: pitch.equity,
        difficulty: pitch.difficulty,
        pitch: draft,
      });
      if (pitchRef.current.status === 'live') return;
      const waitingMessage =
        'Panel prompt copied. Paste and send it to your browser agent; the clock starts when it joins.';
      writeQueuedPitchSession({
        version: 1,
        roomCode,
        founderName,
        companyName,
        askAmount: pitch.askAmount,
        equity: pitch.equity,
        difficulty: pitch.difficulty,
        openingPitch: draft,
        handoffMessage: waitingMessage,
      });
      setHandoffStatus('waiting');
      setHandoffMessage(waitingMessage);
    } catch (error) {
      setHandoffStatus('error');
      setHandoffMessage(
        error instanceof Error
          ? error.message
          : 'The agent handoff did not start.',
      );
    }
  }, [draft, enableMusic, pitch, roomCode, roomReady]);
  const updatePitchDetails = useCallback((update: PitchDetailsUpdate) => {
    setPitch((current) => ({
      ...current,
      founderName: update.founderName?.trim() || current.founderName,
      companyName: update.companyName.trim() || current.companyName,
      askAmount: Math.max(0, Math.round(update.askAmount)),
      equity: Math.max(0, Math.min(100, update.equity)),
      favorability: clampInterest(update.favorability),
      mood: update.mood,
      soundtrack: update.soundtrack,
    }));
  }, []);
  const resetPitch = useCallback(() => {
    clearQueuedPitchSession();
    launchTokenRef.current += 1;
    setLaunchCount(null);
    setPitch(DEFAULT_PITCH);
    setReactions(DEFAULT_REACTIONS);
    setBids([]);
    offerDecisionRef.current = { status: 'idle' };
    setOfferDecision({ status: 'idle' });
    acceptedBidRef.current = null;
    setAcceptedBid(null);
    setCounteringJudgeId(null);
    setCounterAmount('');
    setCounterEquity('');
    setCounterNote('');
    setDraft('');
    setPublishFounderPhoto(false);
    toolEventsRef.current = [];
    setToolEvents([]);
    setFocusedJudgeId(null);
    setComposerOpen(false);
    setFeed([]);
    setFounderTurn({ status: 'open' });
    judgeRescueRef.current = { status: 'idle' };
    setJudgeRescue({ status: 'idle' });
    judgeLifelineRef.current = { status: 'available' };
    setJudgeLifeline({ status: 'available' });
    presentationResetRef.current = { status: 'idle' };
    setPresentationReset({ status: 'idle' });
    appealedJudgeIdsRef.current.clear();
    setEvidenceReviews({});
    answerQualityRef.current = { ...EMPTY_ANSWER_QUALITY };
    twoMinuteWarningRef.current = false;
    soundtrackStopRef.current?.();
    soundtrackStopRef.current = null;
    heartbeatStopRef.current?.();
    heartbeatStopRef.current = null;
    setMusicOn(false);
    if (responseWaiterRef.current) {
      window.clearTimeout(responseWaiterRef.current.timer);
      responseWaiterRef.current.resolve({ status: 'cancelled' });
      responseWaiterRef.current = null;
    }
    if (offerWaiterRef.current) {
      window.clearTimeout(offerWaiterRef.current.timer);
      offerWaiterRef.current.resolve({ status: 'cancelled' });
      offerWaiterRef.current = null;
    }
    if (rescueWaiterRef.current) {
      window.clearInterval(rescueWaiterRef.current.timer);
      rescueWaiterRef.current.resolve({ status: 'cancelled' });
      rescueWaiterRef.current = null;
    }
    if (presentationResetWaiterRef.current) {
      window.clearInterval(presentationResetWaiterRef.current.timer);
      presentationResetWaiterRef.current.resolve({ status: 'cancelled' });
      presentationResetWaiterRef.current = null;
    }
    stopVoices();
  }, [stopVoices]);

  const applyJudgeTurn = useCallback(
    (roundSummary: string, reaction: JudgeReaction) => {
      if (
        offerDecisionRef.current.status === 'answered' &&
        !acceptedBidRef.current
      ) {
        offerDecisionRef.current = { status: 'idle' };
        setOfferDecision({ status: 'idle' });
        bidsRef.current = [];
        setBids([]);
      }
      const answerQuality = reaction.answerQuality ?? 'unrated';
      const normalized: JudgeReaction = {
        ...reaction,
        interest: clampInterest(reaction.interest),
        reactionStyle: reaction.reactionStyle ?? 'neutral',
        answerQuality,
      };
      const activePresentationReset = presentationResetRef.current;
      if (
        activePresentationReset.status === 'reviewed' &&
        activePresentationReset.judgeId === reaction.judgeId
      ) {
        const resolvedPresentationReset: PresentationResetState = {
          status: 'idle',
          usedAt: activePresentationReset.usedAt,
        };
        presentationResetRef.current = resolvedPresentationReset;
        setPresentationReset(resolvedPresentationReset);
      }
      if (reaction.presentationReset) {
        const nextPresentationReset: PresentationResetState = {
          status: 'awaiting',
          judgeId: reaction.judgeId,
          reason: reaction.spoken,
          requestedAt: Date.now(),
          usedAt: Date.now(),
        };
        presentationResetRef.current = nextPresentationReset;
        setPresentationReset(nextPresentationReset);
        appendFeed({
          kind: 'system',
          author: 'Arena',
          text: 'Presentation reset requested. The room clock is paused until a new founder photo is reviewed.',
        });
      }
      if (
        judgeLifelineRef.current.status === 'pending' &&
        judgeLifelineRef.current.judgeId === reaction.judgeId
      ) {
        const resolvedLifeline: JudgeLifelineState = {
          ...judgeLifelineRef.current,
          status: 'resolved',
        };
        judgeLifelineRef.current = resolvedLifeline;
        setJudgeLifeline(resolvedLifeline);
      }
      const currentRescue = judgeRescueRef.current;
      if (
        currentRescue.status === 'answered' &&
        currentRescue.judgeId === reaction.judgeId
      ) {
        const resolvedRescue: JudgeRescueState = {
          ...currentRescue,
          status: reaction.state === 'out' ? 'declined' : 'saved',
          outReason: reaction.outReason ?? currentRescue.outReason,
        };
        judgeRescueRef.current = resolvedRescue;
        setJudgeRescue(resolvedRescue);
        appendFeed({
          kind: 'system',
          author: 'Arena',
          text:
            reaction.state === 'out'
              ? `${JUDGES.find((judge) => judge.id === reaction.judgeId)?.name ?? 'The judge'} heard the appeal and left anyway.`
              : `${JUDGES.find((judge) => judge.id === reaction.judgeId)?.name ?? 'The judge'} is back in the room—for now.`,
        });
      } else if (
        reaction.state === 'out' &&
        !appealedJudgeIdsRef.current.has(reaction.judgeId)
      ) {
        const offeredRescue: JudgeRescueState = {
          status: 'offered',
          judgeId: reaction.judgeId,
          outReason: reaction.outReason ?? reaction.spoken,
          deadline: Date.now() + 20_000,
        };
        judgeRescueRef.current = offeredRescue;
        setJudgeRescue(offeredRescue);
      }
      const nextReactions = {
        ...reactionsRef.current,
        [reaction.judgeId]: normalized,
      };
      reactionsRef.current = nextReactions;
      setReactions(nextReactions);
      if (answerQuality !== 'unrated') {
        answerQualityRef.current[answerQuality] += 1;
      }
      setComposerOpen(false);
      setFocusedJudgeId(reaction.judgeId);
      const panelInterest = Math.round(
        Object.values(nextReactions).reduce(
          (total, judgeReaction) => total + judgeReaction.interest,
          0,
        ) / JUDGES.length,
      );
      const qualityAdjustment =
        answerQuality === 'unanswered'
          ? -16
          : answerQuality === 'evasive'
            ? -12
            : answerQuality === 'weak'
              ? -5
              : answerQuality === 'credible'
                ? 5
                : answerQuality === 'exceptional'
                  ? 10
                  : 0;
      const difficultyMultiplier =
        pitchRef.current.difficulty === 'easy'
          ? 0.65
          : pitchRef.current.difficulty === 'hard'
            ? 1.2
            : pitchRef.current.difficulty === 'legendary'
              ? 1.5
              : 1;
      setPitch((current) => ({
        ...current,
        round: current.round + 1,
        summary: roundSummary,
        favorability: clampInterest(
          panelInterest +
            (qualityAdjustment < 0
              ? qualityAdjustment * difficultyMultiplier
              : qualityAdjustment / difficultyMultiplier),
        ),
      }));
      if (reaction.question) {
        const nextTurn: FounderTurnState = {
          status: 'presenting',
          judgeId: reaction.judgeId,
          question: reaction.question,
        };
        founderTurnRef.current = nextTurn;
        setFounderTurn(nextTurn);
        setResponseSecondsLeft(responseWindow(pitchRef.current.difficulty));
      } else {
        const nextTurn: FounderTurnState = { status: 'open' };
        founderTurnRef.current = nextTurn;
        setFounderTurn(nextTurn);
      }
      speak([{ judgeId: reaction.judgeId, text: reaction.spoken }]);
    },
    [appendFeed, speak],
  );

  const beginJudgeRescue = useCallback(() => {
    const rescue = judgeRescueRef.current;
    if (rescue.status !== 'offered' || !rescue.judgeId) return;
    appealedJudgeIdsRef.current.add(rescue.judgeId);
    const judge = JUDGES.find((item) => item.id === rescue.judgeId);
    const question = `Give ${judge?.name ?? 'this judge'} one concrete reason to stay. You have twenty seconds.`;
    const awaitingRescue: JudgeRescueState = {
      ...rescue,
      status: 'awaiting',
      deadline: Date.now() + 20_000,
    };
    const awaitingTurn: FounderTurnState = {
      status: 'awaiting',
      judgeId: rescue.judgeId,
      question,
      deadline: awaitingRescue.deadline,
    };
    judgeRescueRef.current = awaitingRescue;
    founderTurnRef.current = awaitingTurn;
    setJudgeRescue(awaitingRescue);
    setFounderTurn(awaitingTurn);
    setResponseSecondsLeft(20);
    setFocusedJudgeId(null);
    setComposerOpen(true);
  }, []);

  const recallJudgeWithLifeline = useCallback(
    (judgeId: JudgeId) => {
      if (
        judgeLifelineRef.current.status !== 'available' &&
        judgeLifelineRef.current.status !== 'selecting'
      )
        return;
      const current = reactionsRef.current[judgeId];
      if (!current || current.state !== 'out') return;
      const judge = JUDGES.find((item) => item.id === judgeId);
      const recalled: JudgeReaction = {
        ...current,
        state: 'pressing',
        interest: Math.max(18, current.interest),
        mood: 'skeptical',
        spoken:
          'Lifeline accepted. You bought one final question—do not waste it.',
        question: undefined,
        outReason: undefined,
        reactionStyle: 'neutral',
      };
      const nextReactions = {
        ...reactionsRef.current,
        [judgeId]: recalled,
      };
      const pendingLifeline: JudgeLifelineState = {
        status: 'pending',
        judgeId,
        usedAt: Date.now(),
      };
      reactionsRef.current = nextReactions;
      judgeLifelineRef.current = pendingLifeline;
      setReactions(nextReactions);
      setJudgeLifeline(pendingLifeline);
      setFocusedJudgeId(judgeId);
      appendFeed({
        kind: 'system',
        author: 'Lifeline',
        text: `${judge?.name ?? 'The judge'} has been pulled back into the room for one final question.`,
      });
    },
    [appendFeed],
  );

  const waitForJudgeRescue = useCallback(() => {
    const initial = judgeRescueRef.current;
    if (initial.status === 'answered') {
      return Promise.resolve({
        status: 'answered',
        judgeId: initial.judgeId,
        response: initial.response,
        next: 'The same judge must now answer the founder appeal with post_judge_turn.',
      });
    }
    if (initial.status !== 'offered' && initial.status !== 'awaiting') {
      return Promise.resolve({ status: initial.status });
    }
    if (rescueWaiterRef.current) {
      return Promise.reject(
        new Error('A judge rescue wait is already active.'),
      );
    }
    return new Promise<Record<string, unknown>>((resolve) => {
      const finish = (result: Record<string, unknown>) => {
        if (rescueWaiterRef.current) {
          window.clearInterval(rescueWaiterRef.current.timer);
          rescueWaiterRef.current = null;
        }
        resolve(result);
      };
      const check = () => {
        const latest = judgeRescueRef.current;
        if (latest.status === 'answered') {
          finish({
            status: 'answered',
            judgeId: latest.judgeId,
            response: latest.response,
            next: 'The same judge must now answer the founder appeal with post_judge_turn.',
          });
          return;
        }
        if (latest.status !== 'offered' && latest.status !== 'awaiting') {
          finish({ status: latest.status, judgeId: latest.judgeId });
          return;
        }
        if (!latest.deadline || Date.now() <= latest.deadline) return;
        const timedOut: JudgeRescueState = {
          ...latest,
          status: latest.status === 'offered' ? 'declined' : 'timed_out',
        };
        if (latest.judgeId) appealedJudgeIdsRef.current.add(latest.judgeId);
        judgeRescueRef.current = timedOut;
        setJudgeRescue(timedOut);
        if (latest.status === 'awaiting') {
          const turn = founderTurnRef.current;
          const timedOutTurn: FounderTurnState = {
            ...turn,
            status: 'timed_out',
          };
          founderTurnRef.current = timedOutTurn;
          setFounderTurn(timedOutTurn);
          appendFeed({
            kind: 'system',
            author: 'Arena',
            text: 'Twenty seconds gone. The judge is out.',
          });
        }
        finish({
          status: timedOut.status,
          judgeId: latest.judgeId,
          waitedSeconds: 20,
        });
      };
      const timer = window.setInterval(check, 120);
      rescueWaiterRef.current = { resolve, timer };
      check();
    });
  }, [appendFeed]);

  const reviewPitchEvidence = useCallback(
    (reviews: EvidenceReview[]) => {
      setEvidenceReviews((current) => {
        const next = {
          ...current,
          ...Object.fromEntries(
            reviews.map((review) => [review.materialId, review]),
          ),
        };
        evidenceReviewsRef.current = next;
        return next;
      });
      const activePresentationReset = presentationResetRef.current;
      if (
        activePresentationReset.status === 'captured' &&
        activePresentationReset.materialId &&
        reviews.some(
          (review) => review.materialId === activePresentationReset.materialId,
        )
      ) {
        const reviewedReset: PresentationResetState = {
          ...activePresentationReset,
          status: 'reviewed',
        };
        presentationResetRef.current = reviewedReset;
        setPresentationReset(reviewedReset);
        appendFeed({
          kind: 'system',
          author: 'Arena',
          text: 'New founder photo reviewed. The clock resumes; the same judge has the floor.',
        });
      }
      appendFeed({
        kind: 'system',
        author: 'Arena',
        text: `${reviews.length} evidence item${reviews.length === 1 ? '' : 's'} reviewed. The panel may enter.`,
      });
    },
    [appendFeed],
  );

  const waitForFounderReadinessPhoto = useCallback((timeoutSeconds = 12) => {
    const snapshot = presentationResetRef.current;
    const completedResult = (reset: PresentationResetState) => ({
      status: reset.status,
      judgeId: reset.judgeId,
      material: reset.materialId
        ? materialsRef.current.find(
            (material) => material.id === reset.materialId,
          )
        : undefined,
      next:
        reset.status === 'captured'
          ? 'Open the exact material URL, inspect the new founder photo, then call review_pitch_evidence.'
          : 'The retake is reviewed. The same judge must respond next with post_judge_turn.',
    });
    if (snapshot.status === 'captured' || snapshot.status === 'reviewed')
      return Promise.resolve(completedResult(snapshot));
    if (snapshot.status !== 'awaiting')
      return Promise.resolve({
        status: snapshot.status,
        message: 'No judge is waiting for a founder photo retake.',
      });
    if (presentationResetWaiterRef.current)
      return Promise.reject(
        new Error('A founder photo wait is already active.'),
      );

    return new Promise<Record<string, unknown>>((resolve) => {
      const deadline = Date.now() + Math.max(1, timeoutSeconds) * 1000;
      const finish = (value: Record<string, unknown>) => {
        const waiter = presentationResetWaiterRef.current;
        if (waiter) window.clearInterval(waiter.timer);
        presentationResetWaiterRef.current = null;
        resolve(value);
      };
      const check = () => {
        const latest = presentationResetRef.current;
        if (latest.status === 'captured' || latest.status === 'reviewed') {
          finish(completedResult(latest));
          return;
        }
        if (latest.status !== 'awaiting') {
          finish({ status: latest.status });
          return;
        }
        if (Date.now() >= deadline) {
          finish({
            status: 'waiting',
            judgeId: latest.judgeId,
            waitedSeconds: timeoutSeconds,
            next: 'Call wait_for_founder_readiness_photo again immediately. The room clock remains paused.',
          });
        }
      };
      const timer = window.setInterval(check, 150);
      presentationResetWaiterRef.current = { resolve, timer };
      check();
    });
  }, []);

  const waitForFounderResponse = useCallback(
    (timeoutSeconds = 12) => {
      const turn = founderTurnRef.current;
      if (turn.status === 'answered') {
        return Promise.resolve({
          status: 'answered',
          response: turn.lastResponse,
          judgeId: turn.judgeId,
          question: turn.question,
        });
      }
      if (turn.status !== 'presenting' && turn.status !== 'awaiting') {
        return Promise.resolve({
          status: turn.status,
          message: 'No judge is waiting for an answer.',
        });
      }
      if (responseWaiterRef.current) {
        return Promise.reject(
          new Error('A founder response wait is already active.'),
        );
      }
      const waitStartedAt = Date.now();
      const maxWaitMs = Math.max(1, timeoutSeconds) * 1000;
      const graceMs = 5_000;
      return new Promise<Record<string, unknown>>((resolve) => {
        const finish = (result: Record<string, unknown>) => {
          if (responseWaiterRef.current) {
            window.clearTimeout(responseWaiterRef.current.timer);
            responseWaiterRef.current = null;
          }
          resolve(result);
        };
        function check() {
          const latest = founderTurnRef.current;
          if (latest.status === 'answered') {
            finish({
              status: 'answered',
              response: latest.lastResponse,
              judgeId: latest.judgeId,
              question: latest.question,
            });
            return;
          }
          if (latest.status !== 'presenting' && latest.status !== 'awaiting') {
            finish({ status: latest.status });
            return;
          }
          const now = Date.now();
          if (now - waitStartedAt >= maxWaitMs) {
            finish({
              status: 'waiting',
              judgeId: latest.judgeId,
              question: latest.question,
              phase:
                latest.status === 'presenting'
                  ? 'waiting_for_respond'
                  : 'waiting_for_answer',
              secondsRemaining:
                latest.status === 'awaiting' && latest.deadline
                  ? Math.max(0, Math.ceil((latest.deadline - now) / 1000))
                  : responseWindow(pitchRef.current.difficulty),
              next: 'Keep the response gate open. Call wait_for_founder_response again and do not post another judge turn.',
            });
            return;
          }
          if (latest.status === 'presenting' || !latest.deadline) {
            return;
          }
          if (now <= latest.deadline + graceMs) {
            return;
          }
          const timedOut: FounderTurnState = { ...latest, status: 'timed_out' };
          founderTurnRef.current = timedOut;
          setFounderTurn(timedOut);
          setPitch((current) => ({
            ...current,
            favorability: clampInterest(current.favorability - 8),
            mood: 'tense',
          }));
          appendFeed({
            kind: 'system',
            author: 'Arena',
            text: 'No answer. Patience is burning.',
          });
          finish({
            status: 'timed_out',
            judgeId: latest.judgeId,
            question: latest.question,
            waitedSeconds: responseWindow(pitchRef.current.difficulty),
          });
        }
        const timer = window.setInterval(check, 150);
        responseWaiterRef.current = { resolve, timer };
        check();
      });
    },
    [appendFeed],
  );

  const beginFounderResponse = useCallback(() => {
    const turn = founderTurnRef.current;
    if (turn.status === 'presenting') {
      const awaiting: FounderTurnState = {
        ...turn,
        status: 'awaiting',
        deadline:
          Date.now() + responseWindow(pitchRef.current.difficulty) * 1000,
      };
      founderTurnRef.current = awaiting;
      setFounderTurn(awaiting);
      setResponseSecondsLeft(responseWindow(pitchRef.current.difficulty));
    }
    setFocusedJudgeId(null);
    setComposerOpen(true);
  }, []);

  useEffect(() => {
    if (!composerOpen) return;
    const frame = window.requestAnimationFrame(() =>
      responseInputRef.current?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [composerOpen]);
  const waitForFounderOfferDecision = useCallback(
    (timeoutSeconds = 12) => {
      const decision = offerDecisionRef.current;
      if (decision.status === 'answered') {
        return Promise.resolve({
          status: 'answered',
          action: decision.action,
          judgeId: decision.judgeId,
          amount: decision.amount,
          equity: decision.equity,
          note: decision.note,
        });
      }
      if (decision.status !== 'choosing') {
        return Promise.resolve({
          status: decision.status,
          message: 'No offer decision is waiting for the founder.',
        });
      }
      if (offerWaiterRef.current) {
        return Promise.reject(
          new Error('An offer-decision wait is already active.'),
        );
      }
      const deadline = decision.deadline ?? Date.now();
      const deadlineRemaining = Math.max(0, deadline - Date.now());
      const waitSlice = Math.max(
        0,
        Math.min(timeoutSeconds * 1000, deadlineRemaining),
      );
      return new Promise<Record<string, unknown>>((resolve) => {
        const timer = window.setTimeout(() => {
          const latest = offerDecisionRef.current;
          const latestDeadline = latest.deadline ?? deadline;
          if (latest.status === 'answered') {
            offerWaiterRef.current = null;
            resolve({
              status: 'answered',
              action: latest.action,
              judgeId: latest.judgeId,
              amount: latest.amount,
              equity: latest.equity,
              note: latest.note,
            });
            return;
          }
          if (latest.status !== 'choosing') {
            offerWaiterRef.current = null;
            resolve({ status: latest.status });
            return;
          }
          if (Date.now() < latestDeadline) {
            offerWaiterRef.current = null;
            resolve({
              status: 'waiting',
              offers: bidsRef.current,
              secondsRemaining: Math.max(
                1,
                Math.ceil((latestDeadline - Date.now()) / 1000),
              ),
              next: 'Call wait_for_founder_offer_decision again immediately. Do not continue the panel yet.',
            });
            return;
          }
          const timedOut: OfferDecision = {
            ...latest,
            status: 'timed_out',
          };
          offerDecisionRef.current = timedOut;
          setOfferDecision(timedOut);
          setPitch((current) => ({
            ...current,
            favorability: clampInterest(current.favorability - 6),
            mood: 'tense',
          }));
          appendFeed({
            kind: 'system',
            author: 'Arena',
            text: 'The offers expired while the founder stared at the money.',
          });
          offerWaiterRef.current = null;
          resolve({
            status: 'timed_out',
            offers: bidsRef.current,
            waitedSeconds: 45,
          });
        }, waitSlice);
        offerWaiterRef.current = { resolve, timer };
      });
    },
    [appendFeed],
  );
  const applyJudgeRound = useCallback(
    (roundSummary: string, nextReactions: JudgeReaction[]) => {
      if (
        offerDecisionRef.current.status === 'answered' &&
        !acceptedBidRef.current
      ) {
        offerDecisionRef.current = { status: 'idle' };
        setOfferDecision({ status: 'idle' });
        bidsRef.current = [];
        setBids([]);
      }
      const normalized = Object.fromEntries(
        nextReactions.map((reaction) => [
          reaction.judgeId,
          {
            ...reaction,
            interest: clampInterest(reaction.interest),
            mood:
              reaction.mood ??
              (reaction.interest >= 70
                ? 'impressed'
                : reaction.interest >= 45
                  ? 'intrigued'
                  : 'skeptical'),
          },
        ]),
      ) as Partial<Record<JudgeId, JudgeReaction>>;
      setReactions((current) => ({ ...current, ...normalized }));
      setPitch((current) => ({
        ...current,
        round: current.round + 1,
        summary: roundSummary,
      }));
      speak(
        nextReactions.map((reaction) => ({
          judgeId: reaction.judgeId,
          text: reaction.spoken,
        })),
      );
    },
    [speak],
  );
  const applyBidRound = useCallback(
    (nextBids: Bid[]) => {
      setBids(nextBids);
      bidsRef.current = nextBids;
      setFocusedJudgeId(null);
      acceptedBidRef.current = null;
      setAcceptedBid(null);
      setCounteringJudgeId(null);
      setCounterAmount('');
      setCounterEquity('');
      setCounterNote('');
      const nextDecision: OfferDecision = {
        status: 'choosing',
        deadline: Date.now() + 45_000,
      };
      offerDecisionRef.current = nextDecision;
      setOfferDecision(nextDecision);
      setReactions((current) => {
        const updated = { ...current };
        for (const bid of nextBids) {
          updated[bid.judgeId] = {
            ...updated[bid.judgeId],
            state: 'bidding',
            interest: Math.max(updated[bid.judgeId].interest, 85),
            spoken: bid.spoken,
          };
        }
        return updated;
      });
      setPitch((current) => ({
        ...current,
        round: current.round + 1,
        mood: nextBids.length > 1 ? 'excited' : current.mood,
        summary:
          nextBids.length > 1
            ? 'The judges are bidding against each other.'
            : 'An offer is on the table.',
      }));
      appendFeed({
        kind: 'system',
        author: 'Deal desk',
        text:
          nextBids.length > 1
            ? `${nextBids.length} competing offers are live. Choose, counter, or reject them.`
            : 'An offer is live. Accept it, counter it, or walk away.',
      });
      speak(
        nextBids.map((bid) => ({ judgeId: bid.judgeId, text: bid.spoken })),
      );
    },
    [appendFeed, speak],
  );
  const submitOfferDecision = useCallback(
    (decision: Omit<OfferDecision, 'status' | 'deadline'>) => {
      const answered: OfferDecision = {
        ...decision,
        status: 'answered',
      };
      offerDecisionRef.current = answered;
      setOfferDecision(answered);
      if (decision.action === 'accept' && decision.judgeId) {
        const selected = bidsRef.current.find(
          (bid) => bid.judgeId === decision.judgeId,
        );
        if (selected) {
          acceptedBidRef.current = selected;
          setAcceptedBid(selected);
          appendFeed({
            kind: 'system',
            author: 'Deal desk',
            text: `Founder selected ${JUDGES.find((judge) => judge.id === selected.judgeId)?.name ?? selected.judgeId}: ${money(selected.amount)} for ${selected.equity}%.`,
          });
        }
      } else {
        acceptedBidRef.current = null;
        setAcceptedBid(null);
        appendFeed({
          kind: 'founder',
          author: 'Founder',
          text:
            decision.action === 'counter'
              ? `Counter to ${JUDGES.find((judge) => judge.id === decision.judgeId)?.name ?? 'the judge'}: ${money(decision.amount ?? 0)} for ${decision.equity}%${decision.note ? ` — ${decision.note}` : ''}`
              : 'Founder rejected every offer on the table.',
        });
      }
      if (offerWaiterRef.current) {
        window.clearTimeout(offerWaiterRef.current.timer);
        offerWaiterRef.current.resolve({
          status: 'answered',
          action: answered.action,
          judgeId: answered.judgeId,
          amount: answered.amount,
          equity: answered.equity,
          note: answered.note,
        });
        offerWaiterRef.current = null;
      } else {
        setHandoffMessage(
          'Offer decision recorded. Resume the agent so the judges can react.',
        );
      }
      setCounteringJudgeId(null);
    },
    [appendFeed],
  );
  const acceptOffer = useCallback(
    (bid: Bid) => {
      submitOfferDecision({
        action: 'accept',
        judgeId: bid.judgeId,
        amount: bid.amount,
        equity: bid.equity,
        note: bid.conditions,
      });
    },
    [submitOfferDecision],
  );
  const beginCounterOffer = useCallback((bid: Bid) => {
    setCounteringJudgeId(bid.judgeId);
    setCounterAmount(String(bid.amount));
    setCounterEquity(String(bid.equity));
    setCounterNote('');
  }, []);
  const submitCounterOffer = useCallback(() => {
    if (!counteringJudgeId) return;
    const amount = Math.max(1, Math.round(Number(counterAmount)));
    const equity = Math.max(0, Math.min(100, Number(counterEquity)));
    if (!Number.isFinite(amount) || !Number.isFinite(equity)) return;
    submitOfferDecision({
      action: 'counter',
      judgeId: counteringJudgeId,
      amount,
      equity,
      note: counterNote.trim() || undefined,
    });
  }, [
    counterAmount,
    counterEquity,
    counterNote,
    counteringJudgeId,
    submitOfferDecision,
  ]);
  const finalizePitch = useCallback(
    async (result: {
      score: number;
      summary: string;
      amountRaised: number;
      winningJudgeId?: JudgeId;
    }) => {
      const snapshot = pitchRef.current;
      const quality = answerQualityRef.current;
      const evasiveTotal = quality.evasive + quality.unanswered;
      const credibleTotal = quality.credible + quality.exceptional;
      const allJudgesOut = Object.values(reactionsRef.current).every(
        (reaction) => reaction.state === 'out',
      );
      let scoreCap = allJudgesOut ? 30 : 100;
      if (credibleTotal === 0 && evasiveTotal >= 4) scoreCap = 8;
      else if (credibleTotal === 0 && evasiveTotal >= 3) scoreCap = 15;
      else if (evasiveTotal >= 3) scoreCap = Math.min(scoreCap, 24);
      else if (evasiveTotal >= 2) scoreCap = Math.min(scoreCap, 35);
      const finalPitch = {
        ...snapshot,
        status: 'final' as const,
        score: Math.max(0, Math.min(scoreCap, 100, Math.round(result.score))),
        summary: result.summary,
        amountRaised: Math.max(0, Math.round(result.amountRaised)),
        durationSeconds: Math.max(
          0,
          Math.round((Date.now() - (snapshot.startedAt ?? Date.now())) / 1000),
        ),
      };
      setPitch(finalPitch);
      try {
        const founderPhotoMaterialId = publishFounderPhotoRef.current
          ? [...materialsRef.current]
              .reverse()
              .find((material) =>
                material.name.startsWith('founder-readiness-'),
              )?.id
          : undefined;
        await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            founderName: finalPitch.founderName,
            companyName: finalPitch.companyName,
            agentSignature: finalPitch.agentSignature,
            pitchVenue: finalPitch.pitchVenue,
            score: finalPitch.score,
            amountRaised: finalPitch.amountRaised,
            askAmount: finalPitch.askAmount,
            equity: finalPitch.equity,
            durationSeconds: finalPitch.durationSeconds,
            difficulty: finalPitch.difficulty,
            lifelinesUsed: judgeLifelineRef.current.usedAt ? 1 : 0,
            openingPitch: finalPitch.openingPitch,
            transcript: feedRef.current
              .map((entry) => `${entry.author.toUpperCase()}\n${entry.text}`)
              .join('\n\n'),
            verdictSummary: finalPitch.summary,
            toolCalls: summarizeToolCalls(toolEventsRef.current),
            founderPhotoMaterialId,
          }),
        });
        await fetchLeaderboard();
      } catch {
        // The local game remains playable when persistence is offline.
      }
      speak([
        { judgeId: result.winningJudgeId ?? 'maya', text: result.summary },
      ]);
      return finalPitch;
    },
    [fetchLeaderboard, speak],
  );

  useEffect(() => {
    if (!roomReady || !validRoomCode(roomCode)) return;
    const unregister = registerPitchTools({
      getSnapshot: () => ({
        roomCode,
        openingDraft: draftRef.current,
        pitch: pitchRef.current,
        judges: JUDGES.map((judge) => ({
          id: judge.id,
          name: judge.name,
          role: judge.role,
          ...reactionsRef.current[judge.id],
        })),
        bids: bidsRef.current,
        offerDecision: offerDecisionRef.current,
        acceptedBid: acceptedBidRef.current,
        materials: materialsRef.current.map((material) => ({
          ...material,
          url: new URL(material.url, window.location.href).toString(),
        })),
        conversation: feedRef.current,
        founderTurn: founderTurnRef.current,
        judgeRescue: judgeRescueRef.current,
        judgeLifeline: judgeLifelineRef.current,
        presentationReset: presentationResetRef.current,
        evidenceReview: {
          pendingMaterialIds: materialsRef.current
            .filter((material) => !evidenceReviewsRef.current[material.id])
            .map((material) => material.id),
          reviews: Object.values(evidenceReviewsRef.current),
          ready: materialsRef.current.every((material) =>
            Boolean(evidenceReviewsRef.current[material.id]),
          ),
        },
        panelDirectives: panelProfileRef.current,
      }),
      startPitch,
      updatePitchDetails,
      applyJudgeRound,
      applyJudgeTurn,
      reviewPitchEvidence,
      waitForFounderResponse,
      waitForFounderReadinessPhoto,
      waitForJudgeRescue,
      waitForFounderOfferDecision,
      applyBidRound,
      finalizePitch,
      fetchLeaderboard,
      onStatus: setToolStatus,
      onToolEvent: (event) => {
        const nextEvents = [
          ...toolEventsRef.current,
          { ...event, id: crypto.randomUUID() },
        ].slice(-200);
        toolEventsRef.current = nextEvents;
        setToolEvents(nextEvents);
      },
    });
    return unregister;
  }, [
    applyBidRound,
    applyJudgeRound,
    applyJudgeTurn,
    fetchLeaderboard,
    finalizePitch,
    startPitch,
    updatePitchDetails,
    reviewPitchEvidence,
    roomCode,
    roomReady,
    waitForFounderOfferDecision,
    waitForFounderResponse,
    waitForFounderReadinessPhoto,
    waitForJudgeRescue,
  ]);

  useEffect(() => {
    if (
      pitch.status !== 'live' ||
      presentationReset.status === 'awaiting' ||
      presentationReset.status === 'captured'
    )
      return;
    const timer = window.setInterval(() => {
      setPitch((current) =>
        current.status !== 'live' || current.secondsLeft <= 0
          ? current
          : { ...current, secondsLeft: current.secondsLeft - 1 },
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pitch.status, presentationReset.status]);

  useEffect(() => {
    if (pitch.status !== 'live') {
      twoMinuteWarningRef.current = false;
      return;
    }
    if (pitch.secondsLeft > 120 || twoMinuteWarningRef.current) return;
    twoMinuteWarningRef.current = true;
    setPitch((current) => ({ ...current, mood: 'tense' }));
    appendFeed({
      kind: 'system',
      author: 'Arena',
      text: 'Two minutes remain. The heartbeat joins the score.',
    });
  }, [appendFeed, pitch.secondsLeft, pitch.status]);

  useEffect(() => {
    if (founderTurn.status !== 'awaiting' || !founderTurn.deadline) return;
    const tick = () => {
      setResponseSecondsLeft(
        Math.max(0, Math.ceil((founderTurn.deadline! - Date.now()) / 1000)),
      );
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [founderTurn]);

  useEffect(() => {
    if (offerDecision.status !== 'choosing' || !offerDecision.deadline) return;
    const tick = () => {
      setResponseSecondsLeft(
        Math.max(0, Math.ceil((offerDecision.deadline! - Date.now()) / 1000)),
      );
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [offerDecision]);

  const submitFounderResponse = useCallback(
    (response: string) => {
      const cleaned = response.trim();
      if (!cleaned) return;
      setPitch((current) => ({
        ...current,
        transcript: [current.transcript, cleaned].filter(Boolean).join('\n'),
      }));
      appendFeed({ kind: 'founder', author: 'Founder', text: cleaned });
      const turn = founderTurnRef.current;
      if (turn.status === 'presenting' || turn.status === 'awaiting') {
        const answered: FounderTurnState = {
          ...turn,
          status: 'answered',
          lastResponse: cleaned,
        };
        founderTurnRef.current = answered;
        setFounderTurn(answered);
        const rescue = judgeRescueRef.current;
        if (rescue.status === 'awaiting' && rescue.judgeId === turn.judgeId) {
          const answeredRescue: JudgeRescueState = {
            ...rescue,
            status: 'answered',
            response: cleaned,
          };
          judgeRescueRef.current = answeredRescue;
          setJudgeRescue(answeredRescue);
          if (rescueWaiterRef.current) {
            window.clearInterval(rescueWaiterRef.current.timer);
            rescueWaiterRef.current.resolve({
              status: 'answered',
              judgeId: rescue.judgeId,
              response: cleaned,
              next: 'The same judge must now answer the founder appeal with post_judge_turn.',
            });
            rescueWaiterRef.current = null;
          }
        }
        if (responseWaiterRef.current) {
          window.clearTimeout(responseWaiterRef.current.timer);
          responseWaiterRef.current.resolve({
            status: 'answered',
            response: cleaned,
            judgeId: turn.judgeId,
            question: turn.question,
          });
          responseWaiterRef.current = null;
        } else {
          setHandoffMessage(
            'Answer recorded. Resume the agent so the panel can evaluate it.',
          );
        }
      }
      draftRef.current = '';
      setDraft('');
      setComposerOpen(false);
    },
    [appendFeed],
  );

  const submitDraft = useCallback(() => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    submitFounderResponse(cleaned);
  }, [draft, submitFounderResponse]);

  const uploadMaterials = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files?.length || !sessionIdRef.current) return null;
      setUploading(true);
      setUploadError('');
      try {
        const uploaded: PitchMaterial[] = [];
        for (const file of Array.from(files).slice(0, 6)) {
          const form = new FormData();
          form.set('sessionId', sessionIdRef.current);
          form.set('file', file);
          const response = await fetch('/api/materials', {
            method: 'POST',
            body: form,
          });
          const result = (await response.json()) as {
            material?: PitchMaterial;
            error?: string;
          };
          if (!response.ok || !result.material)
            throw new Error(result.error ?? `Could not upload ${file.name}`);
          setMaterials((current) =>
            [...current, result.material!].slice(0, 12),
          );
          uploaded.push(result.material);
        }
        return uploaded;
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : 'Upload failed',
        );
        return null;
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const sessionTranscript = useCallback(() => {
    const lines = feed.map(
      (entry) =>
        `[${new Date(entry.createdAt).toLocaleTimeString()}] ${entry.author}: ${entry.text}`,
    );
    return [
      `${pitch.companyName} — ${pitchAskLabel(pitch.askAmount, pitch.equity)}`,
      `Difficulty: ${DIFFICULTY_META[pitch.difficulty].label}`,
      `Room: ${roomCode}`,
      '',
      ...lines,
      pitch.summary ? `\nFINAL VERDICT\n${pitch.summary}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [feed, pitch, roomCode]);

  const downloadTranscript = useCallback(() => {
    const blob = new Blob([sessionTranscript()], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${pitchRef.current.companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'pitch'}-transcript.txt`;
    link.click();
    URL.revokeObjectURL(href);
  }, [sessionTranscript]);

  const shareSession = useCallback(async () => {
    const snapshot = pitchRef.current;
    const shareData = {
      title: `${snapshot.companyName} — Pitch The AI`,
      text: `${snapshot.founderName} scored ${snapshot.score ?? snapshot.favorability}/100 in ${DIFFICULTY_META[snapshot.difficulty].label} mode.`,
      url: window.location.href,
    };

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext('2d');
    if (!context) return;

    const background = context.createRadialGradient(600, 280, 20, 600, 280, 720);
    background.addColorStop(0, '#241a09');
    background.addColorStop(0.48, '#0d0c0a');
    background.addColorStop(1, '#020202');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#dcae42';
    context.lineWidth = 3;
    context.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

    context.fillStyle = '#e5b843';
    context.font = '700 24px Arial, sans-serif';
    context.fillText('PITCH THE AI · FINAL VERDICT', 76, 88);
    context.fillStyle = '#ffffff';
    context.font = '800 58px Arial, sans-serif';
    context.fillText(snapshot.companyName || 'Untitled venture', 76, 166);
    context.fillStyle = '#e5b843';
    context.font = '800 96px Arial, sans-serif';
    context.fillText(String(snapshot.score ?? snapshot.favorability), 76, 294);
    context.fillStyle = '#8c8a83';
    context.font = '700 26px Arial, sans-serif';
    context.fillText('/100', 214, 292);
    context.fillStyle = '#ffffff';
    context.font = '800 40px Arial, sans-serif';
    context.fillText(snapshot.amountRaised ? 'YOU GOT A DEAL.' : 'NO DEAL.', 76, 356);

    const summary = snapshot.summary || 'The room has delivered its verdict.';
    const words = summary.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    context.font = '500 24px Arial, sans-serif';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width > 690 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
      if (lines.length === 6) break;
    }
    if (line && lines.length < 7) lines.push(line);
    context.fillStyle = '#d4d1ca';
    lines.slice(0, 7).forEach((text, index) => {
      context.fillText(text, 400, 235 + index * 38);
    });

    context.fillStyle = '#8c8a83';
    context.font = '600 20px Arial, sans-serif';
    context.fillText(
      `${snapshot.founderName} · ${DIFFICULTY_META[snapshot.difficulty].label} mode · ${formatClock(snapshot.durationSeconds ?? 0)}`,
      76,
      542,
    );
    context.fillStyle = '#e5b843';
    context.fillText('pitchtheai.com', 974, 542);

    const imageBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    const file = imageBlob
      ? new File([imageBlob], 'pitch-the-ai-result.png', { type: 'image/png' })
      : null;

    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ ...shareData, files: [file] });
      return;
    }
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }
    if (imageBlob) {
      const href = URL.createObjectURL(imageBlob);
      const link = document.createElement('a');
      link.href = href;
      link.download = 'pitch-the-ai-result.png';
      link.click();
      URL.revokeObjectURL(href);
    }
    await navigator.clipboard.writeText(
      `${shareData.title}\n${shareData.text}\n${shareData.url}`,
    );
  }, []);

  const openIssueReport = useCallback(() => {
    const recentTools = toolEvents
      .slice(-12)
      .map((event) => `${event.toolName}: ${event.phase}`)
      .join('\n');
    const body = [
      issueDraft.trim(),
      '',
      '--- Arena diagnostics ---',
      `Room: ${roomCode}`,
      `Pitch: ${pitch.companyName}`,
      `Status: ${pitch.status}`,
      `Difficulty: ${pitch.difficulty}`,
      `Founder gate: ${founderTurn.status}`,
      `Judge rescue: ${judgeRescue.status}`,
      `Recent WebMCP activity:\n${recentTools || 'none'}`,
    ].join('\n');
    window.open(
      `https://github.com/wesheets/pitchtheai/issues/new?title=${encodeURIComponent(`Arena issue · ${roomCode}`)}&body=${encodeURIComponent(body)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [
    founderTurn.status,
    issueDraft,
    judgeRescue.status,
    pitch,
    roomCode,
    toolEvents,
  ]);

  const startFounderCamera = useCallback(async (
    mode: 'photo' | 'live' = 'photo',
    includeAudio = false,
  ) => {
    const currentStream = cameraStreamRef.current;
    if (currentStream?.active) {
      if (includeAudio && !currentStream.getAudioTracks().length) {
        try {
          const microphone = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
          microphone
            .getAudioTracks()
            .forEach((track) => currentStream.addTrack(track));
        } catch {
          setCameraMessage(
            'Founder camera is live. Microphone access was unavailable, so recording will use available audio only.',
          );
        }
      }
      setCameraMode(mode);
      setCameraStatus('live');
      return currentStream;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMode(null);
      setCameraStatus('error');
      setCameraMessage('This browser does not support a founder camera.');
      return null;
    }
    setCameraMode(mode);
    setCameraStatus('requesting');
    setCameraMessage(
      includeAudio
        ? 'Waiting for camera and microphone permission…'
        : 'Waiting for camera permission…',
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: includeAudio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
      });
      cameraStreamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        cameraStreamRef.current = null;
        setCameraMode(null);
        setCameraStatus('off');
        setCameraMessage('Founder camera stopped.');
      });
      setCameraStatus('live');
      setCameraMessage(
        mode === 'photo'
          ? 'Opening the photo preview…'
          : 'Opening founder video in the lower-left corner…',
      );
      return stream;
    } catch {
      setCameraMode(null);
      setCameraStatus('error');
      setCameraMessage(
        'Camera permission was declined or unavailable. Use Upload instead or try Chrome.',
      );
      return null;
    }
  }, []);

  const beginPresentationRetake = useCallback(async () => {
    const stream = await startFounderCamera('photo');
    if (!stream) return;
    setFocusedJudgeId(null);
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('.founder-camera-slot')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }, [startFounderCamera]);

  const stopFounderCamera = useCallback(() => {
    if (recordingSession) return;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraMode(null);
    setCameraStatus('off');
    setCameraMessage('Founder camera is off.');
  }, [recordingSession]);

  const captureFounderPhoto = useCallback(async () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraMessage('Camera is still warming up. Try the capture again.');
      return;
    }
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    if (!blob) {
      setCameraMessage('The readiness photo could not be captured.');
      return;
    }
    const file = new File([blob], `founder-readiness-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    });
    const uploaded = await uploadMaterials([file]);
    if (!uploaded?.length) {
      setCameraMessage(
        'Photo captured, but it could not be added for the judges. Try again.',
      );
      return;
    }
    const activePresentationReset = presentationResetRef.current;
    if (activePresentationReset.status === 'awaiting') {
      const capturedReset: PresentationResetState = {
        ...activePresentationReset,
        status: 'captured',
        materialId: uploaded[uploaded.length - 1].id,
      };
      presentationResetRef.current = capturedReset;
      setPresentationReset(capturedReset);
    }
    if (!recordingSession) {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraMode(null);
      setCameraStatus('off');
    }
    setCameraMessage(
      activePresentationReset.status === 'awaiting'
        ? 'Retake submitted. The judge is reviewing it; the room clock remains paused.'
        : 'Readiness photo added as evidence. Judges can review presentation setup.',
    );
  }, [recordingSession, uploadMaterials]);

  const uploadFounderPhoto = useCallback(
    async (files: FileList | null) => {
      const source = files?.[0];
      if (!source) return;
      if (!source.type.startsWith('image/')) {
        setCameraMessage('Choose a JPG, PNG, or WebP image for the judges.');
        return;
      }
      const extension = source.name.split('.').pop()?.toLowerCase() || 'jpg';
      const renamed = new File(
        [source],
        `founder-readiness-upload-${Date.now()}.${extension}`,
        { type: source.type },
      );
      const uploaded = await uploadMaterials([renamed]);
      const activePresentationReset = presentationResetRef.current;
      if (uploaded?.length && activePresentationReset.status === 'awaiting') {
        const capturedReset: PresentationResetState = {
          ...activePresentationReset,
          status: 'captured',
          materialId: uploaded[uploaded.length - 1].id,
        };
        presentationResetRef.current = capturedReset;
        setPresentationReset(capturedReset);
        setFocusedJudgeId(null);
      }
      setCameraMessage(
        uploaded?.length
          ? activePresentationReset.status === 'awaiting'
            ? 'Retake submitted. The judge is reviewing it; the room clock remains paused.'
            : 'Founder photo uploaded. Judges can review it as readiness evidence.'
          : 'The founder photo could not be uploaded. Try again.',
      );
    },
    [uploadMaterials],
  );

  const stopSessionRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    if (recordingDrawTimerRef.current !== null) {
      window.clearInterval(recordingDrawTimerRef.current);
      recordingDrawTimerRef.current = null;
    }
    displayRecordingStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
    displayRecordingStreamRef.current = null;
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    if (recordingAudioContextRef.current) {
      void recordingAudioContextRef.current.close();
      recordingAudioContextRef.current = null;
    }
    setRecordingSession(false);
  }, []);

  const startSessionRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      setHandoffMessage('This browser does not support session recording.');
      return;
    }
    try {
      const founderStream = await startFounderCamera('live', true);
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      displayRecordingStreamRef.current = displayStream;
      const screenVideo = document.createElement('video');
      screenVideo.srcObject = displayStream;
      screenVideo.muted = true;
      screenVideo.playsInline = true;
      await screenVideo.play();

      const founderVideo = document.createElement('video');
      if (founderStream) {
        founderVideo.srcObject = founderStream;
        founderVideo.muted = true;
        founderVideo.playsInline = true;
        await founderVideo.play();
      }

      const settings = displayStream.getVideoTracks()[0]?.getSettings();
      const sourceWidth = Math.max(
        1,
        settings?.width || screenVideo.videoWidth || 1920,
      );
      const sourceHeight = Math.max(
        1,
        settings?.height || screenVideo.videoHeight || 1080,
      );
      const scale = Math.min(1, 1920 / sourceWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1280, Math.round(sourceWidth * scale));
      canvas.height = Math.round(canvas.width * (sourceHeight / sourceWidth));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Recording canvas unavailable');

      const drawFrame = () => {
        context.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
        if (founderStream && founderVideo.videoWidth) {
          const pipWidth = Math.round(canvas.width * 0.24);
          const pipHeight = Math.round(
            pipWidth * (founderVideo.videoHeight / founderVideo.videoWidth),
          );
          const margin = Math.round(canvas.width * 0.018);
          const x = margin;
          const y = canvas.height - pipHeight - margin;
          context.save();
          context.fillStyle = 'rgba(0,0,0,.82)';
          context.fillRect(x - 7, y - 28, pipWidth + 14, pipHeight + 35);
          context.strokeStyle = '#ffc857';
          context.lineWidth = Math.max(3, Math.round(canvas.width / 640));
          context.strokeRect(x - 3, y - 3, pipWidth + 6, pipHeight + 6);
          context.translate(x + pipWidth, y);
          context.scale(-1, 1);
          context.drawImage(founderVideo, 0, 0, pipWidth, pipHeight);
          context.restore();
          context.fillStyle = '#ffc857';
          context.font = `700 ${Math.max(13, Math.round(canvas.width / 105))}px sans-serif`;
          context.fillText('FOUNDER CAM', x, y - 9);
        }
      };
      drawFrame();
      recordingDrawTimerRef.current = window.setInterval(drawFrame, 1000 / 30);

      const canvasStream = canvas.captureStream(30);
      const outputTracks = [...canvasStream.getVideoTracks()];
      const streamsWithAudio = [displayStream, founderStream].filter(
        (stream): stream is MediaStream =>
          Boolean(stream?.getAudioTracks().length),
      );
      if (streamsWithAudio.length) {
        const mixContext = new AudioContext();
        await mixContext.resume();
        const destination = mixContext.createMediaStreamDestination();
        streamsWithAudio.forEach((stream) => {
          mixContext.createMediaStreamSource(stream).connect(destination);
        });
        recordingAudioContextRef.current = mixContext;
        outputTracks.push(...destination.stream.getAudioTracks());
      }
      const stream = new MediaStream(outputTracks);
      const preferredMime = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ].find((mime) => MediaRecorder.isTypeSupported(mime));
      const recorder = new MediaRecorder(stream, {
        ...(preferredMime ? { mimeType: preferredMime } : {}),
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      });
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        recordingChunksRef.current = [];
        if (blob.size) {
          const href = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = href;
          link.download = `${pitchRef.current.companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'pitch'}-session.webm`;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
        }
        mediaRecorderRef.current = null;
        setRecordingSession(false);
      };
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (recorder.state !== 'inactive') recorder.stop();
        });
      });
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopSessionRecording();
      });
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.start(1_000);
      setRecordingSession(true);
      setCameraMessage(
        founderStream
          ? 'Recording the arena with founder camera and microphone.'
          : 'Recording the arena without camera because camera access is unavailable.',
      );
    } catch {
      displayRecordingStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      displayRecordingStreamRef.current = null;
      setHandoffMessage('Recording was cancelled or could not start.');
    }
  }, [startFounderCamera, stopSessionRecording]);

  useEffect(
    () => () => {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      displayRecordingStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordingDrawTimerRef.current !== null)
        window.clearInterval(recordingDrawTimerRef.current);
      if (recordingAudioContextRef.current)
        void recordingAudioContextRef.current.close();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      )
        mediaRecorderRef.current.stop();
    },
    [],
  );

  const removeMaterial = useCallback(async (id: string) => {
    const response = await fetch('/api/materials', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, sessionId: sessionIdRef.current }),
    });
    if (response.ok) {
      setMaterials((current) => current.filter((item) => item.id !== id));
      setEvidenceReviews((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    void enableMusic();
    type Recognition = {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: (event: {
        results: ArrayLike<{ 0: { transcript: string } }>;
      }) => void;
      onend: () => void;
      onerror: () => void;
    };
    const voiceWindow = window as typeof window & {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const SpeechRecognition =
      voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDraft(
        'Voice transcription is not available in this browser. Type the pitch here instead.',
      );
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let recognitionFailed = false;
    recognition.onresult = (event) => {
      let text = '';
      for (let index = 0; index < event.results.length; index += 1)
        text += event.results[index][0].transcript;
      draftRef.current = text.trim();
      setDraft(draftRef.current);
    };
    recognition.onend = () => {
      setListening(false);
      if (
        !recognitionFailed &&
        (founderTurnRef.current.status === 'presenting' ||
          founderTurnRef.current.status === 'awaiting') &&
        draftRef.current.trim()
      ) {
        submitFounderResponse(draftRef.current);
      }
    };
    recognition.onerror = () => {
      recognitionFailed = true;
      setListening(false);
    };
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [enableMusic, listening, submitFounderResponse]);

  const activeJudges = useMemo(
    () =>
      Object.values(reactions).filter((reaction) => reaction.state !== 'out')
        .length,
    [reactions],
  );
  const leadingBid = useMemo(
    () =>
      bids.reduce<Bid | undefined>(
        (best, bid) => (!best || bid.amount > best.amount ? bid : best),
        undefined,
      ),
    [bids],
  );
  const acceptedJudge = acceptedBid
    ? JUDGES.find((judge) => judge.id === acceptedBid.judgeId)
    : undefined;
  const pendingEvidenceCount = useMemo(
    () => materials.filter((material) => !evidenceReviews[material.id]).length,
    [evidenceReviews, materials],
  );
  const founderPhoto = useMemo(
    () =>
      [...materials]
        .reverse()
        .find((material) => material.name.startsWith('founder-readiness-')),
    [materials],
  );
  const finalToolCalls = useMemo(
    () => summarizeToolCalls(toolEvents),
    [toolEvents],
  );
  const waitingJudge = founderTurn.judgeId
    ? JUDGES.find((judge) => judge.id === founderTurn.judgeId)
    : undefined;
  const focusedJudge = focusedJudgeId
    ? JUDGES.find((judge) => judge.id === focusedJudgeId)
    : undefined;
  const focusedReaction = focusedJudgeId
    ? reactions[focusedJudgeId]
    : undefined;
  const outJudges = JUDGES.filter(
    (judge) => reactions[judge.id].state === 'out',
  );
  const founderFeed = feed.filter((entry) => entry.kind !== 'judge').slice(-6);
  const pitchQueued =
    pitch.status === 'lobby' &&
    handoffStatus === 'waiting' &&
    Boolean(draft.trim());
  const focusedPresentationReset =
    presentationReset.judgeId === focusedJudgeId &&
    (presentationReset.status === 'awaiting' ||
      presentationReset.status === 'captured');
  const focusedJudgeOverlay =
    focusedJudge && focusedReaction ? (
      <div
        className={`judge-focus-stage ${focusedReaction.state === 'out' ? 'judge-focus-out' : ''}`}
        style={
          {
            '--judge-color': focusedJudge.color,
          } as React.CSSProperties
        }
        aria-live="assertive"
      >
        <div className="judge-focus-portrait-wrap">
          <div
            key={`${focusedJudge.id}-${focusedReaction.mood}-${focusedReaction.reactionStyle}-focus`}
            className="judge-focus-portrait screen-change"
            style={reactionPortraitStyle(focusedJudge, focusedReaction)}
          >
            <div className="crt-scanlines" aria-hidden="true" />
            <span>{stateLabel(focusedReaction.state)}</span>
            <strong>{focusedJudge.name}</strong>
            <small>{focusedJudge.role}</small>
            {focusedReaction.state === 'out' && <b>I&apos;M OUT</b>}
          </div>
        </div>
        <div className="judge-focus-copy">
          <span className="judge-focus-kicker">
            {focusedReaction.state === 'out'
              ? 'Decision delivered'
              : `${focusedJudge.name} has the floor`}
          </span>
          <blockquote>“{focusedReaction.spoken}”</blockquote>
          {focusedReaction.question && (
            <p className="judge-focus-question">{focusedReaction.question}</p>
          )}
          {focusedReaction.state === 'out' && (
            <p className="judge-focus-reason">
              <strong>Why:</strong>{' '}
              {focusedReaction.outReason ?? focusedReaction.spoken}
            </p>
          )}
          <Button
            className="judge-focus-respond"
            disabled={
              focusedPresentationReset &&
              presentationReset.status === 'captured'
            }
            onClick={
              focusedReaction.state === 'out' &&
              judgeRescue.status === 'offered' &&
              judgeRescue.judgeId === focusedJudge.id
                ? beginJudgeRescue
                : focusedPresentationReset
                  ? () => void beginPresentationRetake()
                  : focusedReaction.question
                    ? beginFounderResponse
                    : () => setFocusedJudgeId(null)
            }
          >
            {focusedReaction.state === 'out' &&
            judgeRescue.status === 'offered' &&
            judgeRescue.judgeId === focusedJudge.id
              ? "Wait, don't go!"
              : focusedPresentationReset
                ? presentationReset.status === 'captured'
                  ? 'Photo sent · judge reviewing'
                  : 'Make the change & retake'
                : focusedReaction.question
                  ? 'Respond'
                  : 'Back to the room'}
            <ArrowUpRight data-icon="inline-end" />
          </Button>
          {focusedPresentationReset &&
            presentationReset.status === 'awaiting' && (
              <label className="judge-focus-upload">
                <ImageIcon /> Upload a new photo
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="user"
                  onChange={(event) => {
                    void uploadFounderPhoto(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            )}
          {focusedPresentationReset && (
            <p className="judge-focus-reset-note">
              The pitch clock is paused. This opens the founder camera and
              brings its capture controls into view. You may also upload a new
              photo.
            </p>
          )}
          {focusedReaction.state === 'out' &&
            judgeRescue.status === 'offered' &&
            judgeRescue.judgeId === focusedJudge.id && (
              <button
                type="button"
                className="judge-focus-accept-out"
                onClick={() => {
                  const declined: JudgeRescueState = {
                    ...judgeRescue,
                    status: 'declined',
                  };
                  judgeRescueRef.current = declined;
                  appealedJudgeIdsRef.current.add(focusedJudge.id);
                  setJudgeRescue(declined);
                  setFocusedJudgeId(null);
                }}
              >
                Let them leave
              </button>
            )}
          {focusedReaction.state === 'out' &&
            !['offered', 'awaiting', 'answered'].includes(judgeRescue.status) &&
            judgeLifeline.status === 'available' && (
              <button
                type="button"
                className="judge-focus-lifeline"
                onClick={() => recallJudgeWithLifeline(focusedJudge.id)}
              >
                <LifeBuoy /> Use Second Chance
              </button>
            )}
        </div>
      </div>
    ) : null;

  const founderComposerOverlay =
    pitch.status === 'live' &&
    composerOpen &&
    founderTurn.status !== 'presenting' ? (
      <dialog
        open
        className="founder-composer-stage"
        aria-labelledby="founder-composer-title"
      >
        <div className="founder-composer-header">
          <div>
            <span>
              {founderTurn.status === 'awaiting'
                ? `${waitingJudge?.name ?? 'The judge'} is waiting`
                : 'You have the floor'}
            </span>
            <h2 id="founder-composer-title">
              {founderTurn.status === 'awaiting'
                ? 'Answer the room'
                : 'Add to your pitch'}
            </h2>
          </div>
          <div className="founder-composer-header-actions">
            {founderTurn.status === 'awaiting' && (
              <b
                className={
                  responseSecondsLeft <= 10 ? 'composer-timer-urgent' : ''
                }
                aria-label={`${responseSecondsLeft} seconds remaining`}
              >
                {String(Math.floor(responseSecondsLeft / 60)).padStart(2, '0')}:
                {String(responseSecondsLeft % 60).padStart(2, '0')}
              </b>
            )}
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              aria-label="Return to the room"
            >
              <X />
            </button>
          </div>
        </div>

        {founderTurn.status === 'awaiting' && founderTurn.question && (
          <blockquote>{founderTurn.question}</blockquote>
        )}

        <Textarea
          ref={responseInputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter')
              submitDraft();
            if (event.key === 'Escape') setComposerOpen(false);
          }}
          placeholder={
            founderTurn.status === 'awaiting'
              ? `Answer ${waitingJudge?.name ?? 'the judge'}…`
              : 'Continue your pitch…'
          }
          className="founder-composer-input"
        />

        <div className="founder-composer-footer">
          <div>
            <Button
              size="icon"
              variant="ghost"
              className={`rounded-full ${listening ? 'mic-live' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}
              onClick={toggleListening}
              aria-label={listening ? 'Stop listening' : 'Pitch by voice'}
            >
              {listening ? <MicOff /> : <Mic />}
            </Button>
            <span>{listening ? 'Listening…' : 'Voice or type'}</span>
            <small>Ctrl/⌘ + Enter to send</small>
          </div>
          <Button
            className="founder-composer-submit"
            onClick={submitDraft}
            disabled={!draft.trim()}
          >
            {founderTurn.status === 'awaiting'
              ? `Answer ${waitingJudge?.name?.split(' ')[0] ?? 'judge'}`
              : 'Add to pitch'}{' '}
            <Send data-icon="inline-end" />
          </Button>
        </div>
      </dialog>
    ) : null;

  const flowStatus =
    presentationReset.status === 'awaiting'
      ? 'Presentation reset · clock paused for a new photo'
      : presentationReset.status === 'captured'
        ? 'New photo sent · judge reviewing'
        : presentationReset.status === 'reviewed'
          ? 'Retake reviewed · same judge has the floor'
          : judgeLifeline.status === 'pending'
            ? 'Second Chance active · recalled judge has the floor'
            : judgeRescue.status === 'offered'
              ? 'Judge leaving · appeal window open'
              : judgeRescue.status === 'awaiting'
                ? 'Twenty-second rescue · founder answering'
                : founderTurn.status === 'presenting'
                  ? 'Judge speaking · click Respond when ready'
                  : founderTurn.status === 'awaiting'
                    ? 'Waiting for your answer'
                    : founderTurn.status === 'answered'
                      ? 'Answer received · agent evaluating'
                      : speakingJudge
                        ? 'Judge speaking'
                        : pitch.status === 'live'
                          ? 'Room listening'
                          : 'Room ready';

  const utilityOverlay = utilityPanel ? (
    <dialog
      open
      className={`arena-utility-panel arena-utility-${utilityPanel}`}
      aria-label={
        utilityPanel === 'activity'
          ? 'Live WebMCP activity'
          : utilityPanel === 'transcript'
            ? 'Session transcript'
            : 'Report an issue'
      }
    >
      <header>
        <div>
          <span>
            {utilityPanel === 'activity'
              ? 'Live proof'
              : utilityPanel === 'transcript'
                ? 'Session record'
                : 'Help improve the arena'}
          </span>
          <h2>
            {utilityPanel === 'activity'
              ? 'WebMCP activity'
              : utilityPanel === 'transcript'
                ? 'Pitch transcript'
                : 'Report an issue'}
          </h2>
        </div>
        <button onClick={() => setUtilityPanel(null)} aria-label="Close panel">
          <X />
        </button>
      </header>
      {utilityPanel === 'activity' ? (
        <div className="arena-tool-events">
          {toolEvents.length ? (
            [...toolEvents].reverse().map((event) => (
              <div key={event.id} className={`tool-event-${event.phase}`}>
                <i />
                <strong>{event.toolName.replaceAll('_', ' ')}</strong>
                <span>{event.phase}</span>
                <time>{new Date(event.createdAt).toLocaleTimeString()}</time>
              </div>
            ))
          ) : (
            <p>No calls yet. Activity appears when the visiting AI enters.</p>
          )}
        </div>
      ) : utilityPanel === 'transcript' ? (
        <>
          <pre className="arena-transcript-copy">{sessionTranscript()}</pre>
          <Button onClick={downloadTranscript}>
            <Download data-icon="inline-start" /> Download transcript
          </Button>
        </>
      ) : (
        <>
          <Textarea
            value={issueDraft}
            onChange={(event) => setIssueDraft(event.target.value)}
            placeholder="What happened? What did you expect instead?"
            className="arena-issue-input"
          />
          <p className="arena-issue-note">
            Room code, difficulty, current gate, and recent tool activity will
            be attached. Your pitch text is not included.
          </p>
          <Button onClick={openIssueReport} disabled={!issueDraft.trim()}>
            <Bug data-icon="inline-start" /> Open issue report
          </Button>
        </>
      )}
    </dialog>
  ) : null;

  const lifelineOverlay =
    judgeLifeline.status === 'selecting' ? (
      <dialog
        open
        className="arena-lifeline-panel"
        aria-labelledby="lifeline-title"
      >
        <header>
          <div className="lifeline-mark">
            <LifeBuoy />
          </div>
          <div>
            <span>One-use lifeline</span>
            <h2 id="lifeline-title">Second Chance</h2>
            <p>Pull one eliminated judge back for one final question.</p>
          </div>
          <button
            type="button"
            onClick={() => setJudgeLifeline({ status: 'available' })}
            aria-label="Close lifeline"
          >
            <X />
          </button>
        </header>
        <div className="lifeline-judge-grid">
          {outJudges.map((judge) => (
            <button
              type="button"
              key={judge.id}
              style={{ '--judge-color': judge.color } as React.CSSProperties}
              onClick={() => recallJudgeWithLifeline(judge.id)}
            >
              <div
                className="lifeline-judge-portrait"
                style={reactionPortraitStyle(judge, reactions[judge.id])}
              />
              <span>Recall</span>
              <strong>{judge.name}</strong>
              <small>{judge.role}</small>
              <p>{reactions[judge.id].outReason}</p>
            </button>
          ))}
        </div>
        <footer>
          The recalled judge returns skeptical. Their next question is your last
          chance to win them back.
        </footer>
      </dialog>
    ) : null;

  const arenaModalOpen = Boolean(
    composerOpen ||
      pitch.status === 'final' ||
      utilityPanel ||
      judgeLifeline.status === 'selecting',
  );

  return (
    <main className="room-arena text-[#f6f2e9]">
      <div className="room-vignette" aria-hidden="true" />
      <header className="room-header">
        <div className="room-brand">
          <div className="brand-mark">
            <AudioLines className="size-5" />
          </div>
          <div>
            <p className="font-display text-xl tracking-tight">PITCH THE AI</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">
              Four minds. One deal.
            </p>
          </div>
        </div>
        <div className="room-utilities">
          <span
            className={`tool-pill ${toolStatus === 'ready' ? 'tool-pill-ready' : ''}`}
          >
            <span className="tool-dot" />
            {toolStatus === 'ready'
              ? '13 site tools live'
              : 'WebMCP site tools ready'}
          </span>
          <span
            className="tool-pill hidden lg:inline-flex"
            suppressHydrationWarning
          >
            <AudioLines className="size-3.5 text-[#ffc857]" />
            Room {roomCode}
          </span>
          {recordingSession && (
            <button
              type="button"
              className="recording-pill"
              onClick={stopSessionRecording}
            >
              <i /> Recording · stop
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`rounded-full hover:bg-white/10 hover:text-white ${musicOn ? 'text-[#ffc857]' : 'text-white/60'}`}
            aria-label={
              musicOn ? 'Mute mood soundtrack' : 'Enable mood soundtrack'
            }
            onClick={() => {
              if (musicOn) {
                soundtrackStopRef.current?.();
                soundtrackStopRef.current = null;
                heartbeatStopRef.current?.();
                heartbeatStopRef.current = null;
                window.sessionStorage.setItem('pitchtheai:music', 'off');
                setMusicOn(false);
              } else {
                void enableMusic();
              }
            }}
          >
            <Music2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            aria-label={
              voiceOn ? 'Mute beta judge voices' : 'Enable beta judge voices'
            }
            onClick={() => {
              setVoiceOn((current) => !current);
              if (voiceOn) {
                stopVoices();
              }
            }}
          >
            {voiceOn ? <Volume2 /> : <VolumeX />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Open arena menu"
                >
                  <ChevronDown />
                </Button>
              }
            />
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-52 border border-[#ffc857]/20 bg-[#080a0d]/96 text-white shadow-2xl backdrop-blur-xl"
            >
              <DropdownMenuLabel className="text-[#ffc857]/70">
                Pitch The AI
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#ffc857]/12 focus:text-[#ffc857]"
                onClick={() => {
                  window.location.href = '/leaderboard';
                }}
              >
                <Trophy /> Leaderboard
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#ffc857]/12 focus:text-[#ffc857]"
                onClick={() => setUtilityPanel('activity')}
              >
                <Activity /> Live WebMCP activity
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#ffc857]/12 focus:text-[#ffc857]"
                onClick={() => setUtilityPanel('transcript')}
              >
                <FileText /> Session transcript
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#ffc857]/12 focus:text-[#ffc857]"
                onClick={() =>
                  cameraStatus === 'live'
                    ? stopFounderCamera()
                    : void startFounderCamera('live')
                }
              >
                {cameraStatus === 'live' ? <CameraOff /> : <Camera />}{' '}
                {cameraStatus === 'live'
                  ? 'Close founder camera'
                  : 'Open founder camera'}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#ffc857]/12 focus:text-[#ffc857]"
                onClick={() =>
                  recordingSession
                    ? stopSessionRecording()
                    : void startSessionRecording()
                }
              >
                {recordingSession ? <CircleStop /> : <Video />}{' '}
                {recordingSession ? 'Stop recording' : 'Record screen + camera'}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#ffc857]/12 focus:text-[#ffc857]"
                onClick={() => setUtilityPanel('report')}
              >
                <Bug /> Report an issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {cameraStatus === 'live' && cameraMode === 'live' && (
        <aside
          className={`founder-video-dock ${presentationReset.status === 'awaiting' ? 'founder-video-reset' : ''}`}
          aria-label="Live founder video"
        >
          <header>
            <div>
              <span>Founder cam</span>
              <strong>{pitch.founderName.trim() || 'Guest founder'}</strong>
            </div>
            {recordingSession && <b>REC</b>}
          </header>
          <video
            ref={cameraVideoRef}
            autoPlay
            muted
            playsInline
            aria-label="Live founder camera preview"
          />
          <footer>
            <button type="button" onClick={() => void captureFounderPhoto()}>
              <Camera /> Capture judge photo
            </button>
            <button
              type="button"
              onClick={stopFounderCamera}
              disabled={recordingSession}
              aria-label="Turn off founder camera"
            >
              <CameraOff />
            </button>
          </footer>
        </aside>
      )}
      {launchCount !== null && (
        <output className="arena-launch-countdown" aria-live="assertive">
          <span key={launchCount}>{launchCount}</span>
          <small>Entering room {roomCode}</small>
        </output>
      )}
      <section
        className={`room-stage room-${pitch.status} ${arenaModalOpen ? 'room-stage-modal-open' : ''} ${pendingEvidenceCount > 0 && pitch.status === 'live' ? 'room-evidence-pending' : ''}`}
      >
        {arenaModalOpen && (
          <div className="arena-modal-backdrop" aria-hidden="true" />
        )}
        {focusedJudgeOverlay}
        {founderComposerOverlay}
        {utilityOverlay}
        {lifelineOverlay}
        <div className="judge-monitor-grid">
          <div className="room-title">
            <p>
              <Sparkles className="size-3.5" />{' '}
              {pitch.status === 'lobby'
                ? pitchQueued
                  ? `Pitch queued · ${pitch.founderName}`
                  : 'Live pitch arena'
                : pitch.status === 'final'
                  ? 'Final verdict'
                  : `Now pitching · ${pitch.founderName}`}
            </p>
            <h1>
              {pitch.status === 'lobby' && !pitchQueued ? (
                <>
                  Make them lean in.<span>Before patience runs out.</span>
                </>
              ) : (
                <>
                  {pitch.companyName}
                  <span>{pitchAskLabel(pitch.askAmount, pitch.equity)}</span>
                </>
              )}
            </h1>
            <div
              className={`room-clock ${pitch.secondsLeft < 90 ? 'clock-danger' : ''} ${presentationReset.status === 'awaiting' || presentationReset.status === 'captured' ? 'clock-paused' : ''}`}
            >
              <Clock3 className="size-4" />
              <strong>
                {presentationReset.status === 'awaiting' ||
                presentationReset.status === 'captured'
                  ? 'PAUSED'
                  : formatClock(pitch.secondsLeft)}
              </strong>
              <small>
                {presentationReset.status === 'awaiting' ||
                presentationReset.status === 'captured'
                  ? 'Photo reset'
                  : 'Time remaining'}
              </small>
            </div>
            {pitch.status !== 'lobby' && (
              <div className="room-mode-pills">
                <span>
                  {pitch.equity <= 0 ? 'Competition mode' : 'Investment mode'}
                </span>
                <span>{DIFFICULTY_META[pitch.difficulty].label}</span>
              </div>
            )}
          </div>
          {JUDGES.map((judge) => {
            const reaction = reactions[judge.id];
            const judgeBid = bids.find((bid) => bid.judgeId === judge.id);
            const isActiveTurn =
              speakingJudge === judge.id ||
              ((founderTurn.status === 'presenting' ||
                founderTurn.status === 'awaiting') &&
                founderTurn.judgeId === judge.id);
            return (
              <article
                key={judge.id}
                data-judge={judge.id}
                className={`judge-monitor ${reaction.state === 'out' ? 'monitor-out' : ''} ${reaction.state === 'out' && judgeRescue.judgeId === judge.id && ['offered', 'awaiting', 'answered'].includes(judgeRescue.status) ? 'monitor-rescue-pending' : ''} ${reaction.state === 'bidding' ? 'monitor-bidding' : ''} ${speakingJudge === judge.id ? 'monitor-speaking' : ''} ${isActiveTurn ? 'monitor-active-turn' : ''} ${focusedJudgeId === judge.id ? 'monitor-focused-away' : ''}`}
                style={{ '--judge-color': judge.color } as React.CSSProperties}
              >
                <div className="monitor-bezel">
                  <div
                    key={`${judge.id}-${reaction.mood}-${reaction.reactionStyle}`}
                    className="monitor-screen screen-change"
                    style={reactionPortraitStyle(judge, reaction)}
                  >
                    <div className="crt-scanlines" aria-hidden="true" />
                    <span className="monitor-live">
                      {stateLabel(reaction.state)}
                    </span>
                    <span className="monitor-interest-label">
                      Interest <b>{reaction.interest}%</b>
                    </span>
                    <div className="monitor-identity">
                      <strong>{judge.name}</strong>
                      <small>{judge.role}</small>
                    </div>
                    {reaction.state === 'out' && (
                      <div className="judge-out-stamp">
                        <strong>I&apos;M OUT</strong>
                        <span>{reaction.outReason ?? reaction.spoken}</span>
                      </div>
                    )}
                  </div>
                  <div className="monitor-status-strip">
                    <div className="judge-wave" aria-hidden="true">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <i key={index} />
                      ))}
                    </div>
                    <Progress
                      value={reaction.interest}
                      className="judge-progress monitor-interest"
                    />
                    {judgeBid && (
                      <div className="monitor-bid">
                        {money(judgeBid.amount)}{' '}
                        <small>for {judgeBid.equity}%</small>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {pitchQueued && (
          <section className="queued-pitch-card" aria-live="polite">
            <div className="queued-pitch-card-topline">
              <div>
                <span>Pitch locked</span>
                <strong>Waiting for your AI to enter the room</strong>
              </div>
              <i />
              <button
                onClick={() => {
                  clearQueuedPitchSession();
                  setHandoffStatus('idle');
                  setHandoffMessage(
                    'Edit your pitch, then send a fresh prompt.',
                  );
                }}
              >
                Edit &amp; recopy
              </button>
            </div>
            <div className="queued-pitch-copy">{draft.trim()}</div>
            <footer>
              <span className="queued-pulse" aria-hidden="true" />
              {handoffMessage}
            </footer>
          </section>
        )}

        {!pitchQueued && (
          <button
            className={`stage-microphone ${listening ? 'stage-microphone-live' : ''}`}
            onClick={toggleListening}
            aria-label={listening ? 'Stop listening' : 'Pitch by voice'}
          >
            {/* The microphone is a local transparent stage prop; preserving its exact alpha edge is preferable here. */}
            {/* oxlint-disable-next-line next/no-img-element */}
            <img
              src="/arena-microphone-v2.png"
              alt=""
              width={1024}
              height={1536}
            />
            <span>{listening ? 'Listening…' : 'Your mic is live'}</span>
          </button>
        )}

        <div
          className={`room-control-deck ${pitch.status === 'final' ? 'room-control-deck-final' : ''} ${pitchQueued ? 'room-control-deck-queued' : ''}`}
        >
          <div className="room-metrics" aria-label="Pitch status">
            <div>
              <span>Favorability</span>
              <strong>
                {pitch.favorability}
                <small>/100</small>
              </strong>
            </div>
            <div>
              <span>Still in</span>
              <strong>
                {activeJudges}
                <small>/4</small>
              </strong>
            </div>
            <div>
              <span>Round</span>
              <strong>{pitch.round || 'Seed'}</strong>
            </div>
            <div>
              <span>Best offer</span>
              <strong>{leadingBid ? money(leadingBid.amount) : '—'}</strong>
            </div>
            <div className="room-mood">
              <span>Room read</span>
              <strong>
                {MOOD_META[pitch.mood].emoji} {MOOD_META[pitch.mood].label}
              </strong>
            </div>
          </div>

          <div className="room-console-grid">
            <div className="pitch-console room-pitch-console">
              <div className="pitch-stage-topline">
                <span>Your pitch stage</span>
                <div
                  className={`stage-wave ${listening ? 'stage-wave-live' : ''}`}
                  aria-hidden="true"
                >
                  {Array.from({ length: 34 }).map((_, index) => (
                    <i key={index} />
                  ))}
                </div>
                {pitch.status !== 'lobby' && (
                  <output className="arena-flow-status">{flowStatus}</output>
                )}
              </div>
              {pitch.status === 'lobby' ? (
                <div className="opening-pitch-form">
                  <header className="game-setup-intro">
                    <div>
                      <span>Game board setup</span>
                      <h2>Set the terms. Make your case.</h2>
                    </div>
                    <small>Every field below is editable</small>
                  </header>
                  <div className="game-setup-fields">
                    <label
                      htmlFor="pitch-founder-name"
                      className="game-setup-field"
                      data-filled={Boolean(pitch.founderName.trim())}
                    >
                      <span>
                        <UserRound /> Founder name <b>Type here</b>
                      </span>
                      <Input
                        id="pitch-founder-name"
                        aria-label="Founder name"
                        value={pitch.founderName}
                        onChange={(event) =>
                          setPitch((current) => ({
                            ...current,
                            founderName: event.target.value,
                          }))
                        }
                        placeholder="Guest founder…"
                        autoComplete="name"
                      />
                    </label>
                    <label
                      htmlFor="pitch-venture-name"
                      className="game-setup-field"
                      data-filled={Boolean(pitch.companyName.trim())}
                    >
                      <span>
                        <Building2 /> Venture name <b>Type here</b>
                      </span>
                      <Input
                        id="pitch-venture-name"
                        aria-label="Venture name"
                        value={pitch.companyName}
                        onChange={(event) =>
                          setPitch((current) => ({
                            ...current,
                            companyName: event.target.value,
                          }))
                        }
                        placeholder="Untitled venture…"
                      />
                    </label>
                    <label
                      htmlFor="pitch-ask-amount"
                      className="game-setup-field"
                      data-filled={pitch.askAmount > 0}
                    >
                      <span>
                        <CircleDollarSign /> Ask (USD) <b>Type here</b>
                      </span>
                      <Input
                        id="pitch-ask-amount"
                        aria-label="Ask amount in US dollars"
                        inputMode="numeric"
                        type="number"
                        min={0}
                        value={pitch.askAmount || ''}
                        onChange={(event) =>
                          setPitch((current) => ({
                            ...current,
                            askAmount: Math.max(0, Number(event.target.value)),
                          }))
                        }
                        placeholder="250,000…"
                      />
                    </label>
                    <label
                      htmlFor="pitch-equity"
                      className="game-setup-field"
                      data-filled={pitch.equity > 0}
                    >
                      <span>
                        <PieChart /> Equity (%) <b>Type here</b>
                      </span>
                      <Input
                        id="pitch-equity"
                        aria-label="Equity percentage"
                        inputMode="decimal"
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={pitch.equity || ''}
                        onChange={(event) =>
                          setPitch((current) => ({
                            ...current,
                            equity: Math.max(
                              0,
                              Math.min(100, Number(event.target.value)),
                            ),
                          }))
                        }
                        placeholder="10…"
                      />
                    </label>
                  </div>
                  <div className="game-options-grid">
                    <div
                      className="difficulty-picker"
                      aria-label="Pitch difficulty"
                    >
                      <div>
                        <span>Difficulty</span>
                        <small>
                          {DIFFICULTY_META[pitch.difficulty].description}
                        </small>
                      </div>
                      <fieldset aria-label="Choose difficulty">
                        {(
                          Object.keys(DIFFICULTY_META) as PitchDifficulty[]
                        ).map((difficulty) => (
                          <button
                            key={difficulty}
                            type="button"
                            className={
                              pitch.difficulty === difficulty
                                ? 'difficulty-active'
                                : ''
                            }
                            onClick={() =>
                              setPitch((current) => ({
                                ...current,
                                difficulty,
                              }))
                            }
                          >
                            {DIFFICULTY_META[difficulty].label}
                          </button>
                        ))}
                      </fieldset>
                    </div>
                    <div className="lobby-lifeline-card">
                      <div className="lobby-lifeline-icon">
                        <LifeBuoy />
                      </div>
                      <div>
                        <span>Lifeline</span>
                        <strong>Second Chance</strong>
                        <small>Recall one eliminated judge.</small>
                      </div>
                      <b>1 token</b>
                    </div>
                  </div>
                  <label className="opening-pitch-card">
                    <span>
                      Your pitch
                      <small>Product · customer · traction · why you win</small>
                    </span>
                    <Textarea
                      aria-label="Opening pitch"
                      value={draft}
                      maxLength={6000}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={
                        'Explain your product, who it’s for, your traction, and why you’re the team to win…\nMake your case clear, concise, and compelling.'
                      }
                      className="opening-pitch-input resize-none"
                    />
                    <b>{draft.length} / 6000</b>
                  </label>
                  <div className="opening-pitch-actions">
                    <Button
                      className="enter-room-button"
                      onClick={() => void requestAgent()}
                      disabled={handoffStatus === 'requesting' || !roomReady}
                    >
                      {handoffStatus === 'requesting'
                        ? 'Preparing the room…'
                        : 'Enter room with your AI'}{' '}
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                    <div className="opening-handoff-note">
                      <Clock3 />
                      <output data-error={handoffStatus === 'error'}>
                        {handoffMessage ||
                          'When your AI joins the room, the 3–2–1 begins and the clock starts.'}
                      </output>
                    </div>
                  </div>
                </div>
              ) : pitch.status === 'final' ? (
                <div className="arena-final-summary">
                  <div className="arena-final-score">
                    <span>Final score</span>
                    <strong>{pitch.score}</strong>
                    <small>/100</small>
                  </div>
                  <div className="arena-final-copy">
                    <p>THE ROOM&apos;S VERDICT</p>
                    <h2>
                      {pitch.amountRaised ? 'You got a deal.' : 'No deal.'}
                    </h2>
                    <blockquote>{pitch.summary}</blockquote>
                    <div>
                      <b>
                        {acceptedBid
                          ? `Deal with ${acceptedJudge?.name ?? acceptedBid.judgeId}: ${money(acceptedBid.amount)} for ${acceptedBid.equity}%`
                          : `Raised ${money(pitch.amountRaised ?? 0)}`}
                      </b>
                      <span>{formatClock(pitch.durationSeconds ?? 0)}</span>
                    </div>
                    {finalToolCalls.length > 0 && (
                      <section className="arena-final-tools">
                        <header>
                          <Activity />
                          <span>WebMCP receipt</span>
                          <b>
                            {finalToolCalls.reduce(
                              (total, item) => total + item.count,
                              0,
                            )}{' '}
                            calls
                          </b>
                        </header>
                        <div>
                          {finalToolCalls.map((item) => (
                            <span key={item.name}>
                              {item.name} <b>×{item.count}</b>
                            </span>
                          ))}
                        </div>
                      </section>
                    )}
                    <div className="arena-final-actions">
                      <Button onClick={() => void shareSession()}>
                        <Share2 data-icon="inline-start" /> Share result
                      </Button>
                      <Button variant="outline" onClick={downloadTranscript}>
                        <Download data-icon="inline-start" /> Transcript
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          window.location.href = '/leaderboard';
                        }}
                      >
                        <Trophy data-icon="inline-start" /> Leaderboard
                      </Button>
                      <Button variant="outline" onClick={resetPitch}>
                        <RotateCcw data-icon="inline-start" /> Pitch again
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setUtilityPanel('report')}
                      >
                        <Bug data-icon="inline-start" /> Report issue
                      </Button>
                    </div>
                  </div>
                </div>
              ) : offerDecision.status === 'choosing' || acceptedBid ? (
                <section className="deal-table" aria-live="assertive">
                  {acceptedBid ? (
                    <div
                      className="deal-selected"
                      style={
                        {
                          '--judge-color': acceptedJudge?.color ?? '#ffc857',
                        } as React.CSSProperties
                      }
                    >
                      <span>Founder&apos;s decision</span>
                      <h2>DEAL SELECTED</h2>
                      <p>
                        {acceptedJudge?.name ?? acceptedBid.judgeId}
                        <strong>
                          {money(acceptedBid.amount)} for {acceptedBid.equity}%
                        </strong>
                      </p>
                      {acceptedBid.conditions && (
                        <blockquote>{acceptedBid.conditions}</blockquote>
                      )}
                      <small>
                        The founder chose the investor. Waiting for the
                        panel&apos;s final verdict.
                      </small>
                    </div>
                  ) : (
                    <>
                      <header className="deal-table-header">
                        <div>
                          <span>
                            {bids.length > 1
                              ? 'Live bidding war'
                              : 'Offer on the table'}
                          </span>
                          <h2>You control the deal.</h2>
                          <p>
                            Choose an investor, counter one offer, or walk away
                            from all of them.
                          </p>
                        </div>
                        <b>
                          {String(
                            Math.floor(responseSecondsLeft / 60),
                          ).padStart(2, '0')}
                          :{String(responseSecondsLeft % 60).padStart(2, '0')}
                        </b>
                      </header>
                      <div
                        className={`deal-offer-grid deal-offer-grid-${Math.min(bids.length, 4)}`}
                      >
                        {bids.map((bid) => {
                          const judge = JUDGES.find(
                            (item) => item.id === bid.judgeId,
                          );
                          const isCountering =
                            counteringJudgeId === bid.judgeId;
                          return (
                            <article
                              key={bid.judgeId}
                              className={`deal-offer-card ${isCountering ? 'deal-offer-countering' : ''}`}
                              style={
                                {
                                  '--judge-color': judge?.color ?? '#ffc857',
                                } as React.CSSProperties
                              }
                            >
                              <span>{judge?.name ?? bid.judgeId}</span>
                              <strong>{money(bid.amount)}</strong>
                              <b>for {bid.equity}%</b>
                              {bid.conditions && <p>{bid.conditions}</p>}
                              <div>
                                <button onClick={() => acceptOffer(bid)}>
                                  Accept
                                </button>
                                <button onClick={() => beginCounterOffer(bid)}>
                                  Counter
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {counteringJudgeId && (
                        <form
                          className="deal-counter-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submitCounterOffer();
                          }}
                        >
                          <div>
                            <span>Countering</span>
                            <strong>
                              {JUDGES.find(
                                (judge) => judge.id === counteringJudgeId,
                              )?.name ?? counteringJudgeId}
                            </strong>
                          </div>
                          <label htmlFor="counter-amount">
                            <span>Amount</span>
                            <Input
                              id="counter-amount"
                              type="number"
                              min={1}
                              value={counterAmount}
                              onChange={(event) =>
                                setCounterAmount(event.target.value)
                              }
                            />
                          </label>
                          <label htmlFor="counter-equity">
                            <span>Equity %</span>
                            <Input
                              id="counter-equity"
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={counterEquity}
                              onChange={(event) =>
                                setCounterEquity(event.target.value)
                              }
                            />
                          </label>
                          <Input
                            aria-label="Counter conditions"
                            value={counterNote}
                            onChange={(event) =>
                              setCounterNote(event.target.value)
                            }
                            placeholder="Optional condition"
                          />
                          <Button type="submit">Send counter</Button>
                          <button
                            type="button"
                            onClick={() => setCounteringJudgeId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                      <button
                        className="deal-pass"
                        onClick={() => submitOfferDecision({ action: 'pass' })}
                      >
                        Reject every offer
                      </button>
                    </>
                  )}
                </section>
              ) : (
                <div className="p-3">
                  {pendingEvidenceCount > 0 && (
                    <div className="evidence-gate-banner">
                      <LoaderCircle className="size-3.5 animate-spin" />
                      Agent must review {pendingEvidenceCount} uploaded file
                      {pendingEvidenceCount === 1 ? '' : 's'} before the panel
                      enters.
                    </div>
                  )}
                  <div className="pitch-dialogue-feed" aria-live="polite">
                    {founderFeed.length === 0 ? (
                      <p className="feed-empty">
                        Your answers and arena events will appear here. Judge
                        dialogue appears beneath each screen.
                      </p>
                    ) : (
                      founderFeed.map((entry) => (
                        <div
                          key={entry.id}
                          className={`feed-entry feed-${entry.kind}`}
                        >
                          <strong>{entry.author}</strong>
                          <p>
                            {entry.text}
                            {entry.streaming && (
                              <i className="streaming-cursor" />
                            )}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    className={`founder-compose-trigger ${founderTurn.status === 'awaiting' ? 'founder-compose-trigger-waiting' : ''}`}
                    onClick={() => setComposerOpen(true)}
                    disabled={founderTurn.status === 'presenting'}
                  >
                    <span>
                      {founderTurn.status === 'awaiting'
                        ? `${waitingJudge?.name ?? 'A judge'} is waiting`
                        : 'Your response'}
                    </span>
                    <strong>
                      {draft.trim() ||
                        (founderTurn.status === 'awaiting'
                          ? 'Open the stage to answer…'
                          : 'Open the stage to speak or type…')}
                    </strong>
                    <ArrowUpRight />
                  </button>
                </div>
              )}
            </div>
            <div className="room-deck-actions">
              <button
                className="caption-toggle"
                onClick={() => setCaptionsOn((value) => !value)}
              >
                {captionsOn ? 'Hide' : 'Show'} captions
              </button>
              <button className="caption-toggle" onClick={resetPitch}>
                <RotateCcw className="size-3.5" /> Reset room
              </button>
              {pitch.status === 'live' && (
                <button
                  className={`caption-toggle live-lifeline-button ${judgeLifeline.status === 'pending' ? 'lifeline-pending' : ''}`}
                  onClick={() => setJudgeLifeline({ status: 'selecting' })}
                  disabled={
                    judgeLifeline.status !== 'available' ||
                    outJudges.length === 0 ||
                    ['offered', 'awaiting', 'answered'].includes(
                      judgeRescue.status,
                    )
                  }
                  title={
                    outJudges.length === 0 &&
                    judgeLifeline.status === 'available'
                      ? 'Available after a judge leaves the room'
                      : 'Recall one eliminated judge'
                  }
                >
                  <LifeBuoy className="size-3.5" />
                  {judgeLifeline.status === 'available'
                    ? 'Second Chance'
                    : judgeLifeline.status === 'pending'
                      ? 'Lifeline active'
                      : 'Lifeline used'}
                </button>
              )}
              <button
                className={`caption-toggle ${musicOn ? 'deck-action-live' : ''}`}
                onClick={() => {
                  if (musicOn) {
                    soundtrackStopRef.current?.();
                    soundtrackStopRef.current = null;
                    heartbeatStopRef.current?.();
                    heartbeatStopRef.current = null;
                    window.sessionStorage.setItem('pitchtheai:music', 'off');
                    setMusicOn(false);
                  } else void enableMusic();
                }}
              >
                <Music2 className="size-3.5" />{' '}
                {musicOn ? 'Score on' : 'Add score'}
              </button>
              <label className="music-level">
                <span>Music {Math.round(musicLevel * 100)}%</span>
                <input
                  type="range"
                  min="0"
                  max="0.65"
                  step="0.05"
                  value={musicLevel}
                  onChange={(event) =>
                    setMusicLevel(Number(event.target.value))
                  }
                />
              </label>
              <section
                className="founder-camera-slot"
                aria-label="Founder camera"
              >
                <header>
                  <span>Founder</span>
                  <strong>{pitch.founderName.trim() || 'Guest founder'}</strong>
                  {recordingSession && <b>REC</b>}
                </header>
                <div className="founder-camera-frame">
                  {cameraStatus === 'live' && cameraMode === 'photo' ? (
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      aria-label="Founder photo preview"
                    />
                  ) : founderPhoto ? (
                    <NextImage
                      src={founderPhoto.url}
                      alt={`${pitch.founderName.trim() || 'Founder'} readiness capture`}
                      fill
                      unoptimized
                    />
                  ) : (
                    <div className="founder-camera-empty">
                      {cameraStatus === 'requesting' ? (
                        <LoaderCircle />
                      ) : (
                        <UserRound />
                      )}
                      <span>
                        {cameraStatus === 'requesting'
                          ? 'Opening…'
                          : cameraStatus === 'live'
                            ? 'Capture from the live camera'
                            : 'Add your photo'}
                      </span>
                    </div>
                  )}
                  {cameraStatus === 'live' && cameraMode === 'photo' ? (
                    <i>Live preview</i>
                  ) : founderPhoto ? (
                    <i>MCP evidence</i>
                  ) : null}
                </div>
                <div className="founder-camera-actions">
                  {cameraStatus === 'live' && cameraMode === 'photo' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void captureFounderPhoto()}
                      >
                        <Camera /> Capture judge photo
                      </button>
                      <button
                        className="icon-only"
                        type="button"
                        onClick={stopFounderCamera}
                        aria-label="Close photo preview"
                      >
                        <CameraOff />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startFounderCamera('photo')}
                      disabled={cameraStatus === 'requesting'}
                    >
                      <Camera />
                      {founderPhoto ? 'Retake photo' : 'Take your photo'}
                    </button>
                  )}
                  <label>
                    <ImageIcon /> Upload instead
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="user"
                      onChange={(event) => {
                        void uploadFounderPhoto(event.currentTarget.files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
                <label className="founder-photo-public">
                  <input
                    type="checkbox"
                    checked={publishFounderPhoto}
                    disabled={!founderPhoto}
                    onChange={(event) =>
                      setPublishFounderPhoto(event.target.checked)
                    }
                  />
                  <span>
                    Show this photo on my public leaderboard record
                    <small>Off by default. Judges can still review it.</small>
                  </span>
                </label>
                <div className="founder-video-actions">
                  <button
                    type="button"
                    onClick={() =>
                      cameraStatus === 'live' && cameraMode === 'live'
                        ? stopFounderCamera()
                        : void startFounderCamera('live')
                    }
                    disabled={cameraStatus === 'requesting' || recordingSession}
                  >
                    {cameraStatus === 'live' && cameraMode === 'live' ? (
                      <CameraOff />
                    ) : (
                      <Video />
                    )}
                    {cameraStatus === 'live' && cameraMode === 'live'
                      ? 'Stop live video'
                      : 'Start live video'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      recordingSession
                        ? stopSessionRecording()
                        : void startSessionRecording()
                    }
                  >
                    {recordingSession ? <CircleStop /> : <Video />}
                    {recordingSession
                      ? 'Stop & download recording'
                      : 'Record arena + founder cam'}
                  </button>
                </div>
                <small>
                  {cameraMessage ||
                    'Photo evidence and lower-left live video are separate. Recording downloads locally.'}
                </small>
              </section>
            </div>
          </div>

          <div className="evidence-tray room-evidence-tray">
            <div className="flex flex-wrap items-center gap-2">
              <label className="evidence-upload">
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(event) => {
                    void uploadMaterials(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
                {uploading ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Paperclip className="size-3.5" />
                )}
                {uploading ? 'Uploading evidence…' : 'Add pitch evidence'}
              </label>
              <span className="text-[11px] text-white/28">
                Images, deck PDF/PPTX, or one-pager · 12 MB each
              </span>
              {uploadError && (
                <span className="text-[11px] text-[#ff8ea0]">
                  {uploadError}
                </span>
              )}
            </div>
            {materials.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {materials.map((material) => (
                  <div className="evidence-chip" key={material.id}>
                    {material.contentType.startsWith('image/') ? (
                      <ImageIcon className="size-3.5" />
                    ) : (
                      <FileText className="size-3.5" />
                    )}
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-40 truncate"
                    >
                      {material.name}
                    </a>
                    <span
                      className={
                        evidenceReviews[material.id]
                          ? 'evidence-reviewed'
                          : 'evidence-pending'
                      }
                    >
                      {evidenceReviews[material.id]
                        ? 'Reviewed'
                        : 'Needs review'}
                    </span>
                    <button
                      onClick={() => void removeMaterial(material.id)}
                      aria-label={`Remove ${material.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
