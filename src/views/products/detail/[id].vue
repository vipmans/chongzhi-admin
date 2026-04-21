<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInst } from 'naive-ui';
import { fetchProductDetail, updateProduct } from '@/service/api';
import { extractObjectData, getEntityId, pickValue } from '@/utils/admin';

const route = useRoute();
const productId = computed(() => String(route.params.id || ''));

const loading = ref(false);
const saving = ref(false);
const formRef = ref<FormInst | null>(null);
const detail = ref<Api.Admin.RawRecord>({});

const formModel = reactive<Api.Admin.SaveProductPayload>({
  productCode: '',
  productName: '',
  carrierCode: 'CMCC',
  provinceName: '',
  faceValue: 0,
  productType: 'FAST',
  salesUnit: '',
  status: 'ACTIVE'
});

const carrierOptions = [
  { label: '中国移动', value: 'CMCC' },
  { label: '中国电信', value: 'CTCC' },
  { label: '中国联通', value: 'CUCC' },
  { label: '广电', value: 'CBN' }
];

const productTypeOptions = [
  { label: 'FAST', value: 'FAST' },
  { label: 'MIXED', value: 'MIXED' }
];

const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const rules: Record<string, App.Global.FormRule[]> = {
  productCode: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  productName: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  provinceName: [{ required: true, message: '请输入省份', trigger: 'blur' }],
  faceValue: [{ required: true, type: 'number', message: '请输入面值', trigger: 'blur' }],
  salesUnit: [{ required: true, message: '请输入销售单位', trigger: 'blur' }]
};

function syncForm(record: Api.Admin.RawRecord) {
  formModel.productCode = pickValue(record, ['productCode'], '');
  formModel.productName = pickValue(record, ['productName'], '');
  formModel.carrierCode = pickValue(record, ['carrierCode'], 'CMCC') as Api.Admin.CarrierCode;
  formModel.provinceName = pickValue(record, ['provinceName'], '');
  formModel.faceValue = Number(record.faceValueAmountFen ?? record.faceValue ?? 0) / (record.faceValueAmountFen ? 100 : 1);
  formModel.productType = pickValue(record, ['productType'], 'FAST') as Api.Admin.ProductType;
  formModel.salesUnit = pickValue(record, ['salesUnit'], '');
  formModel.status = pickValue(record, ['status'], 'ACTIVE') as Api.Admin.ProductStatus;
}

async function loadDetail() {
  loading.value = true;

  try {
    const data = await fetchProductDetail(productId.value);
    detail.value = extractObjectData(data);
    syncForm(detail.value);
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  await formRef.value?.validate();
  saving.value = true;

  try {
    await updateProduct(productId.value, {
      productCode: formModel.productCode.trim(),
      productName: formModel.productName.trim(),
      carrierCode: formModel.carrierCode,
      provinceName: formModel.provinceName.trim(),
      faceValue: Number(formModel.faceValue),
      productType: formModel.productType,
      salesUnit: formModel.salesUnit.trim(),
      status: formModel.status
    });
    window.$message?.success('商品信息已保存');
    await loadDetail();
  } finally {
    saving.value = false;
  }
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
          <h2 class="m-0 text-24px text-#0f172a font-700">
            {{ pickValue(detail, ['productName'], '商品详情') }}
          </h2>
          <span class="text-14px text-#64748b">
            商品编码：{{ pickValue(detail, ['productCode'], productId) }} | 运营商：{{ pickValue(detail, ['carrierCode']) }} | 状态：{{
              pickValue(detail, ['status'])
            }}
          </span>
        </div>
        <NButton @click="loadDetail">刷新</NButton>
      </div>
    </NCard>

    <NAlert type="info" :show-icon="false">
      新版 API 的商品详情仅支持平台商品主数据维护，不再在此页面承载供应商映射、平台价格、折扣规则或路由策略配置。
    </NAlert>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="编辑商品" :bordered="false" class="card-wrapper">
          <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="104">
            <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
              <NGi>
                <NFormItem label="商品编码" path="productCode">
                  <NInput v-model:value="formModel.productCode" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="商品名称" path="productName">
                  <NInput v-model:value="formModel.productName" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="运营商">
                  <NSelect v-model:value="formModel.carrierCode" :options="carrierOptions" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="省份" path="provinceName">
                  <NInput v-model:value="formModel.provinceName" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="面值" path="faceValue">
                  <NInputNumber v-model:value="formModel.faceValue" :min="0.01" class="w-full" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="商品类型">
                  <NSelect v-model:value="formModel.productType" :options="productTypeOptions" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="销售单位" path="salesUnit">
                  <NInput v-model:value="formModel.salesUnit" />
                </NFormItem>
              </NGi>
              <NGi>
                <NFormItem label="状态">
                  <NSelect v-model:value="formModel.status" :options="statusOptions" />
                </NFormItem>
              </NGi>
            </NGrid>
            <NButton type="primary" :loading="saving" @click="handleSave">保存商品</NButton>
          </NForm>
        </NCard>
      </NGi>

      <NGi>
        <NSpace vertical :size="16">
          <NCard title="商品摘要" :bordered="false" class="card-wrapper">
            <NDescriptions bordered :column="1" label-placement="left">
              <NDescriptionsItem label="商品 ID">{{ getEntityId(detail, ['productId', 'id']) || productId }}</NDescriptionsItem>
              <NDescriptionsItem label="商品编码">{{ pickValue(detail, ['productCode']) }}</NDescriptionsItem>
              <NDescriptionsItem label="商品名称">{{ pickValue(detail, ['productName']) }}</NDescriptionsItem>
              <NDescriptionsItem label="运营商">{{ pickValue(detail, ['carrierCode']) }}</NDescriptionsItem>
              <NDescriptionsItem label="省份">{{ pickValue(detail, ['provinceName']) }}</NDescriptionsItem>
              <NDescriptionsItem label="面值">
                {{ pickValue(detail, ['faceValueAmountFen']) }} 分 / {{ formModel.faceValue }} 元
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>

          <RawJsonCard title="商品详情原始 JSON" :value="detail" />
        </NSpace>
      </NGi>
    </NGrid>
  </NSpace>
</template>
