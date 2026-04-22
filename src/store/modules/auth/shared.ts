import { localStg } from '@/utils/storage';

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
  localStg.remove('loginUsername');
  localStg.remove('loginDisplayName');
  localStg.remove('loginPrimaryRoleCode');
  localStg.remove('loginRoleCodes');
  localStg.remove('loginPermissionCodes');
  localStg.remove('loginMenuCodes');
  localStg.remove('loginDataScope');
}
