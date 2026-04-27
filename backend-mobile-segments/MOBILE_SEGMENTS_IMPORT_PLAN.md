# 中国大陆 7 位手机号归属地库导入方案

本文档适配当前后端实现：

- 主识别表：`product.mobile_segments`
- 主识别逻辑：`lookupMobileSegment(mobile.slice(0, 7))`
- 影响接口：
  - `POST /open-api/orders/preview-split`
  - 商品匹配 `matchRechargeProduct`

## 1. 数据边界

必须区分两类数据：

1. `carrier_prefix_rules`
用于 3/4 位前缀识别“原始运营商规则”，适合兜底和基础校验。

2. `mobile_segments`
用于 7 位号段识别“省份 / 城市 / 运营商”，是当前充值系统预览与路由的直接依赖。

结论：

- 没有完整 `mobile_segments`，`preview-split` 仍然会失败。
- `carrier_prefix_rules` 不能替代 `mobile_segments`。

## 2. CSV 字段规范

建议后端导入 CSV 至少包含以下列：

| 列名 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `mobile_prefix` | 是 | `1390518` | 手机号前 7 位 |
| `province_name` | 是 | `江苏` | 省份名称 |
| `city_name` | 否 | `南京` | 城市名称 |
| `isp_code` | 是 | `CMCC` | 运营商编码 |
| `isp_name` | 是 | `中国移动` | 运营商名称 |

可选扩展列：

| 列名 | 必填 | 说明 |
| --- | --- | --- |
| `source_name` | 否 | 数据来源名称 |
| `source_version` | 否 | 数据版本，如 `2026-04` |
| `remark` | 否 | 备注 |

当前导入脚本只强依赖前 5 列，额外列会被忽略。

## 3. CSV 模板

```csv
mobile_prefix,province_name,city_name,isp_code,isp_name
1380013,广东,广州,CMCC,中国移动
1390518,江苏,南京,CMCC,中国移动
```

注意：上面第二行仅作为字段示例。正式导入时，请以后端采购或核验后的权威号段资料为准。

## 4. 导入脚本

已提供：

- [import-mobile-segments.ts](C:/Users/nianx/chongzhi-admin/backend-mobile-segments/import-mobile-segments.ts)

该脚本设计为放入后端仓库后使用，推荐目标路径：

`backend/src/scripts/import-mobile-segments.ts`

### 4.1 执行方式

```bash
bun run src/scripts/import-mobile-segments.ts --file=/data/mobile_segments.csv
```

如果希望“当前批次之外的旧号段自动删除”，可以显式打开：

```bash
bun run src/scripts/import-mobile-segments.ts --file=/data/mobile_segments.csv --delete-missing=true
```

### 4.2 脚本行为

脚本会做这些事：

1. 校验 CSV 表头是否完整
2. 校验 `mobile_prefix` 是否为 7 位数字
3. 校验 `isp_code` 是否属于：
   - `CMCC`
   - `CUCC`
   - `CTCC`
   - `CBN`
   - `MVNO`
   - `CTCC_SAT`
4. 拒绝 CSV 内部重复号段
5. 先导入临时表 `tmp_mobile_segments_import`
6. 再 `UPSERT` 到 `product.mobile_segments`
7. 输出“目标表中存在、但本次 CSV 未覆盖”的旧号段数量
8. 仅在 `--delete-missing=true` 时删除旧号段

## 5. 增量更新机制

推荐使用“全量文件 + 增量 upsert + 可选删除”的方式。

### 5.1 日常增量

适用场景：

- 新增少量号段
- 修正个别省份 / 城市 / 运营商

做法：

1. 更新 CSV
2. 直接运行导入脚本
3. 不带 `--delete-missing`

效果：

- 新号段插入
- 变更号段更新
- 历史号段保留

### 5.2 周期性全量校准

适用场景：

- 上游数据源发布新全量版本
- 需要移除历史失效数据

做法：

1. 用最新全量 CSV 导入
2. 先跑一遍不删除，观察 `stalePrefixCount`
3. 核对无误后，再用 `--delete-missing=true`

效果：

- 目标表与当前全量源完全一致

### 5.3 更稳的生产策略

生产环境建议分两步：

1. 先不删除，只生成差异报告
2. 人工确认后再删除旧号段

如果你们对数据可追溯要求更高，建议后续新增两张表：

- `product.mobile_segment_import_batches`
- `product.mobile_segment_import_batch_items`

用于记录每次导入批次、源文件、变更数量、删除数量、操作者。

## 6. 导入前校验 SQL

### 6.1 检查目标表是否存在重复号段

```sql
SELECT mobile_prefix, COUNT(*) AS cnt
FROM product.mobile_segments
GROUP BY mobile_prefix
HAVING COUNT(*) > 1;
```

### 6.2 检查目标表是否有非法前缀

```sql
SELECT *
FROM product.mobile_segments
WHERE mobile_prefix !~ '^\d{7}$';
```

### 6.3 检查目标表是否有空省份/空运营商

```sql
SELECT *
FROM product.mobile_segments
WHERE province_name = ''
   OR isp_code = ''
   OR isp_name = '';
```

## 7. 导入后校验 SQL

### 7.1 查询单个号段是否已补入

```sql
SELECT
  mobile_prefix,
  province_name,
  city_name,
  isp_code,
  isp_name
FROM product.mobile_segments
WHERE mobile_prefix = '1390518';
```

### 7.2 查看各运营商数量分布

```sql
SELECT isp_code, isp_name, COUNT(*) AS total
FROM product.mobile_segments
GROUP BY isp_code, isp_name
ORDER BY total DESC;
```

### 7.3 查看各省份数量分布

```sql
SELECT province_name, COUNT(*) AS total
FROM product.mobile_segments
GROUP BY province_name
ORDER BY total DESC, province_name ASC;
```

### 7.4 抽样验证指定手机号预览前置识别

```sql
SELECT
  mobile_prefix,
  province_name,
  city_name,
  isp_code,
  isp_name
FROM product.mobile_segments
WHERE mobile_prefix IN ('1380013', '1390518', '1860000');
```

## 8. 与当前充值系统的衔接建议

### 8.1 现状

当前后端逻辑是：

1. 查 `product.mobile_segments`
2. 得到 `province / ispName`
3. 再按运营商、省份、面值、商品类型匹配充值商品

所以：

- 号段库缺失时，预览直接失败
- 商品、供应商、拆单都不会继续执行

### 8.2 建议增强

后续可让后端增加兜底逻辑：

1. 先查 `mobile_segments`
2. 查不到时，再查 `carrier_prefix_rules`
3. 若仍只拿到运营商、拿不到省份，则返回明确错误：
   - “已识别运营商，但缺少 7 位归属地号段，无法匹配省份商品”

这样用户体验会更可控。

## 9. 文件清单

本次已生成：

- [carrier_prefix_rules.sql](C:/Users/nianx/chongzhi-admin/backend-mobile-segments/carrier_prefix_rules.sql)
- [seed-mobile-segments.ts](C:/Users/nianx/chongzhi-admin/backend-mobile-segments/seed-mobile-segments.ts)
- [import-mobile-segments.ts](C:/Users/nianx/chongzhi-admin/backend-mobile-segments/import-mobile-segments.ts)
- [mobile_segments.template.csv](C:/Users/nianx/chongzhi-admin/backend-mobile-segments/mobile_segments.template.csv)

推荐后端落位：

- SQL：放数据库迁移或手工执行目录
- seed：放 `backend/src/database/seeds/`
- import script：放 `backend/src/scripts/`
