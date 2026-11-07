import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { authorizedClientProject, clientMentions } from '@/lib/client-portal';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'client' && user.role !== 'admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const q = new URL(req.url).searchParams;
  const raw = q.get('projectId');
  const id = raw === null ? undefined : Number(raw);
  if (raw !== null && (!Number.isSafeInteger(id) || id! <= 0))
    return NextResponse.json({ error: 'invalid_project' }, { status: 400 });
  const project = await authorizedClientProject(id);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  const page = Number(q.get('page') || 1);
  const days = Number(q.get('days') || 0);
  const data = await clientMentions(project.id, {
    page: Number.isSafeInteger(page) ? page : 1,
    q: q.get('q') || undefined,
    source: q.get('source') || undefined,
    days: Number.isSafeInteger(days) ? days : undefined,
  });
  return NextResponse.json({ project, ...data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
