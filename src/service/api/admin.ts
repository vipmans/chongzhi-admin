import { request } from '../request';

export function fetchAdminUsers(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/users/',
    params
  });
}

export function createAdminUser(data: Api.Admin.CreateUserPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/users/',
    method: 'post',
    data
  });
}

export function fetchAdminUserDetail(userId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/users/${userId}`
  });
}

export function fetchAdminRoles(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/roles/',
    params
  });
}

export function createAdminRole(data: Api.Admin.CreateRolePayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/roles/',
    method: 'post',
    data
  });
}

export function fetchChannels(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/channels',
    params
  });
}

export function createChannel(data: Api.Admin.CreateChannelPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/channels',
    method: 'post',
    data
  });
}

export function fetchChannelDetail(channelId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}`
  });
}

export function fetchChannelApiKeys(channelId: string) {
  return request<Api.Admin.RawRecord[]>({
    url: `/admin/channels/${channelId}/api-keys`
  });
}

export function createChannelApiKey(data: Api.Admin.CreateChannelApiKeyPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/channel-api-keys',
    method: 'post',
    data
  });
}

export function fetchChannelCallbackConfig(channelId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}/callback-config`
  });
}

export function saveChannelCallbackConfig(data: Api.Admin.SaveChannelCallbackConfigPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/channel-callback-configs',
    method: 'post',
    data
  });
}

export function fetchChannelOrderPolicy(channelId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}/order-policy`
  });
}

export function saveChannelProduct(data: Api.Admin.SaveChannelProductPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/channel-products',
    method: 'post',
    data
  });
}

export function saveChannelPrice(data: Api.Admin.SaveChannelPricePayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/channel-prices',
    method: 'post',
    data
  });
}

export function saveChannelLimit(data: Api.Admin.SaveChannelLimitPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/channel-limits',
    method: 'post',
    data
  });
}

export function rechargeChannel(channelId: string, data: Api.Admin.RechargeChannelPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}/recharge`,
    method: 'post',
    data
  });
}

export function fetchProducts(params?: Api.Admin.ProductListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/products',
    params
  });
}

export function createProduct(data: Api.Admin.SaveProductPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/products',
    method: 'post',
    data
  });
}

export function updateProduct(productId: string, data: Api.Admin.SaveProductPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/products/${productId}`,
    method: 'put',
    data
  });
}

export function fetchRiskRules(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/risk/rules',
    params
  });
}

export function createRiskRule(data: Api.Admin.SaveRiskRulePayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/risk/rules',
    method: 'post',
    data
  });
}

export function fetchRiskBlackWhiteLists(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/risk/black-white-lists',
    params
  });
}

export function createRiskBlackWhiteList(data: Api.Admin.SaveBlackWhiteListPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/risk/black-white-lists',
    method: 'post',
    data
  });
}

export function fetchRiskDecisions(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/risk/decisions',
    params
  });
}

export function fetchOrders(params?: Api.Admin.OrderListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/orders/',
    params
  });
}

export function fetchOrderDetail(orderNo: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/orders/${orderNo}`
  });
}

export function fetchOrderEvents(orderNo: string, params?: Api.Admin.OrderEventListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: `/admin/orders/${orderNo}/events`,
    params
  });
}

export function closeOrder(orderNo: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/orders/${orderNo}/close`,
    method: 'post'
  });
}

export function markOrderException(orderNo: string, data: Api.Admin.MarkOrderExceptionPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/orders/${orderNo}/mark-exception`,
    method: 'post',
    data
  });
}

export function addOrderRemark(orderNo: string, data: Api.Admin.AddOrderRemarkPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/orders/${orderNo}/remarks`,
    method: 'post',
    data
  });
}

export function retryOrderNotify(orderNo: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/orders/${orderNo}/retry-notify`,
    method: 'post'
  });
}

export function fetchAccounts(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/accounts',
    params
  });
}

export function fetchLedgerEntries(params?: Api.Admin.LedgerEntryListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/ledger-entries',
    params
  });
}

export function fetchNotificationTasks(params?: Api.Admin.NotificationTaskListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/notifications/tasks',
    params
  });
}

export function fetchNotificationTaskDetail(taskNo: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/notifications/tasks/${taskNo}`
  });
}

export function fetchNotificationTaskDeliveryLogs(taskNo: string, params?: Api.Admin.DeliveryLogListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: `/admin/notifications/tasks/${taskNo}/delivery-logs`,
    params
  });
}

export function retryNotificationTask(taskNo: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/notifications/tasks/${taskNo}/retry`,
    method: 'post'
  });
}

export function fetchNotificationDeadLetters(params?: Api.Admin.PagedQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/notifications/dead-letters',
    params
  });
}
