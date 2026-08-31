import {
  deleteMaterial,
  getMaterial,
  listMaterials,
  saveMaterial,
} from '@/db/materials';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const object = await getMaterial(id);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('cache-control', 'private, max-age=300');
    headers.set('x-content-type-options', 'nosniff');
    return new Response(object.body, { headers });
  }
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId)
    return Response.json({ error: 'sessionId is required' }, { status: 400 });
  return Response.json({ materials: await listMaterials(sessionId) });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const sessionId = form.get('sessionId');
  const file = form.get('file');
  if (typeof sessionId !== 'string' || !(file instanceof File)) {
    return Response.json(
      { error: 'A file and sessionId are required.' },
      { status: 400 },
    );
  }
  if (file.size > 12 * 1024 * 1024) {
    return Response.json(
      { error: 'Files must be 12 MB or smaller.' },
      { status: 413 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { error: 'Use JPG, PNG, WebP, PDF, TXT, Markdown, or PPTX.' },
      { status: 415 },
    );
  }
  return Response.json(
    { material: await saveMaterial(sessionId, file) },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { id?: string; sessionId?: string };
  if (!body.id || !body.sessionId)
    return Response.json(
      { error: 'id and sessionId are required' },
      { status: 400 },
    );
  const removed = await deleteMaterial(body.id, body.sessionId);
  return Response.json({ removed }, { status: removed ? 200 : 404 });
}
