import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const requiredHeaders = [
  'prefix',
  'sourcePrefix',
  'pref',
  'province',
  'city',
  'operator',
  'operatorCode',
  'areaCode',
  'postalCode',
  'adminCode',
];

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const hit = process.argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function parseCsv(content) {
  const rows = [];
  let currentField = '';
  let currentRow = [];
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

  const [headerRow, ...dataRows] = rows.filter(row => row.some(cell => cell.trim() !== ''));

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map(item => item.trim());

  return dataRows.map(row =>
    Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? '').trim()])),
  );
}

function ensureHeaders(rows) {
  const headers = Object.keys(rows[0] ?? {});

  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Source CSV is missing required header: ${header}`);
    }
  }
}

function escapeCsvField(value) {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function stringifyCsv(rows, headers) {
  const headerLine = headers.join(',');
  const lines = rows.map(row => headers.map(header => escapeCsvField(String(row[header] ?? ''))).join(','));
  return [headerLine, ...lines].join('\n');
}

function normalizeCarrier(row) {
  const rawOperator = row.operator.trim();
  const rawCode = row.operatorCode.trim();

  if (rawOperator.includes('虚拟')) {
    return { isp_code: 'MVNO', isp_name: '移动转售' };
  }

  if (rawOperator.includes('卫星') || rawCode === '5') {
    return { isp_code: 'CTCC_SAT', isp_name: '中国电信天通卫星' };
  }

  switch (rawCode) {
    case '1':
      return { isp_code: 'CMCC', isp_name: '中国移动' };
    case '2':
      return { isp_code: 'CUCC', isp_name: '中国联通' };
    case '3':
      return { isp_code: 'CTCC', isp_name: '中国电信' };
    case '4':
      return { isp_code: 'CBN', isp_name: '中国广电' };
    default:
      return null;
  }
}

function toImportRow(row) {
  if (!/^\d{7}$/.test(row.prefix.trim())) {
    return null;
  }

  const carrier = normalizeCarrier(row);
  if (!carrier) {
    return null;
  }

  return {
    mobile_prefix: row.prefix.trim(),
    province_name: row.province.trim(),
    city_name: row.city.trim(),
    isp_code: carrier.isp_code,
    isp_name: carrier.isp_name,
  };
}

async function main() {
  const sourceFile = getArg('source', 'C:/Users/nianx/chongzhi-ops/data/mobile-prefixes.source.csv');
  const outputDir = getArg('out-dir', resolve(process.cwd(), 'backend-mobile-segments', 'output'));

  const sourcePath = resolve(sourceFile);
  const raw = await readFile(sourcePath, 'utf8');
  const parsedRows = parseCsv(raw);

  if (!parsedRows.length) {
    throw new Error('Source CSV is empty.');
  }

  ensureHeaders(parsedRows);

  const byPrefix = new Map();
  let skippedInvalidRows = 0;

  for (const row of parsedRows) {
    if (!/^\d{7}$/.test(row.prefix.trim())) {
      skippedInvalidRows += 1;
      continue;
    }

    const current = byPrefix.get(row.prefix) || [];
    current.push(row);
    byPrefix.set(row.prefix, current);
  }

  const importRows = [];
  const conflictRows = [];
  const carrierDistribution = new Map();

  for (const [prefix, rows] of byPrefix.entries()) {
    const baseRow = rows.find(row => row.sourcePrefix.trim() === prefix) ?? rows[0];
    const normalizedBase = toImportRow(baseRow);

    if (!normalizedBase) {
      skippedInvalidRows += rows.length;
      continue;
    }

    const signatures = new Map();

    for (const row of rows) {
      const normalized =
        toImportRow(row) || {
          mobile_prefix: row.prefix.trim(),
          province_name: row.province.trim(),
          city_name: row.city.trim(),
          isp_code: '',
          isp_name: '',
        };

      const signature = [
        normalized.province_name,
        normalized.city_name,
        normalized.isp_code,
        normalized.isp_name,
        row.operator.trim(),
        row.operatorCode.trim(),
      ].join('|');

      signatures.set(signature, { row, normalized });
    }

    if (signatures.size > 1) {
      for (const { row, normalized } of signatures.values()) {
        conflictRows.push({
          ...normalized,
          source_prefix: row.sourcePrefix.trim(),
          operator_raw: row.operator.trim(),
          operator_code_raw: row.operatorCode.trim(),
          reason:
            row.sourcePrefix.trim() === prefix
              ? 'base_row_selected_for_import'
              : 'same_7_digit_prefix_has_multiple_location_variants',
        });
      }
    }

    importRows.push(normalizedBase);
    carrierDistribution.set(
      normalizedBase.isp_code,
      (carrierDistribution.get(normalizedBase.isp_code) ?? 0) + 1,
    );
  }

  importRows.sort((a, b) => a.mobile_prefix.localeCompare(b.mobile_prefix));
  conflictRows.sort((a, b) => {
    const prefixCompare = a.mobile_prefix.localeCompare(b.mobile_prefix);
    return prefixCompare || a.source_prefix.localeCompare(b.source_prefix);
  });

  const summary = {
    sourceFile: sourcePath,
    totalRows: parsedRows.length,
    uniquePrefixes: byPrefix.size,
    importableRows: importRows.length,
    conflictPrefixCount: new Set(conflictRows.map(row => row.mobile_prefix)).size,
    conflictRowCount: conflictRows.length,
    skippedInvalidRows,
    carrierDistribution: Object.fromEntries(
      [...carrierDistribution.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
  };

  await mkdir(outputDir, { recursive: true });

  const importCsv = stringifyCsv(importRows, [
    'mobile_prefix',
    'province_name',
    'city_name',
    'isp_code',
    'isp_name',
  ]);
  const conflictCsv = stringifyCsv(conflictRows, [
    'mobile_prefix',
    'province_name',
    'city_name',
    'isp_code',
    'isp_name',
    'source_prefix',
    'operator_raw',
    'operator_code_raw',
    'reason',
  ]);

  await writeFile(resolve(outputDir, 'mobile_segments.import.csv'), `${importCsv}\n`, 'utf8');
  await writeFile(resolve(outputDir, 'mobile_segments.conflicts.csv'), `${conflictCsv}\n`, 'utf8');
  await writeFile(
    resolve(outputDir, 'mobile_segments.import.summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
