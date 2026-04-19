import { useRouter } from 'vue-router';
import { nextTick } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { RouteKey } from '@elegant-router/types';
import { router as globalRouter } from '@/router';

export function useRouterPush(inSetup = true) {
  const router = inSetup ? useRouter() : globalRouter;
  const route = globalRouter.currentRoute;

  const routerPush = router.push;
  const routerBack = router.back;

  async function routerPushByKey(key: RouteKey, options?: App.Global.RouterPushOptions) {
    const { query, params } = options || {};

    const routeLocation: RouteLocationRaw = {
      name: key
    };

    if (Object.keys(query || {}).length) {
      routeLocation.query = query;
    }

    if (Object.keys(params || {}).length) {
      routeLocation.params = params;
    }

    return routerPush(routeLocation);
  }

  function routerPushByKeyWithMetaQuery(key: RouteKey) {
    const allRoutes = router.getRoutes();
    const meta = allRoutes.find(item => item.name === key)?.meta || null;
    const query: Record<string, string> = {};

    meta?.query?.forEach(item => {
      query[item.key] = item.value;
    });

    return routerPushByKey(key, { query });
  }

  async function toLogin(loginModule?: UnionKey.LoginModule, redirectUrl?: string) {
    const options: App.Global.RouterPushOptions = {
      params: {
        module: loginModule || 'pwd-login'
      }
    };

    const redirect = redirectUrl || route.value.fullPath;
    options.query = { redirect };

    return routerPushByKey('login', options);
  }

  async function redirectFromLogin(needRedirect = true) {
    const redirect = route.value.query?.redirect as string;
    const isLoginRedirect = typeof redirect === 'string' && redirect.startsWith('/login');
    const homeRoute = import.meta.env.VITE_ROUTE_HOME as RouteKey;
    const fallbackPath = `/${homeRoute}`;

    if (needRedirect && redirect && !isLoginRedirect) {
      await router.replace(redirect);
    } else {
      await router.replace({ name: homeRoute });
    }

    await nextTick();

    if (globalRouter.currentRoute.value.name === 'login') {
      await globalRouter.replace({ name: homeRoute });
      await nextTick();
    }

    if (globalRouter.currentRoute.value.name === 'login') {
      window.location.replace(fallbackPath);
    }
  }

  return {
    routerPush,
    routerBack,
    routerPushByKey,
    routerPushByKeyWithMetaQuery,
    toLogin,
    redirectFromLogin
  };
}
