import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import { fetchAuthMe, fetchLogin } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { SetupStoreId } from '@/enum';
import { $t } from '@/locales';
import { localStg } from '@/utils/storage';
import { useRouteStore } from '../route';
import { useTabStore } from '../tab';
import {
  clearAuthStorage,
  getLoginDataScope,
  getLoginDisplayName,
  getLoginMenuCodes,
  getLoginPermissionCodes,
  getLoginPrimaryRoleCode,
  getLoginRoleCodes,
  getLoginUsername,
  getToken,
  markAuthActivity,
  persistLoginTokenStorage
} from './shared';
import { refreshAccessTokenIfNeeded, requestLogout } from '@/service/request/shared';

const SESSION_REFRESH_INTERVAL_MS = 60 * 1000;
const SESSION_REFRESH_AHEAD_MS = 10 * 60 * 1000;
const ACTIVITY_REFRESH_THROTTLE_MS = 30 * 1000;

export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  const routeStore = useRouteStore();
  const tabStore = useTabStore();
  const { toLogin, redirectFromLogin } = useRouterPush(false);
  const { loading: loginLoading, startLoading, endLoading } = useLoading();

  const token = ref('');
  const userInfo: Api.Auth.SessionUser = reactive({
    userName: '',
    displayName: '',
    primaryRoleCode: null,
    roleCodes: [],
    permissionCodes: [],
    menuCodes: [],
    dataScope: null
  });

  let sessionKeepAliveTimer: number | null = null;
  let activityListenersBound = false;
  let lastActivityRefreshAt = 0;

  /** Is login */
  const isLogin = computed(() => Boolean(token.value));

  function clearSessionKeepAlive() {
    if (sessionKeepAliveTimer !== null) {
      window.clearInterval(sessionKeepAliveTimer);
      sessionKeepAliveTimer = null;
    }
  }

  function removeActivityListeners() {
    if (!activityListenersBound) {
      return;
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('click', handleUserActivity);
    window.removeEventListener('keydown', handleUserActivity);
    window.removeEventListener('mousemove', handleUserActivity);
    window.removeEventListener('scroll', handleUserActivity);
    activityListenersBound = false;
  }

  async function keepSessionAlive(force = false) {
    if (!token.value && !getToken()) {
      return false;
    }

    const success = await refreshAccessTokenIfNeeded({
      force,
      thresholdMs: SESSION_REFRESH_AHEAD_MS
    });

    if (success) {
      markAuthActivity();
      token.value = getToken();
    }

    return success;
  }

  function handleUserActivity() {
    if (!isLogin.value) {
      return;
    }

    markAuthActivity();

    const now = Date.now();

    if (now - lastActivityRefreshAt < ACTIVITY_REFRESH_THROTTLE_MS) {
      return;
    }

    lastActivityRefreshAt = now;
    void keepSessionAlive(false);
  }

  function handleVisibilityChange() {
    if (!isLogin.value || document.visibilityState !== 'visible') {
      return;
    }

    void keepSessionAlive(false);
  }

  function handleWindowFocus() {
    if (!isLogin.value) {
      return;
    }

    void keepSessionAlive(false);
  }

  function bindActivityListeners() {
    if (activityListenersBound) {
      return;
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });
    activityListenersBound = true;
  }

  function setupSessionKeepAlive() {
    if (typeof window === 'undefined') {
      return;
    }

    bindActivityListeners();
    clearSessionKeepAlive();

    sessionKeepAliveTimer = window.setInterval(() => {
      if (!isLogin.value || document.visibilityState !== 'visible') {
        return;
      }

      void keepSessionAlive(false);
    }, SESSION_REFRESH_INTERVAL_MS);
  }

  /** Reset auth store */
  async function resetStore() {
    clearSessionKeepAlive();
    removeActivityListeners();
    clearAuthStorage();
    token.value = '';
    userInfo.userName = '';
    userInfo.displayName = '';
    userInfo.primaryRoleCode = null;
    userInfo.roleCodes = [];
    userInfo.permissionCodes = [];
    userInfo.menuCodes = [];
    userInfo.dataScope = null;

    await toLogin('pwd-login', '/');
    tabStore.cacheTabs();
    routeStore.resetStore();
  }

  async function logout() {
    try {
      await requestLogout();
    } finally {
      await resetStore();
    }
  }

  /**
   * Login
   *
   * @param username User name
   * @param password Password
   * @param [redirect=true] Whether to redirect after login. Default is `true`
   */
  async function login(username: string, password: string, redirect = true) {
    startLoading();

    const { data: loginToken, error } = await fetchLogin({ username, password });

    if (!error) {
      const pass = await loginByToken(loginToken, username);

      if (pass) {
        if (!routeStore.isInitAuthRoute) {
          await routeStore.initAuthRoute();
        }

        await redirectFromLogin(redirect);

        window.$notification?.success({
          title: $t('page.login.common.loginSuccess'),
          content: $t('page.login.common.welcomeBack', { userName: userInfo.userName || username }),
          duration: 4500
        });
      }
    } else {
      resetStore();
    }

    endLoading();
  }

  async function loginByToken(loginToken: Api.Auth.LoginToken, username: string) {
    const accessToken = loginToken.accessToken;
    const loginUser = loginToken.user || {};
    const loginUsername = loginUser.username || username;
    const displayName = loginUser.displayName || loginUsername;
    const primaryRoleCode = loginUser.primaryRoleCode ?? null;
    const roleCodes = loginUser.roleCodes || [];
    const permissionCodes = loginUser.permissionCodes || [];
    const menuCodes = loginUser.menuCodes || [];
    const dataScope = loginUser.dataScope ?? null;

    token.value = accessToken;
    userInfo.userName = loginUsername;
    userInfo.displayName = displayName;
    userInfo.primaryRoleCode = primaryRoleCode;
    userInfo.roleCodes = roleCodes;
    userInfo.permissionCodes = permissionCodes;
    userInfo.menuCodes = menuCodes;
    userInfo.dataScope = dataScope;

    persistLoginTokenStorage(loginToken);
    localStg.set('loginUsername', loginUsername);
    localStg.set('loginDisplayName', displayName);
    localStg.set('loginPrimaryRoleCode', primaryRoleCode);
    localStg.set('loginRoleCodes', roleCodes);
    localStg.set('loginPermissionCodes', permissionCodes);
    localStg.set('loginMenuCodes', menuCodes);
    localStg.set('loginDataScope', dataScope);

    tabStore.clearTabs();
    setupSessionKeepAlive();
    void keepSessionAlive(false);

    return true;
  }

  async function initUserInfo() {
    const maybeToken = getToken();

    if (!maybeToken) {
      return;
    }

    token.value = maybeToken;
    userInfo.userName = getLoginUsername();
    userInfo.displayName = getLoginDisplayName();
    userInfo.primaryRoleCode = getLoginPrimaryRoleCode();
    userInfo.roleCodes = getLoginRoleCodes();
    userInfo.permissionCodes = getLoginPermissionCodes();
    userInfo.menuCodes = getLoginMenuCodes();
    userInfo.dataScope = getLoginDataScope();

    setupSessionKeepAlive();
    await keepSessionAlive(false);

    if (userInfo.userName && userInfo.roleCodes.length) {
      return;
    }

    const { data: loginUser, error } = await fetchAuthMe();

    if (error) {
      await resetStore();
      return;
    }

    if (loginUser) {
      const loginUsername = loginUser.username || userInfo.userName;
      const displayName = loginUser.displayName || userInfo.displayName || loginUsername;
      const primaryRoleCode = loginUser.primaryRoleCode ?? userInfo.primaryRoleCode ?? null;
      const roleCodes = loginUser.roleCodes || userInfo.roleCodes || [];
      const permissionCodes = loginUser.permissionCodes || userInfo.permissionCodes || [];
      const menuCodes = loginUser.menuCodes || userInfo.menuCodes || [];
      const dataScope = loginUser.dataScope ?? userInfo.dataScope ?? null;

      userInfo.userName = loginUsername;
      userInfo.displayName = displayName;
      userInfo.primaryRoleCode = primaryRoleCode;
      userInfo.roleCodes = roleCodes;
      userInfo.permissionCodes = permissionCodes;
      userInfo.menuCodes = menuCodes;
      userInfo.dataScope = dataScope;

      localStg.set('loginUsername', loginUsername);
      localStg.set('loginDisplayName', displayName);
      localStg.set('loginPrimaryRoleCode', primaryRoleCode);
      localStg.set('loginRoleCodes', roleCodes);
      localStg.set('loginPermissionCodes', permissionCodes);
      localStg.set('loginMenuCodes', menuCodes);
      localStg.set('loginDataScope', dataScope);
    }
  }

  return {
    token,
    userInfo,
    isLogin,
    loginLoading,
    resetStore,
    logout,
    login,
    loginByToken,
    initUserInfo,
    keepSessionAlive
  };
});
