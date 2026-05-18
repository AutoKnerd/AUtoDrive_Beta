import type { User } from '@/lib/definitions';

export function hasAdminIntelligenceAccess(user: Pick<User, 'role' | 'hasAdminIntelligenceAccess'> | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'Developer' || user.hasAdminIntelligenceAccess === true;
}

