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
  if (!isRecord(value)) {
    return {
      records: [],
      pageNum: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0
    };
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
  if (isRecord(value)) {
    const candidates = ['data', 'detail', 'item', 'content'];

    for (const key of candidates) {
      const current = value[key];

      if (isRecord(current)) {
        return current;
      }
    }

    return value;
  }

  return {};
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
