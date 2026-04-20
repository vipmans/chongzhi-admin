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

/** Get login role codes */
export function getLoginRoleCodes() {
  return localStg.get('loginRoleCodes') || [];
}

/** Clear auth storage */
export function clearAuthStorage() {
  localStg.remove('token');
  localStg.remove('refreshToken');
  localStg.remove('loginUsername');
  localStg.remove('loginDisplayName');
  localStg.remove('loginRoleCodes');
}
