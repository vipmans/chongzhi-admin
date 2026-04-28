import { useAuthStore } from '@/store/modules/auth';
import {
  getAccessTokenExpiresAt,
  getRefreshTokenExpiresAt,
  markAuthActivity,
  persistLoginTokenStorage
} from '@/store/modules/auth/shared';
import { localStg } from '@/utils/storage';
import { fetchLogout, fetchRefreshToken } from '../api';
import type { RequestInstanceState } from './type';

const TOKEN_REFRESH_AHEAD_MS = 10 * 60 * 1000;

let refreshTokenPromise: Promise<boolean> | null = null;

export function getAuthorization() {
  const token = localStg.get('token');
  const Authorization = token ? `Bearer ${token}` : null;

  return Authorization;
}

export function getResponseMsg(data?: Partial<App.Service.Response<any>> | string | null) {
  if (typeof data === 'string') {
    return data;
  }

  return data?.msg || data?.message || (data as Record<string, any> | null)?.summary || '';
}

export function isExpiredTokenMessage(message?: string | null) {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.trim().toLowerCase();

  return [
    'jwt expired',
    'token expired',
    'token has expired',
    'token已过期',
    'jwt已过期',
    '登录已过期',
    '认证已过期',
    'invalid or expired token'
  ].some(keyword => normalizedMessage.includes(keyword));
}

async function runRefreshTokenRequest() {
  const { resetStore } = useAuthStore();

  const rToken = localStg.get('refreshToken') || '';
  const refreshTokenExpiresAt = getRefreshTokenExpiresAt();

  if (!rToken) {
    await resetStore();
    return false;
  }

  if (refreshTokenExpiresAt > 0 && refreshTokenExpiresAt <= Date.now()) {
    await resetStore();
    return false;
  }

  const { error, data } = await fetchRefreshToken(rToken);

  if (!error) {
    persistLoginTokenStorage(data);
    return true;
  }

  await resetStore();

  return false;
}

export async function refreshAccessToken(force = false) {
  const token = localStg.get('token') || '';

  if (!token) {
    return false;
  }

  if (!refreshTokenPromise || force) {
    refreshTokenPromise = runRefreshTokenRequest().finally(() => {
      window.setTimeout(() => {
        refreshTokenPromise = null;
      }, 1000);
    });
  }

  return refreshTokenPromise;
}

export async function refreshAccessTokenIfNeeded(options?: { thresholdMs?: number; force?: boolean }) {
  const token = localStg.get('token') || '';

  if (!token) {
    return false;
  }

  const thresholdMs = options?.thresholdMs ?? TOKEN_REFRESH_AHEAD_MS;
  const accessTokenExpiresAt = getAccessTokenExpiresAt();
  const isForce = Boolean(options?.force);

  if (!isForce && accessTokenExpiresAt > 0 && accessTokenExpiresAt - Date.now() > thresholdMs) {
    markAuthActivity();
    return true;
  }

  const success = await refreshAccessToken(isForce);

  if (success) {
    markAuthActivity();
  }

  return success;
}

export async function requestLogout() {
  const refreshToken = localStg.get('refreshToken') || '';

  if (!refreshToken) {
    return;
  }

  await fetchLogout(refreshToken);
}

export async function handleExpiredRequest(state: RequestInstanceState) {
  if (!state.refreshTokenPromise) {
    state.refreshTokenPromise = refreshAccessToken(true);
  }

  const success = await state.refreshTokenPromise;

  window.setTimeout(() => {
    state.refreshTokenPromise = null;
  }, 1000);

  return success;
}

export function showErrorMsg(state: RequestInstanceState, message: string) {
  if (!state.errMsgStack?.length) {
    state.errMsgStack = [];
  }

  const isExist = state.errMsgStack.includes(message);

  if (!isExist) {
    state.errMsgStack.push(message);

    window.$message?.error(message, {
      onLeave: () => {
        state.errMsgStack = state.errMsgStack.filter(msg => msg !== message);

        window.setTimeout(() => {
          state.errMsgStack = [];
        }, 5000);
      }
    });
  }
}
