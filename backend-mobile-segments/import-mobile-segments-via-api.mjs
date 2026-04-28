import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const hit = process.argv.find(arg => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function getBooleanArg(name, fallback = false) {
  const value = getArg(name, '');
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase());
}

function containsNonAscii(value) {
  return /[^\x00-\x7F]/.test(value);
}

function normalizeAccessToken(rawToken) {
  const value = rawToken.trim();

  if (!value) {
    return '';
  }

  if (containsNonAscii(value)) {
    throw new Error(
      'The value passed to --token contains non-ASCII characters. Please replace the placeholder with a real backend JWT.',
    );
  }

  if (value.includes('你的后台JWT') || value.includes('your-jwt') || value.includes('example')) {
    throw new Error('The value passed to --token looks like a placeholder. Please replace it with a real backend JWT.');
  }

  return value.replace(/^Bearer\s+/i, '');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Failed to parse JSON response from ${url}: ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function login(baseUrl, username, password) {
  const result = await requestJson(`${baseUrl}/admin/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

  if (!result || String(result.code) !== '0000' || !result.data?.accessToken) {
    throw new Error(`Login failed: ${JSON.stringify(result)}`);
  }

  return result.data.accessToken;
}

function unwrapSuccess(result, actionName) {
  if (!result || String(result.code) !== '0000') {
    throw new Error(`${actionName} failed: ${JSON.stringify(result)}`);
  }

  return result.data;
}

async function main() {
  const baseUrl = getArg('base-url', 'https://admin.miigo.cn/api/v1');
  const file = getArg(
    'file',
    resolve(process.cwd(), 'backend-mobile-segments', 'output', 'mobile_segments.import.csv'),
  );
  const token = getArg('token', '');
  const username = getArg('username', '');
  const password = getArg('password', '');
  const sourceName = getArg('source-name', 'phone_location');
  const sourceVersion = getArg('source-version', '2025-03');
  const importMode = getArg('import-mode', 'FULL');
  const remark = getArg('remark', 'China mainland mobile segment import');
  const deleteMissing = getBooleanArg('delete-missing', importMode === 'FULL');
  const execute = getBooleanArg('execute', false);
  const outputFile = getArg(
    'result-file',
    resolve(process.cwd(), 'backend-mobile-segments', 'output', 'mobile_segments.api-import.result.json'),
  );

  const csvContent = await readFile(resolve(file), 'utf8');
  const accessToken =
    normalizeAccessToken(token) || (username && password ? await login(baseUrl, username, password) : '');

  if (!accessToken) {
    throw new Error('Missing authentication. Provide --token=BearerToken or --username=xxx --password=xxx.');
  }

  const previewPayload = {
    content: csvContent,
    fileName: file.split(/[\\/]/).pop() || 'mobile_segments.import.csv',
    importMode,
    deleteMissing,
    sourceName,
    sourceVersion,
    remark,
  };

  const previewResult = await requestJson(`${baseUrl}/admin/mobile-segments/imports/preview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(previewPayload),
  });
  const previewData = unwrapSuccess(previewResult, 'Preview import');

  let executeResult = null;
  const batchId =
    previewData?.batch?.batchId ||
    previewData?.batchId ||
    previewData?.id ||
    previewData?.batch?.id ||
    '';

  if (execute) {
    if (!batchId) {
      throw new Error(`Preview succeeded but batch id was not found: ${JSON.stringify(previewData)}`);
    }

    const result = await requestJson(`${baseUrl}/admin/mobile-segments/imports/${batchId}/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    executeResult = unwrapSuccess(result, 'Execute import');
  }

  const output = {
    request: {
      baseUrl,
      file: resolve(file),
      importMode,
      deleteMissing,
      sourceName,
      sourceVersion,
      execute,
    },
    preview: previewData,
    execute: executeResult,
  };

  await writeFile(outputFile, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
