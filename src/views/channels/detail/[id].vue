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
  fetchChannelCallbackConfig,
  fetchChannelDetail,
  fetchChannelOrderPolicy,
  fetchChannelPortalAccount,
  fetchProducts,
  openChannelPortalAccount,
  rechargeChannel,
  rejectChannelPortalAccount,
  resetChannelPortalPassword,
  saveChannelCallbackConfig,
  saveChannelLimit,
  saveChannelPrice,
  saveChannelProduct
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

const apiKeyFormRef = ref<FormInst | null>(null);
const callbackFormRef = ref<FormInst | null>(null);
const productFormRef = ref<FormInst | null>(null);
const priceFormRef = ref<FormInst | null>(null);
const limitFormRef = ref<FormInst | null>(null);
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

const productOptions = computed<SelectOption[]>(() =>
  products.value.map(item => ({
    label: `${pickValue(item, ['productName'])} (${pickValue(item, ['productCode'])})`,
    value: getEntityId(item, ['productId', 'id'])
  }))
);

const priceRows = computed(() => extractListData(orderPolicy.value.pricePolicies));
const authorizedProductIds = computed<string[]>(() =>
  Array.isArray(orderPolicy.value.authorizedProductIds) ? orderPolicy.value.authorizedProductIds.map(String) : []
);

const authorizedProducts = computed(() =>
  products.value.filter(item => authorizedProductIds.value.includes(getEntityId(item, ['productId', 'id'])))
);

const portalStatus = computed(() => pickValue(portalAccount.value, ['portalStatus'], '-'));
const portalTagType = computed(() => {
  const status = portalStatus.value;

  if (['APPROVED', 'ACTIVE', 'ENABLED'].includes(status)) {
    return 'success';
  }

  if (['PENDING', 'WAITING_APPROVAL'].includes(status)) {
    return 'warning';
  }

  if (['REJECTED', 'DISABLED'].includes(status)) {
    return 'error';
  }

  return 'default';
});

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
    render: row => pickValue(row, ['status'])
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
        { default: () => '原始数据' }
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

  callbackForm.callbackUrl = pickValue(callbackConfig.value, ['callbackUrl'], '');
  callbackForm.timeoutSeconds = Number(callbackConfig.value.timeoutSeconds ?? 30) || 30;
  callbackForm.signSecret = '';

  const limitRule = extractObjectData(orderPolicy.value.limitRule);
  limitForm.singleLimit = Number(limitRule.singleLimitAmountFen ?? limitRule.singleLimit ?? 0) || 0;
  limitForm.dailyLimit = Number(limitRule.dailyLimitAmountFen ?? limitRule.dailyLimit ?? 0) || 0;
  limitForm.monthlyLimit = Number(limitRule.monthlyLimitAmountFen ?? limitRule.monthlyLimit ?? 0) || 0;
  limitForm.qpsLimit = Number(limitRule.qpsLimit ?? 1) || 1;
}

async function loadPage() {
  loading.value = true;

  try {
    const [channelData, apiKeyData, callbackData, policyData, productData, portalData] = await Promise.all([
      fetchChannelDetail(channelId.value),
      fetchChannelApiKeys(channelId.value),
      fetchChannelCallbackConfig(channelId.value),
      fetchChannelOrderPolicy(channelId.value),
      fetchProducts({ pageNum: 1, pageSize: 200 }),
      fetchChannelPortalAccount(channelId.value)
    ]);

    channel.value = extractObjectData(channelData);
    apiKeys.value = extractListData(apiKeyData);
    callbackConfig.value = extractObjectData(callbackData);
    orderPolicy.value = extractObjectData(policyData);
    products.value = extractPagedData(productData).records;
    portalAccount.value = extractObjectData(portalData);

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
    window.$message?.success('渠道凭证已保存');
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

async function handleRecharge() {
  await rechargeFormRef.value?.validate();
  saving.value = true;

  try {
    await rechargeChannel(channelId.value, {
      amount: Number(rechargeForm.amount),
      remark: rechargeForm.remark.trim()
    });
    window.$message?.success('渠道充值已提交');
    rechargeForm.amount = 0;
    rechargeForm.remark = '';
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
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">
            {{ pickValue(channel, ['channelName'], '渠道详情') }}
          </h2>
          <span class="text-14px text-#64748b">
            渠道编码：{{ pickValue(channel, ['channelCode'], channelId) }} | 渠道类型：{{ pickValue(channel, ['channelType']) }} |
            状态：{{ pickValue(channel, ['status']) }}
          </span>
        </div>
        <NButton @click="loadPage">刷新</NButton>
      </div>
    </NCard>

    <NAlert type="info" :show-icon="false">
      当前页面已按新 `api.json` 对齐，除渠道凭证、回调、商品授权、供货价、限额与充值外，还新增支持渠道门户账号开通与审核流转。
    </NAlert>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="主体信息" :bordered="false" class="card-wrapper">
          <NDescriptions bordered :column="1" label-placement="left">
            <NDescriptionsItem label="渠道 ID">{{ getEntityId(channel, ['channelId', 'id']) || channelId }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道编码">{{ pickValue(channel, ['channelCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道名称">{{ pickValue(channel, ['channelName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道类型">{{ pickValue(channel, ['channelType']) }}</NDescriptionsItem>
            <NDescriptionsItem label="结算模式">{{ pickValue(channel, ['settlementMode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ pickValue(channel, ['updatedAt', 'createdAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="策略摘要" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="10">
            <div class="text-14px">已授权商品数：{{ authorizedProductIds.length }}</div>
            <div class="text-14px">价格策略数：{{ priceRows.length }}</div>
            <div class="text-14px">回调地址：<span class="break-all">{{ pickValue(callbackConfig, ['callbackUrl']) }}</span></div>
            <div class="text-14px">回调超时：{{ pickValue(callbackConfig, ['timeoutSeconds']) }} 秒</div>
            <div class="text-14px">
              门户账号状态：
              <NTag size="small" :type="portalTagType">{{ portalStatus }}</NTag>
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
      <NTabPane name="portal" tab="门户账号">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="账号状态" :bordered="false" class="card-wrapper">
                <NDescriptions bordered :column="1" label-placement="left">
                  <NDescriptionsItem label="渠道ID">{{ pickValue(portalAccount, ['channelId'], channelId) }}</NDescriptionsItem>
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
                <NFormItem label="回调密钥" path="signSecret">
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
                    这里配置的是该渠道的供货价，可用于区分不同渠道的销售价格策略。
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

      <NTabPane name="limit" tab="限额与充值">
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

              <NCard title="渠道充值" :bordered="false" class="card-wrapper">
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
              <NCard title="下单策略原始 JSON" :bordered="false" class="card-wrapper">
                <NCode :code="toPrettyJson(orderPolicy)" language="json" word-wrap />
              </NCard>
              <NCard title="限额规则原始 JSON" :bordered="false" class="card-wrapper">
                <NCode :code="toPrettyJson(orderPolicy.limitRule ?? {})" language="json" word-wrap />
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
