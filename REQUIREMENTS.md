# REQUIREMENTS.md

## 统一需求说明

基于以下输入整理：

- `C:\Users\nianx\OneDrive\Desktop\api.json`
- 本次沟通中关于后台用户、角色权限、平台架构、渠道门户、平台商品、投诉管理的全部补充说明

本文档作为当前阶段统一需求版本，供产品、后端、前端共同使用。

---

## 1. 基于 `api.json` 的架构结论

经过对 `api.json` 的仔细核对，当前接口设计明确体现的是“两套登录体系”，而不是多套内部平台登录体系。

### 1.1 当前已明确存在的后台管理平台接口

`api.json` 中已存在以下内部管理平台相关接口：

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `GET /admin/auth/me`
- `POST /admin/auth/logout`
- `GET /admin/users/`
- `POST /admin/users/`
- `POST /admin/users/{userId}/roles`
- `GET /admin/roles/`

这说明：

- 公司内部员工统一通过一个管理平台登录
- 登录后根据角色不同，展示不同菜单和功能
- 当前接口设计并没有单独拆出“技术支持平台登录”“风控平台登录”“运营平台登录”“财务平台登录”这类独立内部登录入口

### 1.2 当前已明确存在的渠道管理平台接口

`api.json` 中已存在以下外部渠道平台相关接口：

- `POST /portal/auth/login`
- `POST /portal/auth/logout`
- `GET /portal/me`

并且渠道门户登录返回结构中已经包含：

- `channelId`
- `channelCode`
- `channelName`
- `status`
- `roleCodes`
- `permissions`

这说明：

- 外部渠道应统一通过一个渠道管理平台登录
- 渠道登录后由后端自动识别所属渠道身份
- 渠道只能访问本渠道相关功能和数据

### 1.3 本次需求的架构约束

必须严格保持整体架构不变：

- 一个管理平台：公司内部员工使用
- 一个渠道管理平台：公司外部渠道使用

明确禁止：

- 再拆出多个内部员工独立登录平台
- 再新增技术支持、风控、运营、财务等独立登录入口
- 将“角色不同”错误实现成“多平台登录”

正确做法是：

- 内部员工统一登录管理平台
- 通过角色和权限控制菜单、页面、按钮、数据范围
- 外部渠道统一登录渠道管理平台

---

## 2. 平台划分

## 2.1 管理平台

管理平台是公司内部统一后台。

使用对象：

- 超级管理员
- 平台运营
- 平台财务
- 风控专员
- 技术支持

建议入口：

- `https://admin.example.com`

在这个平台内，根据用户角色不同，动态显示不同菜单和功能模块。

这些角色是“同一个管理平台里的角色”，不是多个独立平台。

## 2.2 渠道管理平台

渠道管理平台是公司外部渠道统一使用的平台。

使用对象：

- 外部代理销售渠道

建议入口：

- `https://portal.example.com`

特点：

- 每个渠道使用独立账号密码登录
- 登录后只能查看本渠道的业务数据
- 不允许进入内部管理平台

---

## 3. 用户、角色、权限的正确关系

## 3.1 角色和权限不能混用

- 角色：岗位身份
- 权限：可操作的功能点

当前系统应按以下方式设计：

- 内部员工先属于某个角色
- 角色绑定对应权限
- 前端根据角色和权限渲染菜单与功能

## 3.2 内部员工账号

内部员工统一属于管理平台账号体系。

建议角色包括：

- `SUPER_ADMIN`
- `OPS`
- `FINANCE`
- `RISK`
- `SUPPORT`

根据此前业务约束，当前版本建议一个后台用户只绑定一个主角色。

虽然当前 `api.json` 的登录返回和用户列表里使用了 `roleCodes` 数组，但业务上建议：

- 后端限制同一后台用户只有一个有效主角色
- 或至少补充 `primaryRoleCode`

避免前端出现多角色冲突。

## 3.3 外部渠道账号

外部渠道统一属于渠道管理平台账号体系。

特点：

- 一渠道一账号
- 先审核开通，再允许登录
- 登录后自动绑定渠道身份

明确要求：

- 内部员工账号不能登录渠道管理平台
- 渠道账号不能登录管理平台

---

## 4. 基于当前 `api.json` 的后端需求

## 4.1 管理平台认证与用户体系

当前已有：

- `/admin/auth/login`
- `/admin/auth/me`
- `/admin/users/`
- `/admin/users/{userId}/roles`
- `/admin/roles/`

当前缺口主要在于“字段不足”和“角色权限表达不完整”。

### 4.1.1 后台用户新增字段需求

当前 `POST /admin/users/` 从 `api.json` 看，主要只支持：

- `username`
- `password`
- `displayName`
- `email`

这不足以满足业务需求。

建议新增或补齐：

- `roleCode`
- `mobile1`
- `mobile2`
- `wechat`
- `qq`
- `remark`
- `status`

其中：

- `username`、`password`、`roleCode` 为必填
- 其他字段为选填

### 4.1.2 登录返回建议增强

当前 `/admin/auth/login` 与 `/admin/auth/me` 已返回用户基础信息和 `roleCodes`。

建议增强返回：

- `primaryRoleCode`
- `permissionCodes`
- `menuCodes`
- `dataScope`

这样前端才能在同一个管理平台内正确控制菜单和功能。

### 4.1.3 角色接口建议

当前已有：

- `GET /admin/roles/`
- `POST /admin/roles/`

建议角色模型至少包含：

- `roleCode`
- `roleName`
- `status`
- `permissionCodes`
- `menuCodes`
- `dataScope`

## 4.2 渠道管理平台认证与账号体系

当前已有：

- `POST /portal/auth/login`
- `GET /portal/me`

说明当前渠道管理平台已具备独立认证基础。

建议补齐渠道账号开通审核能力：

- `GET /admin/channels/{channelId}/portal-account`
- `POST /admin/channels/{channelId}/portal-account/open`
- `POST /admin/channels/{channelId}/portal-account/approve`
- `POST /admin/channels/{channelId}/portal-account/reject`
- `POST /admin/channels/{channelId}/portal-account/reset-password`
- `POST /admin/channels/{channelId}/portal-account/disable`
- `POST /admin/channels/{channelId}/portal-account/enable`

建议渠道门户账号字段至少包括：

- `portalAccount`
- `portalPasswordHash`
- `portalStatus`
- `portalOpenedAt`
- `portalApprovedAt`
- `lastLoginAt`

并要求：

- 门户数据边界以后端认证上下文为准
- 不允许前端通过手工传入 `channelId` 决定权限边界

## 4.3 平台商品、价格、折扣、供应商关联

### 当前 `api.json` 已有

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

### 当前缺失

当前缺的是平台逻辑的“配置层”：

- 平台商品与供应商商品映射关系
- 默认供应商与候补供应商配置
- 平台采购价、标准售价、毛利配置
- 折扣规则中心
- 路由策略
- 路由预览与路由解释

### 建议新增接口

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

## 4.4 投诉管理 / 售后工单

当前 `api.json` 仅有相邻能力：

- `GET /admin/orders`
- `GET /admin/orders/{orderNo}`
- `POST /admin/orders/{orderNo}/mark-exception`
- `POST /admin/orders/{orderNo}/remarks`

当前并没有完整投诉管理模块。

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

## 5. 基于当前 `api.json` 的前端实现要求

## 5.1 只能保留两个前端平台

前端实现必须严格保持当前架构：

- 一个管理平台前端
- 一个渠道管理平台前端

不要拆成：

- `support-web`
- `risk-web`
- `ops-web`
- `finance-web`

这类独立内部登录站点。

正确实现应为：

- 管理平台内部按角色展示不同菜单模块
- 渠道管理平台单独存在

## 5.2 管理平台前端要求

管理平台内，根据角色和权限动态控制：

- 左侧菜单
- 页面访问
- 按钮权限
- 数据范围

推荐菜单按模块划分，但仍属于同一个管理平台：

- 工作台
- 后台用户
- 角色管理
- 渠道管理
- 供应商管理
- 平台商品
- 订单管理
- 财务管理
- 风控管理
- 技术支持
- 投诉管理
- 审计日志

## 5.3 渠道管理平台前端要求

渠道管理平台保持独立：

- 单独登录页
- 单独用户态
- 单独权限边界

但只允许一个外部渠道平台，不要继续拆分。

---

## 6. 推荐工程实现方式

在保持总体架构不变的前提下，建议前端工程只拆成两个应用：

```text
apps/
  admin-web
  portal-web

packages/
  shared-auth
  shared-api-types
  shared-api-client
  shared-ui
  shared-utils
```

建议共享：

- 基础请求封装
- 类型定义
- 通用组件
- 工具方法

但管理平台与渠道管理平台的登录态、用户态、权限态应分别维护。

---

## 7. 实施优先级

建议按以下顺序推进：

1. 先统一架构认知，固定为“一个管理平台 + 一个渠道管理平台”
2. 先补管理平台角色菜单控制与渠道账号审核开通
3. 再补平台商品配置层能力
4. 最后补投诉管理模块

---

## 8. 一句话结论

根据当前 `api.json`，正确架构不是“多个内部登录平台”，而是：

- 内部员工统一登录管理平台
- 外部渠道统一登录渠道管理平台
- 内部不同岗位通过角色和权限控制菜单与功能

后续所有需求文档、前端实现和后端接口补充，都必须严格按这个架构收敛。
