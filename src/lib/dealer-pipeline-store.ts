import { getAdminDb } from '@/firebase/admin';
import { ensureDealerAccountForClosedWonLead } from '@/lib/dealer-accounts';

export type DealerPipelineStage =
  | 'lead'
  | 'contacted'
  | 'demo'
  | 'trial'
  | 'closed_won'
  | 'closed_lost';

export type DealerPipelineRecord = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant_id: string;
  stage: DealerPipelineStage;
  notes: string;
  created_at: string;
  updated_at: string;
};

type CreateDealerPipelineInput = {
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant_id: string;
  notes: string;
};

type UpdateDealerPipelineByConsultantInput = {
  id: string;
  consultant_id: string;
  stage: string;
};

type AdminUpdateDealerPipelineInput = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant_id: string;
  stage: string;
  notes: string;
};

const DEALER_PIPELINE_STAGES = new Set<DealerPipelineStage>([
  'lead',
  'contacted',
  'demo',
  'trial',
  'closed_won',
  'closed_lost',
]);

function parseStage(value: string): DealerPipelineStage | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lead') return 'lead';
  if (normalized === 'contacted') return 'contacted';
  if (normalized === 'demo') return 'demo';
  if (normalized === 'trial') return 'trial';
  if (normalized === 'closed_won') return 'closed_won';
  if (normalized === 'closed_lost') return 'closed_lost';
  return null;
}

function parseIsoDate(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function docToRecord(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  fallbackConsultantId = ''
): DealerPipelineRecord {
  const data = doc.data() as Record<string, unknown>;
  const stage = parseStage(String(data.stage || 'lead')) || 'lead';

  return {
    id: doc.id,
    dealer_name: String(data.dealer_name || ''),
    contact_name: String(data.contact_name || ''),
    contact_email: String(data.contact_email || ''),
    contact_phone: String(data.contact_phone || ''),
    city: String(data.city || ''),
    state: String(data.state || ''),
    consultant_id: String(data.consultant_id || fallbackConsultantId).toLowerCase(),
    stage,
    notes: String(data.notes || ''),
    created_at: parseIsoDate(data.created_at),
    updated_at: parseIsoDate(data.updated_at) || parseIsoDate(data.created_at),
  };
}

export async function createDealerPipelineLead(input: CreateDealerPipelineInput): Promise<DealerPipelineRecord> {
  const dealerName = input.dealer_name.trim();
  const contactName = input.contact_name.trim();
  const contactEmail = input.contact_email.trim();
  const contactPhone = input.contact_phone.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const consultantId = input.consultant_id.trim().toLowerCase();
  const notes = input.notes.trim();

  if (!dealerName || !contactName || !contactEmail || !consultantId) {
    throw new Error('Dealer name, contact name, contact email, and consultant id are required.');
  }

  const adminDb = getAdminDb();
  const createdAt = new Date();
  const updatedAt = new Date();

  const docRef = await adminDb.collection('dealer_pipeline').add({
    dealer_name: dealerName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    city,
    state,
    consultant_id: consultantId,
    stage: 'lead',
    notes,
    created_at: createdAt,
    updated_at: updatedAt,
  });

  return {
    id: docRef.id,
    dealer_name: dealerName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    city,
    state,
    consultant_id: consultantId,
    stage: 'lead',
    notes,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
  };
}

export async function listDealerPipelineByConsultant(consultantId: string): Promise<DealerPipelineRecord[]> {
  const normalizedConsultantId = consultantId.trim().toLowerCase();
  if (!normalizedConsultantId) return [];

  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection('dealer_pipeline')
    .where('consultant_id', '==', normalizedConsultantId)
    .limit(500)
    .get();

  const rows = snapshot.docs.map((doc) => docToRecord(doc, normalizedConsultantId));
  return rows.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
}

export async function listAllDealerPipeline(): Promise<DealerPipelineRecord[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection('dealer_pipeline').limit(1000).get();
  const rows = snapshot.docs.map((doc) => docToRecord(doc));
  return rows.sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
}

export async function updateDealerPipelineByConsultant(input: UpdateDealerPipelineByConsultantInput): Promise<DealerPipelineRecord> {
  const id = input.id.trim();
  const consultantId = input.consultant_id.trim().toLowerCase();
  const stage = parseStage(input.stage);

  if (!id || !consultantId || !stage) {
    throw new Error('Pipeline id, consultant id, and valid stage are required.');
  }

  if (!DEALER_PIPELINE_STAGES.has(stage)) {
    throw new Error('Invalid stage value.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('dealer_pipeline').doc(id);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Dealer pipeline record not found.');
  }

  const existingData = existing.data() as Record<string, unknown>;
  const existingConsultantId = String(existingData.consultant_id || '').toLowerCase();
  if (existingConsultantId !== consultantId) {
    throw new Error('Forbidden: consultant mismatch.');
  }

  const updatedAt = new Date();
  await docRef.set(
    {
      stage,
      updated_at: updatedAt,
    },
    { merge: true }
  );

  const merged = await docRef.get();
  const record = docToRecord(merged as FirebaseFirestore.QueryDocumentSnapshot, consultantId);
  await ensureDealerAccountForClosedWonLead(record);
  return record;
}

export async function adminUpdateDealerPipeline(input: AdminUpdateDealerPipelineInput): Promise<DealerPipelineRecord> {
  const id = input.id.trim();
  const dealerName = input.dealer_name.trim();
  const contactName = input.contact_name.trim();
  const contactEmail = input.contact_email.trim();
  const contactPhone = input.contact_phone.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const consultantId = input.consultant_id.trim().toLowerCase();
  const stage = parseStage(input.stage);
  const notes = input.notes.trim();

  if (!id || !dealerName || !contactName || !contactEmail || !consultantId || !stage) {
    throw new Error('Pipeline id, dealer name, contact name, contact email, consultant id, and stage are required.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('dealer_pipeline').doc(id);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Dealer pipeline record not found.');
  }

  const updatedAt = new Date();
  await docRef.set(
    {
      dealer_name: dealerName,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      city,
      state,
      consultant_id: consultantId,
      stage,
      notes,
      updated_at: updatedAt,
    },
    { merge: true }
  );

  const merged = await docRef.get();
  const record = docToRecord(merged as FirebaseFirestore.QueryDocumentSnapshot, consultantId);
  await ensureDealerAccountForClosedWonLead(record);
  return record;
}
