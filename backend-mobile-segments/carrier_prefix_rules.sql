-- China mainland mobile carrier prefix rules + MNP cache support
-- Scope:
-- 1. Used for original carrier recognition by 3/4 digit prefix.
-- 2. Does NOT replace product.mobile_segments (7-digit segment library).
-- 3. After mobile number portability (MNP), prefix != current signed carrier.
-- 4. Current signed carrier must come from MNP cache or real-time MNP query source.

BEGIN;

CREATE SCHEMA IF NOT EXISTS product;

CREATE TABLE IF NOT EXISTS product.carrier_prefix_rules (
  id TEXT PRIMARY KEY,
  prefix_start TEXT NOT NULL,
  prefix_end TEXT NOT NULL,
  prefix_length INTEGER NOT NULL CHECK (prefix_length IN (3, 4)),
  carrier_code TEXT NOT NULL,
  carrier_name TEXT NOT NULL,
  host_carrier_code TEXT,
  host_carrier_name TEXT,
  number_type TEXT NOT NULL DEFAULT 'mobile' CHECK (number_type IN ('mobile', 'mvno', 'satellite')),
  supported_for_recharge BOOLEAN NOT NULL DEFAULT TRUE,
  is_mnp_capable BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT,
  data_version TEXT NOT NULL DEFAULT 'CN-MOBILE-PREFIX-2026-04',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_carrier_prefix_rules_range
  ON product.carrier_prefix_rules(prefix_start, prefix_end, prefix_length);

CREATE INDEX IF NOT EXISTS idx_carrier_prefix_rules_lookup
  ON product.carrier_prefix_rules(prefix_length DESC, prefix_start, prefix_end);

CREATE TABLE IF NOT EXISTS product.mobile_mnp_cache (
  mobile_no TEXT PRIMARY KEY CHECK (mobile_no ~ '^\d{11}$'),
  mobile_prefix7 TEXT NOT NULL CHECK (mobile_prefix7 ~ '^\d{7}$'),
  original_carrier_code TEXT,
  original_carrier_name TEXT,
  current_carrier_code TEXT,
  current_carrier_name TEXT,
  mnp_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (mnp_status IN ('UNKNOWN', 'NOT_PORTED', 'PORTED', 'UNSUPPORTED', 'ERROR')),
  mnp_source TEXT,
  source_request_id TEXT,
  checked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_mnp_cache_prefix7
  ON product.mobile_mnp_cache(mobile_prefix7);

CREATE INDEX IF NOT EXISTS idx_mobile_mnp_cache_expires
  ON product.mobile_mnp_cache(expires_at);

INSERT INTO product.carrier_prefix_rules (
  id,
  prefix_start,
  prefix_end,
  prefix_length,
  carrier_code,
  carrier_name,
  host_carrier_code,
  host_carrier_name,
  number_type,
  supported_for_recharge,
  is_mnp_capable,
  note,
  data_version
)
VALUES
  ('cn-130-132-cucc', '130', '132', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-133-133-ctcc', '133', '133', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-1340-1348-cmcc', '1340', '1348', 4, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '1349 例外', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-1349-1349-ctcc', '1349', '1349', 4, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '1349 例外号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-135-139-cmcc', '135', '139', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-145-145-cucc', '145', '145', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-147-148-cmcc', '147', '148', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-149-149-ctcc', '149', '149', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-150-152-cmcc', '150', '152', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-153-153-ctcc', '153', '153', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-155-156-cucc', '155', '156', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-157-159-cmcc', '157', '159', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-162-162-mvno-ctcc', '162', '162', 3, 'MVNO', '移动转售', 'CTCC', '中国电信', 'mvno', FALSE, FALSE, '虚拟运营商号段，宿主网为中国电信，建议单独配置', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-165-165-mvno-cmcc', '165', '165', 3, 'MVNO', '移动转售', 'CMCC', '中国移动', 'mvno', FALSE, FALSE, '虚拟运营商号段，宿主网为中国移动，建议单独配置', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-166-166-cucc', '166', '166', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-167-167-mvno-cucc', '167', '167', 3, 'MVNO', '移动转售', 'CUCC', '中国联通', 'mvno', FALSE, FALSE, '虚拟运营商号段，宿主网为中国联通，建议单独配置', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-170-170-mvno', '170', '170', 3, 'MVNO', '移动转售', NULL, NULL, 'mvno', FALSE, FALSE, '170 号段为虚拟运营商混合号段，需按专门产品线处理', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-171-171-mvno-cucc', '171', '171', 3, 'MVNO', '移动转售', 'CUCC', '中国联通', 'mvno', FALSE, FALSE, '171 号段通常按虚拟运营商处理，建议单独配置', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-172-172-cmcc', '172', '172', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-173-173-ctcc', '173', '173', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-1740-1740-ctcc-sat', '1740', '1740', 4, 'CTCC_SAT', '中国电信天通卫星', NULL, NULL, 'satellite', FALSE, FALSE, '卫星通信号段，不按普通话费充值处理', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-175-176-cucc', '175', '176', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-177-177-ctcc', '177', '177', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-178-178-cmcc', '178', '178', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-180-181-ctcc', '180', '181', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-182-184-cmcc', '182', '184', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-185-186-cucc', '185', '186', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-187-188-cmcc', '187', '188', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-189-189-ctcc', '189', '189', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-190-190-ctcc', '190', '190', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-191-191-ctcc', '191', '191', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-192-192-cbn', '192', '192', 3, 'CBN', '中国广电', NULL, NULL, 'mobile', TRUE, FALSE, '中国广电号段，是否参与携转请按业务规则单独确认', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-193-193-ctcc', '193', '193', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-195-195-cmcc', '195', '195', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-196-196-cucc', '196', '196', 3, 'CUCC', '中国联通', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-197-197-cmcc', '197', '197', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-198-198-cmcc', '198', '198', 3, 'CMCC', '中国移动', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04'),
  ('cn-199-199-ctcc', '199', '199', 3, 'CTCC', '中国电信', NULL, NULL, 'mobile', TRUE, TRUE, '公众移动通信号段', 'CN-MOBILE-PREFIX-2026-04')
ON CONFLICT (prefix_start, prefix_end, prefix_length) DO UPDATE
SET
  carrier_code = EXCLUDED.carrier_code,
  carrier_name = EXCLUDED.carrier_name,
  host_carrier_code = EXCLUDED.host_carrier_code,
  host_carrier_name = EXCLUDED.host_carrier_name,
  number_type = EXCLUDED.number_type,
  supported_for_recharge = EXCLUDED.supported_for_recharge,
  is_mnp_capable = EXCLUDED.is_mnp_capable,
  note = EXCLUDED.note,
  data_version = EXCLUDED.data_version,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION product.resolve_mobile_carrier(p_mobile TEXT)
RETURNS TABLE (
  mobile_no TEXT,
  mobile_prefix7 TEXT,
  matched_prefix TEXT,
  original_carrier_code TEXT,
  original_carrier_name TEXT,
  current_carrier_code TEXT,
  current_carrier_name TEXT,
  host_carrier_code TEXT,
  host_carrier_name TEXT,
  mnp_status TEXT,
  resolution_source TEXT,
  needs_mnp_lookup BOOLEAN,
  supported_for_recharge BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
WITH input_mobile AS (
  SELECT
    p_mobile AS mobile_no,
    LEFT(p_mobile, 7) AS mobile_prefix7,
    LEFT(p_mobile, 4) AS prefix4,
    LEFT(p_mobile, 3) AS prefix3
),
prefix_rule AS (
  SELECT *
  FROM product.carrier_prefix_rules r
  JOIN input_mobile i
    ON (
      (r.prefix_length = 4 AND i.prefix4 BETWEEN r.prefix_start AND r.prefix_end)
      OR
      (r.prefix_length = 3 AND i.prefix3 BETWEEN r.prefix_start AND r.prefix_end)
    )
  ORDER BY r.prefix_length DESC
  LIMIT 1
),
fresh_cache AS (
  SELECT *
  FROM product.mobile_mnp_cache c
  JOIN input_mobile i
    ON i.mobile_no = c.mobile_no
  WHERE c.expires_at IS NOT NULL
    AND c.expires_at > NOW()
  ORDER BY c.checked_at DESC NULLS LAST
  LIMIT 1
)
SELECT
  i.mobile_no,
  i.mobile_prefix7,
  CASE
    WHEN r.prefix_length = 4 THEN i.prefix4
    WHEN r.prefix_length = 3 THEN i.prefix3
    ELSE NULL
  END AS matched_prefix,
  r.carrier_code AS original_carrier_code,
  r.carrier_name AS original_carrier_name,
  COALESCE(c.current_carrier_code, r.host_carrier_code, r.carrier_code) AS current_carrier_code,
  COALESCE(c.current_carrier_name, r.host_carrier_name, r.carrier_name) AS current_carrier_name,
  r.host_carrier_code,
  r.host_carrier_name,
  COALESCE(c.mnp_status, 'UNKNOWN') AS mnp_status,
  CASE
    WHEN c.mobile_no IS NOT NULL THEN 'MNP_CACHE'
    WHEN r.id IS NOT NULL THEN 'PREFIX_RULE'
    ELSE 'NONE'
  END AS resolution_source,
  CASE
    WHEN c.mobile_no IS NOT NULL THEN FALSE
    WHEN COALESCE(r.is_mnp_capable, FALSE) THEN TRUE
    ELSE FALSE
  END AS needs_mnp_lookup,
  COALESCE(r.supported_for_recharge, FALSE) AS supported_for_recharge
FROM input_mobile i
LEFT JOIN prefix_rule r ON TRUE
LEFT JOIN fresh_cache c ON TRUE;
$$;

COMMIT;
