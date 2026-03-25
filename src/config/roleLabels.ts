import type { AisDisplayRole, AisRoleType, UserRole } from '@/lib/definitions';
import { UI_TERMS } from '@/config/uiTerminology';

export type RoleLabelKey = AisDisplayRole;

export type RoleLabels = {
  interactionLabel: string;
  meterLabel: string;
};

export const ROLE_LABELS: Record<RoleLabelKey, RoleLabels> = {
  sales: {
    interactionLabel: 'Fresh Up',
    meterLabel: 'Up Meter',
  },
  service: {
    interactionLabel: 'Service Interaction',
    meterLabel: 'Guest Comfort Meter',
  },
  parts: {
    interactionLabel: 'Counter Interaction',
    meterLabel: 'Customer Confidence Meter',
  },
  fi: {
    interactionLabel: 'Buyer Review',
    meterLabel: 'Buyer Confidence Meter',
  },
  manager: {
    interactionLabel: UI_TERMS.interactionSession,
    meterLabel: 'Interaction Comfort Meter',
  },
  gm: {
    interactionLabel: 'CX Interaction',
    meterLabel: 'Customer Comfort Index',
  },
};

export function resolveRoleLabelKeyFromUserRole(userRole: UserRole | null | undefined): RoleLabelKey {
  if (userRole === 'General Manager') return 'gm';
  if (userRole === 'manager' || userRole === 'Owner' || userRole === 'Trainer' || userRole === 'Admin' || userRole === 'Developer') {
    return 'manager';
  }
  if (userRole === 'Service Writer' || userRole === 'Service Manager') return 'service';
  if (userRole === 'Parts Consultant' || userRole === 'Parts Manager') return 'parts';
  if (userRole === 'Finance Manager') return 'fi';
  return 'sales';
}

export function resolveRoleLabelKeyFromAisRoleType(roleType: AisRoleType): RoleLabelKey {
  return roleType;
}

export function getRoleLabels(role: RoleLabelKey): RoleLabels {
  return ROLE_LABELS[role];
}
