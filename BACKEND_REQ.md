# BACKEND_REQ.md

## 后端正式需求版

基于以下输入整理：

- `C:\Users\nianx\OneDrive\Desktop\api.json`
- [REQUIREMENTS.md](/C:/Users/nianx/chongzhi-admin/REQUIREMENTS.md)

本文档是统一需求的后端拆分版，只保留后端需要实现的部分。

---

## 1. 基于 `api.json` 的后端架构结论

当前 `api.json` 明确体现的是两套认证体系：

### 1.1 内部管理平台

已有接口：

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `GET /admin/auth/me`
- `POST /admin/auth/logout`
- `GET /admin/users/`
- `POST /admin/users/`
- `POST /admin/users/{userId}/roles`
- `GET /admin/roles/`

结论：

- 公司内部员工统一登录同一个管理平台
- 不应再拆出多个内部员工独立登录平台
- 风控、运营、财务、技术支持应属于管理平台中的角色和菜单模块

### 1.2 外部渠道管理平台

已有接口：

- `POST /portal/auth/login`
- `POST /portal/auth/logout`
- `GET /portal/me`

结论：

- 外部渠道统一登录同一个渠道管理平台
- 渠道身份由后端认证上下文识别

---

## 2. 后端必须遵守的架构要求

必须保持：

- 一个内部管理平台
- 一个外部渠道管理平台

明确禁止：

- 再设计多个内部登录域
- 用多个登录平台替代角色权限控制

正确方案：

- 内部员工统一走 `/admin/*`
- 外部渠道统一走 `/portal/*`
- 管理平台内通过角色和权限控制菜单、页面、按钮和数据

---

## 3. 管理平台账号、角色、权限需求

## 3.1 后台用户

当前 `POST /admin/users/` 从 `api.json` 看，仅支持：

- `username`
- `password`
- `displayName`
- `email`

不能满足当前业务。

建议补充字段：

- `roleCode`
- `mobile1`
- `mobile2`
- `wechat`
- `qq`
- `remark`
- `status`

其中：

- `username`、`password`、`roleCode` 为必填
- 其余为选填

## 3.2 角色模型

当前已有：

- `GET /admin/roles/`
- `POST /admin/roles/`
- `POST /admin/users/{userId}/roles`

当前业务要求：

- 管理平台内部员工按角色控制菜单与功能
- 当前版本一个后台用户只保留一个主角色

虽然当前接口使用 `roleCodes` 数组，但建议后端收敛为：

- 单用户单主角色
- 或返回 `primaryRoleCode`

建议角色模型补充：

- `permissionCodes`
- `menuCodes`
- `dataScope`

## 3.3 登录返回增强

当前 `/admin/auth/login` 和 `/admin/auth/me` 已返回用户基础信息和 `roleCodes`。

建议增强返回：

- `primaryRoleCode`
- `permissionCodes`
- `menuCodes`
- `dataScope`

这样前端才能在同一个管理平台里按角色渲染不同菜单和功能。

---

## 4. 渠道管理平台账号需求

## 4.1 渠道门户账号模型

当前 `/portal/auth/login` 与 `/portal/me` 已能返回：

- `channelId`
- `channelCode`
- `channelName`
- `status`
- `roleCodes`
- `permissions`

说明渠道管理平台已有单独登录基础。

建议后端补齐开通审核能力：

- `GET /admin/channels/{channelId}/portal-account`
- `POST /admin/channels/{channelId}/portal-account/open`
- `POST /admin/channels/{channelId}/portal-account/approve`
- `POST /admin/channels/{channelId}/portal-account/reject`
- `POST /admin/channels/{channelId}/portal-account/reset-password`
- `POST /admin/channels/{channelId}/portal-account/disable`
- `POST /admin/channels/{channelId}/portal-account/enable`

建议字段：

- `portalAccount`
- `portalPasswordHash`
- `portalStatus`
- `portalOpenedAt`
- `portalApprovedAt`
- `lastLoginAt`

## 4.2 渠道权限边界

要求：

- 渠道登录成功后，后端自动绑定当前 `channelId`
- 门户接口不能依赖前端传入 `channelId` 判定权限
- 门户所有数据查询只能返回当前登录渠道自己的数据

---

## 5. 平台商品、价格、折扣、供应商关联

## 5.1 当前 `api.json` 已有

- `GET /admin/products`
- `POST /admin/products`
- `GET /admin/products/{productId}`
- `PUT /admin/products/{productId}`
- `GET /admin/suppliers/{supplierId}/products`
- `POST /admin/suppliers/{supplierId}/catalog/sync`
- `POST /internal/suppliers/catalog/full-sync`
- `POST /internal/suppliers/catalog/delta-sync`
- `GET /admin/suppliers/reconcile-diffs`
- `POST /admin/channel-products`
- `POST /admin/channel-prices`
- `GET /admin/channels/{channelId}/order-policy`
- `GET /admin/channels/{channelId}/products`
- `GET /open-api/products/`
- `GET /internal/products/recharge/match`
- `GET /admin/orders/{orderNo}`

## 5.2 当前缺失

当前缺的是平台逻辑配置层：

- 平台商品与供应商商品映射
- 默认供应商与候补供应商
- 平台采购价、标准售价、毛利
- 折扣规则
- 路由策略
- 路由预览与解释

## 5.3 建议新增接口

- `GET /admin/products/{productId}/supplier-mappings`
- `POST /admin/product-supplier-mappings`
- `PUT /admin/product-supplier-mappings/{mappingId}`
- `DELETE /admin/product-supplier-mappings/{mappingId}`
- `GET /admin/products/{productId}/platform-pricing`
- `POST /admin/product-platform-prices`
- `PUT /admin/product-platform-prices/{priceId}`
- `GET /admin/product-discount-rules`
- `POST /admin/product-discount-rules`
- `PUT /admin/product-discount-rules/{ruleId}`
- `GET /admin/products/{productId}/route-policy`
- `PUT /admin/products/{productId}/route-policy`
- `POST /admin/products/{productId}/route-preview`

---

## 6. 投诉管理 / 售后工单

当前 `api.json` 仅有相邻能力：

- `GET /admin/orders`
- `GET /admin/orders/{orderNo}`
- `POST /admin/orders/{orderNo}/mark-exception`
- `POST /admin/orders/{orderNo}/remarks`

当前并没有完整投诉工单模块。

建议新增：

- `GET /admin/complaints`
- `POST /admin/complaints`
- `GET /admin/complaints/{complaintId}`
- `POST /admin/complaints/{complaintId}/assign`
- `POST /admin/complaints/{complaintId}/transfer`
- `POST /admin/complaints/{complaintId}/status`
- `POST /admin/complaints/{complaintId}/progress-logs`
- `POST /admin/complaints/{complaintId}/result`
- `POST /admin/complaints/{complaintId}/feedback`
- `POST /admin/complaints/{complaintId}/close`
- `POST /admin/complaints/{complaintId}/reopen`
- `GET /admin/complaint-stats`
- `POST /admin/complaints/export`

---

## 7. 实施优先级

建议按以下顺序推进：

1. 先固定架构为“一个管理平台 + 一个渠道管理平台”
2. 先补管理平台角色菜单控制与渠道账号审核开通
3. 再补平台商品配置层能力
4. 最后补投诉管理模块

---

## 8. 一句话结论

根据当前 `api.json`，后端正确方向不是继续拆内部登录平台，而是：

- 内部统一管理平台登录
- 外部统一渠道管理平台登录
- 管理平台内部通过角色和权限控制菜单与功能
