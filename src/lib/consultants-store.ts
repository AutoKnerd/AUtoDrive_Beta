import { getAdminDb } from '@/firebase/admin';

export type ConsultantRecord = {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  firebase_uid: string;
  created_at: string;
  referralCode: string;
  firebaseUid: string;
  createdAt: string;
};

type CreateConsultantInput = {
  name: string;
  email: string;
  referralCode: string;
  firebaseUid?: string;
};

type UpdateConsultantInput = {
  name: string;
  email: string;
  referralCode: string;
  firebaseUid?: string;
};

const CONSULTANTS_COLLECTION = 'consultants';

function normalizeReferralCode(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeConsultantRecord(
  id: string,
  row: Record<string, unknown>
): ConsultantRecord {
  const referralCode = normalizeReferralCode(row.referral_code || row.referralCode);
  const firebaseUid = String(row.firebase_uid || row.firebaseUid || '').trim();
  const createdAt = String(row.created_at || row.createdAt || '');

  return {
    id,
    name: String(row.name || ''),
    email: String(row.email || ''),
    referral_code: referralCode,
    firebase_uid: firebaseUid,
    created_at: createdAt,
    referralCode,
    firebaseUid,
    createdAt,
  };
}

async function findConsultantByReferralCode(referralCode: string) {
  const adminDb = getAdminDb();
  return adminDb
    .collection(CONSULTANTS_COLLECTION)
    .where('referral_code', '==', normalizeReferralCode(referralCode))
    .limit(1)
    .get();
}

export async function listConsultants(): Promise<ConsultantRecord[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection(CONSULTANTS_COLLECTION).get();

  return snapshot.docs
    .map((doc) => normalizeConsultantRecord(doc.id, doc.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createConsultant(input: CreateConsultantInput): Promise<ConsultantRecord> {
  const name = input.name.trim();
  const email = input.email.trim();
  const referralCode = normalizeReferralCode(input.referralCode);
  const firebaseUid = String(input.firebaseUid || '').trim();

  if (!name || !email || !referralCode) {
    throw new Error('Name, email, and referral code are required.');
  }

  const existing = await findConsultantByReferralCode(referralCode);
  if (!existing.empty) {
    throw new Error('Referral code already exists.');
  }

  const createdAt = new Date().toISOString();
  const adminDb = getAdminDb();
  const ref = adminDb.collection(CONSULTANTS_COLLECTION).doc();
  const consultant = {
    name,
    email,
    referral_code: referralCode,
    firebase_uid: firebaseUid,
    created_at: createdAt,
  };

  await ref.set(consultant);
  return normalizeConsultantRecord(ref.id, consultant);
}

export async function updateConsultant(id: string, input: UpdateConsultantInput): Promise<ConsultantRecord> {
  const name = input.name.trim();
  const email = input.email.trim();
  const referralCode = normalizeReferralCode(input.referralCode);
  const firebaseUid = String(input.firebaseUid || '').trim();

  if (!name || !email || !referralCode) {
    throw new Error('Name, email, and referral code are required.');
  }

  const adminDb = getAdminDb();
  const ref = adminDb.collection(CONSULTANTS_COLLECTION).doc(id);
  const existing = await ref.get();

  if (!existing.exists) {
    throw new Error('Consultant not found.');
  }

  const duplicate = await findConsultantByReferralCode(referralCode);
  if (!duplicate.empty && duplicate.docs[0].id !== id) {
    throw new Error('Referral code already exists.');
  }

  const previous = normalizeConsultantRecord(id, existing.data() as Record<string, unknown>);
  const updated = {
    name,
    email,
    referral_code: referralCode,
    firebase_uid: firebaseUid,
    created_at: previous.created_at,
  };

  await ref.set(updated, { merge: true });
  return normalizeConsultantRecord(id, updated);
}

export async function deleteConsultant(id: string): Promise<void> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection(CONSULTANTS_COLLECTION).doc(id);
  const existing = await ref.get();

  if (!existing.exists) {
    throw new Error('Consultant not found.');
  }

  await ref.delete();
}

export async function getConsultantByFirebaseUid(firebaseUid: string): Promise<ConsultantRecord | null> {
  const normalizedUid = firebaseUid.trim();
  if (!normalizedUid) {
    return null;
  }

  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection(CONSULTANTS_COLLECTION)
    .where('firebase_uid', '==', normalizedUid)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return normalizeConsultantRecord(doc.id, doc.data() as Record<string, unknown>);
}

export async function getConsultantByReferralCode(referralCode: string): Promise<ConsultantRecord | null> {
  const snapshot = await findConsultantByReferralCode(referralCode);
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return normalizeConsultantRecord(doc.id, doc.data() as Record<string, unknown>);
}
