import { dashboardData, getProjects, getRecentAlertCount, listeningData, briefList } from '@/lib/data';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { alerts as alertsTable, mentions } from '@/lib/db/schema';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';

export type ClientProject = { id: number; name: string };

export async function authorizedClientProject(requestedId?: number): Promise<ClientProject | null> {
  const user = await getCurrentUser();
  if (!user || !['client', 'admin'].includes(user.role)) return null;
  const projects = await getProjects();
  const selected = requestedId ? projects.find((p) => p.id === requestedId) : projects[0];
  return selected ? { id: selected.id, name: selected.name } : null;
}

export async function clientOverview(projectId: number) {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const previousSince = new Date(Date.now() - 14 * 86_400_000);
  const [dashboard, alerts, briefs, previous, pending, negativeTotal, negativeRows, recentAlerts] = await Promise.all([
    dashboardData(projectId),
    getRecentAlertCount(projectId),
    briefList(projectId),
    db.select({ n: sql<number>`count(*)` }).from(mentions)
      .where(and(eq(mentions.projectId, projectId), gte(mentions.publishedAt, previousSince), lt(mentions.publishedAt, since))),
    db.select({ n: sql<number>`count(*)` }).from(mentions)
      .where(and(eq(mentions.projectId, projectId), gte(mentions.publishedAt, since), isNull(mentions.sentiment))),
    db.select({ n: sql<number>`count(*)` }).from(mentions)
      .where(and(eq(mentions.projectId, projectId), gte(mentions.publishedAt, since), inArray(mentions.sentiment, ['negative', 'negativo']))),
    db.select({ id: mentions.id, title: mentions.title, source: mentions.source,
      url: mentions.url, publishedAt: mentions.publishedAt }).from(mentions)
      .where(and(eq(mentions.projectId, projectId), gte(mentions.publishedAt, since), inArray(mentions.sentiment, ['negative', 'negativo'])))
      .orderBy(desc(mentions.publishedAt)).limit(4),
    db.select({ id: alertsTable.id, severity: alertsTable.severity,
      message: alertsTable.message, createdAt: alertsTable.createdAt }).from(alertsTable)
      .where(and(eq(alertsTable.projectId, projectId), gte(alertsTable.createdAt, new Date(Date.now() - 24 * 3600_000))))
      .orderBy(desc(alertsTable.createdAt)).limit(4),
  ]);
  const items = dashboard.latest.slice(0, 7).map((m) => ({
    id: m.id,
    source: m.source,
    title: m.title || 'Publicação sem título',
    url: m.url || null,
    publishedAt: m.publishedAt.toISOString(),
    sentiment: m.sentiment ?? null,
  }));
  return {
    periodDays: 7,
    mentions: Number(dashboard.kpi.total7) || 0,
    previousMentions: Number(previous[0]?.n ?? 0),
    pending: Number(pending[0]?.n ?? 0),
    negative: Number(negativeTotal[0]?.n ?? 0),
    latestPublishedAt: dashboard.latest[0]?.publishedAt.toISOString() ?? null,
    negativeItems: negativeRows.map((item) => ({
      id: item.id, title: item.title || 'Título não informado', source: item.source,
      url: item.url || null, publishedAt: item.publishedAt.toISOString(),
    })),
    alertItems: recentAlerts.map((item) => ({
      id: item.id, severity: item.severity, message: item.message,
      createdAt: item.createdAt.toISOString(),
    })),
    briefPreview: briefs[0]?.content?.trim().slice(0, 800) || null,
    sources: Number(dashboard.kpi.sources) || 0,
    averageSentiment: dashboard.kpi.avgSentiment ?? null,
    alerts,
    latest: items,
    topics: dashboard.topTopics.slice(0, 6).map((t) => ({ topic: t.topic, count: Number(t.n) || 0 })),
    latestBrief: briefs[0] ? { id: briefs[0].id, date: String(briefs[0].briefDate) } : null,
  };
}

export async function clientMentions(projectId: number, filters: {
  page?: number; q?: string; source?: string; days?: number;
}) {
  const list = await listeningData(projectId, {
    page: Math.max(1, Math.min(1000, filters.page ?? 1)),
    q: filters.q?.slice(0, 140),
    source: filters.source?.slice(0, 100),
    days: filters.days && filters.days >= 1 && filters.days <= 90 ? filters.days : undefined,
  });
  return {
    total: Number(list.total) || 0,
    page: list.page,
    pageSize: list.pageSize,
    mentions: list.rows.map((m) => ({
      id: m.id,
      title: m.title || 'Publicação sem título',
      source: m.source,
      excerpt: (m.content || '').slice(0, 220),
      url: m.url || null,
      publishedAt: m.publishedAt.toISOString(),
      sentiment: m.sentiment ?? null,
      relevance: m.relevance ?? null,
    })),
  };
}
