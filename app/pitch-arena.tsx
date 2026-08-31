'use client';

import {
  ArrowUpRight,
  AudioLines,
  ChevronDown,
  Clock3,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  MicOff,
  Music2,
  Paperclip,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import {
  hasBringMyAiAgentBridge,
  requestPitchAgent,
} from '@/lib/agent-handoff';
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
export type JudgeReaction = {
  judgeId: JudgeId;
  state: JudgeState;
  interest: number;
  mood: JudgeMood;
  spoken: string;
  question?: string;
};
export type Bid = {
  judgeId: JudgeId;
  amount: number;
  equity: number;
  conditions?: string;
  spoken: string;
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
  status: 'open' | 'awaiting' | 'answered' | 'timed_out';
  judgeId?: JudgeId;
  question?: string;
  deadline?: number;
  lastResponse?: string;
};
export type EvidenceReview = {
  materialId: string;
  summary: string;
  reviewedAt: number;
};
type PitchStatus = 'lobby' | 'live' | 'final';
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
  askAmount: number;
  equity: number;
  transcript: string;
  status: PitchStatus;
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
  founderName: 'Guest founder',
  companyName: 'Untitled venture',
  askAmount: 250000,
  equity: 10,
  transcript: '',
  status: 'lobby',
  round: 0,
  secondsLeft: 8 * 60,
  favorability: 50,
  mood: 'skeptical',
  soundtrack: 'cinematic',
};

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

export function PitchArena() {
  const [pitch, setPitch] = useState<PitchState>(DEFAULT_PITCH);
  const [reactions, setReactions] =
    useState<Record<JudgeId, JudgeReaction>>(DEFAULT_REACTIONS);
  const [bids, setBids] = useState<Bid[]>([]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('checking');
  const [speakingJudge, setSpeakingJudge] = useState<JudgeId | null>(null);
  const [musicOn, setMusicOn] = useState(false);
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
  const [responseSecondsLeft, setResponseSecondsLeft] = useState(45);
  const [musicLevel, setMusicLevel] = useState(0.42);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [toolStatus, setToolStatus] = useState<
    'checking' | 'ready' | 'browser-only'
  >('checking');
  const [agentHost, setAgentHost] = useState<'codex' | 'bringmyai'>(() =>
    typeof window !== 'undefined' && hasBringMyAiAgentBridge()
      ? 'bringmyai'
      : 'codex',
  );
  const [handoffStatus, setHandoffStatus] = useState<
    'idle' | 'requesting' | 'waiting' | 'connected' | 'error'
  >('idle');
  const [handoffMessage, setHandoffMessage] = useState('');
  const pitchRef = useRef(pitch);
  const reactionsRef = useRef(reactions);
  const bidsRef = useRef(bids);
  const leaderboardRef = useRef(leaderboard);
  const voiceOnRef = useRef(voiceOn);
  const materialsRef = useRef(materials);
  const draftRef = useRef(draft);
  const evidenceReviewsRef = useRef(evidenceReviews);
  const feedRef = useRef(feed);
  const founderTurnRef = useRef(founderTurn);
  const responseWaiterRef = useRef<{
    resolve: (value: Record<string, unknown>) => void;
    timer: number;
  } | null>(null);
  const panelProfileRef = useRef(panelProfile);
  const sessionIdRef = useRef(
    typeof window === 'undefined' ? '' : crypto.randomUUID(),
  );
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundtrackStopRef = useRef<(() => void) | null>(null);
  const twoMinuteWarningRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const activeVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceProviderRef = useRef<VoiceProvider>('checking');

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
    leaderboardRef.current = leaderboard;
  }, [leaderboard]);
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

  const enableMusic = useCallback(async () => {
    const AudioContextClass = window.AudioContext;
    if (!audioContextRef.current)
      audioContextRef.current = new AudioContextClass();
    await audioContextRef.current.resume();
    setMusicOn(true);
  }, []);

  const activeSoundtrack =
    pitch.status === 'live' && pitch.secondsLeft <= 120
      ? 'heartbeat'
      : pitch.soundtrack;

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
    (next?: Partial<PitchState>) => {
      const openingPitch = next?.transcript?.trim() || draftRef.current.trim();
      const nextPitch: PitchState = {
        ...DEFAULT_PITCH,
        ...next,
        transcript: openingPitch,
        status: 'live',
        round: 0,
        secondsLeft: 8 * 60,
        startedAt: Date.now(),
      };
      pitchRef.current = nextPitch;
      setPitch(nextPitch);
      setReactions(DEFAULT_REACTIONS);
      setPanelProfile(createPanelProfile());
      setBids([]);
      setDraft('');
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
      setResponseSecondsLeft(45);
      twoMinuteWarningRef.current = false;
      setHandoffStatus('connected');
      setHandoffMessage('Agent connected. The panel is live.');
      stopVoices();
    },
    [stopVoices],
  );
  const requestAgent = useCallback(async () => {
    const companyName = pitch.companyName.trim();
    if (!companyName || companyName === 'Untitled venture') {
      setHandoffStatus('error');
      setHandoffMessage('Give the pitch a name first.');
      return;
    }
    setHandoffStatus('requesting');
    setHandoffMessage('Handing the room to your agent…');
    try {
      await enableMusic();
      const result = await requestPitchAgent({
        founderName: pitch.founderName,
        companyName,
        askAmount: pitch.askAmount,
        equity: pitch.equity,
        pitch: draft,
      });
      setAgentHost(result.host);
      if (pitchRef.current.status === 'live') return;
      setHandoffStatus('waiting');
      setHandoffMessage(
        result.host === 'bringmyai'
          ? 'Request sent to your selected agent. The clock starts when it joins.'
          : 'Panel prompt copied. Paste and send it in Codex; the clock starts when the agent joins.',
      );
    } catch (error) {
      setHandoffStatus('error');
      setHandoffMessage(
        error instanceof Error
          ? error.message
          : 'The agent handoff did not start.',
      );
    }
  }, [draft, enableMusic, pitch]);
  const updatePitchDetails = useCallback((update: PitchDetailsUpdate) => {
    setPitch((current) => ({
      ...current,
      founderName: update.founderName?.trim() || current.founderName,
      companyName: update.companyName.trim() || current.companyName,
      askAmount: Math.max(0, Math.round(update.askAmount)),
      equity: Math.max(0.1, Math.min(100, update.equity)),
      favorability: clampInterest(update.favorability),
      mood: update.mood,
      soundtrack: update.soundtrack,
    }));
  }, []);
  const resetPitch = useCallback(() => {
    setPitch(DEFAULT_PITCH);
    setReactions(DEFAULT_REACTIONS);
    setBids([]);
    setDraft('');
    setFeed([]);
    setFounderTurn({ status: 'open' });
    setEvidenceReviews({});
    twoMinuteWarningRef.current = false;
    soundtrackStopRef.current?.();
    soundtrackStopRef.current = null;
    setMusicOn(false);
    if (responseWaiterRef.current) {
      window.clearTimeout(responseWaiterRef.current.timer);
      responseWaiterRef.current.resolve({ status: 'cancelled' });
      responseWaiterRef.current = null;
    }
    stopVoices();
  }, [stopVoices]);

  const applyJudgeTurn = useCallback(
    (roundSummary: string, reaction: JudgeReaction) => {
      const normalized: JudgeReaction = {
        ...reaction,
        interest: clampInterest(reaction.interest),
      };
      setReactions((current) => ({
        ...current,
        [reaction.judgeId]: normalized,
      }));
      setPitch((current) => ({
        ...current,
        round: current.round + 1,
        summary: roundSummary,
      }));
      if (reaction.question) {
        const nextTurn: FounderTurnState = {
          status: 'awaiting',
          judgeId: reaction.judgeId,
          question: reaction.question,
          deadline: Date.now() + 45_000,
        };
        founderTurnRef.current = nextTurn;
        setFounderTurn(nextTurn);
        setResponseSecondsLeft(45);
      } else {
        const nextTurn: FounderTurnState = { status: 'open' };
        founderTurnRef.current = nextTurn;
        setFounderTurn(nextTurn);
      }
      speak([{ judgeId: reaction.judgeId, text: reaction.spoken }]);
    },
    [speak],
  );

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
      appendFeed({
        kind: 'system',
        author: 'Arena',
        text: `${reviews.length} evidence item${reviews.length === 1 ? '' : 's'} reviewed. The panel may enter.`,
      });
    },
    [appendFeed],
  );

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
      if (turn.status !== 'awaiting') {
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
      const deadline = turn.deadline ?? Date.now();
      const deadlineRemaining = Math.max(0, deadline - Date.now());
      const waitSlice = Math.max(
        0,
        Math.min(timeoutSeconds * 1000, deadlineRemaining),
      );
      return new Promise<Record<string, unknown>>((resolve) => {
        const timer = window.setTimeout(() => {
          const latest = founderTurnRef.current;
          const latestDeadline = latest.deadline ?? deadline;
          if (latest.status === 'answered') {
            responseWaiterRef.current = null;
            resolve({
              status: 'answered',
              response: latest.lastResponse,
              judgeId: latest.judgeId,
              question: latest.question,
            });
            return;
          }
          if (latest.status !== 'awaiting') {
            responseWaiterRef.current = null;
            resolve({ status: latest.status });
            return;
          }
          if (Date.now() < latestDeadline) {
            responseWaiterRef.current = null;
            resolve({
              status: 'waiting',
              judgeId: latest.judgeId,
              question: latest.question,
              secondsRemaining: Math.max(
                1,
                Math.ceil((latestDeadline - Date.now()) / 1000),
              ),
              next: 'Call wait_for_founder_response again immediately. Do not post another judge turn.',
            });
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
          responseWaiterRef.current = null;
          resolve({
            status: 'timed_out',
            judgeId: latest.judgeId,
            question: latest.question,
            waitedSeconds: 45,
          });
        }, waitSlice);
        responseWaiterRef.current = { resolve, timer };
      });
    },
    [appendFeed],
  );
  const applyJudgeRound = useCallback(
    (roundSummary: string, nextReactions: JudgeReaction[]) => {
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
      speak(
        nextBids.map((bid) => ({ judgeId: bid.judgeId, text: bid.spoken })),
      );
    },
    [speak],
  );
  const finalizePitch = useCallback(
    async (result: {
      score: number;
      summary: string;
      amountRaised: number;
      winningJudgeId?: JudgeId;
    }) => {
      const snapshot = pitchRef.current;
      const finalPitch = {
        ...snapshot,
        status: 'final' as const,
        score: Math.max(0, Math.min(100, Math.round(result.score))),
        summary: result.summary,
        amountRaised: Math.max(0, Math.round(result.amountRaised)),
        durationSeconds: Math.max(
          0,
          Math.round((Date.now() - (snapshot.startedAt ?? Date.now())) / 1000),
        ),
      };
      setPitch(finalPitch);
      try {
        await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            founderName: finalPitch.founderName,
            companyName: finalPitch.companyName,
            score: finalPitch.score,
            amountRaised: finalPitch.amountRaised,
            askAmount: finalPitch.askAmount,
            durationSeconds: finalPitch.durationSeconds,
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
    const unregister = registerPitchTools({
      getSnapshot: () => ({
        openingDraft: draftRef.current,
        pitch: pitchRef.current,
        judges: JUDGES.map((judge) => ({
          id: judge.id,
          name: judge.name,
          role: judge.role,
          ...reactionsRef.current[judge.id],
        })),
        bids: bidsRef.current,
        materials: materialsRef.current.map((material) => ({
          ...material,
          url: new URL(material.url, window.location.href).toString(),
        })),
        conversation: feedRef.current,
        founderTurn: founderTurnRef.current,
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
      applyBidRound,
      finalizePitch,
      fetchLeaderboard,
      onStatus: setToolStatus,
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
    waitForFounderResponse,
  ]);

  useEffect(() => {
    if (pitch.status !== 'live') return;
    const timer = window.setInterval(() => {
      setPitch((current) =>
        current.status !== 'live' || current.secondsLeft <= 0
          ? current
          : { ...current, secondsLeft: current.secondsLeft - 1 },
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pitch.status]);

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
      text: 'Two minutes remain. The music cuts. Heartbeat only.',
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
      if (turn.status === 'awaiting') {
        const answered: FounderTurnState = {
          ...turn,
          status: 'answered',
          lastResponse: cleaned,
        };
        founderTurnRef.current = answered;
        setFounderTurn(answered);
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
    },
    [appendFeed],
  );

  const submitDraft = useCallback(() => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    submitFounderResponse(cleaned);
  }, [draft, submitFounderResponse]);

  const uploadMaterials = useCallback(async (files: FileList | null) => {
    if (!files?.length || !sessionIdRef.current) return;
    setUploading(true);
    setUploadError('');
    try {
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
        setMaterials((current) => [...current, result.material!].slice(0, 12));
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

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
        founderTurnRef.current.status === 'awaiting' &&
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
  const pendingEvidenceCount = useMemo(
    () => materials.filter((material) => !evidenceReviews[material.id]).length,
    [evidenceReviews, materials],
  );
  const waitingJudge = founderTurn.judgeId
    ? JUDGES.find((judge) => judge.id === founderTurn.judgeId)
    : undefined;
  const founderFeed = feed.filter((entry) => entry.kind !== 'judge').slice(-6);

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
            {agentHost === 'bringmyai'
              ? '10 tools + agent bridge'
              : toolStatus === 'ready'
                ? '10 site tools live'
                : 'Site tools in Codex / ChatGPT'}
          </span>
          <span className="tool-pill hidden lg:inline-flex">
            <AudioLines className="size-3.5 text-[#ffc857]" />
            Judge voices beta
          </span>
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <section
        className={`room-stage room-${pitch.status} ${pendingEvidenceCount > 0 && pitch.status === 'live' ? 'room-evidence-pending' : ''}`}
      >
        <div className="judge-monitor-grid">
          <div className="room-title">
            <p>
              <Sparkles className="size-3.5" /> Live pitch arena
            </p>
            <h1>
              Make them lean in.<span>Before patience runs out.</span>
            </h1>
            <div
              className={`room-clock ${pitch.secondsLeft < 90 ? 'clock-danger' : ''}`}
            >
              <Clock3 className="size-4" />
              <strong>{formatClock(pitch.secondsLeft)}</strong>
              <small>Time remaining</small>
            </div>
            {pitch.status !== 'lobby' && (
              <div className="room-pitch-brief">
                <strong>{pitch.companyName}</strong>
                <span>
                  {money(pitch.askAmount)} for {pitch.equity}%
                </span>
              </div>
            )}
          </div>
          {JUDGES.map((judge) => {
            const reaction = reactions[judge.id];
            const judgeBid = bids.find((bid) => bid.judgeId === judge.id);
            const isActiveTurn =
              speakingJudge === judge.id ||
              (founderTurn.status === 'awaiting' &&
                founderTurn.judgeId === judge.id);
            const hasJudgeResponse =
              reaction.spoken && reaction.spoken !== 'Waiting for the pitch.';
            return (
              <article
                key={judge.id}
                data-judge={judge.id}
                className={`judge-monitor ${reaction.state === 'out' ? 'monitor-out' : ''} ${reaction.state === 'bidding' ? 'monitor-bidding' : ''} ${speakingJudge === judge.id ? 'monitor-speaking' : ''} ${isActiveTurn ? 'monitor-active-turn' : ''}`}
                style={{ '--judge-color': judge.color } as React.CSSProperties}
              >
                <div className="monitor-bezel">
                  <div
                    key={`${judge.id}-${reaction.mood}`}
                    className="monitor-screen screen-change"
                    style={{
                      backgroundImage: `url(${judge.portrait})`,
                      backgroundPositionX: portraitPosition(reaction.mood),
                    }}
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
                {captionsOn && hasJudgeResponse && (
                  <div className="judge-response-overlay" aria-live="polite">
                    <strong>{judge.name}</strong>
                    <p>“{reaction.spoken}”</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>

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

        <div className="room-control-deck">
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
              </div>
              {pitch.status === 'lobby' ? (
                <div className="opening-pitch-form">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
                      Ready when you are
                    </p>
                    <p className="mt-0.5 max-w-2xl text-sm text-white/80">
                      Give the room your opening pitch. Bring My AI can send it
                      straight to your selected agent; Codex uses a one-click
                      copy handoff.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      aria-label="Founder name"
                      value={pitch.founderName}
                      onChange={(event) =>
                        setPitch((current) => ({
                          ...current,
                          founderName: event.target.value,
                        }))
                      }
                      placeholder="Founder name"
                      className="h-8 border-white/10 bg-white/[0.04] text-xs"
                    />
                    <Input
                      aria-label="Pitch name"
                      value={pitch.companyName}
                      onChange={(event) =>
                        setPitch((current) => ({
                          ...current,
                          companyName: event.target.value,
                        }))
                      }
                      placeholder="Pitch or company name"
                      className="h-8 border-white/10 bg-white/[0.04] text-xs"
                    />
                    <Input
                      aria-label="Ask amount"
                      type="number"
                      min={0}
                      value={pitch.askAmount}
                      onChange={(event) =>
                        setPitch((current) => ({
                          ...current,
                          askAmount: Math.max(0, Number(event.target.value)),
                        }))
                      }
                      placeholder="Ask amount"
                      className="h-8 border-white/10 bg-white/[0.04] text-xs"
                    />
                    <Input
                      aria-label="Equity percentage"
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={pitch.equity}
                      onChange={(event) =>
                        setPitch((current) => ({
                          ...current,
                          equity: Math.max(
                            0.1,
                            Math.min(100, Number(event.target.value)),
                          ),
                        }))
                      }
                      placeholder="Equity %"
                      className="h-8 border-white/10 bg-white/[0.04] text-xs"
                    />
                  </div>
                  <Textarea
                    aria-label="Opening pitch"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="What are you pitching? Tell the judges what it is, who wants it, your traction, and why you win."
                    className="opening-pitch-input resize-none border-white/10 bg-white/[0.04] text-sm"
                  />
                  <div className="opening-pitch-actions flex flex-wrap items-center gap-3">
                    <Button
                      className="h-8 bg-[#ffc857] text-black hover:bg-[#ffd77e]"
                      onClick={() => void requestAgent()}
                      disabled={handoffStatus === 'requesting'}
                    >
                      {handoffStatus === 'requesting'
                        ? 'Calling your agent…'
                        : agentHost === 'bringmyai'
                          ? 'Enter with my agent'
                          : 'Enter room with Codex'}{' '}
                      <ArrowUpRight data-icon="inline-end" />
                    </Button>
                    <output
                      className={`text-xs ${handoffStatus === 'error' ? 'text-red-300' : 'text-white/48'}`}
                    >
                      {handoffMessage ||
                        'Entering unlocks the score. The clock waits for the agent.'}
                    </output>
                  </div>
                </div>
              ) : pitch.status === 'final' ? (
                <div className="flex min-h-32 items-center justify-between gap-5 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffc857]">
                      Pitch closed
                    </p>
                    <p className="mt-2 text-lg text-white/82">
                      The panel has delivered its final verdict.
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="font-display text-4xl text-[#ffc857]">
                      {pitch.score}
                    </strong>
                    <span className="text-xs text-white/30">/100</span>
                  </div>
                </div>
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
                  {founderTurn.status === 'awaiting' && (
                    <div className="founder-response-gate">
                      <div>
                        <strong>
                          {waitingJudge?.name ?? 'A judge'} is waiting
                        </strong>
                        <span>{founderTurn.question}</span>
                      </div>
                      <b>
                        {String(Math.floor(responseSecondsLeft / 60)).padStart(
                          2,
                          '0',
                        )}
                        :{String(responseSecondsLeft % 60).padStart(2, '0')}
                      </b>
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
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        (event.ctrlKey || event.metaKey) &&
                        event.key === 'Enter'
                      )
                        submitDraft();
                    }}
                    placeholder={
                      founderTurn.status === 'awaiting'
                        ? `Answer ${waitingJudge?.name ?? 'the judge'}…`
                        : 'Continue your pitch… metrics, customers, moat, the ask.'
                    }
                    className="min-h-14 resize-none border-0 bg-transparent text-sm text-white placeholder:text-white/30 focus-visible:ring-0"
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-white/8 px-2 pt-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`rounded-full ${listening ? 'mic-live' : 'text-white/55 hover:bg-white/10 hover:text-white'}`}
                        onClick={toggleListening}
                        aria-label={
                          listening ? 'Stop listening' : 'Pitch by voice'
                        }
                      >
                        {listening ? <MicOff /> : <Mic />}
                      </Button>
                      <span className="text-xs text-white/35">
                        {listening ? 'Listening…' : 'Voice or type'}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="bg-white text-black hover:bg-white/80"
                      onClick={submitDraft}
                      disabled={!draft.trim()}
                    >
                      {founderTurn.status === 'awaiting'
                        ? `Answer ${waitingJudge?.name?.split(' ')[0] ?? 'judge'}`
                        : 'Add to pitch'}{' '}
                      <Send data-icon="inline-end" />
                    </Button>
                  </div>
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
              <button
                className={`caption-toggle ${musicOn ? 'deck-action-live' : ''}`}
                onClick={() => {
                  if (musicOn) {
                    soundtrackStopRef.current?.();
                    soundtrackStopRef.current = null;
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
          {pitch.status === 'final' && (
            <div className="room-final-verdict">
              <span>Panel verdict</span>
              <strong>
                {pitch.score}
                <small>/100</small>
              </strong>
              <p>{pitch.summary}</p>
              <b>
                Raised {money(pitch.amountRaised ?? 0)} ·{' '}
                {formatClock(pitch.durationSeconds ?? 0)}
              </b>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
