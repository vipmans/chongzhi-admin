<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import {
  approveChannelPortalAccount,
  createChannelApiKey,
  disableChannelPortalAccount,
  enableChannelPortalAccount,
  fetchChannelApiKeys,
  fetchChannelBalance,
  fetchChannelCallbackConfig,
  fetchChannelDetail,
  fetchChannelOrderPolicy,
  fetchChannelPortalAccount,
  fetchChannelRechargeRecords,
  fetchChannelSplitPolicy,
  fetchProducts,
  openChannelPortalAccount,
  rechargeChannel,
  rejectChannelPortalAccount,
  resetChannelPortalPassword,
  saveChannelCallbackConfig,
  saveChannelLimit,
  saveChannelPrice,
  saveChannelProduct,
  saveChannelSplitPolicy
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  extractPagedData,
  formatAmountFen,
  getEntityId,
  pickNumber,
  pickValue,
  toBoolean,
  toPrettyJson
} from '@/utils/admin';

const route = useRoute();
const channelId = computed(() => String(route.params.id || ''));

const loading = ref(false);
const saving = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const channel = ref<Api.Admin.RawRecord>({});
const apiKeys = ref<Api.Admin.RawRecord[]>([]);
const callbackConfig = ref<Api.Admin.RawRecord>({});
const orderPolicy = ref<Api.Admin.RawRecord>({});
const portalAccount = ref<Api.Admin.RawRecord>({});
const products = ref<Api.Admin.RawRecord[]>([]);
const splitPolicy = ref<Api.Admin.RawRecord>({});
const channelBalance = ref<Api.Admin.RawRecord>({});
const rechargeRecords = ref<Api.Admin.RawRecord[]>([]);

const apiKeyFormRef = ref<FormInst | null>(null);
const callbackFormRef = ref<FormInst | null>(null);
const productFormRef = ref<FormInst | null>(null);
const priceFormRef = ref<FormInst | null>(null);
const limitFormRef = ref<FormInst | null>(null);
const splitFormRef = ref<FormInst | null>(null);
const rechargeFormRef = ref<FormInst | null>(null);
const portalOpenFormRef = ref<FormInst | null>(null);
const portalRejectFormRef = ref<FormInst | null>(null);
const portalResetFormRef = ref<FormInst | null>(null);

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

const productForm = reactive<Api.Admin.SaveChannelProductPayload>({
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

const splitForm = reactive<Api.Admin.SaveChannelSplitPolicyPayload>({
  enabled: false,
  allowedFaceValues: [],
  preferMaxSingleFaceValue: true,
  maxSplitPieces: 1,
  provinceOverride: '',
  carrierOverride: ''
});

const rechargeForm = reactive<Api.Admin.RechargeChannelPayload>({
  amount: 0,
  remark: ''
});

const portalOpenForm = reactive<Api.Admin.OpenChannelPortalAccountPayload>({
  portalAccount: '',
  password: ''
});

const portalRejectForm = reactive<Api.Admin.RejectChannelPortalAccountPayload>({
  reason: ''
});

const portalResetForm = reactive<Api.Admin.ResetChannelPortalPasswordPayload>({
  password: ''
});

function getTextValue(record: Api.Admin.RawRecord, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key];

    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }

  return fallback;
}

function getStatusTagType(status: string) {
  if (['APPROVED', 'ACTIVE', 'ENABLED', 'SUCCESS'].includes(status)) {
    return 'success';
  }

  if (['PENDING', 'WAITING_APPROVAL', 'PROCESSING'].includes(status)) {
    return 'warning';
  }

  if (['REJECTED', 'DISABLED', 'INACTIVE', 'FAILED', 'ERROR'].includes(status)) {
    return 'error';
  }

  return 'default';
}

function isReadyStatus(status: string) {
  return ['APPROVED', 'ACTIVE', 'ENABLED', 'SUCCESS'].includes(status);
}

function isTruthyObject(record: Api.Admin.RawRecord) {
  return Object.keys(record).length > 0;
}

function summarizeFaceValues(values: number[]) {
  if (!values.length) {
    return '未限制面值';
  }

  return values
    .slice()
    .sort((a, b) => a - b)
    .map(value => `${value}`)
    .join(' / ');
}

async function safeRequest<T>(request: Promise<T>, fallback: T) {
  try {
    return await request;
  } catch {
    return fallback;
  }
}

const productOptions = computed<SelectOption[]>(() =>
  products.value.map(item => ({
    label: `${pickValue(item, ['productName'])} (${pickValue(item, ['productCode'])})`,
    value: getEntityId(item, ['productId', 'id'])
  }))
);

const faceValueOptions = computed<SelectOption[]>(() => {
  const values = Array.from(
    new Set(
      products.value
        .map(item => Number(item.faceValue ?? item.parValue ?? item.amount))
        .filter(value => !Number.isNaN(value) && value > 0)
    )
  ).sort((a, b) => a - b);

  return values.map(value => ({
    label: `${value} 元`,
    value
  }));
});

const priceRows = computed(() => extractListData(orderPolicy.value.pricePolicies));
const limitRule = computed(() => extractObjectData(orderPolicy.value.limitRule));
const authorizedProductIds = computed<string[]>(() =>
  Array.isArray(orderPolicy.value.authorizedProductIds) ? orderPolicy.value.authorizedProductIds.map(String) : []
);

const authorizedProducts = computed(() =>
  products.value.filter(item => authorizedProductIds.value.includes(getEntityId(item, ['productId', 'id'])))
);

const portalStatus = computed(() => pickValue(portalAccount.value, ['portalStatus'], '-'));
const portalTagType = computed(() => getStatusTagType(portalStatus.value));

const balanceFen = computed(() =>
  pickNumber(channelBalance.value, ['availableBalanceFen', 'balanceFen', 'availableAmountFen', 'amountFen'], 0)
);

const hasActiveApiKey = computed(() =>
  apiKeys.value.some(item => {
    const status = getTextValue(item, ['status'], 'ACTIVE');
    return ['ACTIVE', 'ENABLED', 'ISSUED'].includes(status);
  })
);

const hasCallbackConfigured = computed(() => Boolean(getTextValue(callbackConfig.value, ['callbackUrl'])));
const hasAuthorizedProducts = computed(() => authorizedProductIds.value.length > 0);
const hasConfiguredPrice = computed(() => priceRows.value.length > 0);
const hasConfiguredLimit = computed(() => isTruthyObject(limitRule.value));
const hasConfiguredSplitPolicy = computed(
  () => isTruthyObject(splitPolicy.value) && (Array.isArray(splitPolicy.value.allowedFaceValues) || splitPolicy.value.maxSplitPieces !== undefined)
);

const readinessItems = computed(() => {
  const channelStatus = getTextValue(channel.value, ['status'], '-');
  const cooperationStatus = getTextValue(channel.value, ['cooperationStatus'], '-');
  const callbackUrl = getTextValue(callbackConfig.value, ['callbackUrl']);
  const timeoutSeconds = getTextValue(callbackConfig.value, ['timeoutSeconds'], '30');
  const splitEnabled = toBoolean(splitPolicy.value.enabled);
  const splitValues = Array.isArray(splitPolicy.value.allowedFaceValues)
    ? splitPolicy.value.allowedFaceValues.map(value => Number(value)).filter(value => !Number.isNaN(value))
    : [];

  return [
    {
      key: 'channel',
      label: '渠道主体状态',
      ready: channelStatus === 'ACTIVE',
      detail: `主体=${channelStatus}，合作=${cooperationStatus}`
    },
    {
      key: 'portal',
      label: '门户账号已开通并可登录',
      ready: isReadyStatus(portalStatus.value),
      detail: `门户状态=${portalStatus.value}`
    },
    {
      key: 'credential',
      label: '开放接口凭证可用',
      ready: hasActiveApiKey.value,
      detail: apiKeys.value.length ? `已配置 ${apiKeys.value.length} 组凭证` : '尚未创建 AccessKey / SecretKey'
    },
    {
      key: 'callback',
      label: '订单回调地址已配置',
      ready: hasCallbackConfigured.value,
      detail: callbackUrl ? `${callbackUrl}，超时 ${timeoutSeconds} 秒` : '未配置 callbackUrl'
    },
    {
      key: 'product',
      label: '已授权可售商品',
      ready: hasAuthorizedProducts.value,
      detail: hasAuthorizedProducts.value ? `已授权 ${authorizedProductIds.value.length} 个商品` : '尚未授权商品'
    },
    {
      key: 'price',
      label: '渠道供货价已配置',
      ready: hasConfiguredPrice.value,
      detail: hasConfiguredPrice.value ? `已有 ${priceRows.value.length} 条价格策略` : '尚未配置渠道供货价'
    },
    {
      key: 'limit',
      label: '限额与并发控制已配置',
      ready: hasConfiguredLimit.value,
      detail: hasConfiguredLimit.value
        ? `单笔 ${formatAmountFen(limitRule.value.singleLimitAmountFen ?? limitRule.value.singleLimit, '未设置')}，QPS ${pickValue(limitRule.value, ['qpsLimit'], '1')}`
        : '尚未保存限额规则'
    },
    {
      key: 'split',
      label: '拆单策略已配置',
      ready: hasConfiguredSplitPolicy.value,
      detail: hasConfiguredSplitPolicy.value
        ? `${splitEnabled ? '已启用' : '已关闭'}，面值 ${summarizeFaceValues(splitValues)}，最多 ${pickValue(splitPolicy.value, ['maxSplitPieces'], '1')} 笔`
        : '尚未配置拆单策略'
    },
    {
      key: 'balance',
      label: '渠道余额可支撑充值',
      ready: balanceFen.value > 0,
      detail: formatAmountFen(balanceFen.value, '未返回余额')
    }
  ];
});

const readinessCompleted = computed(() => readinessItems.value.filter(item => item.ready).length);
const readinessPercent = computed(() =>
  Math.round((readinessCompleted.value / Math.max(readinessItems.value.length, 1)) * 100)
);

const splitPolicySummary = computed(() => {
  if (!hasConfiguredSplitPolicy.value) {
    return '未配置';
  }

  const values = Array.isArray(splitPolicy.value.allowedFaceValues)
    ? splitPolicy.value.allowedFaceValues.map(value => Number(value)).filter(value => !Number.isNaN(value))
    : [];

  return `${toBoolean(splitPolicy.value.enabled) ? '已启用' : '已关闭'} / 面值 ${summarizeFaceValues(values)} / 最多 ${pickValue(splitPolicy.value, ['maxSplitPieces'], '1')} 笔`;
});

const recentRechargeRows = computed(() => rechargeRecords.value.slice(0, 10));

const priceColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'productId',
    title: '商品',
    render: row => {
      const productId = getEntityId(row, ['productId']);
      const product = products.value.find(item => getEntityId(item, ['productId', 'id']) === productId);
      return product ? `${pickValue(product, ['productName'])} (${pickValue(product, ['productCode'])})` : productId;
    }
  },
  {
    key: 'saleAmountFen',
    title: '渠道供货价',
    render: row => formatAmountFen(row.saleAmountFen ?? row.salePriceFen ?? row.saleAmount ?? row.salePrice)
  },
  {
    key: 'currency',
    title: '币种',
    render: row => pickValue(row, ['currency'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      return h(NTag, { size: 'small', type: getStatusTagType(status) }, { default: () => status });
    }
  },
  {
    key: 'effectiveTime',
    title: '生效时间',
    render: row => `${pickValue(row, ['effectiveFrom'])} ~ ${pickValue(row, ['effectiveTo'])}`
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
          onClick: () => openRaw('渠道价格策略原始数据', row)
        },
        { default: () => '查看原始数据' }
      )
  }
]);

const rechargeColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'amountFen',
    title: '充值金额',
    render: row => formatAmountFen(row.amountFen ?? row.rechargeAmountFen ?? row.amount)
  },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      return h(NTag, { size: 'small', type: getStatusTagType(status) }, { default: () => status });
    }
  },
  {
    key: 'remark',
    title: '备注',
    render: row => pickValue(row, ['remark', 'comment'])
  },
  {
    key: 'createdAt',
    title: '时间',
    render: row => pickValue(row, ['createdAt', 'updatedAt'])
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
          onClick: () => openRaw('渠道充值记录原始数据', row)
        },
        { default: () => '查看原始数据' }
      )
  }
]);

const apiKeyRules: Record<string, App.Global.FormRule[]> = {
  accessKey: [{ required: true, message: '请输入 AccessKey', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 SecretKey', trigger: 'blur' }]
};

const callbackRules: Record<string, App.Global.FormRule[]> = {
  callbackUrl: [{ required: true, message: '请输入回调地址', trigger: 'blur' }],
  signSecret: [{ required: true, message: '请输入回调签名密钥', trigger: 'blur' }]
};

const productRules: Record<string, App.Global.FormRule[]> = {
  productId: [{ required: true, message: '请选择商品', trigger: 'change' }]
};

const priceRules: Record<string, App.Global.FormRule[]> = {
  productId: [{ required: true, message: '请选择商品', trigger: 'change' }],
  salePrice: [{ required: true, type: 'number', message: '请输入渠道供货价', trigger: 'blur' }]
};

const limitRules: Record<string, App.Global.FormRule[]> = {
  singleLimit: [{ required: true, type: 'number', message: '请输入单笔限额', trigger: 'blur' }],
  dailyLimit: [{ required: true, type: 'number', message: '请输入日限额', trigger: 'blur' }],
  monthlyLimit: [{ required: true, type: 'number', message: '请输入月限额', trigger: 'blur' }],
  qpsLimit: [{ required: true, type: 'number', message: '请输入 QPS 限额', trigger: 'blur' }]
};

const splitRules: Record<string, App.Global.FormRule[]> = {
  allowedFaceValues: [
    {
      trigger: 'change',
      validator: () => {
        if (!splitForm.enabled) {
          return true;
        }

        return splitForm.allowedFaceValues.length > 0;
      },
      message: '启用拆单后请选择允许拆单的面值'
    }
  ],
  maxSplitPieces: [{ required: true, type: 'number', message: '请输入最大拆单笔数', trigger: 'blur' }]
};

const rechargeRules: Record<string, App.Global.FormRule[]> = {
  amount: [{ required: true, type: 'number', message: '请输入充值金额', trigger: 'blur' }],
  remark: [{ required: true, message: '请输入充值备注', trigger: 'blur' }]
};

const portalOpenRules: Record<string, App.Global.FormRule[]> = {
  portalAccount: [{ required: true, message: '请输入门户账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入初始密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ]
};

const portalRejectRules: Record<string, App.Global.FormRule[]> = {
  reason: [{ required: true, message: '请输入驳回原因', trigger: 'blur' }]
};

const portalResetRules: Record<string, App.Global.FormRule[]> = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ]
};

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function syncForms() {
  apiKeyForm.channelId = channelId.value;
  callbackForm.channelId = channelId.value;
  productForm.channelId = channelId.value;
  priceForm.channelId = channelId.value;
  limitForm.channelId = channelId.value;

  callbackForm.callbackUrl = getTextValue(callbackConfig.value, ['callbackUrl']);
  callbackForm.timeoutSeconds = Number(callbackConfig.value.timeoutSeconds ?? 30) || 30;
  callbackForm.signSecret = '';

  const currentLimitRule = limitRule.value;
  limitForm.singleLimit = Number(currentLimitRule.singleLimitAmountFen ?? currentLimitRule.singleLimit ?? 0) || 0;
  limitForm.dailyLimit = Number(currentLimitRule.dailyLimitAmountFen ?? currentLimitRule.dailyLimit ?? 0) || 0;
  limitForm.monthlyLimit = Number(currentLimitRule.monthlyLimitAmountFen ?? currentLimitRule.monthlyLimit ?? 0) || 0;
  limitForm.qpsLimit = Number(currentLimitRule.qpsLimit ?? 1) || 1;

  splitForm.enabled = toBoolean(splitPolicy.value.enabled);
  splitForm.allowedFaceValues = Array.isArray(splitPolicy.value.allowedFaceValues)
    ? splitPolicy.value.allowedFaceValues.map(value => Number(value)).filter(value => !Number.isNaN(value))
    : [];
  splitForm.preferMaxSingleFaceValue = splitPolicy.value.preferMaxSingleFaceValue === undefined
    ? true
    : toBoolean(splitPolicy.value.preferMaxSingleFaceValue);
  splitForm.maxSplitPieces = Number(splitPolicy.value.maxSplitPieces ?? 1) || 1;
  splitForm.provinceOverride = getTextValue(splitPolicy.value, ['provinceOverride']);
  splitForm.carrierOverride = getTextValue(splitPolicy.value, ['carrierOverride']);
}

async function loadPage() {
  loading.value = true;

  try {
    const [channelData, productData, apiKeyData, callbackData, policyData, portalData, splitData, balanceData, rechargeData] =
      await Promise.all([
        fetchChannelDetail(channelId.value),
        fetchProducts({ pageNum: 1, pageSize: 200 }),
        safeRequest(fetchChannelApiKeys(channelId.value), [] as Api.Admin.RawList),
        safeRequest(fetchChannelCallbackConfig(channelId.value), {} as Api.Admin.RawRecord),
        safeRequest(fetchChannelOrderPolicy(channelId.value), {} as Api.Admin.RawRecord),
        safeRequest(fetchChannelPortalAccount(channelId.value), {} as Api.Admin.RawRecord),
        safeRequest(fetchChannelSplitPolicy(channelId.value), {} as Api.Admin.RawRecord),
        safeRequest(fetchChannelBalance(channelId.value), {} as Api.Admin.RawRecord),
        safeRequest(fetchChannelRechargeRecords(channelId.value), [] as Api.Admin.RawList)
      ]);

    channel.value = extractObjectData(channelData);
    products.value = extractPagedData(productData).records;
    apiKeys.value = extractListData(apiKeyData);
    callbackConfig.value = extractObjectData(callbackData);
    orderPolicy.value = extractObjectData(policyData);
    portalAccount.value = extractObjectData(portalData);
    splitPolicy.value = extractObjectData(splitData);
    channelBalance.value = extractObjectData(balanceData);
    rechargeRecords.value = extractListData(rechargeData);

    syncForms();
  } finally {
    loading.value = false;
  }
}

async function handleCreateApiKey() {
  await apiKeyFormRef.value?.validate();
  saving.value = true;

  try {
    await createChannelApiKey({
      channelId: channelId.value,
      accessKey: apiKeyForm.accessKey.trim(),
      secretKey: apiKeyForm.secretKey.trim()
    });
    window.$message?.success('渠道接口凭证已保存');
    apiKeyForm.accessKey = '';
    apiKeyForm.secretKey = '';
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleSaveCallback() {
  await callbackFormRef.value?.validate();
  saving.value = true;

  try {
    await saveChannelCallbackConfig({
      channelId: channelId.value,
      callbackUrl: callbackForm.callbackUrl.trim(),
      signSecret: callbackForm.signSecret.trim(),
      timeoutSeconds: Number(callbackForm.timeoutSeconds) || 30
    });
    window.$message?.success('回调配置已保存');
    callbackForm.signSecret = '';
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleAuthorizeProduct() {
  await productFormRef.value?.validate();
  saving.value = true;

  try {
    await saveChannelProduct({
      channelId: channelId.value,
      productId: productForm.productId
    });
    window.$message?.success('商品授权已保存');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleSavePrice() {
  await priceFormRef.value?.validate();
  saving.value = true;

  try {
    await saveChannelPrice({
      channelId: channelId.value,
      productId: priceForm.productId,
      salePrice: Number(priceForm.salePrice)
    });
    window.$message?.success('渠道供货价已保存');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleSaveLimit() {
  await limitFormRef.value?.validate();
  saving.value = true;

  try {
    await saveChannelLimit({
      channelId: channelId.value,
      singleLimit: Number(limitForm.singleLimit),
      dailyLimit: Number(limitForm.dailyLimit),
      monthlyLimit: Number(limitForm.monthlyLimit),
      qpsLimit: Number(limitForm.qpsLimit)
    });
    window.$message?.success('限额规则已保存');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleSaveSplitPolicy() {
  await splitFormRef.value?.validate();
  saving.value = true;

  try {
    await saveChannelSplitPolicy(channelId.value, {
      enabled: splitForm.enabled,
      allowedFaceValues: splitForm.allowedFaceValues.map(value => Number(value)).sort((a, b) => a - b),
      preferMaxSingleFaceValue: splitForm.preferMaxSingleFaceValue,
      maxSplitPieces: Number(splitForm.maxSplitPieces),
      provinceOverride: splitForm.provinceOverride?.trim() || undefined,
      carrierOverride: splitForm.carrierOverride?.trim() || undefined
    });
    window.$message?.success('拆单策略已保存');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleRecharge() {
  await rechargeFormRef.value?.validate();
  saving.value = true;

  try {
    await rechargeChannel(channelId.value, {
      amount: Number(rechargeForm.amount),
      remark: rechargeForm.remark.trim()
    });
    window.$message?.success('渠道余额充值申请已提交');
    rechargeForm.amount = 0;
    rechargeForm.remark = '';
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleOpenPortalAccount() {
  await portalOpenFormRef.value?.validate();
  saving.value = true;

  try {
    await openChannelPortalAccount(channelId.value, {
      portalAccount: portalOpenForm.portalAccount.trim(),
      password: portalOpenForm.password
    });
    window.$message?.success('渠道门户账号已开通，当前状态为待审核');
    portalOpenForm.portalAccount = '';
    portalOpenForm.password = '';
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleApprovePortalAccount() {
  saving.value = true;

  try {
    await approveChannelPortalAccount(channelId.value);
    window.$message?.success('渠道门户账号已审核通过');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleRejectPortalAccount() {
  await portalRejectFormRef.value?.validate();
  saving.value = true;

  try {
    await rejectChannelPortalAccount(channelId.value, {
      reason: portalRejectForm.reason.trim()
    });
    window.$message?.success('渠道门户账号已驳回');
    portalRejectForm.reason = '';
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleResetPortalPassword() {
  await portalResetFormRef.value?.validate();
  saving.value = true;

  try {
    await resetChannelPortalPassword(channelId.value, {
      password: portalResetForm.password
    });
    window.$message?.success('渠道门户密码已重置');
    portalResetForm.password = '';
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleDisablePortalAccount() {
  saving.value = true;

  try {
    await disableChannelPortalAccount(channelId.value);
    window.$message?.success('渠道门户账号已禁用');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

async function handleEnablePortalAccount() {
  saving.value = true;

  try {
    await enableChannelPortalAccount(channelId.value);
    window.$message?.success('渠道门户账号已启用');
    await loadPage();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadPage();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper" :loading="loading">
      <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-8px">
          <h2 class="m-0 text-24px text-#0f172a font-700">
            {{ pickValue(channel, ['channelName'], '渠道详情') }}
          </h2>
          <div class="flex flex-wrap items-center gap-8px text-14px text-#64748b">
            <span>渠道编码：{{ pickValue(channel, ['channelCode'], channelId) }}</span>
            <span>渠道类型：{{ pickValue(channel, ['channelType']) }}</span>
            <span>结算模式：{{ pickValue(channel, ['settlementMode']) }}</span>
            <span>主体状态：</span>
            <NTag size="small" :type="getStatusTagType(pickValue(channel, ['status'], '-'))">
              {{ pickValue(channel, ['status']) }}
            </NTag>
            <span>门户状态：</span>
            <NTag size="small" :type="portalTagType">{{ portalStatus }}</NTag>
          </div>
        </div>
        <NButton @click="loadPage">刷新</NButton>
      </div>
    </NCard>

    <NAlert type="info" :show-icon="false">
      当前页面已按最新接口能力补齐“渠道充值开通工作台”。运营侧可在这里完成门户账号、接口凭证、商品授权、渠道供货价、限额、拆单策略、余额充值与联调说明配置，用于支撑渠道平台的单笔充值与批量充值上线。
    </NAlert>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="主体信息" :bordered="false" class="card-wrapper">
          <NDescriptions bordered :column="1" label-placement="left">
            <NDescriptionsItem label="渠道 ID">{{ getEntityId(channel, ['channelId', 'id']) || channelId }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道编码">{{ pickValue(channel, ['channelCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道名称">{{ pickValue(channel, ['channelName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系人">{{ pickValue(channel, ['contactName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系电话">{{ pickValue(channel, ['contactPhone']) }}</NDescriptionsItem>
            <NDescriptionsItem label="联系邮箱">{{ pickValue(channel, ['contactEmail']) }}</NDescriptionsItem>
            <NDescriptionsItem label="接入地址">{{ pickValue(channel, ['baseUrl']) }}</NDescriptionsItem>
            <NDescriptionsItem label="合作状态">{{ pickValue(channel, ['cooperationStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ pickValue(channel, ['updatedAt', 'createdAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>

      <NGi>
        <NCard title="充值开通总览" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="12">
            <div class="flex items-center justify-between text-14px">
              <span class="font-600 text-#0f172a">开通完成度</span>
              <span class="text-#2563eb">{{ readinessCompleted }}/{{ readinessItems.length }} 项</span>
            </div>
            <NProgress type="line" :percentage="readinessPercent" indicator-placement="inside" processing />
            <div class="text-14px text-#334155">当前余额：{{ formatAmountFen(balanceFen, '未返回余额') }}</div>
            <div class="text-14px text-#334155">已授权商品：{{ authorizedProductIds.length }} 个</div>
            <div class="text-14px text-#334155">价格策略：{{ priceRows.length }} 条</div>
            <div class="text-14px text-#334155">拆单策略：{{ splitPolicySummary }}</div>
            <div class="text-14px text-#334155">
              回调地址：
              <span class="break-all">{{ pickValue(callbackConfig, ['callbackUrl']) }}</span>
            </div>
          </NSpace>
        </NCard>
      </NGi>

      <NGi>
        <NCard title="渠道原始 JSON" :bordered="false" class="card-wrapper">
          <NCode :code="toPrettyJson(channel)" language="json" word-wrap />
        </NCard>
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
      <NTabPane name="readiness" tab="充值开通">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="开通检查清单" :bordered="false" class="card-wrapper">
              <div class="mb-12px text-13px text-#64748b">
                只有当以下项目基本配置完成，渠道平台的单笔充值与批量充值才具备稳定上线条件。
              </div>
              <NList bordered>
                <NListItem v-for="item in readinessItems" :key="item.key">
                  <div class="flex items-start justify-between gap-12px">
                    <div class="flex-1">
                      <div class="text-14px text-#0f172a font-600">{{ item.label }}</div>
                      <div class="mt-4px text-13px text-#64748b">{{ item.detail }}</div>
                    </div>
                    <NTag size="small" :type="item.ready ? 'success' : 'warning'">
                      {{ item.ready ? '已完成' : '待处理' }}
                    </NTag>
                  </div>
                </NListItem>
              </NList>
            </NCard>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <NCard title="渠道平台配合开发要求" :bordered="false" class="card-wrapper">
                <div class="text-14px text-#334155 leading-7">
                  <div class="font-600 text-#0f172a">单笔充值流程</div>
                  <ol class="m-0 mt-8px list-decimal pl-20px">
                    <li>先通过 <code>POST /portal/auth/login</code> 登录渠道门户，获取 Bearer Token。</li>
                    <li>调用 <code>GET /portal/me</code> 获取当前渠道身份与授权信息。</li>
                    <li>调用 <code>GET /open-api/products/</code> 获取可售商品列表。</li>
                    <li>用户输入手机号、面值、商品类型后，先调 <code>POST /open-api/orders/preview-split</code> 预览运营商、省份和拆单结果。</li>
                    <li>用户确认后，再调用 <code>POST /open-api/orders/</code> 正式创建订单。</li>
                    <li>下单完成后，用 <code>GET /open-api/orders/{orderNo}</code> 查订单状态，用 <code>GET /open-api/orders/{orderNo}/events</code> 查看事件日志。</li>
                    <li>如需主动拉取最新状态，可调用 <code>POST /open-api/orders/{orderNo}/refresh-status</code>。</li>
                  </ol>

                  <div class="mt-16px font-600 text-#0f172a">批量充值流程</div>
                  <ol class="m-0 mt-8px list-decimal pl-20px">
                    <li>先下载 <code>GET /open-api/orders/batch-template</code> 模板，按模板导入批量订单。</li>
                    <li>批量导入前，建议前端逐条调用 <code>preview-split</code> 做预览校验，因为当前后端没有独立的“批量预览接口”。</li>
                    <li>可走 <code>POST /open-api/orders/batch-import</code> 上传文件，也可走 <code>POST /open-api/orders/batch</code> 直接提交批量数据。</li>
                    <li>提交后通过 <code>GET /open-api/orders/batch-jobs/{jobId}</code> 查询批任务状态，再用 <code>GET /open-api/orders/batch-jobs/{jobId}/items</code> 查看逐条结果。</li>
                  </ol>
                </div>
              </NCard>

              <NCard title="联调约束与注意事项" :bordered="false" class="card-wrapper">
                <ul class="m-0 list-disc pl-20px text-14px text-#334155 leading-7">
                  <li><code>channelOrderNo</code> 必须由渠道侧生成并保证唯一，作为幂等单号使用。</li>
                  <li><code>preview-split</code> 和批量接口使用字段 <code>productType</code>，单笔正式下单接口使用字段 <code>product_type</code>，前端要严格区分。</li>
                  <li><code>POST /open-api/orders/</code> 成功只表示订单创建成功，不等于充值到账成功。</li>
                  <li>充值结果日志请读取 <code>/open-api/orders/{orderNo}/events</code>，不要把后台内部通知投递明细当作渠道回执。</li>
                  <li>渠道平台前端需要在下单前展示运营商、省份、拆单结果与预计供货价，确认后再提交正式订单。</li>
                  <li>批量充值需要给出逐条失败原因、任务级汇总统计、重试与导出能力。</li>
                </ul>
              </NCard>
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="portal" tab="门户账号">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="账号状态" :bordered="false" class="card-wrapper">
                <NDescriptions bordered :column="1" label-placement="left">
                  <NDescriptionsItem label="渠道 ID">{{ pickValue(portalAccount, ['channelId'], channelId) }}</NDescriptionsItem>
                  <NDescriptionsItem label="门户账号">{{ pickValue(portalAccount, ['portalAccount']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="门户状态">
                    <NTag size="small" :type="portalTagType">{{ portalStatus }}</NTag>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="开通时间">{{ pickValue(portalAccount, ['portalOpenedAt']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="审核通过时间">{{ pickValue(portalAccount, ['portalApprovedAt']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="最近登录时间">{{ pickValue(portalAccount, ['lastLoginAt']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="驳回原因">{{ pickValue(portalAccount, ['portalRejectReason']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="渠道状态">{{ pickValue(portalAccount, ['channelStatus']) }}</NDescriptionsItem>
                </NDescriptions>

                <div class="mt-16px flex flex-wrap gap-12px">
                  <NButton type="primary" :loading="saving" @click="handleApprovePortalAccount">审核通过</NButton>
                  <NButton type="warning" :loading="saving" @click="handleDisablePortalAccount">禁用账号</NButton>
                  <NButton type="success" :loading="saving" @click="handleEnablePortalAccount">启用账号</NButton>
                </div>
              </NCard>

              <NCard title="开通门户账号" :bordered="false" class="card-wrapper">
                <NForm
                  ref="portalOpenFormRef"
                  :model="portalOpenForm"
                  :rules="portalOpenRules"
                  label-placement="left"
                  label-width="108"
                >
                  <NFormItem label="门户账号" path="portalAccount">
                    <NInput v-model:value="portalOpenForm.portalAccount" />
                  </NFormItem>
                  <NFormItem label="初始密码" path="password">
                    <NInput v-model:value="portalOpenForm.password" type="password" show-password-on="click" />
                  </NFormItem>
                  <NButton type="primary" :loading="saving" @click="handleOpenPortalAccount">开通账号</NButton>
                </NForm>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <NCard title="驳回开户申请" :bordered="false" class="card-wrapper">
                <NForm
                  ref="portalRejectFormRef"
                  :model="portalRejectForm"
                  :rules="portalRejectRules"
                  label-placement="left"
                  label-width="108"
                >
                  <NFormItem label="驳回原因" path="reason">
                    <NInput
                      v-model:value="portalRejectForm.reason"
                      type="textarea"
                      :autosize="{ minRows: 4, maxRows: 6 }"
                    />
                  </NFormItem>
                  <NButton type="warning" :loading="saving" @click="handleRejectPortalAccount">提交驳回</NButton>
                </NForm>
              </NCard>

              <NCard title="重置门户密码" :bordered="false" class="card-wrapper">
                <NForm
                  ref="portalResetFormRef"
                  :model="portalResetForm"
                  :rules="portalResetRules"
                  label-placement="left"
                  label-width="108"
                >
                  <NFormItem label="新密码" path="password">
                    <NInput v-model:value="portalResetForm.password" type="password" show-password-on="click" />
                  </NFormItem>
                  <NButton type="primary" :loading="saving" @click="handleResetPortalPassword">重置密码</NButton>
                </NForm>
              </NCard>

              <NCard title="门户账号原始 JSON" :bordered="false" class="card-wrapper">
                <NCode :code="toPrettyJson(portalAccount)" language="json" word-wrap />
              </NCard>
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="credential" tab="凭证与回调">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="接口凭证" :bordered="false" class="card-wrapper">
              <NList bordered>
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
                  <NButton type="primary" :loading="saving" @click="handleCreateApiKey">保存凭证</NButton>
                </NForm>
              </div>
            </NCard>
          </NGi>

          <NGi>
            <NCard title="订单回调配置" :bordered="false" class="card-wrapper">
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
                <NFormItem label="签名密钥" path="signSecret">
                  <NInput v-model:value="callbackForm.signSecret" />
                </NFormItem>
                <NFormItem label="超时秒数">
                  <NInputNumber v-model:value="callbackForm.timeoutSeconds" :min="1" class="w-full" />
                </NFormItem>
                <NButton type="primary" :loading="saving" @click="handleSaveCallback">保存回调配置</NButton>
              </NForm>

              <NCode class="mt-16px" :code="toPrettyJson(callbackConfig)" language="json" word-wrap />
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="product" tab="商品与供货价">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="商品授权" :bordered="false" class="card-wrapper">
                <NForm
                  ref="productFormRef"
                  :model="productForm"
                  :rules="productRules"
                  label-placement="left"
                  label-width="96"
                >
                  <NFormItem label="平台商品" path="productId">
                    <NSelect v-model:value="productForm.productId" :options="productOptions" filterable />
                  </NFormItem>
                  <NButton type="primary" :loading="saving" @click="handleAuthorizeProduct">保存授权</NButton>
                </NForm>
                <div class="mt-12px flex flex-wrap gap-8px">
                  <NTag v-for="item in authorizedProducts" :key="getEntityId(item, ['productId', 'id'])" type="success">
                    {{ pickValue(item, ['productName']) }}
                  </NTag>
                  <span v-if="!authorizedProducts.length" class="text-13px text-#64748b">暂无已授权商品</span>
                </div>
              </NCard>

              <NCard title="渠道供货价" :bordered="false" class="card-wrapper">
                <NForm
                  ref="priceFormRef"
                  :model="priceForm"
                  :rules="priceRules"
                  label-placement="left"
                  label-width="110"
                >
                  <NFormItem label="平台商品" path="productId">
                    <NSelect v-model:value="priceForm.productId" :options="productOptions" filterable />
                  </NFormItem>
                  <NFormItem label="供货价(分)" path="salePrice">
                    <NInputNumber v-model:value="priceForm.salePrice" :min="0" class="w-full" />
                  </NFormItem>
                  <NAlert type="info" :show-icon="false" class="mb-12px">
                    这里配置的是该渠道的供货价，用于决定渠道侧下单时的售价策略、利润空间和实际可售商品。
                  </NAlert>
                  <NButton type="primary" :loading="saving" @click="handleSavePrice">保存供货价</NButton>
                </NForm>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NCard title="当前价格策略" :bordered="false" class="card-wrapper">
              <NDataTable
                :columns="priceColumns"
                :data="priceRows"
                :pagination="{ pageSize: 10 }"
                :row-key="row => getEntityId(row, ['id', 'productId'])"
              />
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="split" tab="拆单策略">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="拆单策略配置" :bordered="false" class="card-wrapper">
              <NForm
                ref="splitFormRef"
                :model="splitForm"
                :rules="splitRules"
                label-placement="left"
                label-width="128"
              >
                <NFormItem label="启用拆单">
                  <NSwitch v-model:value="splitForm.enabled" />
                </NFormItem>
                <NFormItem label="允许面值" path="allowedFaceValues">
                  <NSelect
                    v-model:value="splitForm.allowedFaceValues"
                    :options="faceValueOptions"
                    multiple
                    filterable
                    clearable
                  />
                </NFormItem>
                <NFormItem label="优先大面值">
                  <NSwitch v-model:value="splitForm.preferMaxSingleFaceValue" />
                </NFormItem>
                <NFormItem label="最大拆单笔数" path="maxSplitPieces">
                  <NInputNumber v-model:value="splitForm.maxSplitPieces" :min="1" class="w-full" />
                </NFormItem>
                <NFormItem label="省份覆盖">
                  <NInput v-model:value="splitForm.provinceOverride" placeholder="例如：广东" />
                </NFormItem>
                <NFormItem label="运营商覆盖">
                  <NInput v-model:value="splitForm.carrierOverride" placeholder="例如：CMCC / CUCC / CTCC" />
                </NFormItem>
                <NAlert type="info" :show-icon="false" class="mb-12px">
                  渠道平台在正式下单前，应先调用 <code>preview-split</code> 获取拆单预览结果。批量充值如需“先预览再确认”，需要前端逐条调用预览接口。
                </NAlert>
                <NButton type="primary" :loading="saving" @click="handleSaveSplitPolicy">保存拆单策略</NButton>
              </NForm>
            </NCard>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <NCard title="拆单策略摘要" :bordered="false" class="card-wrapper">
                <NDescriptions bordered :column="1" label-placement="left">
                  <NDescriptionsItem label="状态">
                    <NTag size="small" :type="toBoolean(splitPolicy.enabled) ? 'success' : 'default'">
                      {{ toBoolean(splitPolicy.enabled) ? '启用' : '关闭' }}
                    </NTag>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="允许面值">
                    {{
                      summarizeFaceValues(
                        Array.isArray(splitPolicy.allowedFaceValues)
                          ? splitPolicy.allowedFaceValues.map(value => Number(value)).filter(value => !Number.isNaN(value))
                          : []
                      )
                    }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="优先大面值">
                    {{ toBoolean(splitPolicy.preferMaxSingleFaceValue) ? '是' : '否' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="最大拆单笔数">{{ pickValue(splitPolicy, ['maxSplitPieces'], '1') }}</NDescriptionsItem>
                  <NDescriptionsItem label="省份覆盖">{{ pickValue(splitPolicy, ['provinceOverride']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="运营商覆盖">{{ pickValue(splitPolicy, ['carrierOverride']) }}</NDescriptionsItem>
                </NDescriptions>
              </NCard>

              <NCard title="拆单策略原始 JSON" :bordered="false" class="card-wrapper">
                <NCode :code="toPrettyJson(splitPolicy)" language="json" word-wrap />
              </NCard>
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="limit" tab="额度与余额">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="限额规则" :bordered="false" class="card-wrapper">
                <NForm
                  ref="limitFormRef"
                  :model="limitForm"
                  :rules="limitRules"
                  label-placement="left"
                  label-width="110"
                >
                  <NFormItem label="单笔限额(分)" path="singleLimit">
                    <NInputNumber v-model:value="limitForm.singleLimit" :min="0" class="w-full" />
                  </NFormItem>
                  <NFormItem label="日限额(分)" path="dailyLimit">
                    <NInputNumber v-model:value="limitForm.dailyLimit" :min="0" class="w-full" />
                  </NFormItem>
                  <NFormItem label="月限额(分)" path="monthlyLimit">
                    <NInputNumber v-model:value="limitForm.monthlyLimit" :min="0" class="w-full" />
                  </NFormItem>
                  <NFormItem label="QPS 限额" path="qpsLimit">
                    <NInputNumber v-model:value="limitForm.qpsLimit" :min="1" class="w-full" />
                  </NFormItem>
                  <NButton type="primary" :loading="saving" @click="handleSaveLimit">保存限额</NButton>
                </NForm>
              </NCard>

              <NCard title="渠道余额充值" :bordered="false" class="card-wrapper">
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
                  <NFormItem label="充值备注" path="remark">
                    <NInput
                      v-model:value="rechargeForm.remark"
                      type="textarea"
                      :autosize="{ minRows: 4, maxRows: 6 }"
                    />
                  </NFormItem>
                  <NButton type="primary" :loading="saving" @click="handleRecharge">提交充值</NButton>
                </NForm>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <NCard title="余额概览" :bordered="false" class="card-wrapper">
                <NDescriptions bordered :column="1" label-placement="left">
                  <NDescriptionsItem label="可用余额">
                    {{ formatAmountFen(balanceFen, '未返回余额') }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="币种">{{ pickValue(channelBalance, ['currency'], 'CNY') }}</NDescriptionsItem>
                  <NDescriptionsItem label="更新时间">{{ pickValue(channelBalance, ['updatedAt', 'createdAt']) }}</NDescriptionsItem>
                  <NDescriptionsItem label="余额状态">
                    <NTag size="small" :type="balanceFen > 0 ? 'success' : 'warning'">
                      {{ balanceFen > 0 ? '可下单' : '待充值' }}
                    </NTag>
                  </NDescriptionsItem>
                </NDescriptions>
              </NCard>

              <NCard title="最近充值记录" :bordered="false" class="card-wrapper">
                <NDataTable
                  :columns="rechargeColumns"
                  :data="recentRechargeRows"
                  :pagination="{ pageSize: 5 }"
                  :row-key="row => getEntityId(row, ['id', 'recordId', 'channelRechargeRecordId'])"
                />
              </NCard>

              <NCard title="下单策略原始 JSON" :bordered="false" class="card-wrapper">
                <NCode :code="toPrettyJson(orderPolicy)" language="json" word-wrap />
              </NCard>
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>
    </NTabs>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
