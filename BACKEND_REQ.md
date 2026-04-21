# BACKEND_REQ.md

## 后端正式需求版

基于文件：

- `C:\Users\nianx\OneDrive\Desktop\api.json`

本文档用于发给后端工程师，聚焦以下正式需求：

1. 内部员工账号、角色、权限、子系统访问边界
2. 外部渠道门户账号的审核开通与登录边界
3. 平台商品、价格、折扣、供应商关联配置能力
4. 投诉管理 / 售后工单模块能力

---

## 1. 基本原则

## 1.1 角色与权限必须分开

角色不是权限，权限也不是角色。

- 角色：表示员工岗位身份
- 权限：表示可访问的页面、菜单、按钮、数据范围、审核能力等

当前内部角色建议固定为：

- `SUPER_ADMIN`
- `SUPPORT`
- `RISK`
- `OPS`
- `FINANCE`

当前阶段建议一个后台用户只绑定一个主角色，避免多角色导致菜单、路由、数据范围冲突。

## 1.2 必须拆分两套账号体系

### A. 内部员工账号

适用范围：

- 管理总后台
- 技术支持平台
- 风控管理平台
- 运营管理平台
- 财务管理平台

特点：

- 属于公司内部员工
- 由管理系统创建和维护
- 使用统一认证中心
- 登录后按角色决定可访问的子系统

### B. 外部渠道门户账号

适用范围：

- 渠道门户

特点：

- 属于公司外部代理销售渠道
- 每个渠道有独立账号密码
- 必须先在管理平台审核开通
- 登录后只能访问本渠道数据

明确要求：

- 内部员工账号不得登录渠道门户
- 渠道门户账号不得登录内部管理子系统

---

## 2. 子系统边界与建议访问地址

建议按以下子系统划分：

| 子系统 | 建议地址 | 用户类型 | 可登录角色 |
| --- | --- | --- | --- |
| 管理总后台 | `https://admin.example.com` | 内部员工 | `SUPER_ADMIN` |
| 技术支持平台 | `https://support.example.com` | 内部员工 | `SUPPORT` |
| 风控管理平台 | `https://risk.example.com` | 内部员工 | `RISK` |
| 运营管理平台 | `https://ops.example.com` | 内部员工 | `OPS` |
| 财务管理平台 | `https://finance.example.com` | 内部员工 | `FINANCE` |
| 渠道门户 | `https://portal.example.com` | 外部渠道 | 渠道门户账号 |

要求：

- 每个子系统登录后必须校验当前角色是否匹配本子系统
- 角色不匹配时，后端必须返回明确拒绝结果
- 渠道门户所有接口必须由后端自动解析当前 `channelId`

---

## 3. 建议预置测试账号

## 3.1 内部员工测试账号

| 子系统 | 角色 | 建议账号 | 建议密码 |
| --- | --- | --- | --- |
| 管理总后台 | `SUPER_ADMIN` | `super.admin` | `Admin123!` |
| 技术支持平台 | `SUPPORT` | `support.user` | `Support123!` |
| 风控管理平台 | `RISK` | `risk.user` | `Risk123!` |
| 运营管理平台 | `OPS` | `ops.user` | `Ops123!` |
| 财务管理平台 | `FINANCE` | `finance.user` | `Finance123!` |

兼容当前已有种子账号：

- `admin / Admin123!`

建议后续将其明确为超级管理员专用账号。

## 3.2 外部渠道测试账号

当前可参考的渠道门户测试账号：

- 登录接口：`POST /portal/auth/login`
- 渠道编码：`demo-channel`
- 账号：`demo.portal`
- 密码：`Portal123!`

后续要求：

- 每个渠道都必须有独立门户账号
- 初始密码只允许在开通或重置时返回一次
- 列表页不得回显明文密码

---

## 4. 后端模型与接口需求：内部员工账号体系

## 4.1 后台用户模型

后台新增用户时，建议至少支持以下字段：

- `username`
- `password`
- `roleCode`
- `displayName`
- `mobile1`
- `mobile2`
- `email`
- `wechat`
- `qq`
- `remark`
- `status`
- `defaultSubsystem`

其中：

- `username`、`password`、`roleCode` 为必填
- 其他字段为选填

## 4.2 角色模型

建议角色模型至少包含：

- `roleCode`
- `roleName`
- `subsystemCode`
- `homePath`
- `permissionCodes`
- `status`

建议绑定关系：

| 角色 | 子系统 |
| --- | --- |
| `SUPER_ADMIN` | `ADMIN` |
| `SUPPORT` | `SUPPORT` |
| `RISK` | `RISK` |
| `OPS` | `OPS` |
| `FINANCE` | `FINANCE` |

## 4.3 权限模型

建议权限模型至少支持：

- 页面访问权限
- 菜单显示权限
- 按钮权限
- 数据范围权限
- 导出权限
- 审核权限
- 密码重置权限

## 4.4 统一认证与子系统校验接口

建议保留或增强：

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `GET /admin/auth/me`
- `POST /admin/auth/logout`

建议新增：

- `GET /admin/subsystems`
- `GET /admin/roles/{roleId}/permissions`
- `GET /admin/users/{userId}/subsystems`
- `POST /admin/auth/validate-subsystem-access`

`validate-subsystem-access` 请求建议包括：

- `subsystemCode`
- `accessToken`

返回建议包括：

- `userId`
- `username`
- `roleCode`
- `permissionCodes`
- `allowed`
- `homePath`
- `dataScope`

要求：

- 子系统登录后必须通过该接口做二次校验
- 角色不匹配时必须拒绝进入
- 所有登录、拒绝访问、权限变更必须写审计日志

---

## 5. 后端模型与接口需求：外部渠道账号体系

## 5.1 渠道门户账号模型

建议渠道表或渠道门户账号表补充：

- `portalAccount`
- `portalPasswordHash`
- `portalStatus`
- `portalOpenedAt`
- `portalOpenedBy`
- `portalApprovedAt`
- `portalApprovedBy`
- `lastLoginAt`
- `passwordResetAt`
- `passwordResetBy`

`portalStatus` 建议值：

- `PENDING`
- `APPROVED`
- `REJECTED`
- `DISABLED`

## 5.2 开户、审核、开通、停用流程

要求支持：

- 创建渠道
- 编辑渠道基础信息
- 提交门户开通申请
- 审核通过
- 审核驳回
- 初始化门户账号
- 重置门户密码
- 禁用门户账号
- 启用门户账号

建议新增接口：

- `GET /admin/channels/{channelId}/portal-account`
- `POST /admin/channels/{channelId}/portal-account/open`
- `POST /admin/channels/{channelId}/portal-account/approve`
- `POST /admin/channels/{channelId}/portal-account/reject`
- `POST /admin/channels/{channelId}/portal-account/reset-password`
- `POST /admin/channels/{channelId}/portal-account/disable`
- `POST /admin/channels/{channelId}/portal-account/enable`

## 5.3 渠道门户认证要求

建议保留或增强：

- `POST /portal/auth/login`
- `GET /portal/me`

要求：

- 登录成功后后端自动绑定当前 `channelId`
- 门户接口严禁以“前端传入 channelId”作为权限边界
- 所有数据查询必须只返回当前登录渠道自己的数据

## 5.4 渠道审核日志

建议日志字段：

- `auditId`
- `channelId`
- `action`
- `fromStatus`
- `toStatus`
- `operatorUserId`
- `operatorUsername`
- `remark`
- `createdAt`

---

## 6. 对 `api.json` 的审查结论：平台商品、价格、折扣、供应商关联

## 6.1 当前已具备的能力

当前 `api.json` 已有：

- 平台商品主数据
  - `GET /admin/products`
  - `POST /admin/products`
  - `GET /admin/products/{productId}`
  - `PUT /admin/products/{productId}`
- 供应商商品快照
  - `GET /admin/suppliers/{supplierId}/products`
- 供应商商品同步 / 对账
  - `POST /admin/suppliers/{supplierId}/catalog/sync`
  - `POST /internal/suppliers/catalog/full-sync`
  - `POST /internal/suppliers/catalog/delta-sync`
  - `GET /admin/suppliers/reconcile-diffs`
- 渠道商品授权 / 渠道销售价
  - `POST /admin/channel-products`
  - `POST /admin/channel-prices`
  - `GET /admin/channels/{channelId}/order-policy`
  - `GET /admin/channels/{channelId}/products`
- 开放平台商品展示
  - `GET /open-api/products/`
- 内部匹配能力
  - `GET /internal/products/recharge/match`
- 订单中的供应商路由结果
  - `GET /admin/orders/{orderNo}`
  - 已返回 `businessSnapshot.supplierRoute`

## 6.2 当前明确缺失的能力

当前缺少关键配置层，主要包括：

- 平台商品与供应商商品的映射关系管理
- 默认供应商、候补供应商、优先级配置
- 平台采购价 / 平台标准售价 / 毛利配置
- 折扣中心
- 路由策略中心
- 路由预览与路由解释

## 6.3 建议新增接口

### 6.3.1 平台商品与供应商映射

- `GET /admin/products/{productId}/supplier-mappings`
- `POST /admin/product-supplier-mappings`
- `PUT /admin/product-supplier-mappings/{mappingId}`
- `DELETE /admin/product-supplier-mappings/{mappingId}`
- `POST /admin/product-supplier-mappings/{mappingId}/enable`
- `POST /admin/product-supplier-mappings/{mappingId}/disable`

建议字段：

- `mappingId`
- `productId`
- `supplierId`
- `supplierCode`
- `snapshotId`
- `supplierProductCode`
- `procurementPriceFen`
- `currency`
- `priority`
- `weight`
- `enabled`
- `stockPolicy`
- `healthPolicy`
- `balancePolicy`
- `effectiveFrom`
- `effectiveTo`
- `remark`

### 6.3.2 平台价格中心

- `GET /admin/products/{productId}/platform-pricing`
- `POST /admin/product-platform-prices`
- `PUT /admin/product-platform-prices/{priceId}`
- `DELETE /admin/product-platform-prices/{priceId}`

建议字段：

- `priceId`
- `productId`
- `listPriceFen`
- `standardSalePriceFen`
- `referenceCostFen`
- `grossMarginFen`
- `grossMarginRate`
- `currency`
- `effectiveFrom`
- `effectiveTo`
- `status`

### 6.3.3 折扣中心

- `GET /admin/product-discount-rules`
- `POST /admin/product-discount-rules`
- `PUT /admin/product-discount-rules/{ruleId}`
- `DELETE /admin/product-discount-rules/{ruleId}`

建议字段：

- `ruleId`
- `scopeType`
- `productId`
- `channelId`
- `discountType`
- `discountValue`
- `minAmountFen`
- `maxAmountFen`
- `effectiveFrom`
- `effectiveTo`
- `status`

### 6.3.4 路由策略与预览

- `GET /admin/products/{productId}/route-policy`
- `PUT /admin/products/{productId}/route-policy`
- `POST /admin/products/{productId}/route-preview`

建议支持：

- 按运营商筛选
- 按省份筛选
- 按面值筛选
- 按产品类型筛选
- 按供应商优先级排序
- 按库存状态筛选
- 按供应商余额筛选
- 按供应商健康状态筛选
- `LOWEST_COST`
- `BEST_SUCCESS_RATE`
- `FASTEST_ARRIVAL`

---

## 7. 对 `api.json` 的审查结论：投诉管理 / 售后工单

## 7.1 当前仅有的相邻能力

当前 `api.json` 中，仅有：

- `GET /admin/orders`
- `GET /admin/orders/{orderNo}`
- `POST /admin/orders/{orderNo}/mark-exception`
- `POST /admin/orders/{orderNo}/remarks`

这只能支持：

- 给订单打异常标签
- 给订单写备注
- 查看部分退款状态

尚不能支撑完整投诉管理模块。

## 7.2 当前明确缺失的能力

- 投诉受理
- 工单创建
- 工单分配
- 工单转派
- 工单状态流转
- 处理进度记录
- 处理结果记录
- 用户反馈记录
- 关闭 / 重开工单
- 投诉统计
- 投诉导出
- SLA 管理
- 附件 / 凭证引用

## 7.3 建议新增接口

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
- `GET /admin/complaint-dictionaries`

如果渠道侧也要提交或查询投诉，建议补充：

- `POST /portal/complaints`
- `GET /portal/complaints`
- `GET /portal/complaints/{complaintId}`

## 7.4 建议投诉单字段

- `complaintId`
- `complaintNo`
- `sourceType`
- `complaintType`
- `priority`
- `status`
- `orderNo`
- `channelOrderNo`
- `supplierOrderNo`
- `refundNo`
- `channelId`
- `supplierId`
- `mobile`
- `amountFen`
- `description`
- `attachments`
- `currentAssigneeUserId`
- `expectedResolutionType`
- `slaDeadlineAt`
- `firstResponseAt`
- `resolvedAt`
- `closedAt`

建议状态至少包括：

- `PENDING`
- `ASSIGNED`
- `PROCESSING`
- `WAITING_SUPPLIER`
- `WAITING_USER`
- `REFUND_PROCESSING`
- `RESOLVED`
- `CLOSED`
- `REJECTED`
- `REOPENED`

---

## 8. 交付优先级

建议按以下顺序推进：

1. 先完成“内部员工账号 / 外部渠道账号分域 + 子系统访问校验 + 渠道门户审核开通”
2. 再完成“平台商品 <-> 供应商商品映射 + 路由策略 + 路由预览”
3. 再完成“平台价格中心 + 折扣中心”
4. 最后完成“投诉管理 / 售后工单系统”

---

## 9. 验收标准

后端交付后，至少应满足：

- 内部员工账号与渠道门户账号完全分域
- 子系统能校验角色是否匹配当前平台
- 渠道门户只能访问本渠道数据
- 平台商品能配置供应商映射、价格、折扣、路由策略
- 投诉工单能创建、分配、流转、关闭、导出

---

## 10. 一句话结论

当前最需要后端优先补齐的，是三条清晰边界：

- 内部员工账号体系与外部渠道账号体系的身份边界
- 子系统访问资格与统一认证边界
- 平台商品配置层与投诉工单领域的接口边界
