import { getAdminDb } from '@/firebase/admin';

export type DealerRegistrationRecord = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant: string;
  status: string;
  notes: string;
  subscription_id: string;
  created_at: string;
  updated_at: string;
};

type CreateDealerRegistrationInput = {
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  consultant: string;
  notes: string;
};

type UpdateDealerRegistrationInput = {
  id: string;
  consultant: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  status: string;
  notes: string;
};

type AdminUpdateDealerRegistrationInput = {
  id: string;
  dealer_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  status: string;
  notes: string;
  subscription_id: string;
};

const DEALER_LEAD_STATUSES = new Set([
  'Lead',
  'Contacted',
  'Demo Scheduled',
  'Trial Started',
  'Customer',
  'Lost',
]);

function normalizeDealerLeadStatus(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lead') return 'Lead';
  if (normalized === 'contacted') return 'Contacted';
  if (normalized === 'demo scheduled') return 'Demo Scheduled';
  if (normalized === 'trial started') return 'Trial Started';
  if (normalized === 'customer') return 'Customer';
  if (normalized === 'lost') return 'Lost';
  return 'Lead';
}

function parseStatusInput(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'lead') return 'Lead';
  if (normalized === 'contacted') return 'Contacted';
  if (normalized === 'demo scheduled') return 'Demo Scheduled';
  if (normalized === 'trial started') return 'Trial Started';
  if (normalized === 'customer') return 'Customer';
  if (normalized === 'lost') return 'Lost';
  return null;
}

function parseCreatedAt(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return '';
}

export async function createDealerRegistration(input: CreateDealerRegistrationInput): Promise<DealerRegistrationRecord> {
  const dealerName = input.dealer_name.trim();
  const contactName = input.contact_name.trim();
  const contactEmail = input.contact_email.trim();
  const contactPhone = input.contact_phone.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const consultant = input.consultant.trim().toLowerCase();
  const notes = input.notes.trim();

  if (!dealerName || !contactName || !contactEmail || !consultant) {
    throw new Error('Dealer name, contact name, contact email, and consultant are required.');
  }

  const adminDb = getAdminDb();
  const createdAt = new Date();
  const updatedAt = new Date();

  const docRef = await adminDb.collection('dealer_registrations').add({
    dealer_name: dealerName,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    city,
    state,
    consultant,
    status: 'Lead',
    notes,
    subscription_id: '',
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
    consultant,
    status: 'Lead',
    notes,
    subscription_id: '',
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
  };
}

export async function updateDealerRegistration(input: UpdateDealerRegistrationInput): Promise<DealerRegistrationRecord> {
  const id = input.id.trim();
  const consultant = input.consultant.trim().toLowerCase();
  const contactName = input.contact_name.trim();
  const contactEmail = input.contact_email.trim();
  const contactPhone = input.contact_phone.trim();
  const notes = input.notes.trim();
  const status = parseStatusInput(input.status);

  if (!id || !consultant || !contactName || !contactEmail || !status) {
    throw new Error('Registration id, consultant, contact name, contact email, and status are required.');
  }

  if (!DEALER_LEAD_STATUSES.has(status)) {
    throw new Error('Invalid status value.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('dealer_registrations').doc(id);
  const existing = await docRef.get();

  if (!existing.exists) {
    throw new Error('Dealer registration not found.');
  }

  const existingData = existing.data() as Record<string, unknown>;
  const existingConsultant = String(existingData.consultant || '').toLowerCase();
  if (existingConsultant !== consultant) {
    throw new Error('Forbidden: consultant mismatch.');
  }

  const updatedAt = new Date();
  await docRef.set(
    {
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      status,
      notes,
      updated_at: updatedAt,
    },
    { merge: true }
  );

  const merged = (await docRef.get()).data() as Record<string, unknown>;
  return {
    id,
    dealer_name: String(merged.dealer_name || ''),
    contact_name: String(merged.contact_name || ''),
    contact_email: String(merged.contact_email || ''),
    contact_phone: String(merged.contact_phone || ''),
    city: String(merged.city || ''),
    state: String(merged.state || ''),
    consultant: String(merged.consultant || consultant),
    status: String(merged.status || 'Lead'),
    notes: String(merged.notes || ''),
    subscription_id: String(merged.subscription_id || ''),
    created_at: parseCreatedAt(merged.created_at),
    updated_at: parseCreatedAt(merged.updated_at),
  };
}

export async function listDealerRegistrationsByConsultant(consultantId: string): Promise<DealerRegistrationRecord[]> {
  const consultant = consultantId.trim().toLowerCase();
  if (!consultant) {
    return [];
  }

  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection('dealer_registrations')
    .where('consultant', '==', consultant)
    .limit(200)
    .get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      dealer_name: String(data.dealer_name || ''),
      contact_name: String(data.contact_name || ''),
      contact_email: String(data.contact_email || ''),
      contact_phone: String(data.contact_phone || ''),
      city: String(data.city || ''),
      state: String(data.state || ''),
      consultant: String(data.consultant || consultant),
      status: normalizeDealerLeadStatus(String(data.status || 'Lead')),
      notes: String(data.notes || ''),
      subscription_id: String(data.subscription_id || ''),
      created_at: parseCreatedAt(data.created_at),
      updated_at: parseCreatedAt(data.updated_at) || parseCreatedAt(data.created_at),
    } satisfies DealerRegistrationRecord;
  });

  return rows.sort((a, b) => {
    const aTime = Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.created_at) || 0;
    return bTime - aTime;
  });
}

export async function listAllDealerRegistrations(): Promise<DealerRegistrationRecord[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection('dealer_registrations').limit(500).get();

  const rows = snapshot.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      dealer_name: String(data.dealer_name || ''),
      contact_name: String(data.contact_name || ''),
      contact_email: String(data.contact_email || ''),
      contact_phone: String(data.contact_phone || ''),
      city: String(data.city || ''),
      state: String(data.state || ''),
      consultant: String(data.consultant || ''),
      status: normalizeDealerLeadStatus(String(data.status || 'Lead')),
      notes: String(data.notes || ''),
      subscription_id: String(data.subscription_id || ''),
      created_at: parseCreatedAt(data.created_at),
      updated_at: parseCreatedAt(data.updated_at) || parseCreatedAt(data.created_at),
    } satisfies DealerRegistrationRecord;
  });

  return rows.sort((a, b) => {
    const aTime = Date.parse(a.created_at) || 0;
    const bTime = Date.parse(b.created_at) || 0;
    return bTime - aTime;
  });
}

export async function adminUpdateDealerRegistration(input: AdminUpdateDealerRegistrationInput): Promise<DealerRegistrationRecord> {
  const id = input.id.trim();
  const dealerName = input.dealer_name.trim();
  const contactName = input.contact_name.trim();
  const contactEmail = input.contact_email.trim();
  const contactPhone = input.contact_phone.trim();
  const city = input.city.trim();
  const state = input.state.trim();
  const notes = input.notes.trim();
  const status = parseStatusInput(input.status);
  const subscriptionId = input.subscription_id.trim();

  if (!id || !dealerName || !contactName || !contactEmail || !status) {
    throw new Error('Registration id, dealer name, contact name, contact email, and status are required.');
  }

  if (!DEALER_LEAD_STATUSES.has(status)) {
    throw new Error('Invalid status value.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('dealer_registrations').doc(id);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new Error('Dealer registration not found.');
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
      status,
      notes,
      subscription_id: subscriptionId,
      updated_at: updatedAt,
    },
    { merge: true }
  );

  const merged = (await docRef.get()).data() as Record<string, unknown>;
  return {
    id,
    dealer_name: String(merged.dealer_name || ''),
    contact_name: String(merged.contact_name || ''),
    contact_email: String(merged.contact_email || ''),
    contact_phone: String(merged.contact_phone || ''),
    city: String(merged.city || ''),
    state: String(merged.state || ''),
    consultant: String(merged.consultant || ''),
    status: normalizeDealerLeadStatus(String(merged.status || 'Lead')),
    notes: String(merged.notes || ''),
    subscription_id: String(merged.subscription_id || ''),
    created_at: parseCreatedAt(merged.created_at),
    updated_at: parseCreatedAt(merged.updated_at) || updatedAt.toISOString(),
  };
}
