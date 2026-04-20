import { request } from '../request';

export function fetchLogin(payload: Api.Admin.LoginPayload) {
  return request<Api.Auth.LoginToken>({
    url: '/admin/auth/login',
    method: 'post',
    data: payload
  });
}

export function fetchRefreshToken(refreshToken: string) {
  return request<Api.Auth.LoginToken>({
    url: '/admin/auth/refresh',
    method: 'post',
    data: {
      refreshToken
    }
  });
}

export function fetchAuthMe() {
  return request<Api.Auth.LoginUser>({
    url: '/admin/auth/me'
  });
}

export function fetchLogout(refreshToken: string) {
  return request<void>({
    url: '/admin/auth/logout',
    method: 'post',
    data: {
      refreshToken
    }
  });
}
