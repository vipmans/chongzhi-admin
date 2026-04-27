import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { db } from '@/lib/sql';

type CsvRow = Record<string, string>;

type MobileSegmentRow = {
  mobilePrefix: string;
  provinceName: string;
  cityName: string;
  ispCode: string;
  ispName: string;
  rowHash: string;
};

const requiredHeaders = ['mobile_prefix', 'province_name', 'city_name', 'isp_code', 'isp_name'] as const;
const allowedCarrierCodes = new Set(['CMCC', 'CUCC', 'CTCC', 'CBN', 'MVNO', 'CTCC_SAT']);

function getArg(name: string, fallback = '') {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function getBooleanArg(name: string, fallback = false) {
  const value = getArg(name, '');
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
}

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let currentField = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }

      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = '';
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const [headerRow, ...dataRows] = rows.filter((row) => row.some((cell) => cell.trim() !== ''));

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map((item) => item.trim());
  return dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? '').trim()])),
  );
}

function normalizeRow(row: CsvRow): MobileSegmentRow {
  const mobilePrefix = row.mobile_prefix.trim();
  const provinceName = row.province_name.trim();
  const cityName = row.city_name.trim();
  const ispCode = row.isp_code.trim().toUpperCase();
  const ispName = row.isp_name.trim();

  if (!/^\d{7}$/.test(mobilePrefix)) {
    throw new Error(`mobile_prefix 非法，必须为 7 位数字: ${mobilePrefix}`);
  }

  if (!provinceName) {
    throw new Error(`province_name 不能为空: ${mobilePrefix}`);
  }

  if (!ispName) {
    throw new Error(`isp_name 不能为空: ${mobilePrefix}`);
  }

  if (!allowedCarrierCodes.has(ispCode)) {
    throw new Error(`isp_code 非法: ${mobilePrefix} -> ${ispCode}`);
  }

  const rowHash = createHash('sha1')
    .update([mobilePrefix, provinceName, cityName, ispCode, ispName].join('|'))
    .digest('hex');

  return {
    mobilePrefix,
    provinceName,
    cityName,
    ispCode,
    ispName,
    rowHash,
  };
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

async function main() {
  const file = getArg('file');
  const deleteMissing = getBooleanArg('delete-missing', false);

  if (!file) {
    throw new Error('缺少参数 --file=/absolute/path/mobile_segments.csv');
  }

  const filePath = resolve(file);
  const rawCsv = await readFile(filePath, 'utf8');
  const parsedRows = parseCsv(rawCsv);

  if (!parsedRows.length) {
    throw new Error('CSV 文件为空或表头不合法');
  }

  const headers = Object.keys(parsedRows[0] ?? {});
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`CSV 缺少必填列: ${header}`);
    }
  }

  const normalizedRows = parsedRows.map(normalizeRow);
  const deduped = new Map<string, MobileSegmentRow>();

  for (const row of normalizedRows) {
    if (deduped.has(row.mobilePrefix)) {
      throw new Error(`CSV 存在重复 mobile_prefix: ${row.mobilePrefix}`);
    }

    deduped.set(row.mobilePrefix, row);
  }

  const rows = Array.from(deduped.values());

  await db.begin(async (tx) => {
    await tx.unsafe(`
      CREATE TEMP TABLE tmp_mobile_segments_import (
        mobile_prefix TEXT PRIMARY KEY,
        province_name TEXT NOT NULL,
        city_name TEXT,
        isp_code TEXT NOT NULL,
        isp_name TEXT NOT NULL,
        row_hash TEXT NOT NULL
      ) ON COMMIT DROP
    `);

    for (const group of chunk(rows, 1000)) {
      await tx.unsafe(`
        INSERT INTO tmp_mobile_segments_import (
          mobile_prefix,
          province_name,
          city_name,
          isp_code,
          isp_name,
          row_hash
        )
        VALUES
          ${group
            .map(
              (row) =>
                `(
                  '${row.mobilePrefix}',
                  '${row.provinceName.replaceAll("'", "''")}',
                  '${row.cityName.replaceAll("'", "''")}',
                  '${row.ispCode}',
                  '${row.ispName.replaceAll("'", "''")}',
                  '${row.rowHash}'
                )`,
            )
            .join(',\n          ')}
      `);
    }

    const staleRows = await tx.unsafe<[{ count: number }]>(`
      SELECT COUNT(*)::int AS count
      FROM product.mobile_segments target
      LEFT JOIN tmp_mobile_segments_import source
        ON source.mobile_prefix = target.mobile_prefix
      WHERE source.mobile_prefix IS NULL
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
      SELECT
        'import-mobile-segment-' || mobile_prefix,
        mobile_prefix,
        province_name,
        city_name,
        isp_code,
        isp_name
      FROM tmp_mobile_segments_import
      ON CONFLICT (mobile_prefix) DO UPDATE
      SET
        province_name = EXCLUDED.province_name,
        city_name = EXCLUDED.city_name,
        isp_code = EXCLUDED.isp_code,
        isp_name = EXCLUDED.isp_name,
        updated_at = NOW()
    `);

    if (deleteMissing) {
      await tx.unsafe(`
        DELETE FROM product.mobile_segments target
        WHERE NOT EXISTS (
          SELECT 1
          FROM tmp_mobile_segments_import source
          WHERE source.mobile_prefix = target.mobile_prefix
        )
      `);
    }

    console.log(
      JSON.stringify(
        {
          filePath,
          totalRows: rows.length,
          stalePrefixCount: staleRows[0]?.count ?? 0,
          deleteMissing,
        },
        null,
        2,
      ),
    );
  });

  await db.close();
}

await main();
