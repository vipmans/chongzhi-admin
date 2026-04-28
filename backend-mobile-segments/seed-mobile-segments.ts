import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SQL } from 'bun';

type SeedMobileSegment = {
  id: string;
  mobilePrefix: string;
  provinceName: string;
  cityName: string;
  ispCode: string;
  ispName: string;
};

const seedMobileSegments: SeedMobileSegment[] = [
  {
    id: 'seed-mobile-segment-1380013',
    mobilePrefix: '1380013',
    provinceName: '广东',
    cityName: '广州',
    ispCode: 'CMCC',
    ispName: '中国移动'
  }
];

function sqlLiteral(value: string | number | boolean): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid number for SQL literal: ${value}`);
    }

    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return `'${value.replaceAll("'", "''")}'`;
}

async function loadCarrierPrefixSeedSql() {
  const filePath = resolve(process.cwd(), 'backend-mobile-segments', 'carrier_prefix_rules.sql');
  return readFile(filePath, 'utf8');
}

export async function runSeed(db: SQL): Promise<void> {
  const carrierPrefixSeedSql = await loadCarrierPrefixSeedSql();

  await db.begin(async tx => {
    await tx.unsafe(carrierPrefixSeedSql);

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
            item =>
              `(
                ${sqlLiteral(item.id)},
                ${sqlLiteral(item.mobilePrefix)},
                ${sqlLiteral(item.provinceName)},
                ${sqlLiteral(item.cityName)},
                ${sqlLiteral(item.ispCode)},
                ${sqlLiteral(item.ispName)}
              )`
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
