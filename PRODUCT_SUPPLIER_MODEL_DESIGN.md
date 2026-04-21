# PRODUCT_SUPPLIER_MODEL_DESIGN.md

## 平台商品 / 供应商商品 / 价格 / 路由详细设计

基于以下输入整理：

- `C:\Users\nianx\OneDrive\Desktop\api.json`
- [REQUIREMENTS.md](/C:/Users/nianx/chongzhi-admin/REQUIREMENTS.md)
- [BACKEND_REQ.md](/C:/Users/nianx/chongzhi-admin/BACKEND_REQ.md)

本文档用于把“平台商品、供应商商品、映射关系、价格、折扣、路由”进一步细化成可直接落地的后端建表方案与后台页面设计方案。

---

## 1. 核心设计原则

### 1.1 商品中心只维护平台标准商品

商品中心中的商品不是某一个供应商的商品，而是平台统一定义的“标准商品”。

例如：

- 广东移动 100 元快充
- 全国电信 50 元慢充
- 江苏联通 200 元混充

这些商品属于平台商品主档，不直接属于 A 供应商或 B 供应商。

### 1.2 供应商商品是独立目录层

每个供应商都有自己的原始商品目录。

例如：

- A 供应商有 10 个商品
- B 供应商有 20 个商品

这 30 个商品不能直接作为商品中心商品展示，而应该先进入“供应商商品表”。

### 1.3 平台商品与供应商商品通过映射表关联

同一个平台商品可以关联多个供应商商品。

例如：

- 平台商品：广东移动 100 元快充
- A 商品：`A_GD_CMCC_100_FAST`
- B 商品：`B_CMCC_GD_100`

这两个供应商商品都应映射到同一个平台商品。

### 1.4 不能通过商品名称判断属于哪个供应商

原因：

- 平台商品名称是标准名称
- 供应商商品名称是供应商原始名称
- 同一标准商品可能被多个供应商同时提供

因此必须通过以下数据判断：

- 商品供应商映射表
- 路由策略表
- 订单快照中的实际路由结果

### 1.5 价格必须分层

结合当前业务，价格至少分三层：

- 供应商采购折扣价
- 平台默认供货价
- 渠道供货价

其中：

- 供应商采购折扣价：供应商给平台的进货成本价
- 平台默认供货价：平台默认卖给渠道的基准价
- 渠道供货价：针对某个渠道单独谈判后的实际销售价

不要把“供应商折扣价”和“渠道供货价”混在一个字段里。

### 1.6 同类商品应按高利润库存优先销售

同一个平台商品如果同时挂了多个供应商商品，应优先销售利润空间更高的货源。

例如：

- A 供应商采购折扣价 95.5 元
- B 供应商采购折扣价 96.5 元
- 渠道 1 的供货价 101 元

则优先销售 A。

当 A 的可售库存用完、库存状态不可用、健康度异常或路由失败时，再切到 B。

这意味着路由策略默认不是“随机”或“固定供应商”，而是：

- 先按利润优先
- 再按库存可售
- 再按候补顺序切换

### 1.7 折扣规则与采购折扣不是一回事

当前业务里提到的“折扣价”，本质上是供应商给平台的采购折扣价，不建议再单独放进营销折扣规则里。

因此应区分：

- 采购折扣：属于供应商商品或商品供应商映射
- 渠道供货价：属于渠道商品价格
- 营销折扣规则：如后续存在活动优惠、首单减免、等级折扣时再单独启用

---

## 2. 数据模型总览

建议最少使用以下 6 张核心业务表：

1. `products`
2. `supplier_products`
3. `product_supplier_mappings`
4. `product_platform_prices`
5. `product_discount_rules`
6. `product_route_policies`

建议再补 2 张配套表：

7. `product_route_policy_items`
8. `channel_product_prices`

其中：

- `channel_product_prices` 用于维护每个渠道的供货价
- 如果当前系统已经有稳定的渠道价格表，也可以继续沿用现有表结构

如果当前阶段希望先简化，也可以把路由明细先存入 `product_route_policies.policy_json`，但从长期维护看，拆表更稳。

---

## 3. 数据库表设计

## 3.1 商品表 `products`

用途：

- 维护平台标准商品主档
- 商品中心展示的商品即来自该表

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `product_code` | varchar(64) | 是 | 平台商品编码，平台唯一 |
| `product_name` | varchar(128) | 是 | 平台标准商品名称 |
| `carrier_code` | varchar(32) | 是 | 运营商编码，如 `CMCC` / `CTCC` / `CUCC` / `CBN` |
| `carrier_name` | varchar(32) | 否 | 运营商名称，冗余展示用 |
| `province_code` | varchar(32) | 否 | 省份编码，全国可为空或 `NATIONAL` |
| `province_name` | varchar(32) | 是 | 省份名称 |
| `face_value_amount_fen` | int | 是 | 面值，单位分 |
| `product_type` | varchar(32) | 是 | 商品类型，如 `FAST` / `MIXED` |
| `sales_unit` | varchar(32) | 是 | 销售单位，如 元 / 笔 |
| `recharge_range_json` | json | 否 | 支持充值范围 |
| `arrival_sla_desc` | varchar(128) | 否 | 到账时效说明 |
| `split_support` | tinyint / boolean | 是 | 是否支持拆单 |
| `standard_status` | varchar(32) | 是 | 商品主状态，如 `ACTIVE` / `INACTIVE` |
| `route_status` | varchar(32) | 是 | 路由状态，如 `ENABLED` / `DISABLED` |
| `default_supplier_id` | bigint | 否 | 默认供应商，仅作默认路由入口，不代表唯一供应商 |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `created_by` | varchar(64) | 否 | 创建人 |
| `updated_at` | datetime | 是 | 更新时间 |
| `updated_by` | varchar(64) | 否 | 更新人 |

唯一索引建议：

- `uk_products_product_code(product_code)`
- `idx_products_search(carrier_code, province_code, face_value_amount_fen, product_type, standard_status)`

关键规则：

- 商品中心列表展示这张表
- 商品名称只能表达标准商品，不带供应商归属含义
- 一个商品可以挂多个供应商

---

## 3.2 供应商商品表 `supplier_products`

用途：

- 存放从各供应商同步回来的原始商品目录
- 保留供应商原始编码、原始名称、原始价格、原始库存状态

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `snapshot_id` | varchar(64) | 否 | 快照编号，对应目录同步批次 |
| `supplier_id` | bigint | 是 | 供应商主键 |
| `supplier_code` | varchar(64) | 是 | 供应商编码，冗余字段 |
| `supplier_product_code` | varchar(128) | 是 | 供应商商品编码 |
| `supplier_product_name` | varchar(256) | 是 | 供应商原始商品名称 |
| `carrier_code` | varchar(32) | 是 | 识别后的运营商编码 |
| `province_code` | varchar(32) | 否 | 识别后的省份编码 |
| `province_name` | varchar(32) | 否 | 识别后的省份名称 |
| `face_value_fen` | int | 是 | 识别后的面值 |
| `product_type` | varchar(32) | 否 | 识别后的商品类型 |
| `cost_price_fen` | int | 是 | 供应商采购价 |
| `sale_status` | varchar(32) | 是 | 供应商销售状态 |
| `stock_status` | varchar(32) | 是 | 供应商库存状态 |
| `arrival_sla_desc` | varchar(128) | 否 | 到账时效 |
| `recharge_range_json` | json | 否 | 充值范围 |
| `raw_payload_json` | json | 否 | 原始供应商返回数据 |
| `match_status` | varchar(32) | 是 | 匹配状态，如 `UNMATCHED` / `MATCHED` / `IGNORED` |
| `last_sync_at` | datetime | 是 | 最近同步时间 |
| `is_latest` | tinyint / boolean | 是 | 是否最新版本 |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

唯一索引建议：

- `uk_supplier_products_unique(supplier_id, supplier_product_code, is_latest)`
- `idx_supplier_products_match(supplier_id, carrier_code, province_code, face_value_fen, match_status)`

关键规则：

- 这张表属于供应商目录层，不直接暴露给渠道
- 供应商商品名称仅用于识别与比对，不作为平台商品名
- 同一个供应商商品可以被停用，但历史快照应保留

---

## 3.3 商品供应商映射表 `product_supplier_mappings`

用途：

- 建立平台商品和供应商商品之间的正式关联关系
- 标记默认供应商、候补供应商、优先级、启停状态

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `product_id` | bigint | 是 | 平台商品 ID |
| `supplier_id` | bigint | 是 | 供应商 ID |
| `supplier_product_id` | bigint | 是 | 供应商商品表 ID |
| `supplier_product_code` | varchar(128) | 是 | 冗余供应商商品编码 |
| `match_mode` | varchar(32) | 是 | 匹配方式，如 `MANUAL` / `AUTO` |
| `priority_no` | int | 是 | 路由优先级，数值越小优先级越高 |
| `is_default` | tinyint / boolean | 是 | 是否默认供应商映射 |
| `is_fallback` | tinyint / boolean | 是 | 是否候补供应商 |
| `purchase_price_mode` | varchar(32) | 否 | 采购价模式，如 `SUPPLIER_REALTIME` / `SNAPSHOT` |
| `purchase_price_fen` | int | 否 | 固定采购价或映射快照价 |
| `route_weight` | int | 否 | 加权路由权重 |
| `stock_status_snapshot` | varchar(32) | 否 | 库存快照 |
| `sale_status_snapshot` | varchar(32) | 否 | 销售状态快照 |
| `mapping_status` | varchar(32) | 是 | 状态，如 `ACTIVE` / `INACTIVE` |
| `effective_from` | datetime | 否 | 生效时间 |
| `effective_to` | datetime | 否 | 失效时间 |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `created_by` | varchar(64) | 否 | 创建人 |
| `updated_at` | datetime | 是 | 更新时间 |
| `updated_by` | varchar(64) | 否 | 更新人 |

唯一索引建议：

- `uk_product_supplier_mapping(product_id, supplier_product_id)`
- `idx_product_supplier_route(product_id, mapping_status, priority_no, is_default)`

关键规则：

- 一个平台商品允许对应多个供应商商品
- `is_default = 1` 只能有一条
- 候补供应商可以有多条
- 路由时应基于映射关系，而不是直接扫供应商目录

示例：

- 平台商品 P1
- A 供应商商品 A1，优先级 1，默认
- B 供应商商品 B9，优先级 2，候补

当 A 不可用时，再走 B。

---

## 3.4 平台价格表 `product_platform_prices`

用途：

- 管理平台商品的默认供货价
- 作为渠道单独供货价未配置时的默认价格
- 作为利润测算和渠道报价的基准价

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `product_id` | bigint | 是 | 平台商品 ID |
| `price_type` | varchar(32) | 是 | 价格类型，如 `STANDARD` / `FLOOR` / `SUGGESTED` |
| `currency` | varchar(16) | 是 | 币种 |
| `sale_amount_fen` | int | 是 | 平台默认供货价 |
| `min_sale_amount_fen` | int | 否 | 最低允许供货价 |
| `max_sale_amount_fen` | int | 否 | 最高允许供货价 |
| `gross_profit_mode` | varchar(32) | 否 | 毛利模式，如 `FIXED` / `RATE` |
| `gross_profit_value` | decimal(10,4) | 否 | 毛利值 |
| `pricing_status` | varchar(32) | 是 | 状态，如 `ACTIVE` / `INACTIVE` |
| `effective_from` | datetime | 否 | 生效时间 |
| `effective_to` | datetime | 否 | 失效时间 |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `created_by` | varchar(64) | 否 | 创建人 |
| `updated_at` | datetime | 是 | 更新时间 |
| `updated_by` | varchar(64) | 否 | 更新人 |

索引建议：

- `idx_product_platform_prices(product_id, price_type, pricing_status, effective_from, effective_to)`

关键规则：

- 平台默认供货价不等于供应商采购折扣价
- 平台默认供货价也不一定等于渠道实际供货价
- 若渠道未配置专属供货价，则默认取该表价格
- 若未来存在分时价格，保留时间区间字段

---

## 3.5 折扣规则表 `product_discount_rules`

用途：

- 仅用于未来营销优惠场景
- 描述“在什么条件下，对哪个商品，用什么方式额外优惠”
- 解决首单优惠、渠道等级折扣、活动期优惠、批量折扣等问题

当前阶段说明：

- 如果当前业务没有营销优惠诉求，可以暂不启用该表
- 不要把供应商采购折扣价放进该表

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `rule_code` | varchar(64) | 是 | 规则编码 |
| `rule_name` | varchar(128) | 是 | 规则名称 |
| `product_id` | bigint | 否 | 指定商品，可为空表示适用商品组 |
| `channel_id` | bigint | 否 | 指定渠道，可为空表示全渠道 |
| `channel_level` | varchar(32) | 否 | 指定渠道等级 |
| `discount_type` | varchar(32) | 是 | `FIXED_REDUCTION` / `PERCENTAGE` / `FIXED_PRICE` |
| `discount_value` | decimal(10,4) | 是 | 折扣值 |
| `base_price_type` | varchar(32) | 是 | 基于哪种价格计算，如 `PLATFORM_STANDARD` / `CHANNEL_PRICE` |
| `min_final_price_fen` | int | 否 | 折后最低价保护 |
| `max_discount_amount_fen` | int | 否 | 最大优惠金额限制 |
| `condition_type` | varchar(32) | 是 | 条件类型，如 `ALWAYS` / `FIRST_ORDER` / `ACTIVITY_WINDOW` / `ORDER_COUNT_REACH` |
| `condition_json` | json | 否 | 规则条件明细 |
| `priority_no` | int | 是 | 规则优先级 |
| `stackable` | tinyint / boolean | 是 | 是否允许叠加 |
| `exclusive_tag` | varchar(64) | 否 | 互斥组标记 |
| `rule_status` | varchar(32) | 是 | 状态，如 `ACTIVE` / `INACTIVE` |
| `effective_from` | datetime | 否 | 生效时间 |
| `effective_to` | datetime | 否 | 失效时间 |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `created_by` | varchar(64) | 否 | 创建人 |
| `updated_at` | datetime | 是 | 更新时间 |
| `updated_by` | varchar(64) | 否 | 更新人 |

唯一索引建议：

- `uk_product_discount_rules_rule_code(rule_code)`
- `idx_product_discount_rules_query(product_id, channel_id, channel_level, rule_status, effective_from, effective_to)`

关键规则：

- 折扣规则不是直接覆盖采购价
- 折扣规则通常作用于平台默认供货价或渠道供货价
- 同时命中多条规则时，要按 `priority_no` 和 `stackable` 决定是否叠加

建议结算顺序：

1. 取平台默认供货价
2. 若存在渠道专属供货价，则以渠道价替代
3. 若启用了营销优惠，再执行折扣规则
4. 得到最终成交价
5. 再与采购价比较计算毛利

---

## 3.6 路由策略表 `product_route_policies`

用途：

- 定义某个平台商品在下单时如何选择供应商
- 管理利润优先、库存优先、失败切换、价格保护

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `product_id` | bigint | 是 | 平台商品 ID |
| `policy_code` | varchar(64) | 是 | 路由策略编码 |
| `policy_name` | varchar(128) | 是 | 路由策略名称 |
| `route_mode` | varchar(32) | 是 | `GROSS_PROFIT_FIRST` / `PRIORITY` / `LOWEST_COST` / `WEIGHTED` / `MANUAL_ONLY` |
| `failover_enabled` | tinyint / boolean | 是 | 是否允许失败切换 |
| `price_protect_enabled` | tinyint / boolean | 是 | 是否开启价格保护 |
| `max_purchase_price_fen` | int | 否 | 最大允许采购价 |
| `profit_sort_enabled` | tinyint / boolean | 是 | 是否按预估利润排序 |
| `inventory_check_enabled` | tinyint / boolean | 是 | 是否校验库存 |
| `supplier_health_check_enabled` | tinyint / boolean | 是 | 是否校验供应商健康度 |
| `timeout_fallback_enabled` | tinyint / boolean | 是 | 超时是否切换候补 |
| `timeout_ms` | int | 否 | 超时时间 |
| `route_explain_enabled` | tinyint / boolean | 是 | 是否记录路由解释 |
| `policy_status` | varchar(32) | 是 | 状态，如 `ACTIVE` / `INACTIVE` |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `created_by` | varchar(64) | 否 | 创建人 |
| `updated_at` | datetime | 是 | 更新时间 |
| `updated_by` | varchar(64) | 否 | 更新人 |

唯一索引建议：

- `uk_product_route_policies_product(product_id)`

关键规则：

- 一个商品当前只保留一套生效路由策略
- 策略本身定义路由模式
- 具体走哪些供应商，应由明细子表定义
- 当前业务默认推荐 `GROSS_PROFIT_FIRST`
- 在 `GROSS_PROFIT_FIRST` 模式下，应以“渠道供货价 - 当前采购价”作为排序依据

---

## 3.7 路由策略明细表 `product_route_policy_items`

用途：

- 维护每个路由策略下的供应商候选队列
- 用于定义优先级、权重、价格限制、启停状态

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `policy_id` | bigint | 是 | 路由策略 ID |
| `mapping_id` | bigint | 是 | 商品供应商映射 ID |
| `supplier_id` | bigint | 是 | 供应商 ID |
| `priority_no` | int | 否 | 优先级模式使用 |
| `weight_value` | int | 否 | 加权模式使用 |
| `candidate_status` | varchar(32) | 是 | 状态，如 `ACTIVE` / `INACTIVE` |
| `min_success_rate` | decimal(8,4) | 否 | 最低成功率要求 |
| `max_timeout_ms` | int | 否 | 最大超时阈值 |
| `max_purchase_price_fen` | int | 否 | 候选供应商采购价上限 |
| `allow_fallback` | tinyint / boolean | 是 | 是否允许作为候补 |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

索引建议：

- `idx_product_route_policy_items(policy_id, candidate_status, priority_no)`

关键规则：

- 路由策略决定“怎么选”
- 路由明细决定“可选谁”
- 如果是利润优先模式，应实时计算每个候选项的预估利润
- 库存不可售、销售状态关闭、健康度异常的候选项应被自动剔除

---

## 3.8 渠道供货价表 `channel_product_prices`

用途：

- 维护每个渠道针对每个平台商品的实际供货价
- 支持运营针对不同渠道单独报价

建议字段：

| 字段名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `id` | bigint / snowflake / uuid | 是 | 主键 |
| `channel_id` | bigint | 是 | 渠道 ID |
| `product_id` | bigint | 是 | 平台商品 ID |
| `currency` | varchar(16) | 是 | 币种 |
| `supply_price_fen` | int | 是 | 给该渠道的供货价 |
| `min_supply_price_fen` | int | 否 | 最低允许供货价 |
| `max_supply_price_fen` | int | 否 | 最高允许供货价 |
| `price_status` | varchar(32) | 是 | 状态，如 `ACTIVE` / `INACTIVE` |
| `effective_from` | datetime | 否 | 生效时间 |
| `effective_to` | datetime | 否 | 失效时间 |
| `remark` | varchar(500) | 否 | 备注 |
| `created_at` | datetime | 是 | 创建时间 |
| `created_by` | varchar(64) | 否 | 创建人 |
| `updated_at` | datetime | 是 | 更新时间 |
| `updated_by` | varchar(64) | 否 | 更新人 |

唯一索引建议：

- `uk_channel_product_prices(channel_id, product_id, effective_from)`

关键规则：

- 一个商品可针对不同渠道配置不同供货价
- 若未配置渠道专属价，则回退平台默认供货价
- 渠道供货价必须大于当前选中供应商采购价，否则毛利为负，应阻止生效或预警

---

## 4. 表关系说明

关系如下：

```text
products
  1 -> n product_supplier_mappings

supplier_products
  1 -> n product_supplier_mappings

products
  1 -> n product_platform_prices

products
  1 -> n channel_product_prices

products
  1 -> n product_discount_rules

products
  1 -> 1 product_route_policies

product_route_policies
  1 -> n product_route_policy_items

product_supplier_mappings
  1 -> n product_route_policy_items
```

---

## 5. 典型业务配置流程

以“A 供应商 10 个商品，B 供应商 20 个商品”为例：

### 5.1 第一步：建立供应商主档与技术配置

操作：

- 创建 A 供应商
- 创建 B 供应商
- 配置接口地址、鉴权、超时、回调密钥

对应现有接口：

- `/admin/suppliers`
- `/admin/supplier-configs`

### 5.2 第二步：同步供应商目录

操作：

- 同步 A 的 10 个商品到 `supplier_products`
- 同步 B 的 20 个商品到 `supplier_products`

结果：

- 供应商商品层一共 30 条
- 其中可能有重复能力商品

### 5.3 第三步：建立平台标准商品

假设 A 和 B 中有很多商品本质相同，则平台只建标准商品，例如：

- 广东移动 100 元快充
- 广东移动 200 元快充
- 全国联通 50 元慢充

最终平台商品数可能小于 30。

### 5.4 第四步：建立映射关系

例如：

- 平台商品 P1001 关联 A 的 A001
- 平台商品 P1001 再关联 B 的 B013

则说明：

- A001 和 B013 都是 P1001 的供货来源

### 5.5 第五步：配置平台默认供货价

例如：

- P1001 平台默认供货价 10100 分

注意：

- 这是平台默认供货价
- 不是供应商采购价
- 渠道如果未单独配置，则默认走这里

### 5.6 第六步：配置渠道供货价

例如：

- 渠道 1 销售 P1001，供货价 10100 分
- 渠道 2 销售 P1001，供货价 10050 分

这正对应你的业务场景：

- A 采购折扣价 9550 分
- B 采购折扣价 9650 分
- 渠道 1 供货价 10100 分
- 渠道 2 供货价 10050 分

则预估利润分别为：

- 渠道 1 走 A，毛利 550 分
- 渠道 1 走 B，毛利 450 分
- 渠道 2 走 A，毛利 500 分
- 渠道 2 走 B，毛利 400 分

### 5.7 第七步：配置折扣规则

例如：

- VIP 渠道购买 P1001 打 98 折
- 新渠道首单立减 100 分

说明：

- 如果当前没有营销优惠需求，这一步可以先不做

### 5.8 第八步：配置路由策略

例如：

- 同类商品优先走利润更高的 A
- 若 A 库存耗尽或不可售，则切到 B
- 若 B 采购价超过渠道可承受利润线，则不允许切换
- 若渠道 2 毛利低于最小毛利门槛，则预警或禁止售卖

### 5.9 第九步：开放给渠道

如果渠道需要售卖该商品，再执行：

- 授权渠道商品
- 设置渠道供货价

现有接口已有：

- `/admin/channel-products`
- `/admin/channel-prices`

---

## 6. 后台页面设计

建议把后台页面拆成以下 7 个模块。

## 6.1 商品中心

页面用途：

- 管理平台标准商品

### 6.1.1 列表页字段

- 商品 ID
- 商品编码
- 商品名称
- 运营商
- 省份
- 面值
- 商品类型
- 销售单位
- 默认供应商
- 路由状态
- 标准状态
- 当前默认供货价
- 最近更新时间
- 操作：查看 / 编辑 / 配置映射 / 配置价格 / 配置折扣 / 配置路由

筛选条件：

- 商品编码
- 商品名称
- 运营商
- 省份
- 面值
- 商品类型
- 标准状态
- 路由状态

### 6.1.2 新增 / 编辑弹窗字段

- 商品编码
- 商品名称
- 运营商编码
- 运营商名称
- 省份编码
- 省份名称
- 面值
- 商品类型
- 销售单位
- 支持充值范围
- 到账时效说明
- 是否支持拆单
- 标准状态
- 路由状态
- 默认供应商
- 备注

### 6.1.3 详情页建议分栏

- 基础信息
- 供应商映射
- 平台默认供货价
- 渠道供货价
- 折扣规则
- 路由策略
- 路由预览

---

## 6.2 供应商商品页

页面用途：

- 查看供应商同步回来的原始商品
- 处理未匹配商品

### 6.2.1 列表页字段

- 供应商
- 快照批次
- 供应商商品编码
- 供应商商品名称
- 运营商
- 省份
- 面值
- 商品类型
- 采购价
- 销售状态
- 库存状态
- 匹配状态
- 最近同步时间
- 操作：查看原始报文 / 发起映射 / 忽略

筛选条件：

- 供应商
- 供应商商品编码
- 供应商商品名称
- 运营商
- 省份
- 面值
- 销售状态
- 库存状态
- 匹配状态

### 6.2.2 详情抽屉字段

- 供应商基本信息
- 商品识别结果
- 当前采购价
- 原始 payload
- 已关联平台商品
- 历史同步记录

---

## 6.3 商品供应商映射页

页面用途：

- 配置平台商品与供应商商品的绑定关系

建议入口：

- 从商品详情进入

### 6.3.1 列表页字段

- 平台商品名称
- 供应商
- 供应商商品编码
- 供应商商品名称
- 是否默认
- 是否候补
- 优先级
- 当前采购价
- 销售状态快照
- 库存状态快照
- 生效时间
- 失效时间
- 映射状态
- 操作：编辑 / 停用 / 设为默认 / 加入路由

### 6.3.2 新增 / 编辑弹窗字段

- 平台商品
- 供应商
- 供应商商品
- 匹配方式
- 优先级
- 是否默认
- 是否候补
- 采购价模式
- 固定采购价
- 路由权重
- 生效开始时间
- 生效结束时间
- 映射状态
- 备注

页面规则：

- 保存时校验同一商品仅允许一个默认映射
- 若勾选默认，系统自动取消其他默认项

---

## 6.4 平台默认供货价页

页面用途：

- 管理平台默认供货价与价格边界

### 6.4.1 列表页字段

- 平台商品
- 价格类型
- 默认供货价
- 最低售价
- 最高售价
- 毛利模式
- 毛利值
- 生效时间
- 失效时间
- 状态
- 操作：编辑 / 停用 / 复制新增

### 6.4.2 新增 / 编辑弹窗字段

- 平台商品
- 价格类型
- 币种
- 默认供货价
- 最低售价
- 最高售价
- 毛利模式
- 毛利值
- 生效开始时间
- 生效结束时间
- 状态
- 备注

页面规则：

- 同一商品同一价格类型在同一时间段不能重叠
- 最低售价不能高于默认供货价

---

## 6.5 渠道供货价页

页面用途：

- 给不同渠道配置不同商品供货价

### 6.5.1 列表页字段

- 渠道
- 平台商品
- 供货价
- 平台默认供货价
- 当前最优采购价
- 预估毛利
- 生效时间
- 失效时间
- 状态
- 操作：编辑 / 停用 / 复制

筛选条件：

- 渠道
- 商品
- 状态

### 6.5.2 新增 / 编辑弹窗字段

- 渠道
- 平台商品
- 币种
- 供货价
- 最低供货价
- 最高供货价
- 生效开始时间
- 生效结束时间
- 状态
- 备注

页面规则：

- 保存时自动显示当前可选供应商最低采购价、最高利润价差
- 若供货价低于采购价，应禁止保存或强提示
- 若供货价接近采购价，可提示利润过薄风险

---

## 6.6 折扣规则页

页面用途：

- 管理活动折扣、渠道折扣、首单优惠等

### 6.5.1 列表页字段

- 规则编码
- 规则名称
- 适用商品
- 适用渠道
- 适用渠道等级
- 折扣类型
- 折扣值
- 基础价格类型
- 条件类型
- 优先级
- 是否可叠加
- 状态
- 生效时间
- 失效时间
- 操作：编辑 / 启停 / 复制

筛选条件：

- 规则编码
- 规则名称
- 商品
- 渠道
- 渠道等级
- 折扣类型
- 条件类型
- 状态

### 6.5.2 新增 / 编辑弹窗字段

- 规则编码
- 规则名称
- 适用商品
- 适用渠道
- 适用渠道等级
- 折扣类型
- 折扣值
- 基础价格类型
- 最低成交价保护
- 最大优惠金额
- 条件类型
- 条件配置 JSON 或可视化条件项
- 优先级
- 是否可叠加
- 互斥组
- 生效开始时间
- 生效结束时间
- 状态
- 备注

页面建议：

- 首版可以先支持常用条件模板
- 高阶条件再保留 JSON 配置入口

---

## 6.7 路由策略页

页面用途：

- 管理商品下单时的供应商选择规则
- 默认管理逻辑应支持“利润优先 + 库存优先 + 候补切换”

### 6.6.1 策略主表字段

- 平台商品
- 策略编码
- 策略名称
- 路由模式
- 是否按利润排序
- 是否允许失败切换
- 是否价格保护
- 最大采购价
- 是否校验库存
- 是否校验供应商健康度
- 是否超时切换
- 超时时间
- 是否记录路由解释
- 状态
- 备注

### 6.6.2 候选供应商明细字段

- 供应商
- 供应商商品
- 绑定映射
- 优先级
- 权重
- 最低成功率
- 最大超时
- 最大采购价
- 是否允许作为候补
- 状态
- 操作：上移 / 下移 / 编辑 / 删除

### 6.6.3 路由预览页字段

建议输入：

- 手机号
- 商品
- 面值
- 商品类型
- 渠道

建议输出：

- 命中的平台商品
- 命中的平台价格
- 命中的渠道价格
- 命中的折扣规则
- 候选供应商列表
- 最终选中供应商
- 选中原因
- 被淘汰供应商及淘汰原因
- 预计采购价
- 预计渠道供货价
- 预计毛利

---

## 7. 与现有接口的衔接关系

## 7.1 当前已存在并可直接复用

- 平台商品基础主档：`/admin/products`
- 供应商主档：`/admin/suppliers`
- 供应商技术配置：`/admin/supplier-configs`
- 供应商目录查询：`/admin/suppliers/{supplierId}/products`
- 供应商目录同步：`/admin/suppliers/{supplierId}/catalog/sync`
- 渠道商品授权：`/admin/channel-products`
- 渠道供货价配置：`/admin/channel-prices`
- 渠道策略读取：`/admin/channels/{channelId}/order-policy`
- 渠道商品读取：`/admin/channels/{channelId}/products`

## 7.2 建议新增接口

建议与 [BACKEND_REQ.md](/C:/Users/nianx/chongzhi-admin/BACKEND_REQ.md) 保持一致：

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

补充建议：

- `GET /admin/supplier-products`
- `GET /admin/supplier-products/{supplierProductId}`
- `POST /admin/supplier-products/{supplierProductId}/ignore`
- `POST /admin/supplier-products/{supplierProductId}/match`

---

## 8. 实施顺序建议

建议按以下顺序实施：

1. 先固定平台商品与供应商商品为两层模型
2. 先实现供应商商品同步与未匹配商品处理
3. 再实现商品供应商映射
4. 再实现平台价格
5. 再实现折扣规则
6. 最后实现路由策略与路由预览

原因：

- 映射层是整个模型的中枢
- 没有映射层，商品无法正确识别供应来源
- 没有价格层和路由层，渠道价和订单采购价无法解释

---

## 9. 一句话结论

正确模型不是“商品名称上带供应商”，也不是“谁便宜就永远走谁”，而是：

- 商品中心维护平台标准商品
- 供应商目录维护原始供应商商品
- 通过映射表建立商品与供应商关系
- 通过渠道供货价表维护不同渠道的销售价格
- 通过“利润优先 + 库存优先 + 候补切换”的路由策略决定订单最终走哪个供应商
