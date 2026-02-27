import { UserRole } from '@/lib/definitions';

export type CxScopeRole = 'owner' | 'manager' | 'consultant';

export interface CxScope {
  role: CxScopeRole;
  orgId: string;
  storeId?: string;
  userId?: string;
}

export function mapUserRoleToCxRole(role: UserRole): CxScopeRole {
  if (role === 'Owner' || role === 'Admin' || role === 'Developer' || role === 'Trainer') return 'owner';
  if (['manager', 'Service Manager', 'Parts Manager', 'General Manager', 'Finance Manager'].includes(role)) return 'manager';
  return 'consultant';
}

export function getDefaultScope(user: { role: UserRole; userId: string; dealershipIds?: string[]; selfDeclaredDealershipId?: string }): CxScope {
  const role = mapUserRoleToCxRole(user.role);
  const orgId = 'autodrive-org';
  const storeId = user.dealershipIds?.[0] || user.selfDeclaredDealershipId;

  return {
    role,
    orgId,
    storeId: role === 'owner' ? undefined : storeId,
    userId: role === 'consultant' ? user.userId : undefined,
  };
}

export function getComparisonScope(scope: CxScope): CxScope | null {
  if (scope.userId) {
    // Single-user accounts without a store assignment should not render a benchmark.
    if (!scope.storeId) {
      return null;
    }
    // Consultant vs Store
    return { role: 'manager', orgId: scope.orgId, storeId: scope.storeId };
  }
  if (scope.storeId) {
    // Store vs Org
    return { role: 'owner', orgId: scope.orgId };
  }
  // Org vs nothing
  return null;
}

export function getScopeLabel(scope: CxScope): string {
  if (scope.userId) return 'Individual';
  if (scope.storeId) return 'Store Average';
  return 'Group Average';
}
