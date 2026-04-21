# FRONTEND_SUBSYSTEM_IMPL.md

## 前端 / 子系统开发实施版

基于文件：

- `C:\Users\nianx\OneDrive\Desktop\api.json`
- [BACKEND_REQ.md](/C:/Users/nianx/chongzhi-admin/BACKEND_REQ.md)

本文档用于发给前端工程师、子系统开发工程师，重点说明：

1. 系统边界如何理解
2. 子系统如何拆分
3. 登录鉴权如何落地
4. 菜单、路由、数据边界如何实现
5. 多子系统代码如何同步
6. AI 开发提示词如何编写

---

## 1. 开发前必须统一的业务认知

## 1.1 角色和权限不要混用

- 角色：员工岗位身份
- 权限：具体功能点

前端实现时：

- 用户态里必须同时保留 `roleCode` 和 `permissionCodes`
- 菜单拦截不要只看权限码，也要看当前子系统与角色是否匹配

## 1.2 两套账号体系必须分开实现

### 内部员工账号

适用于：

- 管理总后台
- 技术支持平台
- 风控管理平台
- 运营管理平台
- 财务管理平台

### 外部渠道账号

适用于：

- 渠道门户

实现要求：

- 内部员工登录态与渠道门户登录态不要共用 store
- 内部接口 client 与门户接口 client 最好分开
- 角色判断逻辑与渠道数据边界逻辑不要复用为一套 if/else

---

## 2. 建议子系统拆分

建议按以下应用拆分：

| 应用 | 建议地址 | 用户类型 |
| --- | --- | --- |
| `admin-web` | `https://admin.example.com` | 内部员工 |
| `support-web` | `https://support.example.com` | 内部员工 |
| `risk-web` | `https://risk.example.com` | 内部员工 |
| `ops-web` | `https://ops.example.com` | 内部员工 |
| `finance-web` | `https://finance.example.com` | 内部员工 |
| `portal-web` | `https://portal.example.com` | 外部渠道 |

如果测试环境只有一个域名，也建议至少做逻辑分包：

- `/admin`
- `/support`
- `/risk`
- `/ops`
- `/finance`
- `/portal`

---

## 3. 登录鉴权实施方案

## 3.1 内部员工子系统

推荐流程：

1. 用户在子系统登录页输入账号密码
2. 前端调用统一认证接口
3. 拿到 `accessToken`、用户信息、角色、权限、可访问子系统
4. 调用 `validate-subsystem-access`
5. 如果当前角色不属于本子系统，跳转无权限页
6. 初始化菜单、首页、按钮权限、数据范围

建议用户态最少保留：

- `userId`
- `username`
- `displayName`
- `roleCode`
- `permissionCodes`
- `subsystemCodes`
- `homePath`
- `accessToken`
- `refreshToken`

## 3.2 渠道门户

推荐流程：

1. 渠道用户通过 `POST /portal/auth/login` 登录
2. 登录成功后只保存门户侧用户态
3. 所有门户接口均不传显式 `channelId` 作为边界
4. 页面展示的数据默认就是当前渠道数据

要求：

- 门户前端不要做“切换渠道”的能力
- 门户用户只能看到自己渠道的充值、消费、订单、余额、投诉等

---

## 4. 路由守卫与菜单控制

## 4.1 路由守卫建议

每个子系统都需要两层拦截：

### 第一层：是否已登录

- 无 token 跳转登录页

### 第二层：是否有当前子系统访问资格

- 校验 `roleCode`
- 校验 `subsystemCode`
- 校验 `permissionCodes`

若不满足：

- 跳转 `403` 页面
- 明确提示“当前账号无权访问该子系统”

## 4.2 菜单控制建议

菜单显示至少依据以下三项：

- 当前应用所属子系统
- 当前角色
- 当前权限集合

不要只靠前端静态路由过滤；登录后应使用后端返回的权限模型做初始化。

---

## 5. 推荐工程结构：实现代码同步而不是手工复制

推荐使用：

- `monorepo + shared packages + api codegen`

## 5.1 推荐目录

```text
apps/
  admin-web
  support-web
  risk-web
  ops-web
  finance-web
  portal-web

packages/
  shared-auth
  shared-permission
  shared-api-types
  shared-api-client
  shared-ui
  shared-utils
```

## 5.2 建议共享的内容

所有子系统共享：

- 登录鉴权 SDK
- token 存取与刷新逻辑
- 子系统访问校验逻辑
- 角色与权限枚举
- API 类型
- API Client
- 通用表格、表单、状态标签组件

## 5.3 建议隔离的内容

各子系统独立维护：

- 菜单结构
- 页面路由
- 领域页面
- 特定业务组件

---

## 6. 与 `api.json` 的同步方式

建议流程：

1. 后端维护最新版 `api.json`
2. 前端从 `api.json` 自动生成类型定义
3. 统一生成 `shared-api-client`
4. 各子系统统一依赖共享 API 包

这样可以保证：

- 接口类型只维护一份
- 各子系统不重复手写类型
- 后端一旦变更，前端能统一升级

---

## 7. 针对当前需求的前端落地边界

## 7.1 当前前端可以优先落地的内容

在后端接口补齐前，前端可先完成：

- 内部员工与外部渠道的登录页拆分
- 子系统路由与菜单框架拆分
- 用户态、权限态、token 态统一封装
- 路由守卫与无权限页
- 共享 auth 包与共享 permission 包
- API codegen 流程

## 7.2 依赖后端补齐后再落地的内容

以下功能需要等待后端补齐接口后再完整实现：

### A. 平台商品、价格、折扣、供应商关联

需要等待：

- `supplier-mappings`
- `platform-pricing`
- `product-discount-rules`
- `route-policy`
- `route-preview`

### B. 投诉管理模块

需要等待：

- `complaints`
- `complaint-stats`
- `complaints/export`
- `portal/complaints`

前端在后端未补齐前，不建议硬编码假模型做正式页面，以免反复返工。

---

## 8. 页面级实现建议

## 8.1 内部员工子系统

建议统一具备：

- 登录页
- 无权限页
- 个人信息页
- 密码修改页
- 菜单首页

不同子系统再分别扩展业务页面。

## 8.2 渠道门户

建议统一具备：

- 登录页
- 首页概览
- 充值记录
- 消费记录
- 订单查询
- 余额查询
- 投诉入口

所有页面必须默认作用于“当前登录渠道”。

---

## 9. 前端联调建议

## 9.1 建议测试账号

内部员工：

- `super.admin / Admin123!`
- `support.user / Support123!`
- `risk.user / Risk123!`
- `ops.user / Ops123!`
- `finance.user / Finance123!`

渠道门户：

- `demo.portal / Portal123!`

## 9.2 联调重点

优先验证：

- 不同角色是否只能进入自己的子系统
- 渠道账号是否只能进入门户
- 渠道门户是否只能看到本渠道数据
- 刷新页面后权限状态是否恢复
- 角色变更后重新登录是否生效

---

## 10. 给开发工程师的提示词模板

## 10.1 通用模板

```text
你是一名资深工程师，请基于以下要求实现功能。

项目背景：
- ...

目标：
- ...

输入资料：
- api.json 路径：...
- 当前应用：...
- 现有接口：...

业务规则：
- ...

技术要求：
- ...

输出要求：
- 修改文件
- 新增文件
- 新增接口调用
- 新增类型定义

验收标准：
- ...
```

## 10.2 提示词示例：内部员工子系统登录与权限控制

```text
你是一名前端工程师，请在现有项目中实现内部员工子系统登录与权限控制。

项目背景：
- 系统包含 admin、support、risk、ops、finance 五个内部子系统
- 角色和权限必须分开建模
- 一个用户当前只允许一个主角色

目标：
- 登录后根据角色与权限加载正确菜单
- 若用户角色不属于当前子系统，则禁止进入

输入资料：
- api.json
- 现有登录流程
- 现有路由守卫和状态管理

业务规则：
- SUPER_ADMIN 只可进入 admin
- SUPPORT 只可进入 support
- RISK 只可进入 risk
- OPS 只可进入 ops
- FINANCE 只可进入 finance

技术要求：
- 增加统一 auth store
- 增加 validate-subsystem-access 调用
- 增加 403 页面
- 按 permissionCodes 控制菜单和按钮

输出要求：
- 修改路由守卫
- 修改登录初始化逻辑
- 修改菜单渲染逻辑
- 补充必要类型定义

验收标准：
- 非本角色用户无法进入错误子系统
- 正确角色进入后可看到对应菜单
- 刷新后状态可恢复
```

## 10.3 提示词示例：渠道门户登录与数据边界

```text
你是一名前端工程师，请实现渠道门户登录与数据边界控制。

项目背景：
- 渠道门户只允许外部渠道账号登录
- 每个渠道只能查看自己的充值、消费、订单、余额、投诉数据

目标：
- 完成渠道门户登录页、用户态初始化、数据查询封装

输入资料：
- api.json
- 现有 portal/auth/login 与 portal/me 接口

业务规则：
- 前端不能用可切换的 channelId 作为权限边界
- 页面默认展示当前登录渠道的数据

技术要求：
- 独立 portal auth store
- 独立 portal api client
- 独立 portal 路由守卫

输出要求：
- 完成登录态管理
- 完成首页初始化
- 完成错误处理与未授权跳转

验收标准：
- 门户用户无法看到其他渠道数据
- 刷新页面后登录态可恢复
- 未审核开通账号无法正常进入
```

## 10.4 提示词示例：工程化代码同步

```text
你是一名前端架构师，请将多子系统项目整理为 monorepo，并实现共享认证、共享权限模型、共享 API 类型与共享 API Client。

目标：
- admin、support、risk、ops、finance、portal 六个应用共享基础能力

技术要求：
- 建立 shared-auth、shared-permission、shared-api-types、shared-api-client 包
- 从 api.json 自动生成类型
- 所有应用统一依赖共享包

输出要求：
- 给出目录结构
- 给出依赖关系
- 给出生成脚本
- 给出迁移步骤

验收标准：
- token 逻辑只维护一份
- 接口类型只维护一份
- 角色与权限枚举只维护一份
```

---

## 11. 开发实施优先级

建议前端按以下顺序推进：

1. 先拆分内部员工子系统与渠道门户的登录边界
2. 再完成路由守卫、菜单控制、403 页面
3. 再建设共享 auth / permission / api 包
4. 最后接入平台商品配置层与投诉模块页面

---

## 12. 一句话结论

前端当前最重要的，不是继续堆页面，而是先把三件事做稳：

- 身份域分开
- 子系统访问边界分清
- 共享能力沉淀成可复用工程结构
