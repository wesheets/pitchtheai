declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    MATERIALS: R2Bucket;
    ELEVENLABS_API_KEY?: string;
    ELEVENLABS_DAILY_CHARACTER_LIMIT?: string;
  }
}
