<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInst, SelectOption } from 'naive-ui';
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
import { extractListData, extractObjectData, extractPagedData, getEntityId, normalizeQuery, pickValue } from '@/utils/admin';

const route = useRoute();
const channelId = computed(() => String(route.params.id || ''));
const loading = ref(false);
const products = ref<Api.Admin.RawRecord[]>([]);
const channel = ref<Api.Admin.RawRecord>({});
const apiKeys = ref<Api.Admin.RawRecord[]>([]);
const callbackConfig = ref<Api.Admin.RawRecord>({});
const orderPolicy = ref<Api.Admin.RawRecord>({});

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

const rechargeForm = reactive<Api.Admin.RechargeChannelPayload>({
  amount: 0,
  remark: ''
});

const authorizedProductIds = computed<string[]>(() => {
  const list = orderPolicy.value.authorizedProductIds;
  return Array.isArray(list) ? list.map(item => String(item)) : [];
});

const pricePolicies = computed<Api.Admin.RawRecord[]>(() => extractListData(orderPolicy.value.pricePolicies));
const limitRule = computed(() => extractObjectData(orderPolicy.value.limitRule));

const productOptions = computed<SelectOption[]>(() =>
  products.value.map(item => ({
    label: `${pickValue(item, ['productName'])} (${pickValue(item, ['productCode'])})`,
    value: getEntityId(item, ['productId', 'id', 'productCode'])
  }))
);

const apiKeyRules: Record<string, App.Global.FormRule[]> = {
  accessKey: [{ required: true, message: '请输入 accessKey', trigger: 'blur' }],
  secretKey: [{ required: true, message: '请输入 secretKey', trigger: 'blur' }]
};

const callbackRules: Record<string, App.Global.FormRule[]> = {
  callbackUrl: [{ required: true, message: '请输入回调地址', trigger: 'blur' }],
  signSecret: [{ required: true, message: '请输入签名密钥', trigger: 'blur' }]
};

const strategyRules: Record<string, App.Global.FormRule[]> = {
  productId: [{ required: true, message: '请选择商品', trigger: 'change' }]
};

const priceRules: Record<string, App.Global.FormRule[]> = {
  productId: [{ required: true, message: '请选择商品', trigger: 'change' }],
  salePrice: [{ required: true, type: 'number', message: '请输入销售价', trigger: 'blur' }]
};

const limitRules: Record<string, App.Global.FormRule[]> = {
  singleLimit: [{ required: true, type: 'number', message: '请输入单笔限额', trigger: 'blur' }],
  dailyLimit: [{ required: true, type: 'number', message: '请输入日限额', trigger: 'blur' }],
  monthlyLimit: [{ required: true, type: 'number', message: '请输入月限额', trigger: 'blur' }],
  qpsLimit: [{ required: true, type: 'number', message: '请输入 QPS 限额', trigger: 'blur' }]
};

const rechargeRules: Record<string, App.Global.FormRule[]> = {
  amount: [{ required: true, type: 'number', message: '请输入充值金额', trigger: 'blur' }]
};

function syncForms() {
  apiKeyForm.channelId = channelId.value;
  callbackForm.channelId = channelId.value;
  productAuthForm.channelId = channelId.value;
  priceForm.channelId = channelId.value;
  limitForm.channelId = channelId.value;
}

async function loadDetail() {
  loading.value = true;
  syncForms();

  try {
    const [channelRes, productsRes, apiKeysRes, callbackRes, policyRes] = await Promise.all([
      fetchChannelDetail(channelId.value),
      fetchProducts({ pageNum: 1, pageSize: 100 }),
      fetchChannelApiKeys(channelId.value),
      fetchChannelCallbackConfig(channelId.value),
      fetchChannelOrderPolicy(channelId.value)
    ]);

    channel.value = extractObjectData(channelRes.data);
    products.value = extractPagedData(productsRes.data).records;
    apiKeys.value = extractListData(apiKeysRes.data);
    callbackConfig.value = extractObjectData(callbackRes.data);
    orderPolicy.value = extractObjectData(policyRes.data);

    callbackForm.callbackUrl = pickValue(callbackConfig.value, ['callbackUrl'], '');
    callbackForm.signSecret = pickValue(callbackConfig.value, ['signSecret'], '');
    callbackForm.timeoutSeconds = Number(pickValue(callbackConfig.value, ['timeoutSeconds'], '30')) || 30;

    const limitData = extractObjectData(orderPolicy.value.limitRule);
    limitForm.singleLimit = Number(pickValue(limitData, ['singleLimit'], '0')) || 0;
    limitForm.dailyLimit = Number(pickValue(limitData, ['dailyLimit'], '0')) || 0;
    limitForm.monthlyLimit = Number(pickValue(limitData, ['monthlyLimit'], '0')) || 0;
    limitForm.qpsLimit = Number(pickValue(limitData, ['qpsLimit'], '1')) || 1;
  } finally {
    loading.value = false;
  }
}

async function submitApiKey() {
  await apiKeyFormRef.value?.validate();
  await createChannelApiKey({ ...apiKeyForm });
  window.$message?.success('渠道凭证已保存');
  apiKeyForm.accessKey = '';
  apiKeyForm.secretKey = '';
  await loadDetail();
}

async function submitCallback() {
  await callbackFormRef.value?.validate();
  await saveChannelCallbackConfig({ ...callbackForm });
  window.$message?.success('回调配置已保存');
  await loadDetail();
}

async function submitProductAuth() {
  await productFormRef.value?.validate();
  await saveChannelProduct({ ...productAuthForm });
  window.$message?.success('商品授权已保存');
  await loadDetail();
}

async function submitPrice() {
  await priceFormRef.value?.validate();
  await saveChannelPrice({ ...priceForm, salePrice: Number(priceForm.salePrice) });
  window.$message?.success('销售价策略已保存');
  await loadDetail();
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
  await loadDetail();
}

async function submitRecharge() {
  await rechargeFormRef.value?.validate();
  await rechargeChannel(channelId.value, {
    amount: Number(rechargeForm.amount),
    remark: rechargeForm.remark?.trim() || undefined
  });
  window.$message?.success('渠道账户充值已提交');
  rechargeForm.amount = 0;
  rechargeForm.remark = '';
}

onMounted(() => {
  loadDetail();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper" :loading="loading">
      <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">{{ pickValue(channel, ['channelName', 'name'], '渠道详情') }}</h2>
          <span class="text-14px text-#64748b">
            渠道编码：{{ pickValue(channel, ['channelCode', 'code']) }} | 渠道类型：{{ pickValue(channel, ['channelType', 'type']) }}
          </span>
        </div>
        <NButton @click="loadDetail">刷新详情</NButton>
      </div>
    </NCard>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="主体信息" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="渠道ID">{{ pickValue(channel, ['id', 'channelId']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道编码">{{ pickValue(channel, ['channelCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道名称">{{ pickValue(channel, ['channelName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道类型">{{ pickValue(channel, ['channelType']) }}</NDescriptionsItem>
            <NDescriptionsItem label="状态">{{ pickValue(channel, ['status']) }}</NDescriptionsItem>
            <NDescriptionsItem label="结算模式">{{ pickValue(channel, ['settlementMode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="创建时间">{{ pickValue(channel, ['createdAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <RawJsonCard title="渠道主体原始 JSON" :value="channel" />
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
      <NTabPane name="api-key" tab="接口凭证">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="已有凭证" :bordered="false" class="card-wrapper">
              <NList>
                <NListItem v-for="item in apiKeys" :key="getEntityId(item, ['id', 'channelId', 'accessKey'])">
                  <div class="flex flex-col gap-4px">
                    <span>accessKey：{{ pickValue(item, ['accessKey']) }}</span>
                    <span>签名算法：{{ pickValue(item, ['signAlgorithm']) }}</span>
                    <span>状态：{{ pickValue(item, ['status']) }}</span>
                    <span>过期时间：{{ pickValue(item, ['expiresAt']) }}</span>
                  </div>
                </NListItem>
                <NEmpty v-if="!apiKeys.length" description="暂无接口凭证" />
              </NList>
            </NCard>
          </NGi>
          <NGi>
            <NCard title="新增凭证" :bordered="false" class="card-wrapper">
              <NForm ref="apiKeyFormRef" :model="apiKeyForm" :rules="apiKeyRules" label-placement="left" label-width="96">
                <NFormItem label="AccessKey" path="accessKey">
                  <NInput v-model:value="apiKeyForm.accessKey" />
                </NFormItem>
                <NFormItem label="SecretKey" path="secretKey">
                  <NInput v-model:value="apiKeyForm.secretKey" />
                </NFormItem>
                <NButton type="primary" @click="submitApiKey">保存凭证</NButton>
              </NForm>
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="callback" tab="回调配置">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="回调参数" :bordered="false" class="card-wrapper">
              <NForm ref="callbackFormRef" :model="callbackForm" :rules="callbackRules" label-placement="left" label-width="110">
                <NFormItem label="回调地址" path="callbackUrl">
                  <NInput v-model:value="callbackForm.callbackUrl" />
                </NFormItem>
                <NFormItem label="签名密钥" path="signSecret">
                  <NInput v-model:value="callbackForm.signSecret" />
                </NFormItem>
                <NFormItem label="超时秒数" path="timeoutSeconds">
                  <NInputNumber v-model:value="callbackForm.timeoutSeconds" :min="1" class="w-full" />
                </NFormItem>
                <NButton type="primary" @click="submitCallback">保存回调配置</NButton>
              </NForm>
            </NCard>
          </NGi>
          <NGi>
            <RawJsonCard title="当前回调配置" :value="callbackConfig" />
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="policy" tab="下单策略">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="商品授权" :bordered="false" class="card-wrapper">
                <NForm ref="productFormRef" :model="productAuthForm" :rules="strategyRules" label-placement="left" label-width="96">
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
                <NForm ref="priceFormRef" :model="priceForm" :rules="priceRules" label-placement="left" label-width="96">
                  <NFormItem label="平台商品" path="productId">
                    <NSelect v-model:value="priceForm.productId" :options="productOptions" />
                  </NFormItem>
                  <NFormItem label="销售价" path="salePrice">
                    <NInputNumber v-model:value="priceForm.salePrice" :min="0" class="w-full" />
                  </NFormItem>
                  <NButton type="primary" @click="submitPrice">保存价格</NButton>
                </NForm>
                <NDataTable
                  class="mt-12px"
                  :columns="[
                    { key: 'productId', title: '商品ID' },
                    { key: 'salePrice', title: '销售价' }
                  ]"
                  :data="pricePolicies"
                  :pagination="false"
                  :row-key="row => getEntityId(row, ['productId', 'id'])"
                />
              </NCard>

              <NCard title="限额策略" :bordered="false" class="card-wrapper">
                <NForm ref="limitFormRef" :model="limitForm" :rules="limitRules" label-placement="left" label-width="96">
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
            </NSpace>
          </NGi>
          <NGi>
            <RawJsonCard title="限额规则" :value="limitRule" />
            <div class="h-16px" />
            <RawJsonCard title="当前下单策略" :value="orderPolicy" />
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="recharge" tab="账户充值">
        <NCard title="渠道账户充值" :bordered="false" class="card-wrapper">
          <NForm ref="rechargeFormRef" :model="rechargeForm" :rules="rechargeRules" label-placement="left" label-width="96">
            <NFormItem label="充值金额" path="amount">
              <NInputNumber v-model:value="rechargeForm.amount" :min="0.01" class="w-full" />
            </NFormItem>
            <NFormItem label="备注">
              <NInput v-model:value="rechargeForm.remark" type="textarea" />
            </NFormItem>
            <NButton type="primary" @click="submitRecharge">提交充值</NButton>
          </NForm>
        </NCard>
      </NTabPane>
    </NTabs>
  </NSpace>
</template>
