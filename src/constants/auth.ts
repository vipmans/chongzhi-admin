type AdminSubsystemKey = 'access' | 'operations' | 'finance' | 'risk' | 'support';

type AdminSubsystemConfig = {
  key: AdminSubsystemKey;
  label: string;
};

const subsystemMap: Record<AdminSubsystemKey, AdminSubsystemConfig> = {
  access: { key: 'access', label: '权限平台' },
  operations: { key: 'operations', label: '运营平台' },
  finance: { key: 'finance', label: '财务平台' },
  risk: { key: 'risk', label: '风控平台' },
  support: { key: 'support', label: '支持平台' }
};

function normalizeRoleCodes(roleCodes: string[]) {
  return roleCodes.map(code => code.trim().toUpperCase()).filter(Boolean);
}

function includesRole(roleCodes: string[], expected: string[]) {
  const normalizedRoleCodes = normalizeRoleCodes(roleCodes);
  const expectedCodes = expected.map(code => code.trim().toUpperCase());

  return normalizedRoleCodes.some(code => expectedCodes.includes(code));
}

export function isSuperRole(roleCodes: string[]) {
  return includesRole(roleCodes, ['SUPER_ADMIN', import.meta.env.VITE_STATIC_SUPER_ROLE]);
}

export function getSubsystemKeysByRoleCodes(roleCodes: string[]) {
  if (isSuperRole(roleCodes)) {
    return Object.keys(subsystemMap) as AdminSubsystemKey[];
  }

  const subsystemKeys: AdminSubsystemKey[] = [];

  if (includesRole(roleCodes, ['OPS'])) {
    subsystemKeys.push('operations');
  }

  if (includesRole(roleCodes, ['FINANCE'])) {
    subsystemKeys.push('finance');
  }

  if (includesRole(roleCodes, ['RISK'])) {
    subsystemKeys.push('risk');
  }

  if (includesRole(roleCodes, ['SUPPORT'])) {
    subsystemKeys.push('support');
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

  if (includesRole(roleCodes, ['OPS'])) {
    return 'channels_list';
  }

  if (includesRole(roleCodes, ['FINANCE'])) {
    return 'finance_accounts';
  }

  if (includesRole(roleCodes, ['RISK'])) {
    return 'risk_rules';
  }

  if (includesRole(roleCodes, ['SUPPORT'])) {
    return 'orders_list';
  }

  return 'home';
}
