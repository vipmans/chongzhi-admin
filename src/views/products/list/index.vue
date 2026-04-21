<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createProduct, fetchProducts, updateProduct } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const router = useRouter();

const loading = ref(false);
const submitting = ref(false);
const modalVisible = ref(false);
const rawVisible = ref(false);
const editingId = ref('');
const rawRecord = ref<Api.Admin.RawRecord>({});
const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const formRef = ref<FormInst | null>(null);

const queryModel = reactive<Api.Admin.ProductListQuery>({
  keyword: '',
  status: undefined,
  carrierCode: undefined,
  productType: undefined
});

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
  { label: '全部运营商', value: undefined },
  { label: '中国移动', value: 'CMCC' },
  { label: '中国电信', value: 'CTCC' },
  { label: '中国联通', value: 'CUCC' },
  { label: '广电', value: 'CBN' }
];

const productTypeOptions = [
  { label: '全部类型', value: undefined },
  { label: 'FAST', value: 'FAST' },
  { label: 'MIXED', value: 'MIXED' }
];

const statusOptions = [
  { label: '全部状态', value: undefined },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const editCarrierOptions = carrierOptions.filter(item => item.value);
const editProductTypeOptions = productTypeOptions.filter(item => item.value);
const editStatusOptions = statusOptions.filter(item => item.value);

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'productCode',
    title: '商品编码',
    render: row => pickValue(row, ['productCode', 'code'])
  },
  {
    key: 'productName',
    title: '商品名称',
    render: row => pickValue(row, ['productName', 'name'])
  },
  {
    key: 'carrierCode',
    title: '运营商',
    render: row => pickValue(row, ['carrierCode'])
  },
  {
    key: 'faceValue',
    title: '面值',
    render: row => pickValue(row, ['faceValue', 'amount'])
  },
  {
    key: 'productType',
    title: '类型',
    render: row => pickValue(row, ['productType'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => pickValue(row, ['status'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'info',
            ghost: true,
            onClick: () => router.push(`/products/detail/${getEntityId(row, ['productId', 'id', 'productCode'])}`)
          },
          { default: () => '配置详情' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => openEdit(row)
          },
          { default: () => '编辑' }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            onClick: () => {
              rawRecord.value = row;
              rawVisible.value = true;
            }
          },
          { default: () => '原始数据' }
        )
      ])
  }
]);

const rules: Record<string, App.Global.FormRule[]> = {
  productCode: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  productName: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  provinceName: [{ required: true, message: '请输入省份', trigger: 'blur' }],
  faceValue: [{ required: true, type: 'number', message: '请输入面值', trigger: 'blur' }],
  salesUnit: [{ required: true, message: '请输入销售单位', trigger: 'blur' }]
};

function resetForm() {
  editingId.value = '';
  formModel.productCode = '';
  formModel.productName = '';
  formModel.carrierCode = 'CMCC';
  formModel.provinceName = '';
  formModel.faceValue = 0;
  formModel.productType = 'FAST';
  formModel.salesUnit = '';
  formModel.status = 'ACTIVE';
}

function openCreate() {
  resetForm();
  modalVisible.value = true;
}

function openEdit(row: Api.Admin.RawRecord) {
  editingId.value = getEntityId(row, ['productId', 'id', 'productCode']);
  formModel.productCode = pickValue(row, ['productCode'], '');
  formModel.productName = pickValue(row, ['productName'], '');
  formModel.carrierCode = pickValue(row, ['carrierCode'], 'CMCC') as Api.Admin.CarrierCode;
  formModel.provinceName = pickValue(row, ['provinceName'], '');
  formModel.faceValue = Number(pickValue(row, ['faceValue'], '0')) || 0;
  formModel.productType = pickValue(row, ['productType'], 'FAST') as Api.Admin.ProductType;
  formModel.salesUnit = pickValue(row, ['salesUnit'], '');
  formModel.status = pickValue(row, ['status'], 'ACTIVE') as Api.Admin.ProductStatus;
  modalVisible.value = true;
}

async function loadProducts() {
  loading.value = true;

  try {
    const data = await fetchProducts(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        ...queryModel
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

async function handleSearch() {
  pageNum.value = 1;
  await loadProducts();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = undefined;
  queryModel.carrierCode = undefined;
  queryModel.productType = undefined;
  pageNum.value = 1;
  await loadProducts();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadProducts();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadProducts();
}

async function submitProduct() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    const payload = {
      ...formModel,
      productCode: formModel.productCode.trim(),
      productName: formModel.productName.trim(),
      provinceName: formModel.provinceName.trim(),
      faceValue: Number(formModel.faceValue),
      salesUnit: formModel.salesUnit.trim()
    };

    if (editingId.value) {
      await updateProduct(editingId.value, payload);
      window.$message?.success('商品更新成功');
    } else {
      await createProduct(payload);
      window.$message?.success('商品创建成功');
    }

    modalVisible.value = false;
    pageNum.value = 1;
    await loadProducts();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadProducts();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NSpace wrap>
          <NInput
            v-model:value="queryModel.keyword"
            clearable
            placeholder="搜索商品编码、名称、省份"
            class="lg:w-320px"
          />
          <NSelect v-model:value="queryModel.carrierCode" :options="carrierOptions" class="min-w-160px" />
          <NSelect v-model:value="queryModel.productType" :options="productTypeOptions" class="min-w-160px" />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增平台商品</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="平台商品列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['productId', 'id', 'productCode'])"
      />
      <div class="mt-16px flex justify-end">
        <NPagination
          :page="pageNum"
          :page-size="pageSize"
          :item-count="total"
          show-size-picker
          :page-sizes="[10, 20, 50, 100]"
          @update:page="handlePageChange"
          @update:page-size="handlePageSizeChange"
        />
      </div>
    </NCard>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="editingId ? '编辑平台商品' : '新增平台商品'"
      class="w-640px"
    >
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
              <NSelect v-model:value="formModel.carrierCode" :options="editCarrierOptions" />
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
              <NSelect v-model:value="formModel.productType" :options="editProductTypeOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="销售单位" path="salesUnit">
              <NInput v-model:value="formModel.salesUnit" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NSelect v-model:value="formModel.status" :options="editStatusOptions" />
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitProduct">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="商品原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
