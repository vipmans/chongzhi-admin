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

export function assignAdminUserRole(userId: string, data: Api.Admin.AssignUserRolePayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/users/${userId}/roles`,
    method: 'post',
    data
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

export function fetchChannels(params?: Api.Admin.ChannelListQuery) {
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

export function fetchSuppliers(params?: Api.Admin.SupplierListQuery) {
  return request<Api.Admin.SupplierListResponse>({
    url: '/admin/suppliers',
    params
  });
}

export function createSupplier(data: Api.Admin.SaveSupplierPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/suppliers',
    method: 'post',
    data
  });
}

export function fetchSupplierDetail(supplierId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/suppliers/${supplierId}`
  });
}

export function updateSupplier(supplierId: string, data: Api.Admin.SaveSupplierPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/suppliers/${supplierId}`,
    method: 'put',
    data
  });
}

export function fetchSupplierHealth(supplierId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/suppliers/${supplierId}/health`
  });
}

export function fetchSupplierBalance(supplierId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/suppliers/${supplierId}/balance`
  });
}

export function refreshSupplierBalance(supplierId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/suppliers/${supplierId}/balance/refresh`,
    method: 'post'
  });
}

export function fetchSupplierProducts(supplierId: string, params?: Api.Admin.SupplierProductListQuery) {
  return request<Api.Admin.RawList>({
    url: `/admin/suppliers/${supplierId}/products`,
    params
  });
}

export function fetchSupplierRechargeRecords(supplierId: string) {
  return request<Api.Admin.RawList>({
    url: `/admin/suppliers/${supplierId}/recharge-records`
  });
}

export function createSupplierRechargeRecord(supplierId: string, data: Api.Admin.SupplierRechargeRecordPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/suppliers/${supplierId}/recharge-records`,
    method: 'post',
    data
  });
}

export function fetchSupplierConsumptionLogs(supplierId: string, params?: Api.Admin.SupplierConsumptionLogListQuery) {
  return request<Api.Admin.RawList>({
    url: `/admin/suppliers/${supplierId}/consumption-logs`,
    params
  });
}

export function fetchChannelDetail(channelId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}`
  });
}

export function updateChannel(channelId: string, data: Api.Admin.SaveChannelPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}`,
    method: 'put',
    data
  });
}

export function fetchChannelApiKeys(channelId: string) {
  return request<Api.Admin.RawList>({
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

export function fetchChannelSplitPolicy(channelId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}/split-policy`
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

export function saveChannelSplitPolicy(channelId: string, data: Api.Admin.SaveChannelSplitPolicyPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}/split-policy`,
    method: 'put',
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

export function fetchChannelProducts(channelId: string, params?: Api.Admin.ChannelProductListQuery) {
  return request<Api.Admin.RawList>({
    url: `/admin/channels/${channelId}/products`,
    params
  });
}

export function fetchChannelBalance(channelId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/channels/${channelId}/balance`
  });
}

export function fetchChannelRechargeRecords(channelId: string) {
  return request<Api.Admin.RawList>({
    url: `/admin/channels/${channelId}/recharge-records`
  });
}

export function fetchProducts(params?: Api.Admin.ProductListQuery) {
  return request<Api.Admin.PagedResponse<Api.Admin.RawRecord>>({
    url: '/admin/products',
    params
  });
}

export function fetchProductDetail(productId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/products/${productId}`
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

export function fetchProductSupplierMappings(productId: string) {
  return request<Api.Admin.RawList>({
    url: `/admin/products/${productId}/supplier-mappings`
  });
}

export function createProductSupplierMapping(data: Api.Admin.SaveProductSupplierMappingPayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/product-supplier-mappings',
    method: 'post',
    data
  });
}

export function updateProductSupplierMapping(mappingId: string, data: Api.Admin.SaveProductSupplierMappingPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/product-supplier-mappings/${mappingId}`,
    method: 'put',
    data
  });
}

export function deleteProductSupplierMapping(mappingId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/product-supplier-mappings/${mappingId}`,
    method: 'delete'
  });
}

export function fetchProductPlatformPricing(productId: string) {
  return request<Api.Admin.RawList>({
    url: `/admin/products/${productId}/platform-pricing`
  });
}

export function createProductPlatformPrice(data: Api.Admin.SaveProductPlatformPricePayload) {
  return request<Api.Admin.RawRecord>({
    url: '/admin/product-platform-prices',
    method: 'post',
    data
  });
}

export function updateProductPlatformPrice(priceId: string, data: Api.Admin.SaveProductPlatformPricePayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/product-platform-prices/${priceId}`,
    method: 'put',
    data
  });
}

export function fetchProductDiscountRules(params?: Api.Admin.PagedQuery & { productId?: string }) {
  return request<Api.Admin.RawList>({
    url: '/admin/product-discount-rules',
    params
  });
}

export function fetchProductRoutePolicy(productId: string) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/products/${productId}/route-policy`
  });
}

export function saveProductRoutePolicy(productId: string, data: Api.Admin.SaveProductRoutePolicyPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/products/${productId}/route-policy`,
    method: 'put',
    data
  });
}

export function previewProductRoute(productId: string, data: Api.Admin.ProductRoutePreviewPayload) {
  return request<Api.Admin.RawRecord>({
    url: `/admin/products/${productId}/route-preview`,
    method: 'post',
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
