# 中国大陆手机号携号转网自动校验方案

## 1. 结论

仅靠手机号前三位或前四位，只能识别：

- 原始分配运营商
- 宿主网信息（适用于部分虚拟运营商号段）

但 **不能可靠识别当前签约运营商**。  
原因是携号转网后：

- `139xxxxxxx` 不一定还是中国移动
- `133xxxxxxx` 不一定还是中国电信
- `186xxxxxxx` 不一定还是中国联通

所以系统必须拆成两层：

1. `carrier_prefix_rules`
   用于本地前缀兜底识别
2. `mobile_mnp_cache + 外部 MNP 查询源`
   用于识别当前签约运营商

## 2. 已落库对象

本次已经在 [carrier_prefix_rules.sql](C:/Users/nianx/chongzhi-admin/backend-mobile-segments/carrier_prefix_rules.sql) 中补齐：

- `product.carrier_prefix_rules`
- `product.mobile_mnp_cache`
- `product.resolve_mobile_carrier(p_mobile text)` 解析函数

## 3. 推荐后端流程

### 3.1 充值预览 / 下单前

输入手机号后：

1. 先查 `product.mobile_segments`
   作用：拿到 `province / city / isp_code / isp_name`
2. 再调 `product.resolve_mobile_carrier(mobile)`
   作用：拿到
   - 原始号段运营商
   - 当前可用运营商结果
   - 是否需要触发携转查询
3. 如果 `needs_mnp_lookup = false`
   直接继续后续商品匹配
4. 如果 `needs_mnp_lookup = true`
   调用后端 `MnpResolver`
5. 将返回结果写入 `product.mobile_mnp_cache`
6. 再次调用 `resolve_mobile_carrier`
7. 使用 `current_carrier_code` 做最终商品匹配 / 供应商路由

### 3.2 建议缓存策略

- `NOT_PORTED`
  缓存 `7 ~ 30` 天
- `PORTED`
  缓存 `1 ~ 7` 天
- `ERROR`
  缓存 `5 ~ 30` 分钟，避免接口雪崩
- `UNSUPPORTED`
  缓存 `1` 天

## 4. 建议的后端接口抽象

```ts
type MnpResolveResult = {
  mobileNo: string;
  originalCarrierCode?: 'CMCC' | 'CUCC' | 'CTCC' | 'CBN' | 'MVNO' | 'CTCC_SAT';
  currentCarrierCode?: 'CMCC' | 'CUCC' | 'CTCC' | 'CBN';
  currentCarrierName?: string;
  mnpStatus: 'NOT_PORTED' | 'PORTED' | 'UNSUPPORTED' | 'ERROR';
  source: string;
  sourceRequestId?: string;
  checkedAt: string;
  expiresAt: string;
  errorMessage?: string;
};

interface MnpResolver {
  resolveCurrentCarrier(mobileNo: string): Promise<MnpResolveResult>;
}
```

## 5. 写缓存 SQL

```sql
INSERT INTO product.mobile_mnp_cache (
  mobile_no,
  mobile_prefix7,
  original_carrier_code,
  original_carrier_name,
  current_carrier_code,
  current_carrier_name,
  mnp_status,
  mnp_source,
  source_request_id,
  checked_at,
  expires_at,
  error_message
)
VALUES (
  '13905182307',
  '1390518',
  'CMCC',
  '中国移动',
  'CUCC',
  '中国联通',
  'PORTED',
  'mnp-provider-a',
  'req-20260427-0001',
  NOW(),
  NOW() + INTERVAL '3 days',
  NULL
)
ON CONFLICT (mobile_no) DO UPDATE
SET
  original_carrier_code = EXCLUDED.original_carrier_code,
  original_carrier_name = EXCLUDED.original_carrier_name,
  current_carrier_code = EXCLUDED.current_carrier_code,
  current_carrier_name = EXCLUDED.current_carrier_name,
  mnp_status = EXCLUDED.mnp_status,
  mnp_source = EXCLUDED.mnp_source,
  source_request_id = EXCLUDED.source_request_id,
  checked_at = EXCLUDED.checked_at,
  expires_at = EXCLUDED.expires_at,
  error_message = EXCLUDED.error_message,
  updated_at = NOW();
```

## 6. 预览场景的推荐返回

如果当前签约运营商成功识别，建议后端向前端显式返回：

```json
{
  "mobile": "13905182307",
  "mobilePrefix7": "1390518",
  "provinceName": "江苏",
  "cityName": "南京",
  "originalCarrierCode": "CMCC",
  "originalCarrierName": "中国移动",
  "currentCarrierCode": "CUCC",
  "currentCarrierName": "中国联通",
  "mnpStatus": "PORTED",
  "carrierResolvedBy": "MNP_CACHE"
}
```

这样前端能清楚区分：

- 原始号段归属运营商
- 当前签约运营商
- 是否发生携转

## 7. 风险提示

- 本地规则库只能保证“号段分配规则”正确，不保证“当前签约运营商”正确。
- 如果不接 MNP 查询源，系统最多只能做到“前缀识别 + 风险提示”，不能做到真正自动校验携转后的当前运营商。
- 对充值业务来说，真正用于路由决策的应当是 `current_carrier_code`，不是单纯的前缀规则。
