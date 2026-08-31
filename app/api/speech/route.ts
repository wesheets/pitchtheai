import { env } from 'cloudflare:workers';

const VOICES = {
  maya: { id: 'jsCqWAovK2LkecY7zXl4', stability: 0.46, style: 0.18 },
  julian: { id: 'pNInz6obpgDQGcFmaJgB', stability: 0.55, style: 0.26 },
  priya: { id: 'jBpfuIE2acCO8z3wKNLl', stability: 0.5, style: 0.16 },
  theo: { id: 'onwK4e9ZLuTAKqWW03F9', stability: 0.62, style: 0.12 },
} as const;

type JudgeId = keyof typeof VOICES;

function isJudgeId(value: unknown): value is JudgeId {
  return typeof value === 'string' && value in VOICES;
}

async function reserveCharacters(characters: number) {
  const configuredLimit = Number(env.ELEVENLABS_DAILY_CHARACTER_LIMIT);
  const dailyLimit = Number.isFinite(configuredLimit)
    ? Math.max(1_000, configuredLimit)
    : 20_000;
  const day = new Date().toISOString().slice(0, 10);

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS voice_usage (
      day TEXT PRIMARY KEY,
      characters INTEGER NOT NULL
    )`,
  ).run();

  const result = await env.DB.prepare(
    `INSERT INTO voice_usage (day, characters) VALUES (?, ?)
     ON CONFLICT(day) DO UPDATE SET characters = characters + excluded.characters
     WHERE characters + excluded.characters <= ?`,
  )
    .bind(day, characters, dailyLimit)
    .run();

  return result.meta.changes > 0;
}

export function GET() {
  return Response.json({
    provider: env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'browser',
    streaming: Boolean(env.ELEVENLABS_API_KEY),
    fallback: true,
  });
}

export async function POST(request: Request) {
  if (!env.ELEVENLABS_API_KEY) {
    return Response.json(
      {
        provider: 'browser',
        fallback: true,
        error: 'Voice service is offline.',
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!isJudgeId(body.judgeId) || !text || text.length > 600) {
    return Response.json(
      { error: 'Provide a valid judgeId and 1–600 characters of speech.' },
      { status: 400 },
    );
  }
  if (!(await reserveCharacters(text.length))) {
    return Response.json(
      {
        provider: 'browser',
        fallback: true,
        error: 'Daily voice limit reached.',
      },
      { status: 429 },
    );
  }

  const voice = VOICES[body.judgeId];
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}/stream?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'xi-api-key': env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability: voice.stability,
          similarity_boost: 0.78,
          style: voice.style,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok || !response.body) {
    return Response.json(
      {
        provider: 'browser',
        fallback: true,
        error: `ElevenLabs returned ${response.status}.`,
      },
      { status: 502 },
    );
  }

  return new Response(response.body, {
    headers: {
      'cache-control': 'no-store',
      'content-type': response.headers.get('content-type') ?? 'audio/mpeg',
      'x-voice-provider': 'elevenlabs',
    },
  });
}
