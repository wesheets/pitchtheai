'use client';

import {
  ArrowUpRight,
  AudioLines,
  CircleDollarSign,
  Clock3,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Mic,
  MicOff,
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
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { registerPitchTools } from '@/lib/webmcp';

export type JudgeId = 'maya' | 'julian' | 'priya' | 'theo';
export type JudgeState = 'listening' | 'pressing' | 'bidding' | 'out';
export type JudgeReaction = {
  judgeId: JudgeId;
  state: JudgeState;
  interest: number;
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
type PitchState = {
  founderName: string;
  companyName: string;
  askAmount: number;
  equity: number;
  transcript: string;
  status: PitchStatus;
  round: number;
  secondsLeft: number;
  summary?: string;
  score?: number;
  amountRaised?: number;
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
  voicePitch: number;
  voiceRate: number;
}> = [
  {
    id: 'maya',
    name: 'Maya Cross',
    role: 'Market realist',
    initials: 'MC',
    color: '#65e6ff',
    voicePitch: 1.12,
    voiceRate: 1.04,
  },
  {
    id: 'julian',
    name: 'Julian Voss',
    role: 'Brand contrarian',
    initials: 'JV',
    color: '#bc9cff',
    voicePitch: 0.88,
    voiceRate: 0.96,
  },
  {
    id: 'priya',
    name: 'Priya Nair',
    role: 'Unit economics',
    initials: 'PN',
    color: '#ffc857',
    voicePitch: 1,
    voiceRate: 1.08,
  },
  {
    id: 'theo',
    name: 'Theo Grant',
    role: 'Scale operator',
    initials: 'TG',
    color: '#ff7189',
    voicePitch: 0.76,
    voiceRate: 0.92,
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
};
const DEFAULT_REACTIONS = Object.fromEntries(
  JUDGES.map((judge) => [
    judge.id,
    {
      judgeId: judge.id,
      state: 'listening',
      interest: 50,
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

export function PitchArena() {
  const [pitch, setPitch] = useState<PitchState>(DEFAULT_PITCH);
  const [reactions, setReactions] =
    useState<Record<JudgeId, JudgeReaction>>(DEFAULT_REACTIONS);
  const [bids, setBids] = useState<Bid[]>([]);
  const [draft, setDraft] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
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

  const speak = useCallback(
    (lines: Array<{ judgeId: JudgeId; text: string }>) => {
      if (
        !voiceOnRef.current ||
        typeof window === 'undefined' ||
        !window.speechSynthesis
      )
        return;
      window.speechSynthesis.cancel();
      for (const line of lines) {
        const judge = JUDGES.find((item) => item.id === line.judgeId);
        if (!judge) continue;
        const utterance = new SpeechSynthesisUtterance(
          `${judge.name}. ${line.text}`,
        );
        utterance.pitch = judge.voicePitch;
        utterance.rate = judge.voiceRate;
        window.speechSynthesis.speak(utterance);
      }
    },
    [],
  );

  const startPitch = useCallback((next?: Partial<PitchState>) => {
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
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);
  const resetPitch = useCallback(() => {
    setPitch(DEFAULT_PITCH);
    setReactions(DEFAULT_REACTIONS);
    setBids([]);
    setDraft('');
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }, []);
  const applyJudgeRound = useCallback(
    (roundSummary: string, nextReactions: JudgeReaction[]) => {
      const normalized = Object.fromEntries(
        nextReactions.map((reaction) => [
          reaction.judgeId,
          { ...reaction, interest: clampInterest(reaction.interest) },
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
    <main className="min-h-screen overflow-hidden bg-[#080a0f] text-[#f6f2e9]">
      <div className="arena-grid fixed inset-0 opacity-60" aria-hidden="true" />
      <div className="spotlight spotlight-left" aria-hidden="true" />
      <div className="spotlight spotlight-right" aria-hidden="true" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-10">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
          <span
            className={`tool-pill ${toolStatus === 'ready' ? 'tool-pill-ready' : ''}`}
          >
            <span className="tool-dot" />
            {toolStatus === 'ready'
              ? '6 site tools live'
              : 'Site tools in ChatGPT'}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white/60 hover:bg-white/10 hover:text-white"
            aria-label={voiceOn ? 'Mute judge voices' : 'Enable judge voices'}
            onClick={() => {
              setVoiceOn((current) => !current);
              if (voiceOn) window.speechSynthesis?.cancel();
            }}
          >
            {voiceOn ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-[1500px] px-4 pb-12 pt-6 md:px-8">
        <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="stage-panel p-5 md:p-7">
            <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#ffc857]">
                  <Sparkles className="size-3.5" /> Live pitch arena
                </p>
                <h1 className="font-display max-w-4xl text-4xl leading-[0.96] tracking-[-0.035em] md:text-6xl">
                  Make them lean in.
                  <span className="block text-white/35">
                    Before patience runs out.
                  </span>
                </h1>
              </div>
              <div
                className={`clock ${pitch.secondsLeft < 90 ? 'clock-danger' : ''}`}
              >
                <Clock3 className="size-4" />
                <span>{formatClock(pitch.secondsLeft)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {JUDGES.map((judge) => {
                const reaction = reactions[judge.id];
                const judgeBid = bids.find((bid) => bid.judgeId === judge.id);
                return (
                  <Card
                    key={judge.id}
                    className={`judge-card ${reaction.state === 'out' ? 'judge-out' : ''} ${reaction.state === 'bidding' ? 'judge-bidding' : ''}`}
                    style={
                      { '--judge-color': judge.color } as React.CSSProperties
                    }
                  >
                    <CardHeader className="flex-row items-center gap-3">
                      <div className="judge-avatar">{judge.initials}</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display truncate text-lg">
                          {judge.name}
                        </p>
                        <p className="truncate text-[11px] uppercase tracking-[0.14em] text-white/40">
                          {judge.role}
                        </p>
                      </div>
                      <span className="judge-state">
                        {stateLabel(reaction.state)}
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/35">
                          <span>Interest</span>
                          <span>{reaction.interest}%</span>
                        </div>
                        <Progress
                          value={reaction.interest}
                          className="judge-progress"
                        />
                      </div>
                      {captionsOn && (
                        <p className="min-h-14 text-sm leading-relaxed text-white/72">
                          “{reaction.spoken}”
                        </p>
                      )}
                      {judgeBid && (
                        <div className="bid-chip">
                          <span>{money(judgeBid.amount)}</span>
                          <small>for {judgeBid.equity}%</small>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="pitch-console">
                {pitch.status === 'lobby' ? (
                  <div className="flex min-h-32 flex-col items-start justify-center p-5">
                    <p className="text-sm text-white/45">Ready when you are.</p>
                    <p className="mt-1 max-w-xl text-lg text-white/85">
                      Open this page in ChatGPT, ask it to join the panel, then
                      pitch by voice or text.
                    </p>
                    <Button
                      className="mt-4 bg-[#ffc857] text-black hover:bg-[#ffd77e]"
                      onClick={() => startPitch()}
                    >
                      Enter the room <ArrowUpRight data-icon="inline-end" />
                    </Button>
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
                      className="min-h-24 resize-none border-0 bg-transparent text-base text-white placeholder:text-white/30 focus-visible:ring-0"
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
              <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
                <button
                  className="caption-toggle"
                  onClick={() => setCaptionsOn((value) => !value)}
                >
                  {captionsOn ? 'Hide' : 'Show'} captions
                </button>
                <button className="caption-toggle" onClick={resetPitch}>
                  <RotateCcw className="size-3.5" /> Reset
                </button>
              </div>
            </div>
            <div className="evidence-tray">
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
          </div>

          <aside className="space-y-4">
            <div className="metric-grid">
              <div className="metric-card">
                <span>Still in</span>
                <strong>
                  {activeJudges}
                  <small>/4</small>
                </strong>
              </div>
              <div className="metric-card">
                <span>Best offer</span>
                <strong>{leadingBid ? money(leadingBid.amount) : '—'}</strong>
              </div>
              <div className="metric-card">
                <span>Your ask</span>
                <strong>{money(pitch.askAmount)}</strong>
              </div>
              <div className="metric-card">
                <span>Round</span>
                <strong>{pitch.round}</strong>
              </div>
            </div>
            {pitch.status === 'final' && (
              <div className="final-card">
                <p className="text-xs uppercase tracking-[0.18em] text-[#ffc857]">
                  Panel verdict
                </p>
                <div className="my-3 flex items-end gap-2">
                  <strong>{pitch.score}</strong>
                  <span>/100</span>
                </div>
                <p className="text-sm leading-relaxed text-white/65">
                  {pitch.summary}
                </p>
                <p className="mt-4 text-sm">
                  <span className="text-white/40">Raised </span>
                  {money(pitch.amountRaised ?? 0)}
                </p>
              </div>
            )}
            <div className="leaderboard-panel">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-2 font-display text-xl">
                    <Trophy className="size-4 text-[#ffc857]" /> Pitch board
                  </p>
                  <p className="text-xs text-white/35">
                    Top scores, then capital raised
                  </p>
                </div>
                <span className="live-badge">Live</span>
              </div>
              <div className="space-y-1.5">
                {leaderboard.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-white/35">
                    First deal takes the board.
                  </p>
                ) : (
                  leaderboard.slice(0, 6).map((entry, index) => (
                    <div className="leader-row" key={entry.id}>
                      <span className="leader-rank">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {entry.companyName}
                        </p>
                        <p className="truncate text-[11px] text-white/35">
                          {entry.founderName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#ffc857]">
                          {entry.score}
                        </p>
                        <p className="text-[10px] text-white/35">
                          {money(entry.amountRaised)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="how-card">
              <CircleDollarSign className="size-5 text-[#65e6ff]" />
              <div>
                <p className="text-sm font-medium">The twist</p>
                <p className="mt-1 text-xs leading-relaxed text-white/42">
                  Weak pitches burn patience. Strong pitches can turn the panel
                  against itself in a live bidding war.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
