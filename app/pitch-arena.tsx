'use client';

import {
  ArrowUpRight,
  AudioLines,
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
  soundtrack: 'silence',
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
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('checking');
  const [speakingJudge, setSpeakingJudge] = useState<JudgeId | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [panelProfile, setPanelProfile] = useState<PanelProfile>(() =>
    createPanelProfile(),
  );
  const [materials, setMaterials] = useState<PitchMaterial[]>([]);
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
  const panelProfileRef = useRef(panelProfile);
  const sessionIdRef = useRef(
    typeof window === 'undefined' ? '' : crypto.randomUUID(),
  );
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundtrackStopRef = useRef<(() => void) | null>(null);
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

  useEffect(() => {
    soundtrackStopRef.current?.();
    soundtrackStopRef.current = null;
    const context = audioContextRef.current;
    if (!musicOn || !context || pitch.soundtrack === 'silence') return;
    const stop = startSoundtrack(context, pitch.soundtrack);
    soundtrackStopRef.current = stop;
    return () => {
      stop();
      soundtrackStopRef.current = null;
    };
  }, [musicOn, pitch.soundtrack]);

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

  const speak = useCallback(
    (lines: Array<{ judgeId: JudgeId; text: string }>) => {
      if (!voiceOnRef.current || typeof window === 'undefined') return;
      stopVoices();
      const controller = new AbortController();
      voiceAbortRef.current = controller;
      void (async () => {
        for (const line of lines) {
          if (controller.signal.aborted || !voiceOnRef.current) break;
          setSpeakingJudge(line.judgeId);
          try {
            const provider = await speakJudge(
              line.judgeId,
              line.text,
              voiceProviderRef.current,
              controller.signal,
              (audio) => {
                activeVoiceAudioRef.current = audio;
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
      setPitch({
        ...DEFAULT_PITCH,
        ...next,
        transcript: '',
        status: 'live',
        round: 0,
        secondsLeft: 8 * 60,
      });
      setReactions(DEFAULT_REACTIONS);
      setPanelProfile(createPanelProfile());
      setBids([]);
      setDraft('');
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
  }, [draft, pitch]);
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
    stopVoices();
  }, [stopVoices]);
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
        panelDirectives: panelProfileRef.current,
      }),
      startPitch,
      updatePitchDetails,
      applyJudgeRound,
      applyBidRound,
      finalizePitch,
      fetchLeaderboard,
      onStatus: setToolStatus,
    });
    return unregister;
  }, [
    applyBidRound,
    applyJudgeRound,
    fetchLeaderboard,
    finalizePitch,
    startPitch,
    updatePitchDetails,
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

  const submitDraft = useCallback(() => {
    const cleaned = draft.trim();
    if (!cleaned) return;
    setPitch((current) => ({
      ...current,
      transcript: [current.transcript, cleaned].filter(Boolean).join('\n'),
    }));
    setDraft('');
  }, [draft]);

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
    if (response.ok)
      setMaterials((current) => current.filter((item) => item.id !== id));
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
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
    recognition.onresult = (event) => {
      let text = '';
      for (let index = 0; index < event.results.length; index += 1)
        text += event.results[index][0].transcript;
      setDraft(text.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [listening]);

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
              ? '7 tools + agent bridge'
              : toolStatus === 'ready'
                ? '7 site tools live'
                : 'Site tools in Codex / ChatGPT'}
          </span>
          <span className="tool-pill hidden lg:inline-flex">
            <AudioLines className="size-3.5 text-[#ffc857]" />
            {voiceProvider === 'elevenlabs'
              ? '4 streamed voices'
              : voiceProvider === 'checking'
                ? 'Checking voices'
                : '4 browser voices'}
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
            aria-label={voiceOn ? 'Mute judge voices' : 'Enable judge voices'}
            onClick={() => {
              setVoiceOn((current) => !current);
              if (voiceOn) {
                stopVoices();
              }
            }}
          >
            {voiceOn ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      </header>
      <section className={`room-stage room-${pitch.status}`}>
        <div className="judge-monitor-grid">
          <div className="room-title">
            <p><Sparkles className="size-3.5" /> Live pitch arena</p>
            <h1>Make them lean in.<span>Before patience runs out.</span></h1>
            <div className={`room-clock ${pitch.secondsLeft < 90 ? 'clock-danger' : ''}`}>
              <Clock3 className="size-4" />
              <strong>{formatClock(pitch.secondsLeft)}</strong>
              <small>Time remaining</small>
            </div>
          </div>
          {JUDGES.map((judge) => {
            const reaction = reactions[judge.id];
            const judgeBid = bids.find((bid) => bid.judgeId === judge.id);
            return (
              <article
                key={judge.id}
                data-judge={judge.id}
                className={`judge-monitor ${reaction.state === 'out' ? 'monitor-out' : ''} ${reaction.state === 'bidding' ? 'monitor-bidding' : ''} ${speakingJudge === judge.id ? 'monitor-speaking' : ''}`}
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
                    <span className="monitor-live">{stateLabel(reaction.state)}</span>
                    <span className="monitor-interest-label">Interest <b>{reaction.interest}%</b></span>
                    <div className="monitor-identity">
                      <strong>{judge.name}</strong>
                      <small>{judge.role}</small>
                    </div>
                  </div>
                  <div className="monitor-status-strip">
                    <div className="judge-wave" aria-hidden="true">
                      {Array.from({ length: 9 }).map((_, index) => <i key={index} />)}
                    </div>
                    <Progress value={reaction.interest} className="judge-progress monitor-interest" />
                    {captionsOn && <p>“{reaction.spoken}”</p>}
                    {judgeBid && <div className="monitor-bid">{money(judgeBid.amount)} <small>for {judgeBid.equity}%</small></div>}
                  </div>
                </div>
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
            <div><span>Favorability</span><strong>{pitch.favorability}<small>/100</small></strong></div>
            <div><span>Still in</span><strong>{activeJudges}<small>/4</small></strong></div>
            <div><span>Round</span><strong>{pitch.round || 'Seed'}</strong></div>
            <div><span>Best offer</span><strong>{leadingBid ? money(leadingBid.amount) : '—'}</strong></div>
            <div className="room-mood"><span>Room read</span><strong>{MOOD_META[pitch.mood].emoji} {MOOD_META[pitch.mood].label}</strong></div>
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
                  <div className="space-y-3 p-3.5">
                    <div>
                      <p className="text-sm text-white/45">Ready when you are.</p>
                      <p className="mt-1 max-w-2xl text-lg text-white/85">
                        Give the room your opening pitch. Bring My AI can send it
                        straight to your selected agent; Codex uses a one-click
                        copy handoff.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        className="border-white/10 bg-white/[0.04]"
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
                        className="border-white/10 bg-white/[0.04]"
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
                        className="border-white/10 bg-white/[0.04]"
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
                        className="border-white/10 bg-white/[0.04]"
                      />
                    </div>
                    <Textarea
                      aria-label="Opening pitch"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="What are you pitching? Tell the judges what it is, who wants it, your traction, and why you win."
                      className="min-h-24 border-white/10 bg-white/[0.04] text-base"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        className="bg-[#ffc857] text-black hover:bg-[#ffd77e]"
                        onClick={() => void requestAgent()}
                        disabled={handoffStatus === 'requesting'}
                      >
                        {handoffStatus === 'requesting'
                          ? 'Calling your agent…'
                          : agentHost === 'bringmyai'
                            ? 'Start with my agent'
                            : 'Send to Codex'}{' '}
                        <ArrowUpRight data-icon="inline-end" />
                      </Button>
                      <output
                        className={`text-sm ${handoffStatus === 'error' ? 'text-red-300' : 'text-white/48'}`}
                      >
                        {handoffMessage ||
                          'The eight-minute clock waits for the agent.'}
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
                      placeholder="Continue your pitch… metrics, customers, moat, the ask."
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
                        Add to pitch <Send data-icon="inline-end" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            <div className="room-deck-actions">
              <button className="caption-toggle" onClick={() => setCaptionsOn((value) => !value)}>
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
                <Music2 className="size-3.5" /> {musicOn ? 'Score on' : 'Add score'}
              </button>
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
              <strong>{pitch.score}<small>/100</small></strong>
              <p>{pitch.summary}</p>
              <b>Raised {money(pitch.amountRaised ?? 0)}</b>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
