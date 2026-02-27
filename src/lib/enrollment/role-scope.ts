import type { UserRole } from '@/lib/definitions';

export type EnrollmentScope =
  | 'manager_and_under'
  | 'general_manager_and_under'
  | 'owner_and_under';

const SCOPE_RANK: Record<EnrollmentScope, number> = {
  manager_and_under: 1,
  general_manager_and_under: 2,
  owner_and_under: 3,
};

const SCOPE_ORDER: EnrollmentScope[] = [
  'owner_and_under',
  'general_manager_and_under',
  'manager_and_under',
];

const MAX_SCOPE_BY_ROLE: Partial<Record<UserRole, EnrollmentScope>> = {
  Developer: 'owner_and_under',
  Admin: 'owner_and_under',
  Trainer: 'general_manager_and_under',
  Owner: 'general_manager_and_under',
  'General Manager': 'manager_and_under',
  manager: 'manager_and_under',
  'Service Manager': 'manager_and_under',
  'Parts Manager': 'manager_and_under',
  'Finance Manager': 'manager_and_under',
};

const ROLES_BY_SCOPE: Record<EnrollmentScope, UserRole[]> = {
  owner_and_under: [
    'Owner',
    'General Manager',
    'manager',
    'Service Manager',
    'Parts Manager',
    'Finance Manager',
    'Sales Consultant',
    'Service Writer',
    'Parts Consultant',
  ],
  general_manager_and_under: [
    'General Manager',
    'manager',
    'Service Manager',
    'Parts Manager',
    'Finance Manager',
    'Sales Consultant',
    'Service Writer',
    'Parts Consultant',
  ],
  manager_and_under: [
    'manager',
    'Service Manager',
    'Parts Manager',
    'Finance Manager',
    'Sales Consultant',
    'Service Writer',
    'Parts Consultant',
  ],
};

export function isEnrollmentScope(value: unknown): value is EnrollmentScope {
  return (
    value === 'manager_and_under' ||
    value === 'general_manager_and_under' ||
    value === 'owner_and_under'
  );
}

export function getMaxEnrollmentScopeForInviter(role: UserRole): EnrollmentScope | null {
  return MAX_SCOPE_BY_ROLE[role] ?? null;
}

export function canUseEnrollmentScope(inviterRole: UserRole, scope: EnrollmentScope): boolean {
  const maxScope = getMaxEnrollmentScopeForInviter(inviterRole);
  if (!maxScope) return false;
  return SCOPE_RANK[scope] <= SCOPE_RANK[maxScope];
}

export function getAvailableEnrollmentScopesForInviter(role: UserRole): EnrollmentScope[] {
  const maxScope = getMaxEnrollmentScopeForInviter(role);
  if (!maxScope) return [];
  return SCOPE_ORDER.filter((scope) => SCOPE_RANK[scope] <= SCOPE_RANK[maxScope]);
}

export function getAllowedEnrollmentRolesForScope(scope: EnrollmentScope): UserRole[] {
  return [...ROLES_BY_SCOPE[scope]];
}

export function getEnrollmentScopeLabel(scope: EnrollmentScope): string {
  switch (scope) {
    case 'owner_and_under':
      return 'Owner and under';
    case 'general_manager_and_under':
      return 'General Manager and under';
    case 'manager_and_under':
      return 'Managers and under';
    default:
      return 'Managers and under';
  }
}

export function getEnrollmentScopeDescription(scope: EnrollmentScope): string {
  switch (scope) {
    case 'owner_and_under':
      return 'Allows Owner, General Manager, all manager roles, and frontline roles.';
    case 'general_manager_and_under':
      return 'Allows General Manager, all manager roles, and frontline roles.';
    case 'manager_and_under':
      return 'Allows manager roles and frontline roles.';
    default:
      return '';
  }
}
