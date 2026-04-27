-- 中国大陆手机号运营商前缀规则库
-- 适配当前 ISP 充值后端风格，建议落在 product schema 下。
-- 注意：
-- 1. 该表用于“运营商前缀规则”兜底识别，不替代 7 位号段归属地库 product.mobile_segments。
-- 2. 7 位号段库仍是 preview-split / matchRechargeProduct 的主识别来源。
-- 3. 携号转网后，前缀规则仅代表“原始号段所属运营商”，不等于当前签约运营商。

CREATE TABLE IF NOT EXISTS product.carrier_prefix_rules (
  id TEXT PRIMARY KEY,
  prefix_start TEXT NOT NULL,
  prefix_end TEXT NOT NULL,
  prefix_length INTEGER NOT NULL CHECK (prefix_length IN (3, 4)),
  carrier_code TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  number_type TEXT NOT NULL DEFAULT 'mobile',
  supported_for_recharge BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_carrier_prefix_rules_range
  ON product.carrier_prefix_rules(prefix_start, prefix_end, prefix_length);

CREATE INDEX IF NOT EXISTS idx_carrier_prefix_rules_lookup
  ON product.carrier_prefix_rules(prefix_length DESC, prefix_start, prefix_end);

INSERT INTO product.carrier_prefix_rules (
  id,
  prefix_start,
  prefix_end,
  prefix_length,
  carrier_code,
  carrier_name,
  number_type,
  supported_for_recharge,
  note
)
VALUES
  ('seed-prefix-130-132-cucc', '130', '132', 3, 'CUCC', '中国联通', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-133-133-ctcc', '133', '133', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-1340-1348-cmcc', '1340', '1348', 4, 'CMCC', '中国移动', 'mobile', TRUE, '1349 例外'),
  ('seed-prefix-1349-1349-ctcc', '1349', '1349', 4, 'CTCC', '中国电信', 'mobile', TRUE, '1349 特殊拆分'),
  ('seed-prefix-135-139-cmcc', '135', '139', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-145-145-cucc', '145', '145', 3, 'CUCC', '中国联通', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-147-148-cmcc', '147', '148', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-149-149-ctcc', '149', '149', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-150-152-cmcc', '150', '152', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-153-153-ctcc', '153', '153', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-155-156-cucc', '155', '156', 3, 'CUCC', '中国联通', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-157-159-cmcc', '157', '159', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-162-162-ctcc', '162', '162', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-166-167-cucc', '166', '167', 3, 'CUCC', '中国联通', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-170-171-mvno', '170', '171', 3, 'MVNO', '移动通信转售', 'mvno', FALSE, '转售专用号段，建议单独处理'),
  ('seed-prefix-172-172-cmcc', '172', '172', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-173-173-ctcc', '173', '173', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-1740-1740-ctcc-sat', '1740', '1740', 4, 'CTCC_SAT', '中国电信天通卫星', 'satellite', FALSE, '1740 专属卫星号段'),
  ('seed-prefix-175-176-cucc', '175', '176', 3, 'CUCC', '中国联通', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-177-177-ctcc', '177', '177', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-178-178-cmcc', '178', '178', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-180-181-ctcc', '180', '181', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-182-184-cmcc', '182', '184', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-185-186-cucc', '185', '186', 3, 'CUCC', '中国联通', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-187-188-cmcc', '187', '188', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-189-189-ctcc', '189', '189', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-190-190-ctcc', '190', '190', 3, 'CTCC', '中国电信', 'mobile', TRUE, '工信部核发'),
  ('seed-prefix-191-191-ctcc', '191', '191', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-192-192-cbn', '192', '192', 3, 'CBN', '中国广电', 'mobile', TRUE, '工信部核发'),
  ('seed-prefix-193-193-ctcc', '193', '193', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-195-195-cmcc', '195', '195', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-196-196-cucc', '196', '196', 3, 'CUCC', '中国联通', 'mobile', TRUE, '工信部核发'),
  ('seed-prefix-197-197-cmcc', '197', '197', 3, 'CMCC', '中国移动', 'mobile', TRUE, '工信部核发'),
  ('seed-prefix-198-198-cmcc', '198', '198', 3, 'CMCC', '中国移动', 'mobile', TRUE, '公众移动通信'),
  ('seed-prefix-199-199-ctcc', '199', '199', 3, 'CTCC', '中国电信', 'mobile', TRUE, '公众移动通信')
ON CONFLICT (prefix_start, prefix_end, prefix_length) DO UPDATE
SET
  carrier_code = EXCLUDED.carrier_code,
  carrier_name = EXCLUDED.carrier_name,
  number_type = EXCLUDED.number_type,
  supported_for_recharge = EXCLUDED.supported_for_recharge,
  note = EXCLUDED.note,
  updated_at = NOW();
