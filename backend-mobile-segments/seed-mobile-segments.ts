import type { SQL } from 'bun';

type CarrierPrefixRule = {
  id: string;
  prefixStart: string;
  prefixEnd: string;
  prefixLength: 3 | 4;
  carrierCode: string;
  carrierName: string;
  numberType: 'mobile' | 'mvno' | 'satellite';
  supportedForRecharge: boolean;
  note: string;
};

type SeedMobileSegment = {
  id: string;
  mobilePrefix: string;
  provinceName: string;
  cityName: string;
  ispCode: string;
  ispName: string;
};

const carrierPrefixRules: CarrierPrefixRule[] = [
  {
    id: 'seed-prefix-130-132-cucc',
    prefixStart: '130',
    prefixEnd: '132',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-133-133-ctcc',
    prefixStart: '133',
    prefixEnd: '133',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-1340-1348-cmcc',
    prefixStart: '1340',
    prefixEnd: '1348',
    prefixLength: 4,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '1349 例外',
  },
  {
    id: 'seed-prefix-1349-1349-ctcc',
    prefixStart: '1349',
    prefixEnd: '1349',
    prefixLength: 4,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '1349 特殊拆分',
  },
  {
    id: 'seed-prefix-135-139-cmcc',
    prefixStart: '135',
    prefixEnd: '139',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-145-145-cucc',
    prefixStart: '145',
    prefixEnd: '145',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-147-148-cmcc',
    prefixStart: '147',
    prefixEnd: '148',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-149-149-ctcc',
    prefixStart: '149',
    prefixEnd: '149',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-150-152-cmcc',
    prefixStart: '150',
    prefixEnd: '152',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-153-153-ctcc',
    prefixStart: '153',
    prefixEnd: '153',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-155-156-cucc',
    prefixStart: '155',
    prefixEnd: '156',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-157-159-cmcc',
    prefixStart: '157',
    prefixEnd: '159',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-162-162-ctcc',
    prefixStart: '162',
    prefixEnd: '162',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-166-167-cucc',
    prefixStart: '166',
    prefixEnd: '167',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-170-171-mvno',
    prefixStart: '170',
    prefixEnd: '171',
    prefixLength: 3,
    carrierCode: 'MVNO',
    carrierName: '移动通信转售',
    numberType: 'mvno',
    supportedForRecharge: false,
    note: '转售专用号段，建议单独处理',
  },
  {
    id: 'seed-prefix-172-172-cmcc',
    prefixStart: '172',
    prefixEnd: '172',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-173-173-ctcc',
    prefixStart: '173',
    prefixEnd: '173',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-1740-1740-ctcc-sat',
    prefixStart: '1740',
    prefixEnd: '1740',
    prefixLength: 4,
    carrierCode: 'CTCC_SAT',
    carrierName: '中国电信天通卫星',
    numberType: 'satellite',
    supportedForRecharge: false,
    note: '1740 专属卫星号段',
  },
  {
    id: 'seed-prefix-175-176-cucc',
    prefixStart: '175',
    prefixEnd: '176',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-177-177-ctcc',
    prefixStart: '177',
    prefixEnd: '177',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-178-178-cmcc',
    prefixStart: '178',
    prefixEnd: '178',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-180-181-ctcc',
    prefixStart: '180',
    prefixEnd: '181',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-182-184-cmcc',
    prefixStart: '182',
    prefixEnd: '184',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-185-186-cucc',
    prefixStart: '185',
    prefixEnd: '186',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-187-188-cmcc',
    prefixStart: '187',
    prefixEnd: '188',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-189-189-ctcc',
    prefixStart: '189',
    prefixEnd: '189',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-190-190-ctcc',
    prefixStart: '190',
    prefixEnd: '190',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '工信部核发',
  },
  {
    id: 'seed-prefix-191-191-ctcc',
    prefixStart: '191',
    prefixEnd: '191',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-192-192-cbn',
    prefixStart: '192',
    prefixEnd: '192',
    prefixLength: 3,
    carrierCode: 'CBN',
    carrierName: '中国广电',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '工信部核发',
  },
  {
    id: 'seed-prefix-193-193-ctcc',
    prefixStart: '193',
    prefixEnd: '193',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-195-195-cmcc',
    prefixStart: '195',
    prefixEnd: '195',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-196-196-cucc',
    prefixStart: '196',
    prefixEnd: '196',
    prefixLength: 3,
    carrierCode: 'CUCC',
    carrierName: '中国联通',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '工信部核发',
  },
  {
    id: 'seed-prefix-197-197-cmcc',
    prefixStart: '197',
    prefixEnd: '197',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '工信部核发',
  },
  {
    id: 'seed-prefix-198-198-cmcc',
    prefixStart: '198',
    prefixEnd: '198',
    prefixLength: 3,
    carrierCode: 'CMCC',
    carrierName: '中国移动',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
  {
    id: 'seed-prefix-199-199-ctcc',
    prefixStart: '199',
    prefixEnd: '199',
    prefixLength: 3,
    carrierCode: 'CTCC',
    carrierName: '中国电信',
    numberType: 'mobile',
    supportedForRecharge: true,
    note: '公众移动通信',
  },
];

const seedMobileSegments: SeedMobileSegment[] = [
  {
    id: 'seed-mobile-segment-1380013',
    mobilePrefix: '1380013',
    provinceName: '广东',
    cityName: '广州',
    ispCode: 'CMCC',
    ispName: '中国移动',
  },
];

function sqlLiteral(value: string | number | boolean): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`SQL 数值非法: ${value}`);
    }

    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return `'${value.replaceAll("'", "''")}'`;
}

export async function runSeed(db: SQL): Promise<void> {
  await db.begin(async (tx) => {
    await tx.unsafe(`
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
      )
    `);

    await tx.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS uk_carrier_prefix_rules_range
        ON product.carrier_prefix_rules(prefix_start, prefix_end, prefix_length)
    `);

    await tx.unsafe(`
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
        ${carrierPrefixRules
          .map(
            (item) =>
              `(
                ${sqlLiteral(item.id)},
                ${sqlLiteral(item.prefixStart)},
                ${sqlLiteral(item.prefixEnd)},
                ${sqlLiteral(item.prefixLength)},
                ${sqlLiteral(item.carrierCode)},
                ${sqlLiteral(item.carrierName)},
                ${sqlLiteral(item.numberType)},
                ${sqlLiteral(item.supportedForRecharge)},
                ${sqlLiteral(item.note)}
              )`,
          )
          .join(',\n        ')}
      ON CONFLICT (prefix_start, prefix_end, prefix_length) DO UPDATE
      SET
        carrier_code = EXCLUDED.carrier_code,
        carrier_name = EXCLUDED.carrier_name,
        number_type = EXCLUDED.number_type,
        supported_for_recharge = EXCLUDED.supported_for_recharge,
        note = EXCLUDED.note,
        updated_at = NOW()
    `);

    await tx.unsafe(`
      INSERT INTO product.mobile_segments (
        id,
        mobile_prefix,
        province_name,
        city_name,
        isp_code,
        isp_name
      )
      VALUES
        ${seedMobileSegments
          .map(
            (item) =>
              `(
                ${sqlLiteral(item.id)},
                ${sqlLiteral(item.mobilePrefix)},
                ${sqlLiteral(item.provinceName)},
                ${sqlLiteral(item.cityName)},
                ${sqlLiteral(item.ispCode)},
                ${sqlLiteral(item.ispName)}
              )`,
          )
          .join(',\n        ')}
      ON CONFLICT (mobile_prefix) DO UPDATE
      SET
        province_name = EXCLUDED.province_name,
        city_name = EXCLUDED.city_name,
        isp_code = EXCLUDED.isp_code,
        isp_name = EXCLUDED.isp_name,
        updated_at = NOW()
    `);
  });
}
