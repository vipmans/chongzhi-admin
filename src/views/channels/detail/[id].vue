<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import {
  createChannelApiKey,
  fetchChannelApiKeys,
  fetchChannelBalance,
  fetchChannelCallbackConfig,
  fetchChannelDetail,
  fetchChannelOrderPolicy,
  fetchChannelProducts,
  fetchChannelRechargeRecords,
  fetchChannelSplitPolicy,
  fetchProducts,
  rechargeChannel,
  saveChannelCallbackConfig,
  saveChannelLimit,
  saveChannelPrice,
  saveChannelProduct,
  saveChannelSplitPolicy,
  updateChannel
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  extractPagedData,
  formatAmountFen,
  formatBooleanLabel,
  getEntityId,
  normalizeQuery,
  pickValue,
  toBoolean,
  toPrettyJson
} from '@/utils/admin';

const route = useRoute();
const channelId = computed(() => String(route.params.id || ''));

const loading = ref(false);
const productsLoading = ref(false);
const rechargeLoading = ref(false);
const savingBasic = ref(false);
const savingSplit = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const channel = ref<Api.Admin.RawRecord>({});
const balance = ref<Api.Admin.RawRecord>({});
const channelProducts = ref<Api.Admin.RawRecord[]>([]);
const rechargeRows = ref<Api.Admin.RawRecord[]>([]);
const apiKeys = ref<Api.Admin.RawRecord[]>([]);
const callbackConfig = ref<Api.Admin.RawRecord>({});
const orderPolicy = ref<Api.Admin.RawRecord>({});
const splitPolicy = ref<Api.Admin.RawRecord>({});
const platformProducts = ref<Api.Admin.RawRecord[]>([]);

const basicFormRef = ref<FormInst | null>(null);
const apiKeyFormRef = ref<FormInst | null>(null);
const callbackFormRef = ref<FormInst | null>(null);
const productFormRef = ref<FormInst | null>(null);
const priceFormRef = ref<FormInst | null>(null);
const limitFormRef = ref<FormInst | null>(null);
const splitFormRef = ref<FormInst | null>(null);
const rechargeFormRef = ref<FormInst | null>(null);

const basicForm = reactive<Api.Admin.SaveChannelPayload>({
  channelCode: '',
  channelName: '',
  channelType: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  baseUrl: '',
  protocolType: '',
  accessAccount: '',
  accessPassword: '',
  cooperationStatus: '',
  supportsConsumptionLog: false,
  settlementMode: '',
  status: '',
  remark: ''
});

const apiKeyForm = reactive<Api.Admin.CreateChannelApiKeyPayload>({
  channelId: '',
  accessKey: '',
  secretKey: ''
});

const callbackForm = reactive<Api.Admin.SaveChannelCallbackConfigPayload>({
  channelId: '',
  callbackUrl: '',
  signSecret: '',
  timeoutSeconds: 30
});

const productAuthForm = reactive<Api.Admin.SaveChannelProductPayload>({
  channelId: '',
  productId: ''
});

const priceForm = reactive<Api.Admin.SaveChannelPricePayload>({
  channelId: '',
  productId: '',
  salePrice: 0
});

const limitForm = reactive<Api.Admin.SaveChannelLimitPayload>({
  channelId: '',
  singleLimit: 0,
  dailyLimit: 0,
  monthlyLimit: 0,
  qpsLimit: 1
});

const splitForm = reactive({
  enabled: false,
  allowedFaceValuesText: '',
  preferMaxSingleFaceValue: true,
  maxSplitPieces: 5,
  provinceOverride: '',
  carrierOverride: ''
});

const rechargeForm = reactive<Api.Admin.RechargeChannelPayload>({
  amount: 0,
  remark: ''
});

const productQuery = reactive({
  carrierCode: '',
  province: '',
  faceValue: null as number | null,
  status: ''
});

const productOptions = computed<SelectOption[]>(() =>
  platformProducts.value.map(item => ({
    label: `${pickValue(item, ['productName'])} (${pickValue(item, ['productCode'])})`,
    value: getEntityId(item, ['productId', 'id', 'productCode'])
  }))
);

const authorizedProductIds = computed<string[]>(() => {
  const list = orderPolicy.value.authorizedProductIds;
  return Array.isArray(list) ? list.map(item => String(item)) : [];
});

const pricePolicies = computed<Api.Admin.RawRecord[]>(() => extractListData(orderPolicy.value.pricePolicies));
const limitRule = computed(() => extractObjectData(orderPolicy.value.limitRule));

const basicRules: Record<string, App.Global.FormRule[]> = {
  channelCode: [{ required: true, message: '请输入渠道编码', trigger: 'blur' }],
  channelName: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  channelType: [{ required: true, message: '请输入渠道类型', trigger: 'blur' }]
};

const apiKeyRules: Record<string, App.Global.FormRule[]> = {
  accessKey: [{ required: true, message: '请输入 AccessKey', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 SecretKey', trigger: 'blur' }]
};

const callbackRules: Record<string, App.Global.FormRule[]> = {
  callbackUrl: [{ required: true, message: '请输入回调地址', trigger: 'blur' }]
};

const strategyRules: Record<string, App.Global.FormRule[]> = {
  productId: [{ required: true, message: '请选择平台商品', trigger: 'change' }]
};

const priceRules: Record<string, App.Global.FormRule[]> = {
  productId: [{ required: true, message: '请选择平台商品', trigger: 'change' }],
  salePrice: [{ required: true, type: 'number', message: '请输入销售价(分)', trigger: 'blur' }]
};

const limitRules: Record<string, App.Global.FormRule[]> = {
  singleLimit: [{ required: true, type: 'number', message: '请输入单笔限额', trigger: 'blur' }],
  dailyLimit: [{ required: true, type: 'number', message: '请输入日限额', trigger: 'blur' }],
  monthlyLimit: [{ required: true, type: 'number', message: '请输入月限额', trigger: 'blur' }],
  qpsLimit: [{ required: true, type: 'number', message: '请输入 QPS 限额', trigger: 'blur' }]
};

const splitRules: Record<string, App.Global.FormRule[]> = {
  allowedFaceValuesText: [{ required: true, message: '请输入可拆面值', trigger: 'blur' }],
  maxSplitPieces: [{ required: true, type: 'number', message: '请输入最大拆单片数', trigger: 'blur' }]
};

const rechargeRules: Record<string, App.Global.FormRule[]> = {
  amount: [{ required: true, type: 'number', message: '请输入充值金额', trigger: 'blur' }],
  remark: [{ required: true, message: '请输入充值备注', trigger: 'blur' }]
};

const channelProductColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'productName', title: '商品名称', render: row => pickValue(row, ['productName']) },
  { key: 'carrierCode', title: '运营商', render: row => pickValue(row, ['carrierCode']) },
  { key: 'province', title: '省份', render: row => pickValue(row, ['province']) },
  { key: 'faceValueFen', title: '面值', render: row => formatAmountFen(row.faceValueFen) },
  { key: 'salePriceFen', title: '销售价', render: row => formatAmountFen(row.salePriceFen) },
  { key: 'authorized', title: '是否授权', render: row => formatBooleanLabel(row.authorized, '已授权', '未授权') },
  { key: 'routeSupplierName', title: '路由供应商', render: row => pickValue(row, ['routeSupplierName']) },
  { key: 'latestSnapshotAt', title: '快照时间', render: row => pickValue(row, ['latestSnapshotAt']) },
  { key: 'status', title: '状态', render: row => pickValue(row, ['status']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          onClick: () => openRaw('渠道商品原始数据', row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const rechargeColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'amountFen', title: '充值金额', render: row => formatAmountFen(row.amountFen) },
  { key: 'beforeBalanceFen', title: '充值前余额', render: row => formatAmountFen(row.beforeBalanceFen) },
  { key: 'afterBalanceFen', title: '充值后余额', render: row => formatAmountFen(row.afterBalanceFen) },
  { key: 'recordSource', title: '来源', render: row => pickValue(row, ['recordSource']) },
  { key: 'operatorUsername', title: '操作人', render: row => pickValue(row, ['operatorUsername']) },
  { key: 'remark', title: '备注', render: row => pickValue(row, ['remark']) },
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
          onClick: () => openRaw('渠道充值记录原始数据', row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const pricePolicyColumns: DataTableColumns<Api.Admin.RawRecord> = [
  { key: 'productId', title: '商品 ID', render: row => pickValue(row, ['productId']) },
  {
    key: 'salePrice',
    title: '销售价',
    render: row => formatAmountFen(row.salePriceFen ?? row.salePrice)
  }
];

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function syncForms() {
  apiKeyForm.channelId = channelId.value;
  callbackForm.channelId = channelId.value;
  productAuthForm.channelId = channelId.value;
  priceForm.channelId = channelId.value;
  limitForm.channelId = channelId.value;
}

function syncBasicForm(record: Api.Admin.RawRecord) {
  basicForm.channelCode = pickValue(record, ['channelCode'], '');
  basicForm.channelName = pickValue(record, ['channelName'], '');
  basicForm.channelType = pickValue(record, ['channelType'], '');
  basicForm.contactName = pickValue(record, ['contactName'], '');
  basicForm.contactPhone = pickValue(record, ['contactPhone'], '');
  basicForm.contactEmail = pickValue(record, ['contactEmail'], '');
  basicForm.baseUrl = pickValue(record, ['baseUrl'], '');
  basicForm.protocolType = pickValue(record, ['protocolType'], '');
  basicForm.accessAccount = pickValue(record, ['accessAccount'], '');
  basicForm.accessPassword = '';
  basicForm.cooperationStatus = pickValue(record, ['cooperationStatus'], '');
  basicForm.supportsConsumptionLog = toBoolean(record.supportsConsumptionLog);
  basicForm.settlementMode = pickValue(record, ['settlementMode'], '');
  basicForm.status = pickValue(record, ['status'], '');
  basicForm.remark = pickValue(record, ['remark'], '');
}

function syncPolicyForms() {
  callbackForm.callbackUrl = pickValue(callbackConfig.value, ['callbackUrl'], '');
  callbackForm.signSecret = '';
  callbackForm.timeoutSeconds = Number(pickValue(callbackConfig.value, ['timeoutSeconds'], '30')) || 30;

  const limitData = extractObjectData(orderPolicy.value.limitRule);
  limitForm.singleLimit = Number(pickValue(limitData, ['singleLimit'], '0')) || 0;
  limitForm.dailyLimit = Number(pickValue(limitData, ['dailyLimit'], '0')) || 0;
  limitForm.monthlyLimit = Number(pickValue(limitData, ['monthlyLimit'], '0')) || 0;
  limitForm.qpsLimit = Number(pickValue(limitData, ['qpsLimit'], '1')) || 1;

  splitForm.enabled = toBoolean(splitPolicy.value.enabled);
  splitForm.allowedFaceValuesText = Array.isArray(splitPolicy.value.allowedFaceValues)
    ? splitPolicy.value.allowedFaceValues.join(', ')
    : '';
  splitForm.preferMaxSingleFaceValue = toBoolean(splitPolicy.value.preferMaxSingleFaceValue);
  splitForm.maxSplitPieces = Number(pickValue(splitPolicy.value, ['maxSplitPieces'], '5')) || 5;
  splitForm.provinceOverride = pickValue(splitPolicy.value, ['provinceOverride'], '');
  splitForm.carrierOverride = pickValue(splitPolicy.value, ['carrierOverride'], '');
}

function parseAllowedFaceValues() {
  const items = splitForm.allowedFaceValuesText
    .split(/[\s,，]+/)
    .map(item => Number(item))
    .filter(item => !Number.isNaN(item) && item > 0);

  return Array.from(new Set(items));
}

async function loadOverview() {
  loading.value = true;
  syncForms();

  try {
    const [channelRes, balanceRes, productsRes, apiKeysRes, callbackRes, policyRes, splitPolicyRes, rechargeRes] =
      await Promise.all([
        fetchChannelDetail(channelId.value),
        fetchChannelBalance(channelId.value),
        fetchProducts({ pageNum: 1, pageSize: 200 }),
        fetchChannelApiKeys(channelId.value),
        fetchChannelCallbackConfig(channelId.value),
        fetchChannelOrderPolicy(channelId.value),
        fetchChannelSplitPolicy(channelId.value),
        fetchChannelRechargeRecords(channelId.value)
      ]);

    channel.value = extractObjectData(channelRes.data);
    balance.value = extractObjectData(balanceRes.data);
    platformProducts.value = extractPagedData(productsRes.data).records;
    apiKeys.value = extractListData(apiKeysRes.data);
    callbackConfig.value = extractObjectData(callbackRes.data);
    orderPolicy.value = extractObjectData(policyRes.data);
    splitPolicy.value = extractObjectData(splitPolicyRes.data);
    rechargeRows.value = extractListData(rechargeRes.data);

    syncBasicForm(channel.value);
    syncPolicyForms();
  } finally {
    loading.value = false;
  }
}

async function loadChannelProducts() {
  productsLoading.value = true;

  try {
    const { data } = await fetchChannelProducts(
      channelId.value,
      normalizeQuery({
        carrierCode: productQuery.carrierCode || undefined,
        province: productQuery.province || undefined,
        faceValue: productQuery.faceValue || undefined,
        status: productQuery.status || undefined
      })
    );

    channelProducts.value = extractListData(data);
  } finally {
    productsLoading.value = false;
  }
}

async function loadRechargeRecords() {
  rechargeLoading.value = true;

  try {
    const { data } = await fetchChannelRechargeRecords(channelId.value);
    rechargeRows.value = extractListData(data);
  } finally {
    rechargeLoading.value = false;
  }
}

async function reloadAll() {
  await Promise.all([loadOverview(), loadChannelProducts()]);
}

async function handleSaveBasic() {
  await basicFormRef.value?.validate();
  savingBasic.value = true;

  try {
    await updateChannel(
      channelId.value,
      normalizeQuery({
        ...basicForm,
        channelCode: basicForm.channelCode.trim(),
        channelName: basicForm.channelName.trim(),
        channelType: basicForm.channelType.trim(),
        contactName: basicForm.contactName?.trim(),
        contactPhone: basicForm.contactPhone?.trim(),
        contactEmail: basicForm.contactEmail?.trim(),
        baseUrl: basicForm.baseUrl?.trim(),
        protocolType: basicForm.protocolType?.trim(),
        accessAccount: basicForm.accessAccount?.trim(),
        accessPassword: basicForm.accessPassword?.trim(),
        cooperationStatus: basicForm.cooperationStatus?.trim(),
        settlementMode: basicForm.settlementMode?.trim(),
        status: basicForm.status?.trim(),
        remark: basicForm.remark?.trim(),
        supportsConsumptionLog: toBoolean(basicForm.supportsConsumptionLog)
      }) as Api.Admin.SaveChannelPayload
    );

    window.$message?.success('渠道信息已保存');
    await loadOverview();
  } finally {
    savingBasic.value = false;
  }
}

async function submitApiKey() {
  await apiKeyFormRef.value?.validate();
  await createChannelApiKey({ ...apiKeyForm });
  window.$message?.success('渠道凭证已保存');
  apiKeyForm.accessKey = '';
  apiKeyForm.secretKey = '';
  await loadOverview();
}

async function submitCallback() {
  await callbackFormRef.value?.validate();
  await saveChannelCallbackConfig(
    normalizeQuery({
      ...callbackForm,
      callbackUrl: callbackForm.callbackUrl.trim(),
      signSecret: callbackForm.signSecret?.trim(),
      timeoutSeconds: Number(callbackForm.timeoutSeconds) || 30
    }) as Api.Admin.SaveChannelCallbackConfigPayload
  );
  window.$message?.success('回调配置已保存');
  callbackForm.signSecret = '';
  await loadOverview();
}

async function submitProductAuth() {
  await productFormRef.value?.validate();
  await saveChannelProduct({ ...productAuthForm });
  window.$message?.success('商品授权已保存');
  await Promise.all([loadOverview(), loadChannelProducts()]);
}

async function submitPrice() {
  await priceFormRef.value?.validate();
  await saveChannelPrice({ ...priceForm, salePrice: Number(priceForm.salePrice) });
  window.$message?.success('销售价策略已保存');
  await loadOverview();
}

async function submitLimit() {
  await limitFormRef.value?.validate();
  await saveChannelLimit({
    ...limitForm,
    singleLimit: Number(limitForm.singleLimit),
    dailyLimit: Number(limitForm.dailyLimit),
    monthlyLimit: Number(limitForm.monthlyLimit),
    qpsLimit: Number(limitForm.qpsLimit)
  });
  window.$message?.success('限额策略已保存');
  await loadOverview();
}

async function submitSplitPolicy() {
  await splitFormRef.value?.validate();

  const allowedFaceValues = parseAllowedFaceValues();

  if (!allowedFaceValues.length) {
    window.$message?.error('请至少填写一个可拆面值');
    return;
  }

  savingSplit.value = true;

  try {
    await saveChannelSplitPolicy(channelId.value, {
      enabled: toBoolean(splitForm.enabled),
      allowedFaceValues,
      preferMaxSingleFaceValue: toBoolean(splitForm.preferMaxSingleFaceValue),
      maxSplitPieces: Number(splitForm.maxSplitPieces),
      provinceOverride: splitForm.provinceOverride.trim() || undefined,
      carrierOverride: splitForm.carrierOverride.trim() || undefined
    });

    window.$message?.success('拆单策略已保存');
    await loadOverview();
  } finally {
    savingSplit.value = false;
  }
}

async function submitRecharge() {
  await rechargeFormRef.value?.validate();
  await rechargeChannel(channelId.value, {
    amount: Number(rechargeForm.amount),
    remark: rechargeForm.remark?.trim()
  });
  window.$message?.success('渠道充值已提交');
  rechargeForm.amount = 0;
  rechargeForm.remark = '';
  await Promise.all([loadOverview(), loadRechargeRecords()]);
}

async function handleResetProductFilters() {
  productQuery.carrierCode = '';
  productQuery.province = '';
  productQuery.faceValue = null;
  productQuery.status = '';
  await loadChannelProducts();
}

const balanceTagType = computed(() => {
  const status = pickValue(balance.value, ['status'], '').toUpperCase();

  if (status.includes('FROZEN')) {
    return 'warning';
  }

  if (status.includes('DISABLED') || status.includes('INACTIVE')) {
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
            {{ pickValue(channel, ['channelName', 'name'], '渠道详情') }}
          </h2>
          <span class="text-14px text-#64748b">
            渠道编码：{{ pickValue(channel, ['channelCode', 'code']) }} | 渠道类型：{{
              pickValue(channel, ['channelType'])
            }}
            | 合作状态：{{ pickValue(channel, ['cooperationStatus']) }}
          </span>
        </div>
        <NButton @click="reloadAll">刷新详情</NButton>
      </div>
    </NCard>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="主体概览" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="联系人">{{ pickValue(channel, ['contactName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系电话">{{ pickValue(channel, ['contactPhone']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系邮箱">{{ pickValue(channel, ['contactEmail']) }}</NDescriptionsItem>
            <NDescriptionsItem label="接口地址">{{ pickValue(channel, ['baseUrl']) }}</NDescriptionsItem>
            <NDescriptionsItem label="协议">{{ pickValue(channel, ['protocolType']) }}</NDescriptionsItem>
            <NDescriptionsItem label="消费日志">
              {{ formatBooleanLabel(channel.supportsConsumptionLog, '支持', '不支持') }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="余额概览" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="12">
            <div class="text-28px text-#0f172a font-700">{{ formatAmountFen(balance.availableBalanceFen) }}</div>
            <NTag :type="balanceTagType" round>{{ pickValue(balance, ['status'], 'UNKNOWN') }}</NTag>
            <div class="text-14px text-#64748b">冻结余额：{{ formatAmountFen(balance.frozenBalanceFen) }}</div>
            <div class="text-14px text-#64748b">币种：{{ pickValue(balance, ['currency']) }}</div>
            <div class="text-14px text-#64748b">更新时间：{{ pickValue(balance, ['updatedAt']) }}</div>
          </NSpace>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="当前策略概览" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="结算模式">{{ pickValue(channel, ['settlementMode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="已授权商品数">{{ authorizedProductIds.length }}</NDescriptionsItem>
            <NDescriptionsItem label="回调地址">{{ pickValue(callbackConfig, ['callbackUrl']) }}</NDescriptionsItem>
            <NDescriptionsItem label="回调超时">{{ pickValue(callbackConfig, ['timeoutSeconds']) }}</NDescriptionsItem>
            <NDescriptionsItem label="拆单启用">
              {{ formatBooleanLabel(splitPolicy.enabled, '是', '否') }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
      <NTabPane name="basic" tab="基本信息">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="编辑渠道信息" :bordered="false" class="card-wrapper">
              <NForm ref="basicFormRef" :model="basicForm" :rules="basicRules" label-placement="left" label-width="110">
                <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                  <NGi>
                    <NFormItem label="渠道编码" path="channelCode">
                      <NInput v-model:value="basicForm.channelCode" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="渠道名称" path="channelName">
                      <NInput v-model:value="basicForm.channelName" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="渠道类型" path="channelType">
                      <NInput v-model:value="basicForm.channelType" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="联系人">
                      <NInput v-model:value="basicForm.contactName" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="联系电话">
                      <NInput v-model:value="basicForm.contactPhone" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="联系邮箱">
                      <NInput v-model:value="basicForm.contactEmail" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="接口地址">
                      <NInput v-model:value="basicForm.baseUrl" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="协议类型">
                      <NInput v-model:value="basicForm.protocolType" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="接入账号">
                      <NInput v-model:value="basicForm.accessAccount" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="接入密码">
                      <NInput
                        v-model:value="basicForm.accessPassword"
                        type="password"
                        show-password-on="click"
                        placeholder="留空则不更新"
                      />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="合作状态">
                      <NInput v-model:value="basicForm.cooperationStatus" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="结算模式">
                      <NInput v-model:value="basicForm.settlementMode" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="消费日志能力">
                      <NSwitch v-model:value="basicForm.supportsConsumptionLog" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="状态">
                      <NInput v-model:value="basicForm.status" />
                    </NFormItem>
                  </NGi>
                </NGrid>
                <NFormItem label="备注">
                  <NInput v-model:value="basicForm.remark" type="textarea" :autosize="{ minRows: 4, maxRows: 6 }" />
                </NFormItem>
                <NButton type="primary" :loading="savingBasic" @click="handleSaveBasic">保存信息</NButton>
              </NForm>
            </NCard>
          </NGi>
          <NGi>
            <NSpace vertical :size="16">
              <RawJsonCard title="渠道详情原始 JSON" :value="channel" />
              <RawJsonCard title="渠道余额原始 JSON" :value="balance" />
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="products" tab="商品与策略">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px">
            <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
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
            </NGrid>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleResetProductFilters">重置</NButton>
              <NButton @click="loadChannelProducts">查询</NButton>
            </div>
          </div>

          <NDataTable
            :columns="channelProductColumns"
            :data="channelProducts"
            :loading="productsLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['productId', 'channelId', 'id'])"
          />
        </NCard>

        <div class="h-16px" />

        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="商品授权" :bordered="false" class="card-wrapper">
                <NForm
                  ref="productFormRef"
                  :model="productAuthForm"
                  :rules="strategyRules"
                  label-placement="left"
                  label-width="96"
                >
                  <NFormItem label="平台商品" path="productId">
                    <NSelect v-model:value="productAuthForm.productId" :options="productOptions" />
                  </NFormItem>
                  <NButton type="primary" @click="submitProductAuth">保存授权</NButton>
                </NForm>
                <div class="mt-12px text-13px text-#64748b">
                  已授权商品：{{ authorizedProductIds.length ? authorizedProductIds.join(', ') : '暂无' }}
                </div>
              </NCard>

              <NCard title="销售价策略" :bordered="false" class="card-wrapper">
                <NForm
                  ref="priceFormRef"
                  :model="priceForm"
                  :rules="priceRules"
                  label-placement="left"
                  label-width="96"
                >
                  <NFormItem label="平台商品" path="productId">
                    <NSelect v-model:value="priceForm.productId" :options="productOptions" />
                  </NFormItem>
                  <NFormItem label="销售价(分)" path="salePrice">
                    <NInputNumber v-model:value="priceForm.salePrice" :min="0" class="w-full" />
                  </NFormItem>
                  <NButton type="primary" @click="submitPrice">保存价格</NButton>
                </NForm>
                <NDataTable
                  class="mt-12px"
                  :columns="pricePolicyColumns"
                  :data="pricePolicies"
                  :pagination="false"
                  :row-key="row => getEntityId(row, ['productId', 'id'])"
                />
              </NCard>

              <NCard title="限额策略" :bordered="false" class="card-wrapper">
                <NForm
                  ref="limitFormRef"
                  :model="limitForm"
                  :rules="limitRules"
                  label-placement="left"
                  label-width="96"
                >
                  <NFormItem label="单笔限额" path="singleLimit">
                    <NInputNumber v-model:value="limitForm.singleLimit" :min="0" class="w-full" />
                  </NFormItem>
                  <NFormItem label="日限额" path="dailyLimit">
                    <NInputNumber v-model:value="limitForm.dailyLimit" :min="0" class="w-full" />
                  </NFormItem>
                  <NFormItem label="月限额" path="monthlyLimit">
                    <NInputNumber v-model:value="limitForm.monthlyLimit" :min="0" class="w-full" />
                  </NFormItem>
                  <NFormItem label="QPS 限额" path="qpsLimit">
                    <NInputNumber v-model:value="limitForm.qpsLimit" :min="1" class="w-full" />
                  </NFormItem>
                  <NButton type="primary" @click="submitLimit">保存限额</NButton>
                </NForm>
              </NCard>

              <NCard title="拆单策略" :bordered="false" class="card-wrapper">
                <NForm
                  ref="splitFormRef"
                  :model="splitForm"
                  :rules="splitRules"
                  label-placement="left"
                  label-width="120"
                >
                  <NFormItem label="启用拆单">
                    <NSwitch v-model:value="splitForm.enabled" />
                  </NFormItem>
                  <NFormItem label="可拆面值" path="allowedFaceValuesText">
                    <NInput v-model:value="splitForm.allowedFaceValuesText" placeholder="例如 200,100,50,20,10" />
                  </NFormItem>
                  <NFormItem label="优先大面值">
                    <NSwitch v-model:value="splitForm.preferMaxSingleFaceValue" />
                  </NFormItem>
                  <NFormItem label="最大拆单片数" path="maxSplitPieces">
                    <NInputNumber v-model:value="splitForm.maxSplitPieces" :min="1" :max="20" class="w-full" />
                  </NFormItem>
                  <NFormItem label="省份覆盖">
                    <NInput v-model:value="splitForm.provinceOverride" placeholder="可选" />
                  </NFormItem>
                  <NFormItem label="运营商覆盖">
                    <NInput v-model:value="splitForm.carrierOverride" placeholder="可选" />
                  </NFormItem>
                  <NButton type="primary" :loading="savingSplit" @click="submitSplitPolicy">保存拆单策略</NButton>
                </NForm>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <RawJsonCard title="下单策略原始 JSON" :value="orderPolicy" />
              <RawJsonCard title="限额规则原始 JSON" :value="limitRule" />
              <RawJsonCard title="拆单策略原始 JSON" :value="splitPolicy" />
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="credentials" tab="凭证与回调">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="接口凭证" :bordered="false" class="card-wrapper">
              <NList>
                <NListItem v-for="item in apiKeys" :key="getEntityId(item, ['id', 'accessKey'])">
                  <div class="flex flex-col gap-4px">
                    <span>AccessKey：{{ pickValue(item, ['accessKey']) }}</span>
                    <span>签名算法：{{ pickValue(item, ['signAlgorithm']) }}</span>
                    <span>状态：{{ pickValue(item, ['status']) }}</span>
                    <span>过期时间：{{ pickValue(item, ['expiresAt']) }}</span>
                  </div>
                </NListItem>
                <NEmpty v-if="!apiKeys.length" description="暂无接口凭证" />
              </NList>

              <div class="mt-16px border-t border-#e5e7eb pt-16px">
                <NForm
                  ref="apiKeyFormRef"
                  :model="apiKeyForm"
                  :rules="apiKeyRules"
                  label-placement="left"
                  label-width="96"
                >
                  <NFormItem label="AccessKey" path="accessKey">
                    <NInput v-model:value="apiKeyForm.accessKey" />
                  </NFormItem>
                  <NFormItem label="SecretKey" path="secretKey">
                    <NInput v-model:value="apiKeyForm.secretKey" />
                  </NFormItem>
                  <NButton type="primary" @click="submitApiKey">新增凭证</NButton>
                </NForm>
              </div>
            </NCard>
          </NGi>

          <NGi>
            <NCard title="回调配置" :bordered="false" class="card-wrapper">
              <NForm
                ref="callbackFormRef"
                :model="callbackForm"
                :rules="callbackRules"
                label-placement="left"
                label-width="110"
              >
                <NFormItem label="回调地址" path="callbackUrl">
                  <NInput v-model:value="callbackForm.callbackUrl" />
                </NFormItem>
                <NFormItem label="签名密钥">
                  <NInput v-model:value="callbackForm.signSecret" placeholder="留空则不更新" />
                </NFormItem>
                <NFormItem label="超时秒数">
                  <NInputNumber v-model:value="callbackForm.timeoutSeconds" :min="1" class="w-full" />
                </NFormItem>
                <NButton type="primary" @click="submitCallback">保存回调配置</NButton>
              </NForm>

              <div class="mt-16px">
                <RawJsonCard title="当前回调原始 JSON" :value="callbackConfig" />
              </div>
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="recharge" tab="充值记录">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="渠道账户充值" :bordered="false" class="card-wrapper">
              <NForm
                ref="rechargeFormRef"
                :model="rechargeForm"
                :rules="rechargeRules"
                label-placement="left"
                label-width="96"
              >
                <NFormItem label="充值金额" path="amount">
                  <NInputNumber v-model:value="rechargeForm.amount" :min="0.01" class="w-full" />
                </NFormItem>
                <NFormItem label="备注" path="remark">
                  <NInput v-model:value="rechargeForm.remark" type="textarea" />
                </NFormItem>
                <NButton type="primary" @click="submitRecharge">提交充值</NButton>
              </NForm>
            </NCard>
          </NGi>
          <NGi>
            <RawJsonCard title="余额原始 JSON" :value="balance" />
          </NGi>
        </NGrid>

        <div class="h-16px" />

        <NCard title="充值记录" :bordered="false" class="card-wrapper">
          <div class="mb-16px flex justify-end">
            <NButton @click="loadRechargeRecords">刷新记录</NButton>
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
    </NTabs>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
