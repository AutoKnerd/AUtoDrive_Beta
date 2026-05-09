import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const subscribeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  company: z.string().trim().min(1),
  role: z.string().trim().min(1),
  source: z.string().trim().min(1).default('autoknerd-popup'),
});

function parseAutomationIds(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseRoleAutomationMap(value: string | undefined): Record<string, string[]> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Record<string, string | string[] | undefined>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([role, automationValue]) => {
          const ids = Array.isArray(automationValue)
            ? automationValue
            : typeof automationValue === 'string'
              ? automationValue.split(',')
              : [];

          return [role, ids.map((entry) => entry.trim()).filter(Boolean)] as const;
        })
        .filter(([, ids]) => ids.length > 0)
    );
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = subscribeSchema.parse(body);

    const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();
    const apiToken = process.env.BEEHIIV_API_TOKEN?.trim();

    if (!publicationId || !apiToken) {
      return NextResponse.json(
        {
          error: 'Missing Beehiiv credentials. Set BEEHIIV_PUBLICATION_ID and BEEHIIV_API_TOKEN in .env.local.',
        },
        { status: 500 }
      );
    }

    const normalizedPublicationId = publicationId.startsWith('pub_')
      ? publicationId
      : `pub_${publicationId}`;
    const defaultAutomationIds = parseAutomationIds(process.env.BEEHIIV_AUTOMATION_IDS);
    const roleAutomationMap = parseRoleAutomationMap(process.env.BEEHIIV_ROLE_AUTOMATION_IDS_JSON);
    const automationIds = [
      ...defaultAutomationIds,
      ...(roleAutomationMap[parsed.role] ?? []),
    ];

    const response = await fetch(`https://api.beehiiv.com/v2/publications/${normalizedPublicationId}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: parsed.email,
        reactivate_existing: false,
        send_welcome_email: false,
        custom_fields: [
          { name: 'Email Address', value: parsed.email },
          { name: 'First Name', value: parsed.firstName },
          { name: 'Last Name', value: parsed.lastName },
          { name: 'Company / dealership', value: parsed.company },
          { name: 'Role', value: parsed.role },
        ],
        ...(automationIds.length > 0 ? { automation_ids: automationIds } : {}),
      }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: responseText || 'Beehiiv rejected the subscription request.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, forwarded: true });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message || 'Invalid subscription details.'
      : error instanceof Error
        ? error.message
        : 'Unable to subscribe.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
