import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { useLoading } from '@sa/hooks';
import { fetchLogin } from '@/service/api';
import { useRouterPush } from '@/hooks/common/router';
import { SetupStoreId } from '@/enum';
import { $t } from '@/locales';
import { localStg } from '@/utils/storage';
import { useRouteStore } from '../route';
import { useTabStore } from '../tab';
import { clearAuthStorage, getLoginUsername, getToken } from './shared';
import { requestLogout } from '@/service/request/shared';

export const useAuthStore = defineStore(SetupStoreId.Auth, () => {
  const routeStore = useRouteStore();
  const tabStore = useTabStore();
  const { toLogin, redirectFromLogin } = useRouterPush(false);
  const { loading: loginLoading, startLoading, endLoading } = useLoading();

  const token = ref('');
  const userInfo: Api.Auth.SessionUser = reactive({
    userName: ''
  });

  /** Is login */
  const isLogin = computed(() => Boolean(token.value));

  /** Reset auth store */
  async function resetStore() {
    clearAuthStorage();
    token.value = '';
    userInfo.userName = '';

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
   * @param userName User name
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
    const loginUsername = loginToken.user?.username || username;

    token.value = accessToken;
    userInfo.userName = loginUsername;
    localStg.set('token', accessToken);
    localStg.set('refreshToken', loginToken.refreshToken);
    localStg.set('loginUsername', loginUsername);
    tabStore.clearTabs();
    return true;
  }

  async function initUserInfo() {
    const maybeToken = getToken();

    if (maybeToken) {
      token.value = maybeToken;
      userInfo.userName = getLoginUsername();
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
    initUserInfo
  };
});
