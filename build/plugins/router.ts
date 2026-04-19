import type { RouteMeta } from 'vue-router';
import ElegantVueRouter from '@elegant-router/vue/vite';
import type { RouteKey } from '@elegant-router/types';

export function setupElegantRouter() {
  const businessRouteMeta: Partial<Record<string, Partial<RouteMeta>>> = {
    home: { title: '工作台', icon: 'mdi:view-dashboard-outline', order: 1 },
    access: { title: '后台权限', icon: 'mdi:shield-account-outline', order: 2 },
    access_users: { title: '后台用户', order: 1 },
    access_roles: { title: '角色管理', order: 2 },
    channels: { title: '渠道管理', icon: 'mdi:lan-connect', order: 3 },
    channels_list: { title: '渠道列表', order: 1 },
    channels_detail: { title: '渠道详情', hideInMenu: true, activeMenu: 'channels_list' as RouteKey },
    products: { title: '商品中心', icon: 'mdi:cube-outline', order: 4 },
    products_list: { title: '平台商品', order: 1 },
    suppliers: { title: '供应商管理', icon: 'mdi:truck-delivery-outline', order: 4.5 },
    suppliers_list: { title: '供应商列表', order: 1 },
    risk: { title: '风控管理', icon: 'mdi:shield-alert-outline', order: 5 },
    risk_rules: { title: '风控规则', order: 1 },
    risk_lists: { title: '黑白名单', order: 2 },
    risk_decisions: { title: '风控决策', order: 3 },
    orders: { title: '订单中心', icon: 'mdi:clipboard-list-outline', order: 6 },
    orders_list: { title: '订单列表', order: 1 },
    orders_detail: { title: '订单详情', hideInMenu: true, activeMenu: 'orders_list' as RouteKey },
    finance: { title: '财务中心', icon: 'mdi:wallet-outline', order: 7 },
    finance_accounts: { title: '账户信息', order: 1 },
    finance_ledger: { title: '财务流水', order: 2 },
    notifications: { title: '通知管理', icon: 'mdi:bell-outline', order: 8 },
    notifications_tasks: { title: '通知任务', order: 1 },
    notifications_detail: { title: '通知详情', hideInMenu: true, activeMenu: 'notifications_tasks' as RouteKey },
    'notifications_dead-letters': { title: '通知死信', order: 2 }
  };

  return ElegantVueRouter({
    layouts: {
      base: 'src/layouts/base-layout/index.vue',
      blank: 'src/layouts/blank-layout/index.vue'
    },
    routePathTransformer(routeName, routePath) {
      const key = routeName as RouteKey;

      if (key === 'login') {
        return '/login/:module(pwd-login)?';
      }

      return routePath;
    },
    onRouteMetaGen(routeName) {
      const key = routeName as RouteKey;

      const constantRouteMeta: Partial<Record<RouteKey, Partial<RouteMeta>>> = {
        login: { title: '登录', i18nKey: 'route.login', constant: true, hideInMenu: true },
        403: { title: '403', i18nKey: 'route.403', constant: true, hideInMenu: true },
        404: { title: '404', i18nKey: 'route.404', constant: true, hideInMenu: true },
        500: { title: '500', i18nKey: 'route.500', constant: true, hideInMenu: true }
      };

      return {
        title: key,
        ...businessRouteMeta[key],
        ...constantRouteMeta[key]
      };
    }
  });
}
