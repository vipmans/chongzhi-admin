<script setup lang="ts">
import { computed, h, nextTick, onMounted, reactive, ref } from 'vue';
import { NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import {
  createMobileSegment,
  deleteMobileSegment,
  executeMobileSegmentImport,
  fetchMobileSegmentChangeLogs,
  fetchMobileSegmentDetail,
  fetchMobileSegmentExport,
  fetchMobileSegmentImportDetail,
  fetchMobileSegmentImportDiff,
  fetchMobileSegmentImportErrors,
  fetchMobileSegmentImportTemplate,
  fetchMobileSegmentImports,
  fetchMobileSegmentValidationIssues,
  fetchMobileSegmentValidationSummary,
  fetchMobileSegments,
  previewMobileSegmentImport,
  updateMobileSegment,
  updateMobileSegmentStatus
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  extractPagedData,
  getDateTimeRange,
  getEntityId,
  normalizeQuery,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

type SegmentFormMode = 'create' | 'edit';

const loading = ref(false);
const importLoading = ref(false);
const summaryLoading = ref(false);
const issueLoading = ref(false);
const saving = ref(false);
const previewing = ref(false);
const executingImport = ref(false);
const changeLogLoading = ref(false);
const importErrorLoading = ref(false);

const rows = ref<Api.Admin.RawRecord[]>([]);
const importRows = ref<Api.Admin.RawRecord[]>([]);
const issueRows = ref<Api.Admin.RawRecord[]>([]);
const validationSummary = ref<Api.Admin.RawRecord>({});
const changeLogRows = ref<Api.Admin.RawRecord[]>([]);
const importErrorRows = ref<Api.Admin.RawRecord[]>([]);

const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const importTotal = ref(0);
const importPageNum = ref(1);
const importPageSize = ref(10);
const issueTotal = ref(0);
const issuePageNum = ref(1);
const issuePageSize = ref(10);
const changeLogTotal = ref(0);
const changeLogPageNum = ref(1);
const changeLogPageSize = ref(10);

const segmentTimeRange = ref<[number, number] | null>(null);
const importTimeRange = ref<[number, number] | null>(null);

const formVisible = ref(false);
const formMode = ref<SegmentFormMode>('create');
const formRef = ref<FormInst | null>(null);

const importVisible = ref(false);
const importFormRef = ref<FormInst | null>(null);
const importFileInputRef = ref<HTMLInputElement | null>(null);
const previewResult = ref<Api.Admin.RawRecord>({});

const changeLogVisible = ref(false);
const changeLogPrefix = ref('');

const importErrorsVisible = ref(false);
const importErrorsBatchNo = ref('');

const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const segmentQueryModel = reactive<Api.Admin.MobileSegmentListQuery>({
  keyword: '',
  mobilePrefix: '',
  provinceName: '',
  cityName: '',
  ispCode: '',
  ispName: '',
  status: '',
  sourceName: ''
});

const importQueryModel = reactive<Api.Admin.MobileSegmentImportListQuery>({
  batchNo: '',
  sourceName: '',
  sourceVersion: '',
  importMode: '',
  status: '',
  operatorUsername: ''
});

const issueQueryModel = reactive<Api.Admin.MobileSegmentValidationIssueListQuery>({
  issueType: ''
});

const formModel = reactive<Api.Admin.SaveMobileSegmentPayload>({
  mobilePrefix: '',
  provinceName: '',
  cityName: '',
  ispCode: 'CMCC',
  ispName: '中国移动',
  status: 'ACTIVE',
  sourceName: 'MANUAL',
  sourceVersion: '',
  remark: ''
});

const importForm = reactive<Api.Admin.PreviewMobileSegmentImportPayload>({
  content: '',
  fileName: '',
  importMode: 'INCREMENTAL',
  deleteMissing: false,
  sourceName: '',
  sourceVersion: '',
  remark: ''
});

const carrierLabelMap: Record<string, string> = {
  CMCC: '中国移动',
  CUCC: '中国联通',
  CTCC: '中国电信',
  CBN: '中国广电',
  MVNO: '移动转售',
  CTCC_SAT: '天通卫星'
};

const carrierOptions = Object.entries(carrierLabelMap).map(([value, label]) => ({ label: `${label} (${value})`, value }));
const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];
const importModeOptions = [
  { label: '全部模式', value: '' },
  { label: 'INCREMENTAL', value: 'INCREMENTAL' },
  { label: 'FULL', value: 'FULL' }
];
const importModeFormOptions = importModeOptions.filter(item => item.value);
const issueTypeOptions = [
  { label: '全部问题类型', value: '' },
  { label: 'INVALID_PREFIX', value: 'INVALID_PREFIX' },
  { label: 'DUPLICATE_PREFIX', value: 'DUPLICATE_PREFIX' },
  { label: 'MISSING_PROVINCE', value: 'MISSING_PROVINCE' },
  { label: 'MISSING_CARRIER', value: 'MISSING_CARRIER' },
  { label: 'INACTIVE_HIT', value: 'INACTIVE_HIT' },
  { label: 'PREVIEW_MISS', value: 'PREVIEW_MISS' }
];

const previewBatch = computed(() => extractObjectData(previewResult.value.batch));
const previewSummary = computed(() => extractObjectData(previewResult.value.summary));
const previewErrors = computed(() => extractListData(previewResult.value.errors));

const summaryCards = computed(() => [
  { label: '非法号段', value: pickValue(validationSummary.value, ['invalidPrefixCount'], '0') },
  { label: '重复号段', value: pickValue(validationSummary.value, ['duplicatePrefixCount'], '0') },
  { label: '缺省份', value: pickValue(validationSummary.value, ['missingProvinceCount'], '0') },
  { label: '缺运营商', value: pickValue(validationSummary.value, ['missingCarrierCount'], '0') },
  { label: '停用仍命中', value: pickValue(validationSummary.value, ['inactiveHitCount'], '0') },
  { label: '24h 预览未命中', value: pickValue(validationSummary.value, ['previewMissLast24hCount'], '0') },
  { label: '7d 高频失败号段', value: pickValue(validationSummary.value, ['topFailedPrefixCount'], '0') }
]);

const segmentRules: Record<string, App.Global.FormRule[]> = {
  mobilePrefix: [
    { required: true, message: '请输入 7 位手机号前缀', trigger: 'blur' },
    { pattern: /^\d{7}$/, message: '手机号前缀必须是 7 位数字', trigger: 'blur' }
  ],
  provinceName: [{ required: true, message: '请输入省份', trigger: 'blur' }],
  ispCode: [{ required: true, message: '请选择运营商编码', trigger: 'change' }],
  ispName: [{ required: true, message: '请输入运营商名称', trigger: 'blur' }]
};

const importRules: Record<string, App.Global.FormRule[]> = {
  fileName: [{ required: true, message: '请选择 CSV 文件', trigger: 'blur' }],
  content: [{ required: true, message: '请导入 CSV 内容', trigger: 'blur' }],
  sourceName: [{ required: true, message: '请输入来源名称', trigger: 'blur' }],
  sourceVersion: [{ required: true, message: '请输入来源版本', trigger: 'blur' }]
};

function getStatusType(status: string) {
  if (status === 'ACTIVE' || status === 'SUCCESS') return 'success';
  if (status === 'INACTIVE' || status === 'FAILED') return 'warning';
  if (status === 'ERROR') return 'error';
  return 'default';
}

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function syncCarrierNameByCode() {
  formModel.ispName = carrierLabelMap[formModel.ispCode] || formModel.ispName;
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resetFormModel() {
  formModel.mobilePrefix = '';
  formModel.provinceName = '';
  formModel.cityName = '';
  formModel.ispCode = 'CMCC';
  formModel.ispName = '中国移动';
  formModel.status = 'ACTIVE';
  formModel.sourceName = 'MANUAL';
  formModel.sourceVersion = '';
  formModel.remark = '';
}

function fillFormModel(record: Api.Admin.RawRecord) {
  formModel.mobilePrefix = pickValue(record, ['mobilePrefix'], '');
  formModel.provinceName = pickValue(record, ['provinceName'], '');
  formModel.cityName = pickValue(record, ['cityName'], '');
  formModel.ispCode = pickValue(record, ['ispCode'], 'CMCC');
  formModel.ispName = pickValue(record, ['ispName'], carrierLabelMap[formModel.ispCode] || '');
  formModel.status = pickValue(record, ['status'], 'ACTIVE');
  formModel.sourceName = pickValue(record, ['sourceName'], '');
  formModel.sourceVersion = pickValue(record, ['sourceVersion'], '');
  formModel.remark = pickValue(record, ['remark'], '');
}

async function loadSegments() {
  loading.value = true;

  try {
    const data = await fetchMobileSegments(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        ...segmentQueryModel,
        ...getDateTimeRange(segmentTimeRange.value)
      })
    );

    const pageData = extractPagedData(data);
    rows.value = pageData.records;
    total.value = pageData.total;
    pageNum.value = pageData.pageNum;
    pageSize.value = pageData.pageSize;
  } finally {
    loading.value = false;
  }
}

async function loadImportRows() {
  importLoading.value = true;

  try {
    const data = await fetchMobileSegmentImports(
      normalizeQuery({
        pageNum: importPageNum.value,
        pageSize: importPageSize.value,
        ...importQueryModel,
        ...getDateTimeRange(importTimeRange.value)
      })
    );

    const pageData = extractPagedData(data);
    importRows.value = pageData.records;
    importTotal.value = pageData.total;
    importPageNum.value = pageData.pageNum;
    importPageSize.value = pageData.pageSize;
  } finally {
    importLoading.value = false;
  }
}

async function loadValidationSummary() {
  summaryLoading.value = true;

  try {
    const data = await fetchMobileSegmentValidationSummary();
    validationSummary.value = extractObjectData(data);
  } finally {
    summaryLoading.value = false;
  }
}

async function loadIssueRows() {
  issueLoading.value = true;

  try {
    const data = await fetchMobileSegmentValidationIssues(
      normalizeQuery({
        pageNum: issuePageNum.value,
        pageSize: issuePageSize.value,
        ...issueQueryModel
      })
    );

    const pageData = extractPagedData(data);
    issueRows.value = pageData.records;
    issueTotal.value = pageData.total;
    issuePageNum.value = pageData.pageNum;
    issuePageSize.value = pageData.pageSize;
  } finally {
    issueLoading.value = false;
  }
}

async function loadChangeLogs() {
  if (!changeLogPrefix.value) return;

  changeLogLoading.value = true;

  try {
    const data = await fetchMobileSegmentChangeLogs(changeLogPrefix.value, {
      pageNum: changeLogPageNum.value,
      pageSize: changeLogPageSize.value
    });

    const pageData = extractPagedData(data);
    changeLogRows.value = pageData.records;
    changeLogTotal.value = pageData.total;
    changeLogPageNum.value = pageData.pageNum;
    changeLogPageSize.value = pageData.pageSize;
  } finally {
    changeLogLoading.value = false;
  }
}

async function handleSegmentSearch() {
  pageNum.value = 1;
  await loadSegments();
}

async function handleSegmentReset() {
  segmentQueryModel.keyword = '';
  segmentQueryModel.mobilePrefix = '';
  segmentQueryModel.provinceName = '';
  segmentQueryModel.cityName = '';
  segmentQueryModel.ispCode = '';
  segmentQueryModel.ispName = '';
  segmentQueryModel.status = '';
  segmentQueryModel.sourceName = '';
  segmentTimeRange.value = null;
  pageNum.value = 1;
  await loadSegments();
}

async function handleImportSearch() {
  importPageNum.value = 1;
  await loadImportRows();
}

async function handleImportReset() {
  importQueryModel.batchNo = '';
  importQueryModel.sourceName = '';
  importQueryModel.sourceVersion = '';
  importQueryModel.importMode = '';
  importQueryModel.status = '';
  importQueryModel.operatorUsername = '';
  importTimeRange.value = null;
  importPageNum.value = 1;
  await loadImportRows();
}

async function handleIssueSearch() {
  issuePageNum.value = 1;
  await loadIssueRows();
}

async function handleIssueReset() {
  issueQueryModel.issueType = '';
  issuePageNum.value = 1;
  await loadIssueRows();
}

async function openCreateModal() {
  formMode.value = 'create';
  resetFormModel();
  formVisible.value = true;
  await nextTick();
  formRef.value?.restoreValidation?.();
}

async function openEditModal(mobilePrefix: string) {
  formMode.value = 'edit';
  const data = await fetchMobileSegmentDetail(mobilePrefix);
  fillFormModel(extractObjectData(data));
  formVisible.value = true;
  await nextTick();
  formRef.value?.restoreValidation?.();
}

async function handleSaveSegment() {
  syncCarrierNameByCode();
  await formRef.value?.validate();
  saving.value = true;

  try {
    const payload: Api.Admin.SaveMobileSegmentPayload = {
      mobilePrefix: formModel.mobilePrefix.trim(),
      provinceName: formModel.provinceName.trim(),
      cityName: formModel.cityName?.trim() || undefined,
      ispCode: formModel.ispCode,
      ispName: formModel.ispName.trim(),
      status: formModel.status || undefined,
      sourceName: formModel.sourceName?.trim() || undefined,
      sourceVersion: formModel.sourceVersion?.trim() || undefined,
      remark: formModel.remark?.trim() || undefined
    };

    if (formMode.value === 'create') {
      await createMobileSegment(payload);
      window.$message?.success('号段创建成功');
    } else {
      await updateMobileSegment(formModel.mobilePrefix, payload);
      window.$message?.success('号段更新成功');
    }

    formVisible.value = false;
    await Promise.all([loadSegments(), loadValidationSummary(), loadIssueRows()]);
  } finally {
    saving.value = false;
  }
}

async function handleToggleStatus(row: Api.Admin.RawRecord) {
  const mobilePrefix = pickValue(row, ['mobilePrefix'], '');
  const currentStatus = pickValue(row, ['status'], 'ACTIVE');
  const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

  await updateMobileSegmentStatus(mobilePrefix, {
    status: nextStatus as 'ACTIVE' | 'INACTIVE',
    remark: `manual switch to ${nextStatus}`
  });

  window.$message?.success(`号段状态已更新为 ${nextStatus}`);
  await Promise.all([loadSegments(), loadValidationSummary(), loadIssueRows()]);
}

async function handleDeleteSegment(mobilePrefix: string) {
  await deleteMobileSegment(mobilePrefix);
  window.$message?.success('号段已删除');
  await Promise.all([loadSegments(), loadValidationSummary(), loadIssueRows()]);
}

async function openChangeLogModal(mobilePrefix: string) {
  changeLogPrefix.value = mobilePrefix;
  changeLogPageNum.value = 1;
  changeLogVisible.value = true;
  await loadChangeLogs();
}

async function handleDownloadTemplate() {
  const data = extractObjectData(await fetchMobileSegmentImportTemplate());
  downloadTextFile(pickValue(data, ['fileName'], 'mobile-segments-template.csv'), pickValue(data, ['content'], ''));
}

async function handleExportSegments() {
  const data = extractObjectData(await fetchMobileSegmentExport());
  downloadTextFile(pickValue(data, ['fileName'], 'mobile-segments-export.csv'), pickValue(data, ['content'], ''));
}

async function openImportModal() {
  importForm.fileName = '';
  importForm.content = '';
  importForm.importMode = 'INCREMENTAL';
  importForm.deleteMissing = false;
  importForm.sourceName = '';
  importForm.sourceVersion = '';
  importForm.remark = '';
  previewResult.value = {};
  importVisible.value = true;
  await nextTick();
  importFormRef.value?.restoreValidation?.();
}

function handlePickImportFile() {
  importFileInputRef.value?.click();
}

async function handleImportFileChange(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];

  if (!file) {
    return;
  }

  importForm.fileName = file.name;
  importForm.content = await file.text();
  target.value = '';
}

async function handlePreviewImport() {
  await importFormRef.value?.validate();
  previewing.value = true;

  try {
    previewResult.value = extractObjectData(await previewMobileSegmentImport(importForm));
    window.$message?.success('号段导入预检完成');
    await loadImportRows();
  } finally {
    previewing.value = false;
  }
}

async function handleExecuteImport(batchId?: string) {
  const targetBatchId = batchId || getEntityId(previewBatch.value, ['id']);

  if (!targetBatchId) {
    window.$message?.warning('请先完成预检并生成导入批次');
    return;
  }

  executingImport.value = true;

  try {
    await executeMobileSegmentImport(targetBatchId);
    window.$message?.success('号段导入已执行');
    await Promise.all([loadImportRows(), loadSegments(), loadValidationSummary(), loadIssueRows()]);
  } finally {
    executingImport.value = false;
  }
}

async function openImportErrors(batchId: string, batchNo = '') {
  importErrorsBatchNo.value = batchNo || batchId;
  importErrorsVisible.value = true;
  importErrorLoading.value = true;

  try {
    const data = await fetchMobileSegmentImportErrors(batchId);
    importErrorRows.value = extractPagedData(data).records.length ? extractPagedData(data).records : extractListData(data);
  } finally {
    importErrorLoading.value = false;
  }
}

async function openImportDetail(batchId: string) {
  const data = await fetchMobileSegmentImportDetail(batchId);
  openRaw(`导入批次详情 ${batchId}`, data);
}

async function openImportDiff(batchId: string) {
  const data = await fetchMobileSegmentImportDiff(batchId);
  openRaw(`导入差异 ${batchId}`, data);
}

const segmentColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'mobilePrefix', title: '手机号前 7 位', render: row => pickValue(row, ['mobilePrefix']) },
  { key: 'provinceName', title: '省份', render: row => pickValue(row, ['provinceName']) },
  { key: 'cityName', title: '城市', render: row => pickValue(row, ['cityName']) },
  { key: 'ispCode', title: '运营商编码', render: row => pickValue(row, ['ispCode']) },
  { key: 'ispName', title: '运营商名称', render: row => pickValue(row, ['ispName']) },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      return h(NTag, { size: 'small', type: getStatusType(status) }, { default: () => status });
    }
  },
  { key: 'sourceName', title: '来源', render: row => pickValue(row, ['sourceName', 'sourceVersion']) },
  { key: 'updatedAt', title: '更新时间', render: row => pickValue(row, ['updatedAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const mobilePrefix = pickValue(row, ['mobilePrefix'], '');
      const status = pickValue(row, ['status'], 'ACTIVE');
      const actionLabel = status === 'ACTIVE' ? '停用' : '启用';

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => openEditModal(mobilePrefix) },
          { default: () => '编辑' }
        ),
        h(
          NButton,
          { size: 'small', onClick: () => openChangeLogModal(mobilePrefix) },
          { default: () => '变更记录' }
        ),
        h(
          NButton,
          { size: 'small', type: 'warning', ghost: true, onClick: () => handleToggleStatus(row) },
          { default: () => actionLabel }
        ),
        h(
          NButton,
          { size: 'small', type: 'error', ghost: true, onClick: () => handleDeleteSegment(mobilePrefix) },
          { default: () => '删除' }
        )
      ]);
    }
  }
]);

const importColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'batchNo', title: '批次号', render: row => pickValue(row, ['batchNo']) },
  { key: 'sourceName', title: '来源名称', render: row => pickValue(row, ['sourceName']) },
  { key: 'sourceVersion', title: '来源版本', render: row => pickValue(row, ['sourceVersion']) },
  { key: 'importMode', title: '导入模式', render: row => pickValue(row, ['importMode']) },
  { key: 'summary', title: '统计', render: row => `+${pickValue(row, ['insertedRows'], '0')} / ~${pickValue(row, ['updatedRows'], '0')} / -${pickValue(row, ['deletedRows'], '0')}` },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      return h(NTag, { size: 'small', type: getStatusType(status) }, { default: () => status });
    }
  },
  { key: 'operatorUsername', title: '操作人', render: row => pickValue(row, ['operatorUsername']) },
  { key: 'createdAt', title: '创建时间', render: row => pickValue(row, ['createdAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const batchId = getEntityId(row, ['id', 'batchId']);
      const batchNo = pickValue(row, ['batchNo'], batchId);

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', ghost: true, onClick: () => openImportDetail(batchId) },
          { default: () => '详情' }
        ),
        h(
          NButton,
          { size: 'small', onClick: () => openImportErrors(batchId, batchNo) },
          { default: () => '错误明细' }
        ),
        h(
          NButton,
          { size: 'small', onClick: () => openImportDiff(batchId) },
          { default: () => '导入差异' }
        ),
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => handleExecuteImport(batchId) },
          { default: () => '执行导入' }
        )
      ]);
    }
  }
]);

const issueColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'mobilePrefix', title: '手机号前 7 位', render: row => pickValue(row, ['mobilePrefix']) },
  { key: 'issueType', title: '问题类型', render: row => pickValue(row, ['issueType']) },
  { key: 'issueMessage', title: '问题说明', render: row => pickValue(row, ['issueMessage']) },
  { key: 'lastFailedAt', title: '最近失败时间', render: row => pickValue(row, ['lastFailedAt']) },
  { key: 'failedCount', title: '失败次数', render: row => pickValue(row, ['failedCount'], '0') },
  { key: 'suggestedAction', title: '建议处理', render: row => pickValue(row, ['suggestedAction']) },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const mobilePrefix = pickValue(row, ['mobilePrefix'], '');
      return h(
        NButton,
        { size: 'small', type: 'primary', ghost: true, onClick: () => openEditModal(mobilePrefix) },
        { default: () => '去处理' }
      );
    }
  }
]);

const changeLogColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'changeType', title: '变更类型', render: row => pickValue(row, ['changeType']) },
  { key: 'sourceType', title: '来源类型', render: row => pickValue(row, ['sourceType']) },
  { key: 'operatorUsername', title: '操作人', render: row => pickValue(row, ['operatorUsername']) },
  { key: 'createdAt', title: '变更时间', render: row => pickValue(row, ['createdAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw(`号段变更 ${pickValue(row, ['id'])}`, row)
        },
        { default: () => '查看详情' }
      )
  }
]);

const importErrorColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'rowNo', title: '行号', render: row => pickValue(row, ['rowNo', 'lineNo']) },
  { key: 'mobilePrefix', title: '手机号前 7 位', render: row => pickValue(row, ['mobilePrefix']) },
  { key: 'errorType', title: '错误类型', render: row => pickValue(row, ['errorType']) },
  { key: 'errorMessage', title: '错误说明', render: row => pickValue(row, ['errorMessage', 'message']) }
]);

onMounted(async () => {
  await Promise.all([loadSegments(), loadImportRows(), loadValidationSummary(), loadIssueRows()]);
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      号段管理已按新接口接入，支持号段增删改查、CSV 导入预检与执行、导入记录追踪，以及号段异常校验。这里的数据会直接影响充值预览、商品匹配和供应商路由。
    </NAlert>

    <NTabs type="line" animated>
      <NTabPane name="segments" tab="号段列表">
        <NCard :bordered="false" class="card-wrapper">
          <div class="flex flex-col gap-12px">
            <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
              <NGi>
                <NInput v-model:value="segmentQueryModel.keyword" clearable placeholder="通用关键词" />
              </NGi>
              <NGi>
                <NInput v-model:value="segmentQueryModel.mobilePrefix" clearable placeholder="手机号前 7 位" />
              </NGi>
              <NGi>
                <NInput v-model:value="segmentQueryModel.provinceName" clearable placeholder="省份" />
              </NGi>
              <NGi>
                <NInput v-model:value="segmentQueryModel.cityName" clearable placeholder="城市" />
              </NGi>
              <NGi>
                <NSelect v-model:value="segmentQueryModel.ispCode" :options="[{ label: '全部运营商', value: '' }, ...carrierOptions]" clearable />
              </NGi>
              <NGi>
                <NInput v-model:value="segmentQueryModel.ispName" clearable placeholder="运营商名称" />
              </NGi>
              <NGi>
                <NSelect v-model:value="segmentQueryModel.status" :options="statusOptions" />
              </NGi>
              <NGi>
                <NInput v-model:value="segmentQueryModel.sourceName" clearable placeholder="来源名称" />
              </NGi>
              <NGi span="1 s:2 m:4">
                <NDatePicker v-model:value="segmentTimeRange" type="datetimerange" clearable class="w-full" />
              </NGi>
            </NGrid>

            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleSegmentReset">重置</NButton>
              <NButton @click="handleSegmentSearch">查询</NButton>
              <NButton @click="handleDownloadTemplate">下载模板</NButton>
              <NButton @click="handleExportSegments">导出结果</NButton>
              <NButton type="primary" @click="openImportModal">批量导入</NButton>
              <NButton type="primary" ghost @click="openCreateModal">新增号段</NButton>
            </div>
          </div>
        </NCard>

        <NCard title="手机号号段列表" :bordered="false" class="card-wrapper">
          <NDataTable
            :columns="segmentColumns"
            :data="rows"
            :loading="loading"
            remote
            :row-key="row => getEntityId(row, ['mobilePrefix', 'id'])"
          />
          <div class="mt-16px flex justify-end">
            <NPagination
              :page="pageNum"
              :page-size="pageSize"
              :item-count="total"
              show-size-picker
              :page-sizes="[10, 20, 50, 100]"
              @update:page="
                value => {
                  pageNum = value;
                  loadSegments();
                }
              "
              @update:page-size="
                value => {
                  pageSize = value;
                  pageNum = 1;
                  loadSegments();
                }
              "
            />
          </div>
        </NCard>
      </NTabPane>

      <NTabPane name="imports" tab="导入记录">
        <NCard :bordered="false" class="card-wrapper">
          <div class="flex flex-col gap-12px">
            <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
              <NGi>
                <NInput v-model:value="importQueryModel.batchNo" clearable placeholder="批次号" />
              </NGi>
              <NGi>
                <NInput v-model:value="importQueryModel.sourceName" clearable placeholder="来源名称" />
              </NGi>
              <NGi>
                <NInput v-model:value="importQueryModel.sourceVersion" clearable placeholder="来源版本" />
              </NGi>
              <NGi>
                <NSelect v-model:value="importQueryModel.importMode" :options="importModeOptions" />
              </NGi>
              <NGi>
                <NInput v-model:value="importQueryModel.status" clearable placeholder="状态" />
              </NGi>
              <NGi>
                <NInput v-model:value="importQueryModel.operatorUsername" clearable placeholder="操作人" />
              </NGi>
              <NGi span="1 s:2 m:4">
                <NDatePicker v-model:value="importTimeRange" type="datetimerange" clearable class="w-full" />
              </NGi>
            </NGrid>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleImportReset">重置</NButton>
              <NButton type="primary" @click="handleImportSearch">查询</NButton>
            </div>
          </div>
        </NCard>

        <NCard title="导入批次记录" :bordered="false" class="card-wrapper">
          <NDataTable
            :columns="importColumns"
            :data="importRows"
            :loading="importLoading"
            remote
            :row-key="row => getEntityId(row, ['id', 'batchNo'])"
          />
          <div class="mt-16px flex justify-end">
            <NPagination
              :page="importPageNum"
              :page-size="importPageSize"
              :item-count="importTotal"
              show-size-picker
              :page-sizes="[10, 20, 50, 100]"
              @update:page="
                value => {
                  importPageNum = value;
                  loadImportRows();
                }
              "
              @update:page-size="
                value => {
                  importPageSize = value;
                  importPageNum = 1;
                  loadImportRows();
                }
              "
            />
          </div>
        </NCard>
      </NTabPane>

      <NTabPane name="validation" tab="异常校验">
        <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi v-for="item in summaryCards" :key="item.label">
            <NCard :bordered="false" class="card-wrapper" :loading="summaryLoading">
              <div class="text-13px text-#64748b">{{ item.label }}</div>
              <div class="mt-8px text-28px text-#0f172a font-700">{{ item.value }}</div>
            </NCard>
          </NGi>
        </NGrid>

        <NCard :bordered="false" class="card-wrapper">
          <div class="flex flex-col gap-12px">
            <NSpace wrap>
              <NSelect v-model:value="issueQueryModel.issueType" :options="issueTypeOptions" class="min-w-220px" />
            </NSpace>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton
                @click="
                  async () => {
                    await loadValidationSummary();
                    await handleIssueReset();
                  }
                "
              >
                重新校验
              </NButton>
              <NButton type="primary" @click="handleIssueSearch">查询问题</NButton>
            </div>
          </div>
        </NCard>

        <NCard title="异常问题明细" :bordered="false" class="card-wrapper">
          <NDataTable
            :columns="issueColumns"
            :data="issueRows"
            :loading="issueLoading"
            remote
            :row-key="row => `${pickValue(row, ['mobilePrefix'])}-${pickValue(row, ['issueType'])}`"
          />
          <div class="mt-16px flex justify-end">
            <NPagination
              :page="issuePageNum"
              :page-size="issuePageSize"
              :item-count="issueTotal"
              show-size-picker
              :page-sizes="[10, 20, 50, 100]"
              @update:page="
                value => {
                  issuePageNum = value;
                  loadIssueRows();
                }
              "
              @update:page-size="
                value => {
                  issuePageSize = value;
                  issuePageNum = 1;
                  loadIssueRows();
                }
              "
            />
          </div>
        </NCard>
      </NTabPane>
    </NTabs>

    <NModal v-model:show="formVisible" preset="card" :title="formMode === 'create' ? '新增号段' : '编辑号段'" class="w-720px">
      <NForm ref="formRef" :model="formModel" :rules="segmentRules" label-placement="left" label-width="108">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="12">
          <NGi>
            <NFormItem label="手机号前 7 位" path="mobilePrefix">
              <NInput v-model:value="formModel.mobilePrefix" :disabled="formMode === 'edit'" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="省份" path="provinceName">
              <NInput v-model:value="formModel.provinceName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="城市">
              <NInput v-model:value="formModel.cityName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="运营商编码" path="ispCode">
              <NSelect
                v-model:value="formModel.ispCode"
                :options="carrierOptions"
                @update:value="
                  value => {
                    formModel.ispCode = value || 'CMCC';
                    syncCarrierNameByCode();
                  }
                "
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="运营商名称" path="ispName">
              <NInput v-model:value="formModel.ispName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NSelect v-model:value="formModel.status" :options="statusOptions.filter(item => item.value)" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="来源名称">
              <NInput v-model:value="formModel.sourceName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="来源版本">
              <NInput v-model:value="formModel.sourceVersion" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="备注">
          <NInput v-model:value="formModel.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <div class="mt-16px flex justify-end gap-12px">
        <NButton @click="formVisible = false">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSaveSegment">保存</NButton>
      </div>
    </NModal>

    <NModal v-model:show="importVisible" preset="card" title="号段批量导入" class="w-900px">
      <NForm ref="importFormRef" :model="importForm" :rules="importRules" label-placement="left" label-width="108">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="12">
          <NGi span="2">
            <NFormItem label="CSV 文件" path="fileName">
              <div class="flex w-full items-center gap-12px">
                <NInput v-model:value="importForm.fileName" readonly placeholder="请选择 CSV 文件" />
                <NButton @click="handlePickImportFile">选择文件</NButton>
              </div>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="导入模式">
              <NSelect v-model:value="importForm.importMode" :options="importModeFormOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="来源名称" path="sourceName">
              <NInput v-model:value="importForm.sourceName" placeholder="例如：MIIT / 内部维护" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="来源版本" path="sourceVersion">
              <NInput v-model:value="importForm.sourceVersion" placeholder="例如：2026-04" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="删除缺失">
              <NCheckbox v-model:checked="importForm.deleteMissing">本批次未出现的旧号段执行删除</NCheckbox>
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="导入备注">
          <NInput v-model:value="importForm.remark" />
        </NFormItem>
        <NFormItem label="CSV 内容" path="content">
          <NInput v-model:value="importForm.content" type="textarea" :autosize="{ minRows: 10, maxRows: 16 }" />
        </NFormItem>
      </NForm>

      <input ref="importFileInputRef" type="file" accept=".csv,text/csv" class="hidden" @change="handleImportFileChange" />

      <NAlert type="info" :show-icon="false" class="mb-16px">
        导入流程为“先预检、后执行”。预检会生成批次，并返回新增、更新、删除和错误统计；确认无误后再执行正式导入。
      </NAlert>

      <div class="flex justify-end gap-12px">
        <NButton @click="importVisible = false">关闭</NButton>
        <NButton type="primary" :loading="previewing" @click="handlePreviewImport">预检 CSV</NButton>
      </div>

      <div v-if="getEntityId(previewBatch, ['id'])" class="mt-16px">
        <NDescriptions bordered :column="2" label-placement="left">
          <NDescriptionsItem label="批次号">{{ pickValue(previewBatch, ['batchNo']) }}</NDescriptionsItem>
          <NDescriptionsItem label="状态">{{ pickValue(previewBatch, ['status']) }}</NDescriptionsItem>
          <NDescriptionsItem label="总行数">{{ pickValue(previewBatch, ['totalRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="有效行数">{{ pickValue(previewBatch, ['validRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="新增">{{ pickValue(previewBatch, ['insertedRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="更新">{{ pickValue(previewBatch, ['updatedRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="未变化">{{ pickValue(previewBatch, ['unchangedRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="待删除">{{ pickValue(previewBatch, ['deletedRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="错误数">{{ pickValue(previewBatch, ['errorRows']) }}</NDescriptionsItem>
          <NDescriptionsItem label="文件哈希">{{ pickValue(previewBatch, ['fileHash']) }}</NDescriptionsItem>
        </NDescriptions>

        <div class="mt-16px flex justify-end gap-12px">
          <NButton @click="openImportErrors(getEntityId(previewBatch, ['id']), pickValue(previewBatch, ['batchNo']))">查看错误</NButton>
          <NButton @click="openImportDiff(getEntityId(previewBatch, ['id']))">查看差异</NButton>
          <NButton type="primary" :loading="executingImport" @click="handleExecuteImport()">执行导入</NButton>
        </div>

        <NCode class="mt-16px" :code="toPrettyJson(previewSummary)" language="json" word-wrap />
      </div>
    </NModal>

    <NModal v-model:show="changeLogVisible" preset="card" :title="`变更记录 ${changeLogPrefix}`" class="w-900px">
      <NDataTable
        :columns="changeLogColumns"
        :data="changeLogRows"
        :loading="changeLogLoading"
        :row-key="row => getEntityId(row, ['id'])"
      />
      <div class="mt-16px flex justify-end">
        <NPagination
          :page="changeLogPageNum"
          :page-size="changeLogPageSize"
          :item-count="changeLogTotal"
          show-size-picker
          :page-sizes="[10, 20, 50]"
          @update:page="
            value => {
              changeLogPageNum = value;
              loadChangeLogs();
            }
          "
          @update:page-size="
            value => {
              changeLogPageSize = value;
              changeLogPageNum = 1;
              loadChangeLogs();
            }
          "
        />
      </div>
    </NModal>

    <NModal v-model:show="importErrorsVisible" preset="card" :title="`导入错误明细 ${importErrorsBatchNo}`" class="w-900px">
      <NDataTable
        :columns="importErrorColumns"
        :data="importErrorRows"
        :loading="importErrorLoading"
        :row-key="row => `${pickValue(row, ['rowNo', 'lineNo'])}-${pickValue(row, ['mobilePrefix'])}`"
      />
      <NEmpty v-if="!importErrorLoading && !importErrorRows.length" description="该批次没有错误行" />
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-960px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
