export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractListData(value: unknown): Api.Admin.RawList {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const candidates = ['records', 'items', 'list', 'rows', 'content', 'data'];

  for (const key of candidates) {
    const current = value[key];

    if (Array.isArray(current)) {
      return current.filter(isRecord);
    }
  }

  return [];
}

export function extractPagedData(value: unknown): Api.Admin.PagedResponse<Api.Admin.RawRecord> {
  if (Array.isArray(value)) {
    const records = value.filter(isRecord);

    return {
      records,
      pageNum: 1,
      pageSize: records.length || 20,
      total: records.length,
      totalPages: records.length ? 1 : 0
    };
  }

  if (!isRecord(value)) {
    return {
      records: [],
      pageNum: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    };
  }

  const nestedCandidates = ['data', 'result', 'payload', 'content'];

  for (const key of nestedCandidates) {
    const current: unknown = value[key];

    if (current !== undefined && current !== null && current !== value) {
      const nested = extractPagedData(current);

      if (nested.records.length || isRecord(current)) {
        return nested;
      }
    }
  }

  const records = Array.isArray(value.records) ? value.records.filter(isRecord) : extractListData(value);
  const pageNum = Number(value.pageNum ?? value.current ?? 1) || 1;
  const pageSize = Number(value.pageSize ?? value.size ?? records.length ?? 20) || 20;
  const total = Number(value.total ?? records.length) || 0;
  const totalPages = Number(value.totalPages ?? (pageSize > 0 ? Math.ceil(total / pageSize) : 0)) || 0;

  return {
    records,
    pageNum,
    pageSize,
    total,
    totalPages
  };
}

export function extractObjectData(value: unknown): Api.Admin.RawRecord {
  if (!isRecord(value)) {
    return {};
  }

  const candidates = ['data', 'detail', 'item', 'content'];

  for (const key of candidates) {
    const current = value[key];

    if (isRecord(current)) {
      return current;
    }
  }

  return value;
}

export function pickValue(record: Api.Admin.RawRecord, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && value !== '') {
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
  }

  return fallback;
}

export function pickNumber(record: Api.Admin.RawRecord, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key];
    const num = Number(value);

    if (!Number.isNaN(num)) {
      return num;
    }
  }

  return fallback;
}

export function toBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'y', 'active', 'enabled', 'supported'].includes(normalized);
  }

  return false;
}

export function formatAmountFen(value: unknown, fallback = '-') {
  const amount = Number(value);

  if (Number.isNaN(amount)) {
    return fallback;
  }

  return `CNY ${(amount / 100).toFixed(2)} (${amount} fen)`;
}

export function formatBooleanLabel(value: unknown, positive = '是', negative = '否') {
  return toBoolean(value) ? positive : negative;
}

export function getEntityId(record: Api.Admin.RawRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }

  return '';
}

export function getKeywordFilter<T extends Api.Admin.RawRecord>(rows: T[], keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return rows;
  }

  return rows.filter(row => JSON.stringify(row).toLowerCase().includes(normalizedKeyword));
}

export function toPrettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export function normalizeQuery<T extends Record<string, any>>(query: T) {
  const entries = Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '');

  return Object.fromEntries(entries) as Partial<T>;
}

export function getDateTimeRange(range: [number, number] | null) {
  if (!range?.length) {
    return {};
  }

  const [start, end] = range;

  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString()
  };
}

function escapeExcelCell(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function downloadExcelTable(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const headerHtml = headers.map(header => `<th>${escapeExcelCell(header)}</th>`).join('');
  const rowHtml = rows.map(row => `<tr>${row.map(cell => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`).join('');

  const html = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">',
    '<head><meta charset="UTF-8"></head>',
    '<body>',
    `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowHtml}</tbody></table>`,
    '</body>',
    '</html>'
  ].join('');

  const blob = new Blob([`\uFEFF${html}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
