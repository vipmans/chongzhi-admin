<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import {
  createChannelApiKey,
  fetchChannelApiKeys,
  fetchChannelCallbackConfig,
  fetchChannelDetail,
  fetchChannelOrderPolicy,
  fetchProducts,
  rechargeChannel,
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
const products = ref<Api.Admin.RawRecord[]>([]);

const apiKeyFormRef = ref<FormInst | null>(null);
const callbackFormRef = ref<FormInst | null>(null);
const productFormRef = ref<FormInst | null>(null);
const priceFormRef = ref<FormInst | null>(null);
const limitFormRef = ref<FormInst | null>(null);
const rechargeFormRef = ref<FormInst | null>(null);

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
    render: row => formatAmountFen(row.saleAmountFen)
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
  signSecret: [{ required: true, message: '请输入回调密钥', trigger: 'blur' }]
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
    const [channelData, apiKeyData, callbackData, policyData, productData] = await Promise.all([
      fetchChannelDetail(channelId.value),
      fetchChannelApiKeys(channelId.value),
      fetchChannelCallbackConfig(channelId.value),
      fetchChannelOrderPolicy(channelId.value),
      fetchProducts({ pageNum: 1, pageSize: 200 })
    ]);

    channel.value = extractObjectData(channelData);
    apiKeys.value = extractListData(apiKeyData);
    callbackConfig.value = extractObjectData(callbackData);
    orderPolicy.value = extractObjectData(policyData);
    products.value = extractPagedData(productData).records;

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
      新版 API 不支持前端直接修改渠道主体基础信息，因此详情页以读取主体档案为主，重点提供凭证、回调、商品授权、渠道供货价、限额和充值配置能力。
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
            <div class="text-14px">
              回调地址：
              <span class="break-all">{{ pickValue(callbackConfig, ['callbackUrl']) }}</span>
            </div>
            <div class="text-14px">回调超时：{{ pickValue(callbackConfig, ['timeoutSeconds']) }} 秒</div>
            <NTag type="info" round>渠道供货价由 `channel-prices` 接口单独配置</NTag>
          </NSpace>
        </NCard>
      </NGi>
      <NGi>
        <RawJsonCard title="渠道详情原始 JSON" :value="channel" />
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
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

              <div class="mt-16px">
                <RawJsonCard title="回调配置原始 JSON" :value="callbackConfig" />
              </div>
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
                    这里配置的是渠道侧供货价，例如 100 元话费可给不同渠道分别配置 10100、10050 等价格。
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
                  <NAlert type="info" :show-icon="false" class="mb-12px">
                    渠道充值接口只返回操作结果，不返回余额快照；首次充值时后端会自动初始化渠道账务账户。
                  </NAlert>
                  <NButton type="primary" :loading="saving" @click="handleRecharge">提交充值</NButton>
                </NForm>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <RawJsonCard title="下单策略原始 JSON" :value="orderPolicy" />
              <RawJsonCard title="限额规则原始 JSON" :value="orderPolicy.limitRule ?? {}" />
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
