import { NextResponse } from 'next/server';
import { authorizedClientProject, clientOverview } from '@/lib/client-portal';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (user.role !== 'client' && user.role !== 'admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const raw = new URL(req.url).searchParams.get('projectId');
  const id = raw === null ? undefined : Number(raw);
  if (raw !== null && (!Number.isSafeInteger(id) || id! <= 0))
    return NextResponse.json({ error: 'invalid_project' }, { status: 400 });
  const project = await authorizedClientProject(id);
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  const data = await clientOverview(project.id);
  return NextResponse.json({ project, ...data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
