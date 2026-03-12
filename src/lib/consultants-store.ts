import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

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

const CONSULTANTS_FILE_PATH = path.join(process.cwd(), 'data', 'consultants.json');

async function ensureConsultantsFile() {
  await fs.mkdir(path.dirname(CONSULTANTS_FILE_PATH), { recursive: true });

  try {
    await fs.access(CONSULTANTS_FILE_PATH);
  } catch {
    await fs.writeFile(CONSULTANTS_FILE_PATH, '[]\n', 'utf8');
  }
}

async function readConsultants(): Promise<ConsultantRecord[]> {
  await ensureConsultantsFile();
  const raw = await fs.readFile(CONSULTANTS_FILE_PATH, 'utf8');

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return (parsed as Record<string, unknown>[]).map((row) => normalizeConsultantRecord(row));
  } catch {
    return [];
  }
}

async function writeConsultants(consultants: ConsultantRecord[]) {
  await ensureConsultantsFile();
  const serialized = consultants.map((consultant) => ({
    id: consultant.id,
    name: consultant.name,
    email: consultant.email,
    referral_code: consultant.referral_code,
    firebase_uid: consultant.firebase_uid,
    created_at: consultant.created_at,
  }));
  await fs.writeFile(CONSULTANTS_FILE_PATH, JSON.stringify(serialized, null, 2) + '\n', 'utf8');
}

function normalizeConsultantRecord(row: Record<string, unknown>): ConsultantRecord {
  const referralCode = String(row.referral_code || row.referralCode || '').trim().toLowerCase();
  const firebaseUid = String(row.firebase_uid || row.firebaseUid || '').trim();
  const createdAt = String(row.created_at || row.createdAt || '');

  return {
    id: String(row.id || ''),
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

export async function listConsultants(): Promise<ConsultantRecord[]> {
  const consultants = await readConsultants();
  return [...consultants].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createConsultant(input: CreateConsultantInput): Promise<ConsultantRecord> {
  const name = input.name.trim();
  const email = input.email.trim();
  const referralCode = input.referralCode.trim().toLowerCase();
  const firebaseUid = String(input.firebaseUid || '').trim();

  if (!name || !email || !referralCode) {
    throw new Error('Name, email, and referral code are required.');
  }

  const consultants = await readConsultants();

  const exists = consultants.some((consultant) => consultant.referralCode.toLowerCase() === referralCode);
  if (exists) {
    throw new Error('Referral code already exists.');
  }

  const consultant: ConsultantRecord = {
    id: randomUUID(),
    name,
    email,
    referral_code: referralCode,
    firebase_uid: firebaseUid,
    created_at: new Date().toISOString(),
    referralCode,
    firebaseUid,
    createdAt: new Date().toISOString(),
  };

  consultants.push(consultant);
  await writeConsultants(consultants);

  return consultant;
}

export async function updateConsultant(id: string, input: UpdateConsultantInput): Promise<ConsultantRecord> {
  const name = input.name.trim();
  const email = input.email.trim();
  const referralCode = input.referralCode.trim().toLowerCase();
  const firebaseUid = String(input.firebaseUid || '').trim();

  if (!name || !email || !referralCode) {
    throw new Error('Name, email, and referral code are required.');
  }

  const consultants = await readConsultants();
  const index = consultants.findIndex((consultant) => consultant.id === id);

  if (index === -1) {
    throw new Error('Consultant not found.');
  }

  const exists = consultants.some(
    (consultant) => consultant.id !== id && consultant.referralCode.toLowerCase() === referralCode
  );
  if (exists) {
    throw new Error('Referral code already exists.');
  }

  const updated: ConsultantRecord = {
    ...consultants[index],
    name,
    email,
    referral_code: referralCode,
    firebase_uid: firebaseUid,
    referralCode,
    firebaseUid,
  };

  consultants[index] = updated;
  await writeConsultants(consultants);

  return updated;
}

export async function deleteConsultant(id: string): Promise<void> {
  const consultants = await readConsultants();
  const nextConsultants = consultants.filter((consultant) => consultant.id !== id);

  if (nextConsultants.length === consultants.length) {
    throw new Error('Consultant not found.');
  }

  await writeConsultants(nextConsultants);
}

export async function getConsultantByFirebaseUid(firebaseUid: string): Promise<ConsultantRecord | null> {
  const normalizedUid = firebaseUid.trim();
  if (!normalizedUid) {
    return null;
  }

  const consultants = await readConsultants();
  const consultant = consultants.find((row) => row.firebase_uid === normalizedUid);
  return consultant || null;
}

export async function getConsultantByReferralCode(referralCode: string): Promise<ConsultantRecord | null> {
  const normalizedCode = referralCode.trim().toLowerCase();
  if (!normalizedCode) {
    return null;
  }

  const consultants = await readConsultants();
  const consultant = consultants.find((row) => row.referral_code === normalizedCode);
  return consultant || null;
}
