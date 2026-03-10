import { randomUUID } from 'node:crypto';
import { getAdminDb } from '@/firebase/admin';

export type DealerAccountRecord = {
  dealer_id: string;
  dealer_name: string;
  owner_user_id: string;
  created_at: string;
  plan: string;
  seat_count: number;
  consultant_id: string;
  source_pipeline_id: string;
};

type PipelineLeadInput = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant_id: string;
  notes: string;
  stage: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function ensureDealerAccountForClosedWonLead(lead: PipelineLeadInput): Promise<DealerAccountRecord | null> {
  if (lead.stage !== 'closed_won') {
    return null;
  }

  const adminDb = getAdminDb();
  const existingSnap = await adminDb
    .collection('dealer_accounts')
    .where('source_pipeline_id', '==', lead.id)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as Record<string, unknown>;
    return {
      dealer_id: String(existing.dealer_id || ''),
      dealer_name: String(existing.dealer_name || ''),
      owner_user_id: String(existing.owner_user_id || ''),
      created_at: String(existing.created_at || ''),
      plan: String(existing.plan || 'starter'),
      seat_count: Number(existing.seat_count || 10),
      consultant_id: String(existing.consultant_id || ''),
      source_pipeline_id: String(existing.source_pipeline_id || ''),
    };
  }

  const dealershipRef = adminDb.collection('dealerships').doc();
  const dealerId = dealershipRef.id;
  const ownerUserId = `dealer-owner-${randomUUID()}`;
  const createdAtIso = new Date().toISOString();

  await dealershipRef.set({
    name: lead.dealer_name,
    status: 'active',
    address: {
      city: lead.city,
      state: lead.state,
      street: '',
      zip: '',
    },
    billingTier: 'sales_fi',
    billingSubscriptionStatus: 'trialing',
    billingTrialStartedAt: createdAtIso,
  });

  await adminDb.collection('users').doc(ownerUserId).set({
    userId: ownerUserId,
    name: lead.contact_name || 'Dealer Owner',
    email: normalizeEmail(lead.contact_email || `${dealerId}@autodrivecx.local`),
    role: 'Owner',
    dealershipIds: [dealerId],
    avatarUrl: '',
    xp: 0,
    memberSince: createdAtIso,
    subscriptionStatus: 'trialing',
    dealerAccountOwner: true,
    contactPhone: lead.contact_phone || '',
  });

  const dealerAccount: DealerAccountRecord = {
    dealer_id: dealerId,
    dealer_name: lead.dealer_name,
    owner_user_id: ownerUserId,
    created_at: createdAtIso,
    plan: 'starter',
    seat_count: 10,
    consultant_id: lead.consultant_id.trim().toLowerCase(),
    source_pipeline_id: lead.id,
  };

  await adminDb.collection('dealer_accounts').doc(dealerId).set(dealerAccount);
  return dealerAccount;
}

export async function getDealerAccountByDealerId(dealerId: string): Promise<DealerAccountRecord | null> {
  const normalizedDealerId = dealerId.trim();
  if (!normalizedDealerId) return null;

  const adminDb = getAdminDb();
  const snap = await adminDb.collection('dealer_accounts').doc(normalizedDealerId).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;

  return {
    dealer_id: String(data.dealer_id || normalizedDealerId),
    dealer_name: String(data.dealer_name || ''),
    owner_user_id: String(data.owner_user_id || ''),
    created_at: String(data.created_at || ''),
    plan: String(data.plan || 'starter'),
    seat_count: Number(data.seat_count || 10),
    consultant_id: String(data.consultant_id || ''),
    source_pipeline_id: String(data.source_pipeline_id || ''),
  };
}
