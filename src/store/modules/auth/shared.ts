import { localStg } from '@/utils/storage';

const SECOND_TO_MS = 1000;

function decodeBase64Url(value: string) {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalizedValue.length % 4;
  const paddedValue = padding ? normalizedValue.padEnd(normalizedValue.length + (4 - padding), '=') : normalizedValue;

  try {
    return window.atob(paddedValue);
  } catch {
    return '';
  }
}

function parseJwtPayload(token?: string | null) {
  if (!token) {
    return null;
  }

  const segments = token.split('.');

  if (segments.length < 2) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(segments[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveTokenExpiresAt(token?: string | null, expiresInSeconds?: number) {
  const payload = parseJwtPayload(token);
  const jwtExp = Number(payload?.exp || 0);

  if (jwtExp > 0) {
    return jwtExp * SECOND_TO_MS;
  }

  if (expiresInSeconds && expiresInSeconds > 0) {
    return Date.now() + expiresInSeconds * SECOND_TO_MS;
  }

  return 0;
}

export function persistLoginTokenStorage(loginToken: Pick<Api.Auth.LoginToken, 'accessToken' | 'refreshToken' | 'expiresInSeconds'>) {
  const accessTokenExpiresAt = resolveTokenExpiresAt(loginToken.accessToken, loginToken.expiresInSeconds);
  const refreshTokenExpiresAt = resolveTokenExpiresAt(loginToken.refreshToken);

  localStg.set('token', loginToken.accessToken);
  localStg.set('refreshToken', loginToken.refreshToken);

  if (accessTokenExpiresAt > 0) {
    localStg.set('accessTokenExpiresAt', accessTokenExpiresAt);
  } else {
    localStg.remove('accessTokenExpiresAt');
  }

  if (refreshTokenExpiresAt > 0) {
    localStg.set('refreshTokenExpiresAt', refreshTokenExpiresAt);
  } else {
    localStg.remove('refreshTokenExpiresAt');
  }

  localStg.set('lastAuthActivityAt', Date.now());
}

export function markAuthActivity() {
  localStg.set('lastAuthActivityAt', Date.now());
}

export function getAccessTokenExpiresAt() {
  return Number(localStg.get('accessTokenExpiresAt') || 0);
}

export function getRefreshTokenExpiresAt() {
  return Number(localStg.get('refreshTokenExpiresAt') || 0);
}

export function getLastAuthActivityAt() {
  return Number(localStg.get('lastAuthActivityAt') || 0);
}

/** Get token */
export function getToken() {
  return localStg.get('token') || '';
}

/** Get login username */
export function getLoginUsername() {
  return localStg.get('loginUsername') || '';
}

/** Get login display name */
export function getLoginDisplayName() {
  return localStg.get('loginDisplayName') || '';
}

/** Get login primary role */
export function getLoginPrimaryRoleCode() {
  return localStg.get('loginPrimaryRoleCode') || null;
}

/** Get login role codes */
export function getLoginRoleCodes() {
  return localStg.get('loginRoleCodes') || [];
}

/** Get login permission codes */
export function getLoginPermissionCodes() {
  return localStg.get('loginPermissionCodes') || [];
}

/** Get login menu codes */
export function getLoginMenuCodes() {
  return localStg.get('loginMenuCodes') || [];
}

/** Get login data scope */
export function getLoginDataScope() {
  return localStg.get('loginDataScope') || null;
}

/** Clear auth storage */
export function clearAuthStorage() {
  localStg.remove('token');
  localStg.remove('refreshToken');
  localStg.remove('accessTokenExpiresAt');
  localStg.remove('refreshTokenExpiresAt');
  localStg.remove('lastAuthActivityAt');
  localStg.remove('loginUsername');
  localStg.remove('loginDisplayName');
  localStg.remove('loginPrimaryRoleCode');
  localStg.remove('loginRoleCodes');
  localStg.remove('loginPermissionCodes');
  localStg.remove('loginMenuCodes');
  localStg.remove('loginDataScope');
}
