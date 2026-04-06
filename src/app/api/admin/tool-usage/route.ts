import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { TOOLBOX_TOOLS } from '@/lib/tools/toolbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdminOrDeveloper(req: NextRequest): Promise<{ ok: true; actor: User; actorId: string } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  const actor = userDoc.data() as User;
  if (actor.role !== 'Admin' && actor.role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin or Developer access required.' }, { status: 403 }) };
  }

  return { ok: true, actor, actorId: decoded.uid };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;

    const db = getAdminDb();
    const [summarySnap, recentEventsSnap] = await Promise.all([
      db.collection('toolboxToolUsageSummary').orderBy('totalCount', 'desc').limit(50).get(),
      db.collection('toolboxToolUsageEvents').orderBy('createdAt', 'desc').limit(12).get(),
    ]);

    const toolMeta = new Map(
      TOOLBOX_TOOLS.map((tool) => [tool.id, { name: tool.name, category: tool.category, access: tool.access }]),
    );

    const summary = summarySnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const toolId = String(data.toolId || doc.id);
      const meta = toolMeta.get(toolId);
      return {
        toolId,
        name: meta?.name || toolId,
        category: meta?.category || 'Unknown',
        access: meta?.access || 'free',
        totalCount: Number(data.totalCount || 0),
        authenticatedCount: Number(data.authenticatedCount || 0),
        anonymousCount: Number(data.anonymousCount || 0),
        lastOpenedAt: typeof data.lastOpenedAt === 'string' ? data.lastOpenedAt : null,
        lastSource: typeof data.lastSource === 'string' ? data.lastSource : null,
      };
    });

    const recentEvents = recentEventsSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const toolId = String(data.toolId || '');
      const meta = toolMeta.get(toolId);
      return {
        id: doc.id,
        toolId,
        name: meta?.name || toolId,
        source: typeof data.source === 'string' ? data.source : null,
        role: typeof data.role === 'string' ? data.role : null,
        isAuthenticated: Boolean(data.isAuthenticated),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      };
    });

    return NextResponse.json({
      ok: true,
      summary,
      recentEvents,
      totals: {
        totalOpens: summary.reduce((sum, row) => sum + row.totalCount, 0),
        trackedTools: summary.length,
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to load tool usage.' }, { status: 500 });
  }
}
