<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchSuppliers } from '@/service/api';
import {
  extractListData,
  extractPagedData,
  getEntityId,
  getKeywordFilter,
  normalizeQuery,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

const router = useRouter();

const loading = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});

const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

const queryModel = reactive<Api.Admin.SupplierListQuery>({
  keyword: '',
  cooperationStatus: '',
  healthStatus: '',
  protocolType: ''
});

const healthOptions = [
  { label: '全部健康状态', value: '' },
  { label: 'HEALTHY', value: 'HEALTHY' },
  { label: 'DEGRADED', value: 'DEGRADED' },
  { label: 'UNAVAILABLE', value: 'UNAVAILABLE' }
];

const cooperationOptions = [
  { label: '全部合作状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'PAUSED', value: 'PAUSED' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'supplierCode',
    title: '供应商编码',
    render: row => pickValue(row, ['supplierCode', 'code'])
  },
  {
    key: 'supplierName',
    title: '供应商名称',
    render: row => pickValue(row, ['supplierName', 'name'])
  },
  {
    key: 'protocolType',
    title: '协议类型',
    render: row => pickValue(row, ['protocolType'])
  },
  {
    key: 'cooperationStatus',
    title: '合作状态',
    render: row => pickValue(row, ['cooperationStatus', 'status'])
  },
  {
    key: 'healthStatus',
    title: '健康状态',
    render: row => pickValue(row, ['healthStatus'])
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    render: row => pickValue(row, ['updatedAt', 'createdAt'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const supplierId = getEntityId(row, ['supplierId', 'id', 'supplierCode']);

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => router.push(`/suppliers/detail/${supplierId}`)
          },
          { default: () => '详情' }
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
      ]);
    }
  }
]);

function applyLocalList(list: Api.Admin.RawRecord[]) {
  let filtered = list;

  if (queryModel.keyword?.trim()) {
    filtered = getKeywordFilter(filtered, queryModel.keyword);
  }

  if (queryModel.cooperationStatus) {
    filtered = filtered.filter(item => pickValue(item, ['cooperationStatus'], '') === queryModel.cooperationStatus);
  }

  if (queryModel.healthStatus) {
    filtered = filtered.filter(item => pickValue(item, ['healthStatus'], '') === queryModel.healthStatus);
  }

  if (queryModel.protocolType) {
    const keyword = queryModel.protocolType.toLowerCase();
    filtered = filtered.filter(item => pickValue(item, ['protocolType'], '').toLowerCase().includes(keyword));
  }

  total.value = filtered.length;
  const start = (pageNum.value - 1) * pageSize.value;
  rows.value = filtered.slice(start, start + pageSize.value);
}

async function loadSuppliers() {
  loading.value = true;

  try {
    const data = await fetchSuppliers(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        ...queryModel
      })
    );

    if (Array.isArray(data)) {
      applyLocalList(extractListData(data));
      return;
    }

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
  await loadSuppliers();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.cooperationStatus = '';
  queryModel.healthStatus = '';
  queryModel.protocolType = '';
  pageNum.value = 1;
  await loadSuppliers();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadSuppliers();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadSuppliers();
}

onMounted(() => {
  loadSuppliers();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      新版 API 的供应商模块仅提供列表、余额、目录同步、熔断恢复、同步日志、对账差异和参数配置能力，不再提供前端创建、删除、充值记录和消费日志接口。
    </NAlert>

    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索编码、名称、协议" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.cooperationStatus" :options="cooperationOptions" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.healthStatus" :options="healthOptions" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.protocolType" clearable placeholder="协议类型" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton type="primary" @click="handleSearch">查询</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="供应商列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['supplierId', 'id', 'supplierCode'])"
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

    <NModal v-model:show="rawVisible" preset="card" title="供应商原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
