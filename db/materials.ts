import { env } from 'cloudflare:workers';

export type PitchMaterial = {
  id: string;
  name: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: number;
};

async function ensureMaterials() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS pitch_materials (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_pitch_materials_session
    ON pitch_materials(session_id, created_at ASC)
  `).run();
}

export async function listMaterials(sessionId: string) {
  await ensureMaterials();
  const result = await env.DB.prepare(
    `SELECT id, name, content_type AS contentType, size, created_at AS createdAt
     FROM pitch_materials WHERE session_id = ? ORDER BY created_at ASC LIMIT 12`,
  )
    .bind(sessionId)
    .all<Omit<PitchMaterial, 'url'>>();
  return result.results.map((item) => ({
    ...item,
    url: `/api/materials?id=${encodeURIComponent(item.id)}`,
  }));
}

export async function saveMaterial(sessionId: string, file: File) {
  await ensureMaterials();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await env.MATERIALS.put(`pitch-materials/${id}`, file.stream(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { originalName: file.name },
  });
  await env.DB.prepare(
    `INSERT INTO pitch_materials (id, session_id, name, content_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      sessionId,
      file.name.slice(0, 180),
      file.type || 'application/octet-stream',
      file.size,
      createdAt,
    )
    .run();
  return {
    id,
    name: file.name.slice(0, 180),
    contentType: file.type || 'application/octet-stream',
    size: file.size,
    createdAt,
    url: `/api/materials?id=${encodeURIComponent(id)}`,
  } satisfies PitchMaterial;
}

export async function getMaterial(id: string) {
  return env.MATERIALS.get(`pitch-materials/${id}`);
}

export async function deleteMaterial(id: string, sessionId: string) {
  await ensureMaterials();
  const existing = await env.DB.prepare(
    'SELECT id FROM pitch_materials WHERE id = ? AND session_id = ?',
  )
    .bind(id, sessionId)
    .first<{ id: string }>();
  if (!existing) return false;
  await env.MATERIALS.delete(`pitch-materials/${id}`);
  await env.DB.prepare(
    'DELETE FROM pitch_materials WHERE id = ? AND session_id = ?',
  )
    .bind(id, sessionId)
    .run();
  return true;
}
