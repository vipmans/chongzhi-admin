<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import {
  fetchSupplierBalance,
  fetchSupplierDetail,
  fetchSupplierReconcileDiffs,
  fetchSupplierSyncLogs,
  recoverSupplierCircuitBreaker,
  saveSupplierConfig,
  triggerSupplierCatalogSync
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  extractPagedData,
  formatAmountFen,
  getEntityId,
  normalizeQuery,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

const route = useRoute();
const supplierId = computed(() => String(route.params.id || ''));

const loading = ref(false);
const actionLoading = ref(false);
const logsLoading = ref(false);
const diffsLoading = ref(false);
const savingConfig = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});
const configFormRef = ref<FormInst | null>(null);

const supplier = ref<Api.Admin.RawRecord>({});
const balance = ref<Api.Admin.RawRecord>({});
const syncLogs = ref<Api.Admin.RawRecord[]>([]);
const reconcileRows = ref<Api.Admin.RawRecord[]>([]);
const reconcileTotal = ref(0);
const reconcilePageNum = ref(1);
const reconcilePageSize = ref(10);
const reconcileDate = ref<number | null>(null);

const queryModel = reactive({
  orderNo: ''
});

const configForm = reactive({
  credential: '',
  callbackSecret: '',
  timeoutMs: 3000,
  configJsonText: '{\n  "baseUrl": "",\n  "remark": ""\n}'
});

const configRules: Record<string, App.Global.FormRule[]> = {
  credential: [{ required: true, message: '请输入供应商凭证', trigger: 'blur' }],
  callbackSecret: [{ required: true, message: '请输入回调密钥', trigger: 'blur' }],
  configJsonText: [{ required: true, message: '请输入配置 JSON', trigger: 'blur' }]
};

const syncLogColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'status',
    title: '同步状态',
    render: row => pickValue(row, ['status', 'syncStatus', 'resultStatus'])
  },
  {
    key: 'startedAt',
    title: '开始时间',
    render: row => pickValue(row, ['startedAt', 'createdAt'])
  },
  {
    key: 'finishedAt',
    title: '结束时间',
    render: row => pickValue(row, ['finishedAt', 'updatedAt'])
  },
  {
    key: 'summary',
    title: '结果摘要',
    render: row => pickValue(row, ['summary', 'message', 'resultMessage'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw('同步日志原始数据', row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const reconcileColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'reconcileDate',
    title: '对账日期',
    render: row => pickValue(row, ['reconcileDate', 'bizDate', 'createdAt'])
  },
  {
    key: 'orderNo',
    title: '平台订单号',
    render: row => pickValue(row, ['orderNo'])
  },
  {
    key: 'supplierOrderNo',
    title: '供应商订单号',
    render: row => pickValue(row, ['supplierOrderNo'])
  },
  {
    key: 'diffField',
    title: '差异字段',
    render: row => pickValue(row, ['diffField', 'diffType', 'fieldName'])
  },
  {
    key: 'platformValue',
    title: '平台值',
    render: row => pickValue(row, ['platformValue'])
  },
  {
    key: 'supplierValue',
    title: '供应商值',
    render: row => pickValue(row, ['supplierValue'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw('对账差异原始数据', row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const balanceTagType = computed(() => {
  const status = pickValue(balance.value, ['balanceStatus', 'status'], '').toUpperCase();

  if (status.includes('LOW') || status.includes('WARN')) {
    return 'warning';
  }

  if (status.includes('FAIL') || status.includes('ERROR')) {
    return 'error';
  }

  return 'success';
});

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function normalizeReconcileRows(data: unknown) {
  const pageData = Array.isArray(data) ? extractPagedData(data) : extractPagedData(data);
  const currentSupplierCode = pickValue(supplier.value, ['supplierCode'], '');
  const filtered = pageData.records.filter(item => {
    const currentId = getEntityId(item, ['supplierId', 'id']);
    const supplierCode = pickValue(item, ['supplierCode'], '');

    if (!currentId && !supplierCode) {
      return true;
    }

    return currentId === supplierId.value || supplierCode === currentSupplierCode;
  });

  reconcileRows.value = filtered;
  reconcileTotal.value = filtered.length || pageData.total;
  reconcilePageNum.value = pageData.pageNum;
  reconcilePageSize.value = pageData.pageSize;
}

async function loadOverview() {
  loading.value = true;

  try {
    const [supplierData, balanceData] = await Promise.all([
      fetchSupplierDetail(supplierId.value),
      fetchSupplierBalance(supplierId.value)
    ]);

    supplier.value = extractObjectData(supplierData);
    balance.value = extractObjectData(balanceData);
  } finally {
    loading.value = false;
  }
}

async function loadSyncLogs() {
  logsLoading.value = true;

  try {
    const data = await fetchSupplierSyncLogs(supplierId.value);
    syncLogs.value = extractListData(data);
  } finally {
    logsLoading.value = false;
  }
}

async function loadReconcileDiffs() {
  diffsLoading.value = true;

  try {
    const data = await fetchSupplierReconcileDiffs(
      normalizeQuery({
        pageNum: reconcilePageNum.value,
        pageSize: reconcilePageSize.value,
        reconcileDate: reconcileDate.value ? new Date(reconcileDate.value).toISOString().slice(0, 10) : undefined,
        orderNo: queryModel.orderNo || undefined
      })
    );

    normalizeReconcileRows(data);
  } finally {
    diffsLoading.value = false;
  }
}

async function reloadAll() {
  await loadOverview();
  await Promise.all([loadSyncLogs(), loadReconcileDiffs()]);
}

async function handleCatalogSync() {
  actionLoading.value = true;

  try {
    await triggerSupplierCatalogSync(supplierId.value);
    window.$message?.success('已触发供应商目录同步');
    await loadSyncLogs();
  } finally {
    actionLoading.value = false;
  }
}

async function handleRecoverCircuitBreaker() {
  actionLoading.value = true;

  try {
    await recoverSupplierCircuitBreaker(supplierId.value);
    window.$message?.success('已提交熔断恢复请求');
    await loadOverview();
  } finally {
    actionLoading.value = false;
  }
}

async function handleSaveConfig() {
  await configFormRef.value?.validate();

  let configJson: Api.Admin.JsonObject;

  try {
    configJson = JSON.parse(configForm.configJsonText) as Api.Admin.JsonObject;
  } catch {
    window.$message?.error('配置 JSON 格式不正确');
    return;
  }

  savingConfig.value = true;

  try {
    await saveSupplierConfig({
      supplierId: supplierId.value,
      credential: configForm.credential.trim(),
      callbackSecret: configForm.callbackSecret.trim(),
      timeoutMs: Number(configForm.timeoutMs) || 3000,
      configJson
    });
    window.$message?.success('供应商参数已保存');
  } finally {
    savingConfig.value = false;
  }
}

async function handleDiffSearch() {
  reconcilePageNum.value = 1;
  await loadReconcileDiffs();
}

async function handleDiffReset() {
  queryModel.orderNo = '';
  reconcileDate.value = null;
  reconcilePageNum.value = 1;
  await loadReconcileDiffs();
}

async function handleDiffPageChange(page: number) {
  reconcilePageNum.value = page;
  await loadReconcileDiffs();
}

async function handleDiffPageSizeChange(size: number) {
  reconcilePageSize.value = size;
  reconcilePageNum.value = 1;
  await loadReconcileDiffs();
}

onMounted(() => {
  reloadAll();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper" :loading="loading">
      <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">
            {{ pickValue(supplier, ['supplierName', 'name'], '供应商详情') }}
          </h2>
          <span class="text-14px text-#64748b">
            供应商编码：{{ pickValue(supplier, ['supplierCode'], supplierId) }} | 协议类型：{{
              pickValue(supplier, ['protocolType'])
            }}
            | 合作状态：{{ pickValue(supplier, ['cooperationStatus', 'status']) }}
          </span>
        </div>
        <NSpace>
          <NButton @click="reloadAll">刷新</NButton>
          <NButton type="primary" :loading="actionLoading" @click="handleCatalogSync">目录同步</NButton>
          <NButton type="warning" :loading="actionLoading" @click="handleRecoverCircuitBreaker">恢复熔断</NButton>
        </NSpace>
      </div>
    </NCard>

    <NAlert type="info" :show-icon="false">
      新版接口没有单独的供应商详情编辑接口，详情页以供应商列表快照为主，配合余额、同步日志、对账差异和参数配置能力完成运营管理。
    </NAlert>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="基础信息" :bordered="false" class="card-wrapper">
          <NDescriptions bordered :column="1" label-placement="left">
            <NDescriptionsItem label="供应商 ID">{{ getEntityId(supplier, ['supplierId', 'id']) || supplierId }}</NDescriptionsItem>
            <NDescriptionsItem label="供应商编码">{{ pickValue(supplier, ['supplierCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="供应商名称">{{ pickValue(supplier, ['supplierName', 'name']) }}</NDescriptionsItem>
            <NDescriptionsItem label="协议类型">{{ pickValue(supplier, ['protocolType']) }}</NDescriptionsItem>
            <NDescriptionsItem label="合作状态">{{ pickValue(supplier, ['cooperationStatus', 'status']) }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ pickValue(supplier, ['updatedAt', 'createdAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="余额信息" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="12">
            <div class="text-28px text-#0f172a font-700">
              {{ formatAmountFen(balance.balanceAmountFen ?? balance.availableBalanceFen) }}
            </div>
            <NTag :type="balanceTagType" round>{{ pickValue(balance, ['balanceStatus', 'status'], 'UNKNOWN') }}</NTag>
            <div class="text-14px text-#64748b">币种：{{ pickValue(balance, ['currency']) }}</div>
            <div class="text-14px text-#64748b">来源：{{ pickValue(balance, ['sourceType']) }}</div>
            <div class="text-14px text-#64748b">查询时间：{{ pickValue(balance, ['queriedAt', 'updatedAt']) }}</div>
          </NSpace>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="运营提示" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="10">
            <NAlert type="warning" :show-icon="false">
              目录同步会刷新供应商商品快照与库存状态，建议在低峰期操作。
            </NAlert>
            <NAlert type="warning" :show-icon="false">
              熔断恢复会让当前供应商重新参与自动路由，请确认上游已恢复稳定。
            </NAlert>
            <NAlert type="info" :show-icon="false">
              参数配置会影响供应商凭证、超时策略和回调验签，请保存前完成联调核对。
            </NAlert>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
      <NTabPane name="config" tab="参数配置">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="供应商参数" :bordered="false" class="card-wrapper">
              <NForm
                ref="configFormRef"
                :model="configForm"
                :rules="configRules"
                label-placement="left"
                label-width="110"
              >
                <NFormItem label="供应商凭证" path="credential">
                  <NInput v-model:value="configForm.credential" placeholder="例如 token / appKey:appSecret" />
                </NFormItem>
                <NFormItem label="回调密钥" path="callbackSecret">
                  <NInput v-model:value="configForm.callbackSecret" />
                </NFormItem>
                <NFormItem label="超时毫秒">
                  <NInputNumber v-model:value="configForm.timeoutMs" :min="100" class="w-full" />
                </NFormItem>
                <NFormItem label="配置 JSON" path="configJsonText">
                  <NInput
                    v-model:value="configForm.configJsonText"
                    type="textarea"
                    :autosize="{ minRows: 10, maxRows: 18 }"
                  />
                </NFormItem>
                <NButton type="primary" :loading="savingConfig" @click="handleSaveConfig">保存配置</NButton>
              </NForm>
            </NCard>
          </NGi>
          <NGi>
            <NSpace vertical :size="16">
              <RawJsonCard title="供应商快照 JSON" :value="supplier" />
              <RawJsonCard title="余额原始 JSON" :value="balance" />
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="sync" tab="同步日志">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex justify-end">
            <NButton :loading="logsLoading" @click="loadSyncLogs">刷新日志</NButton>
          </div>
          <NDataTable
            :columns="syncLogColumns"
            :data="syncLogs"
            :loading="logsLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['id', 'syncLogId', 'createdAt'])"
          />
        </NCard>
      </NTabPane>

      <NTabPane name="reconcile" tab="对账差异">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px">
            <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
              <NGi>
                <NInput v-model:value="queryModel.orderNo" clearable placeholder="平台订单号" />
              </NGi>
              <NGi>
                <NDatePicker v-model:value="reconcileDate" type="date" clearable class="w-full" />
              </NGi>
              <NGi>
                <NAlert type="info" :show-icon="false">
                  如返回结果未带供应商标识，页面将展示接口返回的全部差异记录。
                </NAlert>
              </NGi>
            </NGrid>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleDiffReset">重置</NButton>
              <NButton type="primary" @click="handleDiffSearch">查询</NButton>
            </div>
          </div>

          <NDataTable
            :columns="reconcileColumns"
            :data="reconcileRows"
            :loading="diffsLoading"
            remote
            :row-key="row => getEntityId(row, ['id', 'orderNo', 'supplierOrderNo'])"
          />
          <div class="mt-16px flex justify-end">
            <NPagination
              :page="reconcilePageNum"
              :page-size="reconcilePageSize"
              :item-count="reconcileTotal"
              show-size-picker
              :page-sizes="[10, 20, 50]"
              @update:page="handleDiffPageChange"
              @update:page-size="handleDiffPageSizeChange"
            />
          </div>
        </NCard>
      </NTabPane>
    </NTabs>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
