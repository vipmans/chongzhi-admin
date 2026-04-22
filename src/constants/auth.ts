type AdminSubsystemKey = 'access' | 'operations' | 'finance' | 'risk' | 'support' | 'customerService';

type AdminSubsystemConfig = {
  key: AdminSubsystemKey;
  label: string;
};

const subsystemMap: Record<AdminSubsystemKey, AdminSubsystemConfig> = {
  access: { key: 'access', label: '权限平台' },
  operations: { key: 'operations', label: '运营平台' },
  finance: { key: 'finance', label: '财务平台' },
  risk: { key: 'risk', label: '风控平台' },
  support: { key: 'support', label: '技术支持平台' },
  customerService: { key: 'customerService', label: '平台客服' }
};

export const SUPPORT_ROLE_CODES = ['SUPPORT'] as const;
export const CUSTOMER_SERVICE_ROLE_CODES = ['CUSTOMER_SERVICE', 'CUSTOMER_SUPPORT', 'CS'] as const;

function normalizeRoleCode(roleCode?: string | null) {
  return roleCode?.trim().toUpperCase() || '';
}

function getRoleAliasGroups() {
  return [
    ['SUPER_ADMIN', 'R_SUPER', normalizeRoleCode(import.meta.env.VITE_STATIC_SUPER_ROLE)].filter(Boolean),
    ['OPS'],
    ['FINANCE'],
    ['RISK'],
    [...SUPPORT_ROLE_CODES],
    [...CUSTOMER_SERVICE_ROLE_CODES]
  ];
}

function getRoleAliasGroup(roleCode: string) {
  const normalizedRoleCode = normalizeRoleCode(roleCode);

  if (!normalizedRoleCode) {
    return [];
  }

  const matchedGroup = getRoleAliasGroups().find(group => group.includes(normalizedRoleCode));

  return matchedGroup || [normalizedRoleCode];
}

export function normalizeRoleCodes(roleCodes: string[]) {
  return Array.from(new Set(roleCodes.map(code => normalizeRoleCode(code)).filter(Boolean)));
}

export function hasAnyRole(roleCodes: string[], expected: string[]) {
  const normalizedRoleCodes = normalizeRoleCodes(roleCodes);
  const normalizedExpected = normalizeRoleCodes(expected);

  return normalizedExpected.some(expectedCode => {
    const acceptedCodes = getRoleAliasGroup(expectedCode);
    return normalizedRoleCodes.some(roleCode => acceptedCodes.includes(roleCode));
  });
}

export function isSuperRole(roleCodes: string[]) {
  return hasAnyRole(roleCodes, ['SUPER_ADMIN']);
}

export function isSupportRole(roleCodes: string[]) {
  return hasAnyRole(roleCodes, [...SUPPORT_ROLE_CODES]);
}

export function isCustomerServiceRole(roleCodes: string[]) {
  return hasAnyRole(roleCodes, [...CUSTOMER_SERVICE_ROLE_CODES]);
}

export function getSubsystemKeysByRoleCodes(roleCodes: string[]) {
  if (isSuperRole(roleCodes)) {
    return Object.keys(subsystemMap) as AdminSubsystemKey[];
  }

  const subsystemKeys: AdminSubsystemKey[] = [];

  if (hasAnyRole(roleCodes, ['OPS'])) {
    subsystemKeys.push('operations');
  }

  if (hasAnyRole(roleCodes, ['FINANCE'])) {
    subsystemKeys.push('finance');
  }

  if (hasAnyRole(roleCodes, ['RISK'])) {
    subsystemKeys.push('risk');
  }

  if (isSupportRole(roleCodes)) {
    subsystemKeys.push('support');
  }

  if (isCustomerServiceRole(roleCodes)) {
    subsystemKeys.push('customerService');
  }

  return subsystemKeys;
}

export function getSubsystemLabelsByRoleCodes(roleCodes: string[]) {
  const subsystemKeys = getSubsystemKeysByRoleCodes(roleCodes);

  if (!subsystemKeys.length) {
    return ['未分配子系统'];
  }

  return subsystemKeys.map(key => subsystemMap[key].label);
}

export function getDefaultHomeRouteByRoleCodes(roleCodes: string[]): App.Global.LastLevelRouteKey {
  if (isSuperRole(roleCodes)) {
    return 'home';
  }

  if (hasAnyRole(roleCodes, ['OPS'])) {
    return 'channels_list';
  }

  if (hasAnyRole(roleCodes, ['FINANCE'])) {
    return 'finance_accounts';
  }

  if (hasAnyRole(roleCodes, ['RISK'])) {
    return 'risk_rules';
  }

  if (isCustomerServiceRole(roleCodes)) {
    return 'orders_list';
  }

  if (isSupportRole(roleCodes)) {
    return 'ops_jobs';
  }

  return 'home';
}
