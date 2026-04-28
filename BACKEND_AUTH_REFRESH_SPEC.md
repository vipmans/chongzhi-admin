# 后端接口改造说明文档

## 1. 文档目的

本文档用于指导后端工程师完成“后台管理平台 JWT 无感续签”能力改造，目标是在**用户持续正常使用系统时自动刷新登录态**，尽量避免出现 `JWT expired`、强制重新登录、弹窗打断操作等问题。

本文档适用于：

- 后台管理系统 `admin`
- 外部渠道平台 `portal`（如需同样支持无感续签）

---

## 2. 目标与原则

### 2.1 目标

实现以下体验：

- 用户登录后，前端持有 `accessToken + refreshToken`
- 前端在切页、页面激活、用户操作、定时巡检时自动调用刷新接口
- 只要用户持续活跃，系统自动续签，尽量不掉线
- 用户无须手动重新登录
- 用户无须看到 “JWT 过期” 提示弹窗

### 2.2 设计原则

- `accessToken` 短期有效，降低泄露风险
- `refreshToken` 长期有效，用于续签
- `refreshToken` 支持**滑动续期**
- 后端必须可控地管理和吊销会话
- 前后端明确区分：
  - `accessToken` 过期，可刷新
  - `refreshToken` 失效，不可刷新，必须重新登录

### 2.3 非目标

本文档不建议实现真正意义上的“永久不过期 JWT”。

推荐实现的是：

- **持续活跃时长期在线**
- **长时间不活跃后自动失效**
- **账号被禁用、密码修改、会话吊销时立即失效**

---

## 3. 推荐时效策略

推荐参数如下：

- `accessToken`：4 小时
- `refreshToken`：30 天
- `refreshToken`：每次刷新成功后重新签发并重置有效期
- `absoluteSessionMaxAge`：90 天

说明：

- 4 小时用于降低 `accessToken` 泄露风险
- 30 天用于支撑“无感续签”
- 90 天绝对会话上限用于防止真正无限期在线

---

## 4. 现状与改造范围

当前前端已使用或预期使用以下接口：

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `GET /admin/auth/me`
- `POST /admin/auth/logout`

如外部渠道平台也要支持无感续签，建议补齐：

- `POST /portal/auth/login`
- `POST /portal/auth/refresh`
- `GET /portal/me`
- `POST /portal/auth/logout`

---

## 5. 后端改造要求

## 5.1 登录接口返回完整会话信息

### 接口

`POST /admin/auth/login`

### 请求示例

```http
POST /admin/auth/login
Content-Type: application/json

{
  "username": "ops.admin",
  "password": "Admin123!"
}
```

### 响应示例

```json
{
  "code": "0000",
  "msg": "success",
  "data": {
    "accessToken": "<JWT_ACCESS_TOKEN>",
    "refreshToken": "<JWT_REFRESH_TOKEN_OR_OPAQUE_TOKEN>",
    "expiresInSeconds": 14400,
    "refreshExpiresInSeconds": 2592000,
    "accessTokenExpiresAt": "2026-04-28T16:00:00+08:00",
    "refreshTokenExpiresAt": "2026-05-28T12:00:00+08:00",
    "sessionId": "sess_01JV....",
    "user": {
      "id": "u_10001",
      "username": "ops.admin",
      "displayName": "运营管理员",
      "status": "ACTIVE",
      "primaryRoleCode": "OPS",
      "roleCodes": ["OPS"],
      "permissionCodes": ["orders.read", "channels.write"],
      "menuCodes": ["orders_list", "channels_list"],
      "dataScope": "ALL"
    }
  }
}
```

### 必要要求

- 必须返回 `accessToken`
- 必须返回 `refreshToken`
- 必须返回 `expiresInSeconds`
- 建议返回 `refreshExpiresInSeconds`
- 建议返回 `sessionId`
- 建议显式返回 `accessTokenExpiresAt` 和 `refreshTokenExpiresAt`

---

## 5.2 刷新接口支持滑动续期

### 接口

`POST /admin/auth/refresh`

### 请求示例

```http
POST /admin/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<OLD_REFRESH_TOKEN>"
}
```

### 刷新成功响应示例

```json
{
  "code": "0000",
  "msg": "success",
  "data": {
    "accessToken": "<NEW_ACCESS_TOKEN>",
    "refreshToken": "<NEW_REFRESH_TOKEN>",
    "expiresInSeconds": 14400,
    "refreshExpiresInSeconds": 2592000,
    "accessTokenExpiresAt": "2026-04-28T16:15:00+08:00",
    "refreshTokenExpiresAt": "2026-05-28T12:15:00+08:00",
    "sessionId": "sess_01JV...."
  }
}
```

### 刷新接口行为要求

刷新成功时后端必须：

1. 校验 `refreshToken` 是否存在且有效
2. 校验所属账号是否可用
3. 校验所属会话是否未吊销
4. 校验未超过绝对最长会话时长
5. 重新签发新的 `accessToken`
6. 推荐同时轮换签发新的 `refreshToken`
7. 更新会话表中的：
   - `lastActiveAt`
   - `expiresAt`
   - `refreshTokenHash`
   - `rotatedAt`

### 强烈建议

- 刷新时**轮换 refresh token**
- 老 refresh token 可保留 `30~60 秒` 宽限期，避免多标签页并发刷新误踢用户

---

## 5.3 登出接口支持销毁会话

### 接口

`POST /admin/auth/logout`

### 请求示例

```http
POST /admin/auth/logout
Content-Type: application/json

{
  "refreshToken": "<CURRENT_REFRESH_TOKEN>"
}
```

### 响应示例

```json
{
  "code": "0000",
  "msg": "success",
  "data": null
}
```

### 行为要求

- 将当前会话标记为 `REVOKED`
- 后续使用该 refresh token 刷新必须失败
- 可选：记录登出原因、IP、UA、操作人

---

## 5.4 `/me` 接口建议返回当前会话状态

### 接口

`GET /admin/auth/me`

### 响应示例

```json
{
  "code": "0000",
  "msg": "success",
  "data": {
    "id": "u_10001",
    "username": "ops.admin",
    "displayName": "运营管理员",
    "status": "ACTIVE",
    "primaryRoleCode": "OPS",
    "roleCodes": ["OPS"],
    "permissionCodes": ["orders.read", "channels.write"],
    "menuCodes": ["orders_list", "channels_list"],
    "dataScope": "ALL",
    "session": {
      "sessionId": "sess_01JV....",
      "accessTokenExpiresAt": "2026-04-28T16:15:00+08:00",
      "refreshTokenExpiresAt": "2026-05-28T12:15:00+08:00",
      "lastActiveAt": "2026-04-28T12:15:00+08:00"
    }
  }
}
```

---

## 6. 外部渠道平台接口建议

如渠道平台也要无感续签，建议新增：

### 接口

`POST /portal/auth/refresh`

### 请求示例

```http
POST /portal/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<OLD_PORTAL_REFRESH_TOKEN>"
}
```

### 响应示例

```json
{
  "code": "0000",
  "msg": "success",
  "data": {
    "accessToken": "<NEW_PORTAL_ACCESS_TOKEN>",
    "refreshToken": "<NEW_PORTAL_REFRESH_TOKEN>",
    "expiresInSeconds": 14400,
    "refreshExpiresInSeconds": 2592000,
    "sessionId": "sess_portal_01JV...."
  }
}
```

---

## 7. 错误码约定

后端必须严格区分“可刷新”和“必须重登”两类错误。

## 7.1 建议错误码

| 错误码 | 含义 | 前端处理 |
| --- | --- | --- |
| `0000` | 成功 | 正常处理 |
| `A1001` | accessToken 已过期 | 尝试调用 refresh |
| `A1002` | accessToken 无效/签名错误 | 退出登录 |
| `A1003` | refreshToken 已过期 | 退出登录并跳转登录页 |
| `A1004` | refreshToken 无效 | 退出登录并跳转登录页 |
| `A1005` | 会话已吊销 | 退出登录并跳转登录页 |
| `A1006` | 会话超过绝对最长时长 | 退出登录并跳转登录页 |
| `A1007` | 用户已被禁用 | 退出登录并提示账号不可用 |
| `A1008` | 用户密码已变更，需重新登录 | 退出登录并跳转登录页 |
| `A1009` | 会话不存在 | 退出登录并跳转登录页 |
| `A1010` | 并发刷新冲突，请重试 | 可重试一次，失败后退出登录 |

## 7.2 推荐错误响应格式

```json
{
  "code": "A1003",
  "msg": "refresh token expired",
  "data": null,
  "traceId": "tr_01JV...."
}
```

### 要求

- `msg` 必须稳定、可读
- `code` 必须稳定、可枚举
- 不要把所有问题都返回成 `jwt expired`
- `refresh` 接口失败时不要再返回“可刷新”类错误码，避免前端死循环

---

## 8. 表结构建议

建议新增登录会话表，而不是只依赖纯 JWT 无状态校验。

## 8.1 会话表 `auth_sessions`

### 建表建议

```sql
CREATE TABLE auth_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_id VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(64) NOT NULL,
  platform_type VARCHAR(32) NOT NULL COMMENT 'ADMIN/PORTAL',
  client_type VARCHAR(32) DEFAULT NULL COMMENT 'WEB/H5/API',
  refresh_token_hash VARCHAR(255) NOT NULL,
  refresh_token_prev_hash VARCHAR(255) DEFAULT NULL,
  access_token_jti VARCHAR(128) DEFAULT NULL,
  issued_at DATETIME NOT NULL,
  last_active_at DATETIME NOT NULL,
  refresh_expires_at DATETIME NOT NULL,
  absolute_expires_at DATETIME NOT NULL,
  revoked_at DATETIME DEFAULT NULL,
  revoke_reason VARCHAR(128) DEFAULT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  login_ip VARCHAR(64) DEFAULT NULL,
  last_ip VARCHAR(64) DEFAULT NULL,
  user_agent VARCHAR(512) DEFAULT NULL,
  device_fingerprint VARCHAR(128) DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_platform_type (platform_type),
  INDEX idx_refresh_expires_at (refresh_expires_at),
  INDEX idx_absolute_expires_at (absolute_expires_at),
  INDEX idx_status (status)
);
```

## 8.2 字段说明

| 字段 | 说明 |
| --- | --- |
| `session_id` | 会话唯一标识，建议返回给前端 |
| `user_id` | 所属用户 |
| `platform_type` | `ADMIN` 或 `PORTAL` |
| `refresh_token_hash` | 当前 refresh token 的哈希值，不建议明文存储 |
| `refresh_token_prev_hash` | 上一个 refresh token 哈希，用于并发刷新宽限 |
| `access_token_jti` | 当前 access token 的唯一 ID |
| `issued_at` | 首次签发时间 |
| `last_active_at` | 最后活跃时间 |
| `refresh_expires_at` | refresh token 滑动过期时间 |
| `absolute_expires_at` | 绝对最长会话截止时间 |
| `revoked_at` | 吊销时间 |
| `revoke_reason` | 吊销原因 |
| `status` | `ACTIVE/REVOKED/EXPIRED/LOCKED` |
| `login_ip` | 登录 IP |
| `last_ip` | 最后一次刷新或访问 IP |
| `user_agent` | 浏览器或设备标识 |
| `version` | 乐观锁版本号，可用于并发刷新控制 |

---

## 9. 刷新流程建议

## 9.1 登录流程

1. 校验账号密码
2. 生成 `sessionId`
3. 生成 `accessToken`
4. 生成 `refreshToken`
5. 将 refresh token 哈希写入 `auth_sessions`
6. 返回 token 与过期时间

## 9.2 刷新流程

1. 接收 `refreshToken`
2. 解析或定位会话
3. 校验会话存在且为 `ACTIVE`
4. 校验用户状态为 `ACTIVE`
5. 校验未超过 `refresh_expires_at`
6. 校验未超过 `absolute_expires_at`
7. 生成新的 `accessToken`
8. 生成新的 `refreshToken`
9. 将旧 token 哈希移入 `refresh_token_prev_hash`
10. 更新 `refresh_token_hash`
11. 更新 `last_active_at`
12. 更新 `refresh_expires_at`
13. 返回新 token

## 9.3 登出流程

1. 根据 `refreshToken` 定位会话
2. 将 `status` 改为 `REVOKED`
3. 写入 `revoked_at`
4. 写入 `revoke_reason=LOGOUT`

---

## 10. 并发刷新处理建议

浏览器多标签页、重复点击、定时器并发都可能导致多个 refresh 请求同时发起。

建议后端采用以下任一方案：

### 方案 A：旧 refresh token 短暂宽限

- refresh 成功后：
  - 当前 token 写入 `refresh_token_hash`
  - 旧 token 写入 `refresh_token_prev_hash`
- 宽限 30~60 秒内允许旧 token 再刷新一次

### 方案 B：基于会话版本号控制

- 会话表加 `version`
- refresh 时更新 `version = version + 1`
- 冲突时返回 `A1010`

### 方案 C：刷新幂等窗口

- 同一 `sessionId` 在极短时间窗口内重复刷新
- 直接返回最近一次生成的新 token

推荐优先采用方案 A，兼容性最好。

---

## 11. 安全建议

1. `refreshToken` 不建议明文入库，建议保存哈希
2. 建议 refresh token 比 access token 更长、更难猜测
3. 建议 access token 中包含 `jti/sessionId/userId/roleVersion`
4. 密码修改后应吊销所有会话
5. 用户禁用后应吊销所有会话
6. 可选支持单端登录或多端登录策略
7. 建议记录 refresh 操作日志，便于审计

---

## 12. 前后端配合要求

前端已经具备如下行为或将按此行为工作：

- 页面访问时提前刷新
- 页面切换时检查是否接近过期
- 页面重新激活时检查是否接近过期
- 用户活跃操作期间触发续签
- 接口返回 access token 过期时自动尝试 refresh

后端必须保证：

1. `/auth/refresh` 可稳定调用
2. refresh 失败错误码明确
3. refresh 成功返回新的 token 与过期时间
4. 不把所有问题都归类为 `jwt expired`

---

## 13. 验收标准

满足以下条件即可视为改造完成：

1. 用户登录后，持续操作系统 8 小时以上，无需手动重登
2. 用户切换页面、窗口最小化后重新激活，登录态自动续签
3. 多标签页同时在线时，不因并发刷新导致频繁掉线
4. refresh token 失效时，前端可明确识别并跳回登录页
5. 密码修改或账号禁用后，旧会话能够被及时踢出
6. 后端日志可追踪每次登录、刷新、登出和会话吊销行为

---

## 14. 推荐落地顺序

1. 先完善 `admin` 登录、刷新、登出链路
2. 增加 `auth_sessions` 表
3. 接入滑动续期
4. 增加并发刷新宽限
5. 联调前端自动续签
6. 最后再复制到 `portal` 侧

---

## 15. 结论

本次改造的正确方向不是“把 JWT 改成永久有效”，而是：

- 短期 `accessToken`
- 长期 `refreshToken`
- 滑动续期
- 服务端可控会话

这样既能实现“用户持续使用时基本不掉线”，又能保留账号风控、会话吊销、密码变更失效、安全审计等后台管理系统必须具备的安全能力。

