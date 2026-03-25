import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { ToolboxAccountSession, ToolboxSavedEntry } from '@/lib/tools/toolbox';
import { FREE_ACCOUNT_SAVE_LIMIT } from '@/lib/tools/toolbox';
import { getAdminDb } from '@/firebase/admin';

export const TOOLBOX_ACCOUNT_COLLECTION = 'toolboxAccounts';
export const TOOLBOX_ENTRY_SUBCOLLECTION = 'entries';
export const TOOLBOX_UNLOCK_COLLECTION = 'toolboxUnlocks';

export type ToolboxAccountRecord = {
  email: string;
  userState: 'free_account' | 'paid_account';
  authToken: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export function normalizeEmail(input: unknown): string {
  return String(input || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isStrongEnoughPassword(password: string): boolean {
  return password.length >= 8;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex');
}

export function createPasswordRecord(password: string): { passwordSalt: string; passwordHash: string } {
  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, passwordSalt);
  return { passwordSalt, passwordHash };
}

export function verifyPassword(password: string, record: Pick<ToolboxAccountRecord, 'passwordSalt' | 'passwordHash'>): boolean {
  const expected = Buffer.from(record.passwordHash, 'hex');
  const actual = Buffer.from(hashPassword(password, record.passwordSalt), 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function createAuthToken(): string {
  return randomBytes(24).toString('hex');
}

export async function getAccountByEmail(email: string): Promise<ToolboxAccountRecord | null> {
  const adminDb = getAdminDb();
  const docRef = adminDb.collection(TOOLBOX_ACCOUNT_COLLECTION).doc(email);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return snap.data() as ToolboxAccountRecord;
}

export async function upsertAccount(record: ToolboxAccountRecord): Promise<void> {
  const adminDb = getAdminDb();
  const docRef = adminDb.collection(TOOLBOX_ACCOUNT_COLLECTION).doc(record.email);
  await docRef.set(record, { merge: true });
}

export async function storeEntries(email: string, entries: ToolboxSavedEntry[]): Promise<void> {
  if (!entries.length) return;

  const adminDb = getAdminDb();
  const batch = adminDb.batch();

  entries.forEach((entry) => {
    const docRef = adminDb
      .collection(TOOLBOX_ACCOUNT_COLLECTION)
      .doc(email)
      .collection(TOOLBOX_ENTRY_SUBCOLLECTION)
      .doc(entry.id || randomBytes(8).toString('hex'));

    batch.set(docRef, {
      id: entry.id || docRef.id,
      toolId: entry.toolId,
      content: entry.content,
      createdAt: entry.createdAt || new Date().toISOString(),
    });
  });

  await batch.commit();
}

export async function listEntries(email: string, limitCount: number): Promise<ToolboxSavedEntry[]> {
  const adminDb = getAdminDb();
  const snap = await adminDb
    .collection(TOOLBOX_ACCOUNT_COLLECTION)
    .doc(email)
    .collection(TOOLBOX_ENTRY_SUBCOLLECTION)
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();

  return snap.docs.map((doc) => doc.data() as ToolboxSavedEntry);
}

export async function countEntries(email: string): Promise<number> {
  const adminDb = getAdminDb();
  const snap = await adminDb
    .collection(TOOLBOX_ACCOUNT_COLLECTION)
    .doc(email)
    .collection(TOOLBOX_ENTRY_SUBCOLLECTION)
    .count()
    .get();

  return Number(snap.data().count || 0);
}

export function canSaveMore(userState: 'free_account' | 'paid_account', existingEntries: number): boolean {
  if (userState === 'paid_account') return true;
  return existingEntries < FREE_ACCOUNT_SAVE_LIMIT;
}

export function validateEntryPayload(entry: Partial<ToolboxSavedEntry>): entry is ToolboxSavedEntry {
  return (
    typeof entry.id === 'string' &&
    typeof entry.toolId === 'string' &&
    typeof entry.content === 'string' &&
    typeof entry.createdAt === 'string'
  );
}

export function toSession(record: ToolboxAccountRecord): ToolboxAccountSession {
  return {
    email: record.email,
    authToken: record.authToken,
    userState: record.userState,
  };
}
