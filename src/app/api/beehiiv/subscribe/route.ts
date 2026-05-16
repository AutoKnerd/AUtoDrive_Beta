import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/firebase/admin';

const subscribeSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().optional().default(''),
  firstName: z.string().trim().optional().default(''),
  lastName: z.string().trim().optional().default(''),
  company: z.string().trim().optional().default(''),
  role: z.string().trim().optional().default(''),
  dealership: z.string().trim().optional().default(''),
  interest: z.string().trim().optional().default(''),
  message: z.string().trim().optional().default(''),
  source: z.string().trim().min(1).default('autoknerd-popup'),
});

function deriveNameParts(input: { name: string; firstName: string; lastName: string }) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' '),
    };
  }

  const parts = input.name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    fullName: input.name.trim(),
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAutomationIds(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonStringArrayMap(value: string | undefined): Record<string, string[]> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as Record<string, string | string[] | undefined>;
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, entry]) => {
          const ids = Array.isArray(entry)
            ? entry
            : typeof entry === 'string'
              ? entry.split(',')
              : [];

          return [key, ids.map((id) => id.trim()).filter(Boolean)] as const;
        })
        .filter(([, ids]) => ids.length > 0)
    );
  } catch {
    return {};
  }
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

async function logSubmissionToAdmin(payload: {
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  role: string;
  dealership: string;
  interest: string;
  message: string;
  source: string;
  submittedAt: string;
  beehiivStatus: string | null;
  beehiivTags: string[];
  forwarded: boolean;
  updated: boolean;
}) {
  const adminTrackedSources = new Set(['contact', 'schedule-call']);
  if (!adminTrackedSources.has(payload.source)) return;

  try {
    const adminDb = getAdminDb();
    const createdAt = new Date(payload.submittedAt);
    const submissionRef = adminDb.collection('contactFormSubmissions').doc();
    await submissionRef.set({
      submissionId: submissionRef.id,
      email: payload.email,
      name: payload.name,
      firstName: payload.firstName,
      lastName: payload.lastName,
      company: payload.company,
      role: payload.role,
      dealership: payload.dealership,
      interest: payload.interest,
      message: payload.message,
      source: payload.source,
      beehiivStatus: payload.beehiivStatus,
      beehiivTags: payload.beehiivTags,
      forwarded: payload.forwarded,
      updated: payload.updated,
      isTended: false,
      isSpam: false,
      createdAt: Timestamp.fromDate(createdAt),
      updatedAt: Timestamp.fromDate(createdAt),
      submittedAt: Timestamp.fromDate(createdAt),
    });
  } catch (error) {
    console.error('Failed to log contact form submission', error);
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
    const sourceAutomationMap = parseJsonStringArrayMap(process.env.BEEHIIV_SOURCE_AUTOMATION_IDS_JSON);
    const automationIds = [
      ...defaultAutomationIds,
      ...(roleAutomationMap[parsed.role] ?? []),
      ...(sourceAutomationMap[parsed.source] ?? []),
    ];
    const submittedAt = new Date().toISOString();
    const contactQuestion = [
      `Submitted At: ${submittedAt}`,
      parsed.interest ? `Interest: ${parsed.interest}` : '',
      parsed.message ? `Message: ${parsed.message}` : '',
    ].filter(Boolean).join('\n\n');
    const nameParts = deriveNameParts(parsed);
    const customFields = [
      { name: 'What’s up', value: parsed.source },
      ...(nameParts.fullName ? [{ name: 'Name', value: nameParts.fullName }] : []),
      ...(nameParts.fullName ? [{ name: 'Full Name', value: nameParts.fullName }] : []),
      ...(nameParts.firstName ? [{ name: 'First Name', value: nameParts.firstName }] : []),
      ...(nameParts.lastName ? [{ name: 'Last Name', value: nameParts.lastName }] : []),
      ...(parsed.company ? [{ name: 'Company', value: parsed.company }] : []),
      ...(parsed.company ? [{ name: 'Company / dealership', value: parsed.company }] : []),
      ...(parsed.role ? [{ name: 'Role', value: parsed.role }] : []),
      ...(parsed.role ? [{ name: 'Current Role / Store', value: parsed.role }] : []),
      ...(parsed.dealership ? [{ name: 'Dealership', value: parsed.dealership }] : []),
      ...(contactQuestion ? [{ name: 'AutoDrive Question', value: contactQuestion }] : []),
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
        custom_fields: customFields,
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

    const updateResponse = await fetch(
      `https://api.beehiiv.com/v2/publications/${normalizedPublicationId}/subscriptions/by_email/${encodeURIComponent(parsed.email)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          custom_fields: customFields,
        }),
      }
    );

    if (!updateResponse.ok) {
      const responseText = await updateResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error: responseText || 'Beehiiv accepted the subscriber but rejected the field update.',
        },
        { status: 502 }
      );
    }

    const readSubscription = async () => {
      const readbackResponse = await fetch(
        `https://api.beehiiv.com/v2/publications/${normalizedPublicationId}/subscriptions/by_email/${encodeURIComponent(parsed.email)}?expand[]=tags`,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );

      return (await readbackResponse.json().catch(() => null)) as {
        data?: { status?: string; tags?: string[] };
      } | null;
    };

    let readback = await readSubscription();
    if (readback?.data?.status === 'validating') {
      await wait(2500);
      readback = await readSubscription();
    }

    const beehiivStatus = readback?.data?.status ?? null;
    const beehiivTags = readback?.data?.tags ?? [];

    await logSubmissionToAdmin({
      email: parsed.email,
      name: nameParts.fullName,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      company: parsed.company,
      role: parsed.role,
      dealership: parsed.dealership,
      interest: parsed.interest,
      message: parsed.message,
      source: parsed.source,
      submittedAt,
      beehiivStatus,
      beehiivTags,
      forwarded: true,
      updated: true,
    });

    return NextResponse.json({
      ok: beehiivStatus !== 'invalid',
      forwarded: true,
      updated: true,
      beehiivStatus,
      beehiivTags,
      ...(beehiivStatus === 'invalid'
        ? { error: 'Beehiiv received the submission, but marked the email address invalid.' }
        : {}),
    });
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues[0]?.message || 'Invalid subscription details.'
      : error instanceof Error
        ? error.message
        : 'Unable to subscribe.';

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
