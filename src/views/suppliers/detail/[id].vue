<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import {
  createSupplierRechargeRecord,
  fetchSupplierBalance,
  fetchSupplierConsumptionLogs,
  fetchSupplierDetail,
  fetchSupplierHealth,
  fetchSupplierProducts,
  fetchSupplierRechargeRecords,
  refreshSupplierBalance,
  updateSupplier
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  formatAmountFen,
  formatBooleanLabel,
  getDateTimeRange,
  getEntityId,
  normalizeQuery,
  pickValue,
  toBoolean,
  toPrettyJson
} from '@/utils/admin';

const route = useRoute();
const supplierId = computed(() => String(route.params.id || ''));

const loading = ref(false);
const productsLoading = ref(false);
const rechargeLoading = ref(false);
const logsLoading = ref(false);
const saving = ref(false);
const refreshingBalance = ref(false);
const createRecordVisible = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const supplier = ref<Api.Admin.RawRecord>({});
const health = ref<Api.Admin.RawRecord>({});
const balance = ref<Api.Admin.RawRecord>({});
const productRows = ref<Api.Admin.RawRecord[]>([]);
const rechargeRows = ref<Api.Admin.RawRecord[]>([]);
const consumptionRows = ref<Api.Admin.RawRecord[]>([]);

const supplierFormRef = ref<FormInst | null>(null);
const rechargeFormRef = ref<FormInst | null>(null);

const supplierForm = reactive<Api.Admin.SaveSupplierPayload>({
  supplierCode: '',
  supplierName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  baseUrl: '',
  protocolType: '',
  credentialMode: '',
  accessAccount: '',
  accessPassword: '',
  cooperationStatus: '',
  supportsBalanceQuery: false,
  supportsRechargeRecords: false,
  supportsConsumptionLog: false,
  remark: '',
  healthStatus: '',
  status: ''
});

const productQuery = reactive({
  carrierCode: '',
  province: '',
  faceValue: null as number | null,
  status: '',
  updatedRange: null as [number, number] | null
});

const logQuery = reactive({
  mobile: '',
  orderNo: '',
  supplierOrderNo: '',
  timeRange: null as [number, number] | null
});

const rechargeForm = reactive<Api.Admin.SupplierRechargeRecordPayload>({
  rechargeType: 'MANUAL',
  amountFen: 0,
  currency: 'CNY',
  beforeBalanceFen: 0,
  afterBalanceFen: 0,
  recordSource: 'MANUAL_INPUT',
  supplierTradeNo: '',
  remark: '',
  rawPayload: {},
  status: 'SUCCESS'
});

const rechargeRawPayloadText = ref('{}');

const supplierRules: Record<string, App.Global.FormRule[]> = {
  supplierName: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  protocolType: [{ required: true, message: '请输入协议类型', trigger: 'blur' }]
};

const rechargeRules: Record<string, App.Global.FormRule[]> = {
  rechargeType: [{ required: true, message: '请输入充值类型', trigger: 'blur' }],
  amountFen: [{ required: true, type: 'number', message: '请输入充值金额(分)', trigger: 'blur' }],
  recordSource: [{ required: true, message: '请输入记录来源', trigger: 'blur' }]
};

const productColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'supplierProductCode', title: '供应商产品编码', render: row => pickValue(row, ['supplierProductCode']) },
  { key: 'productName', title: '产品名称', render: row => pickValue(row, ['productName']) },
  { key: 'carrierCode', title: '运营商', render: row => pickValue(row, ['carrierCode']) },
  { key: 'province', title: '省份', render: row => pickValue(row, ['province']) },
  { key: 'faceValueFen', title: '面值', render: row => formatAmountFen(row.faceValueFen) },
  { key: 'costPriceFen', title: '成本价', render: row => formatAmountFen(row.costPriceFen) },
  { key: 'saleStatus', title: '销售状态', render: row => pickValue(row, ['saleStatus']) },
  { key: 'stockStatus', title: '库存状态', render: row => pickValue(row, ['stockStatus']) },
  { key: 'arrivalSla', title: '到账时效', render: row => pickValue(row, ['arrivalSla']) },
  { key: 'updatedAt', title: '更新时间', render: row => pickValue(row, ['updatedAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw('产品快照原始数据', row.rawPayload ?? row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const rechargeColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'rechargeType', title: '充值类型', render: row => pickValue(row, ['rechargeType']) },
  { key: 'amountFen', title: '充值金额', render: row => formatAmountFen(row.amountFen) },
  { key: 'beforeBalanceFen', title: '充值前余额', render: row => formatAmountFen(row.beforeBalanceFen) },
  { key: 'afterBalanceFen', title: '充值后余额', render: row => formatAmountFen(row.afterBalanceFen) },
  { key: 'recordSource', title: '来源', render: row => pickValue(row, ['recordSource']) },
  { key: 'status', title: '状态', render: row => pickValue(row, ['status']) },
  { key: 'supplierTradeNo', title: '供应商流水号', render: row => pickValue(row, ['supplierTradeNo']) },
  { key: 'operatorUsername', title: '操作人', render: row => pickValue(row, ['operatorUsername']) },
  { key: 'createdAt', title: '创建时间', render: row => pickValue(row, ['createdAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw('充值记录原始数据', row.rawPayload ?? row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const consumptionColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'mobile', title: '手机号', render: row => pickValue(row, ['mobile']) },
  { key: 'orderNo', title: '平台订单号', render: row => pickValue(row, ['orderNo']) },
  { key: 'supplierOrderNo', title: '供应商订单号', render: row => pickValue(row, ['supplierOrderNo']) },
  { key: 'amountFen', title: '消费金额', render: row => formatAmountFen(row.amountFen) },
  { key: 'status', title: '状态', render: row => pickValue(row, ['status']) },
  { key: 'occurredAt', title: '发生时间', render: row => pickValue(row, ['occurredAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw('消费日志原始数据', row.rawPayload ?? row)
        },
        { default: () => '原始数据' }
      )
  }
]);

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function syncSupplierForm(record: Api.Admin.RawRecord) {
  supplierForm.supplierCode = pickValue(record, ['supplierCode'], '');
  supplierForm.supplierName = pickValue(record, ['supplierName'], '');
  supplierForm.contactName = pickValue(record, ['contactName'], '');
  supplierForm.contactPhone = pickValue(record, ['contactPhone'], '');
  supplierForm.contactEmail = pickValue(record, ['contactEmail'], '');
  supplierForm.baseUrl = pickValue(record, ['baseUrl'], '');
  supplierForm.protocolType = pickValue(record, ['protocolType'], '');
  supplierForm.credentialMode = pickValue(record, ['credentialMode'], '');
  supplierForm.accessAccount = pickValue(record, ['accessAccount'], '');
  supplierForm.accessPassword = '';
  supplierForm.cooperationStatus = pickValue(record, ['cooperationStatus'], '');
  supplierForm.supportsBalanceQuery = toBoolean(record.supportsBalanceQuery);
  supplierForm.supportsRechargeRecords = toBoolean(record.supportsRechargeRecords);
  supplierForm.supportsConsumptionLog = toBoolean(record.supportsConsumptionLog);
  supplierForm.remark = pickValue(record, ['remark'], '');
  supplierForm.healthStatus = pickValue(record, ['healthStatus'], '');
  supplierForm.status = pickValue(record, ['status'], '');
}

function getUpdatedRangeQuery() {
  if (!productQuery.updatedRange?.length) {
    return {};
  }

  const [start, end] = productQuery.updatedRange;

  return {
    updatedStartTime: new Date(start).toISOString(),
    updatedEndTime: new Date(end).toISOString()
  };
}

async function loadOverview() {
  loading.value = true;

  try {
    const [detailRes, healthRes, balanceRes] = await Promise.all([
      fetchSupplierDetail(supplierId.value),
      fetchSupplierHealth(supplierId.value),
      fetchSupplierBalance(supplierId.value)
    ]);

    supplier.value = extractObjectData(detailRes.data);
    health.value = extractObjectData(healthRes.data);
    balance.value = extractObjectData(balanceRes.data);
    syncSupplierForm(supplier.value);
  } finally {
    loading.value = false;
  }
}

async function loadProducts() {
  productsLoading.value = true;

  try {
    const { data } = await fetchSupplierProducts(
      supplierId.value,
      normalizeQuery({
        carrierCode: productQuery.carrierCode || undefined,
        province: productQuery.province || undefined,
        faceValue: productQuery.faceValue || undefined,
        status: productQuery.status || undefined,
        ...getUpdatedRangeQuery()
      })
    );

    productRows.value = extractListData(data);
  } finally {
    productsLoading.value = false;
  }
}

async function loadRechargeRecords() {
  rechargeLoading.value = true;

  try {
    const { data } = await fetchSupplierRechargeRecords(supplierId.value);
    rechargeRows.value = extractListData(data);
  } finally {
    rechargeLoading.value = false;
  }
}

async function loadConsumptionLogs() {
  logsLoading.value = true;

  try {
    const { data } = await fetchSupplierConsumptionLogs(
      supplierId.value,
      normalizeQuery({
        mobile: logQuery.mobile,
        orderNo: logQuery.orderNo,
        supplierOrderNo: logQuery.supplierOrderNo,
        ...getDateTimeRange(logQuery.timeRange)
      })
    );

    consumptionRows.value = extractListData(data);
  } finally {
    logsLoading.value = false;
  }
}

async function reloadAll() {
  await Promise.all([loadOverview(), loadProducts(), loadRechargeRecords(), loadConsumptionLogs()]);
}

async function handleSaveSupplier() {
  await supplierFormRef.value?.validate();
  saving.value = true;

  try {
    await updateSupplier(
      supplierId.value,
      normalizeQuery({
        ...supplierForm,
        supplierCode: supplierForm.supplierCode?.trim(),
        supplierName: supplierForm.supplierName.trim(),
        contactName: supplierForm.contactName?.trim(),
        contactPhone: supplierForm.contactPhone?.trim(),
        contactEmail: supplierForm.contactEmail?.trim(),
        baseUrl: supplierForm.baseUrl?.trim(),
        protocolType: supplierForm.protocolType.trim(),
        credentialMode: supplierForm.credentialMode?.trim(),
        accessAccount: supplierForm.accessAccount?.trim(),
        accessPassword: supplierForm.accessPassword?.trim(),
        cooperationStatus: supplierForm.cooperationStatus?.trim(),
        remark: supplierForm.remark?.trim(),
        healthStatus: supplierForm.healthStatus?.trim(),
        status: supplierForm.status?.trim(),
        supportsBalanceQuery: toBoolean(supplierForm.supportsBalanceQuery),
        supportsRechargeRecords: toBoolean(supplierForm.supportsRechargeRecords),
        supportsConsumptionLog: toBoolean(supplierForm.supportsConsumptionLog)
      }) as Api.Admin.SaveSupplierPayload
    );

    window.$message?.success('供应商信息已保存');
    await loadOverview();
  } finally {
    saving.value = false;
  }
}

async function handleRefreshBalance() {
  refreshingBalance.value = true;

  try {
    const { data } = await refreshSupplierBalance(supplierId.value);
    balance.value = extractObjectData(data);
    window.$message?.success('供应商余额已刷新');
  } finally {
    refreshingBalance.value = false;
  }
}

function openCreateRechargeRecord() {
  rechargeForm.rechargeType = 'MANUAL';
  rechargeForm.amountFen = 0;
  rechargeForm.currency = 'CNY';
  rechargeForm.beforeBalanceFen = 0;
  rechargeForm.afterBalanceFen = 0;
  rechargeForm.recordSource = 'MANUAL_INPUT';
  rechargeForm.supplierTradeNo = '';
  rechargeForm.remark = '';
  rechargeForm.rawPayload = {};
  rechargeForm.status = 'SUCCESS';
  rechargeRawPayloadText.value = '{}';
  createRecordVisible.value = true;
}

async function submitRechargeRecord() {
  await rechargeFormRef.value?.validate();

  let rawPayload: Api.Admin.JsonObject | undefined;

  try {
    rawPayload = rechargeRawPayloadText.value.trim()
      ? (JSON.parse(rechargeRawPayloadText.value) as Api.Admin.JsonObject)
      : undefined;
  } catch {
    window.$message?.error('原始报文必须是合法 JSON');
    return;
  }

  await createSupplierRechargeRecord(
    supplierId.value,
    normalizeQuery({
      ...rechargeForm,
      rechargeType: rechargeForm.rechargeType.trim(),
      amountFen: Number(rechargeForm.amountFen),
      currency: rechargeForm.currency?.trim(),
      beforeBalanceFen: Number(rechargeForm.beforeBalanceFen) || 0,
      afterBalanceFen: Number(rechargeForm.afterBalanceFen) || 0,
      recordSource: rechargeForm.recordSource.trim(),
      supplierTradeNo: rechargeForm.supplierTradeNo?.trim(),
      remark: rechargeForm.remark?.trim(),
      status: rechargeForm.status?.trim(),
      rawPayload
    }) as Api.Admin.SupplierRechargeRecordPayload
  );

  window.$message?.success('充值记录已新增');
  createRecordVisible.value = false;
  await Promise.all([loadRechargeRecords(), loadOverview()]);
}

async function handleResetProductFilters() {
  productQuery.carrierCode = '';
  productQuery.province = '';
  productQuery.faceValue = null;
  productQuery.status = '';
  productQuery.updatedRange = null;
  await loadProducts();
}

async function handleResetLogFilters() {
  logQuery.mobile = '';
  logQuery.orderNo = '';
  logQuery.supplierOrderNo = '';
  logQuery.timeRange = null;
  await loadConsumptionLogs();
}

const balanceTagType = computed(() => {
  const status = pickValue(balance.value, ['balanceStatus'], '').toUpperCase();

  if (status.includes('LOW') || status.includes('WARN')) {
    return 'warning';
  }

  if (status.includes('FAIL') || status.includes('ERROR')) {
    return 'error';
  }

  return 'success';
});

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
            供应商编码：{{ pickValue(supplier, ['supplierCode']) }} | 协议：{{
              pickValue(supplier, ['protocolType'])
            }}
            | 合作状态：{{ pickValue(supplier, ['cooperationStatus']) }}
          </span>
        </div>
        <NSpace>
          <NButton :loading="refreshingBalance" @click="handleRefreshBalance">刷新余额</NButton>
          <NButton @click="reloadAll">刷新详情</NButton>
        </NSpace>
      </div>
    </NCard>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="基础概览" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="联系人">{{ pickValue(supplier, ['contactName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系电话">{{ pickValue(supplier, ['contactPhone']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系邮箱">{{ pickValue(supplier, ['contactEmail']) }}</NDescriptionsItem>
            <NDescriptionsItem label="接口地址">{{ pickValue(supplier, ['baseUrl']) }}</NDescriptionsItem>
            <NDescriptionsItem label="接入账号">{{ pickValue(supplier, ['accessAccount']) }}</NDescriptionsItem>
            <NDescriptionsItem label="消费日志">
              {{ formatBooleanLabel(supplier.supportsConsumptionLog, '支持', '不支持') }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="健康状态" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="健康状态">{{ pickValue(health, ['healthStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="HTTP 状态">{{ pickValue(health, ['httpStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="状态说明">{{ pickValue(health, ['message']) }}</NDescriptionsItem>
            <NDescriptionsItem label="最近成功">{{ pickValue(health, ['lastSuccessAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="最近失败">{{ pickValue(health, ['lastFailureAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="检查时间">{{ pickValue(health, ['checkedAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="余额概览" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="12">
            <div class="text-28px text-#0f172a font-700">{{ formatAmountFen(balance.balanceAmountFen) }}</div>
            <NTag :type="balanceTagType" round>{{ pickValue(balance, ['balanceStatus'], 'UNKNOWN') }}</NTag>
            <div class="text-14px text-#64748b">币种：{{ pickValue(balance, ['currency']) }}</div>
            <div class="text-14px text-#64748b">来源：{{ pickValue(balance, ['sourceType']) }}</div>
            <div class="text-14px text-#64748b">查询时间：{{ pickValue(balance, ['queriedAt']) }}</div>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
      <NTabPane name="basic" tab="基本信息">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="编辑供应商信息" :bordered="false" class="card-wrapper">
              <NForm
                ref="supplierFormRef"
                :model="supplierForm"
                :rules="supplierRules"
                label-placement="left"
                label-width="110"
              >
                <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                  <NGi>
                    <NFormItem label="供应商编码">
                      <NInput v-model:value="supplierForm.supplierCode" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="供应商名称" path="supplierName">
                      <NInput v-model:value="supplierForm.supplierName" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="联系人">
                      <NInput v-model:value="supplierForm.contactName" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="联系电话">
                      <NInput v-model:value="supplierForm.contactPhone" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="联系邮箱">
                      <NInput v-model:value="supplierForm.contactEmail" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="接口地址">
                      <NInput v-model:value="supplierForm.baseUrl" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="协议类型" path="protocolType">
                      <NInput v-model:value="supplierForm.protocolType" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="认证模式">
                      <NInput v-model:value="supplierForm.credentialMode" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="接入账号">
                      <NInput v-model:value="supplierForm.accessAccount" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="接入密码">
                      <NInput
                        v-model:value="supplierForm.accessPassword"
                        type="password"
                        show-password-on="click"
                        placeholder="留空则不更新"
                      />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="合作状态">
                      <NInput v-model:value="supplierForm.cooperationStatus" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="健康状态">
                      <NInput v-model:value="supplierForm.healthStatus" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="支持余额查询">
                      <NSwitch v-model:value="supplierForm.supportsBalanceQuery" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="支持充值记录">
                      <NSwitch v-model:value="supplierForm.supportsRechargeRecords" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="支持消费日志">
                      <NSwitch v-model:value="supplierForm.supportsConsumptionLog" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="状态">
                      <NInput v-model:value="supplierForm.status" />
                    </NFormItem>
                  </NGi>
                </NGrid>
                <NFormItem label="备注">
                  <NInput v-model:value="supplierForm.remark" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
                </NFormItem>
                <NButton type="primary" :loading="saving" @click="handleSaveSupplier">保存信息</NButton>
              </NForm>
            </NCard>
          </NGi>
          <NGi>
            <NSpace vertical :size="16">
              <RawJsonCard title="供应商详情原始 JSON" :value="supplier" />
              <RawJsonCard title="健康检查原始 JSON" :value="health" />
              <RawJsonCard title="余额原始 JSON" :value="balance" />
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="products" tab="产品快照">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px">
            <NGrid cols="1 s:2 m:5" responsive="screen" :x-gap="12" :y-gap="12">
              <NGi>
                <NInput v-model:value="productQuery.carrierCode" clearable placeholder="运营商" />
              </NGi>
              <NGi>
                <NInput v-model:value="productQuery.province" clearable placeholder="省份" />
              </NGi>
              <NGi>
                <NInputNumber v-model:value="productQuery.faceValue" :min="1" class="w-full" placeholder="面值(分)" />
              </NGi>
              <NGi>
                <NInput v-model:value="productQuery.status" clearable placeholder="状态" />
              </NGi>
              <NGi>
                <NDatePicker v-model:value="productQuery.updatedRange" type="datetimerange" clearable class="w-full" />
              </NGi>
            </NGrid>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleResetProductFilters">重置</NButton>
              <NButton @click="loadProducts">查询</NButton>
            </div>
          </div>

          <NDataTable
            :columns="productColumns"
            :data="productRows"
            :loading="productsLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['snapshotId', 'supplierProductCode'])"
          />
        </NCard>
      </NTabPane>

      <NTabPane name="recharge" tab="充值记录">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
            <div class="text-14px text-#64748b">
              当前接口余额：{{ formatAmountFen(balance.balanceAmountFen) }}，来源：{{
                pickValue(balance, ['sourceType'])
              }}
            </div>
            <div class="flex flex-wrap gap-12px">
              <NButton @click="loadRechargeRecords">刷新记录</NButton>
              <NButton type="primary" @click="openCreateRechargeRecord">人工新增记录</NButton>
            </div>
          </div>

          <NDataTable
            :columns="rechargeColumns"
            :data="rechargeRows"
            :loading="rechargeLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['recordId'])"
          />
        </NCard>
      </NTabPane>

      <NTabPane name="consumption" tab="消费日志">
        <NAlert v-if="!toBoolean(supplier.supportsConsumptionLog)" type="warning" :show-icon="false" class="mb-16px">
          当前供应商未标记为“支持消费日志”，如果后端已经提供该能力，仍可继续查询。
        </NAlert>

        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px">
            <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
              <NGi>
                <NInput v-model:value="logQuery.mobile" clearable placeholder="手机号" />
              </NGi>
              <NGi>
                <NInput v-model:value="logQuery.orderNo" clearable placeholder="平台订单号" />
              </NGi>
              <NGi>
                <NInput v-model:value="logQuery.supplierOrderNo" clearable placeholder="供应商订单号" />
              </NGi>
              <NGi>
                <NDatePicker v-model:value="logQuery.timeRange" type="datetimerange" clearable class="w-full" />
              </NGi>
            </NGrid>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleResetLogFilters">重置</NButton>
              <NButton @click="loadConsumptionLogs">查询</NButton>
            </div>
          </div>

          <NDataTable
            :columns="consumptionColumns"
            :data="consumptionRows"
            :loading="logsLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['id'])"
          />
        </NCard>
      </NTabPane>
    </NTabs>

    <NModal v-model:show="createRecordVisible" preset="card" title="新增供应商充值记录" class="w-680px">
      <NForm
        ref="rechargeFormRef"
        :model="rechargeForm"
        :rules="rechargeRules"
        label-placement="left"
        label-width="120"
      >
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="充值类型" path="rechargeType">
              <NInput v-model:value="rechargeForm.rechargeType" placeholder="例如 MANUAL / TRANSFER" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="记录来源" path="recordSource">
              <NInput v-model:value="rechargeForm.recordSource" placeholder="例如 MANUAL_INPUT / API_SYNC" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="充值金额(分)" path="amountFen">
              <NInputNumber v-model:value="rechargeForm.amountFen" :min="1" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="币种">
              <NInput v-model:value="rechargeForm.currency" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="充值前余额(分)">
              <NInputNumber v-model:value="rechargeForm.beforeBalanceFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="充值后余额(分)">
              <NInputNumber v-model:value="rechargeForm.afterBalanceFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="供应商流水号">
              <NInput v-model:value="rechargeForm.supplierTradeNo" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NInput v-model:value="rechargeForm.status" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="备注">
          <NInput v-model:value="rechargeForm.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 4 }" />
        </NFormItem>
        <NFormItem label="原始报文 JSON">
          <NInput v-model:value="rechargeRawPayloadText" type="textarea" :autosize="{ minRows: 6, maxRows: 10 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="createRecordVisible = false">取消</NButton>
          <NButton type="primary" @click="submitRechargeRecord">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
