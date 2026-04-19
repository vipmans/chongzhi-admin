<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
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

const loading = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

const queryModel = reactive<Api.Admin.SupplierListQuery>({
  keyword: '',
  status: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
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
    render: row => pickValue(row, ['protocolType', 'protocol', 'adapterType'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => getSupplierStatus(row) || '-'
  },
  {
    key: 'createdAt',
    title: '创建时间',
    render: row => pickValue(row, ['createdAt', 'createTime'])
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
          onClick: () => {
            rawRecord.value = row;
            rawVisible.value = true;
          }
        },
        { default: () => '查看原始' }
      )
  }
]);

function getSupplierStatus(row: Api.Admin.RawRecord) {
  if (typeof row.status === 'string' && row.status) {
    return row.status;
  }

  if (typeof row.enabled === 'boolean') {
    return row.enabled ? 'ACTIVE' : 'INACTIVE';
  }

  return pickValue(row, ['enabled'], '');
}

function applyLocalList(list: Api.Admin.RawRecord[]) {
  let filtered = list;

  if (queryModel.keyword?.trim()) {
    filtered = getKeywordFilter(filtered, queryModel.keyword);
  }

  if (queryModel.status) {
    filtered = filtered.filter(row => getSupplierStatus(row) === queryModel.status);
  }

  total.value = filtered.length;

  const start = (pageNum.value - 1) * pageSize.value;
  const end = start + pageSize.value;

  rows.value = filtered.slice(start, end);
}

async function loadSuppliers() {
  loading.value = true;

  try {
    const { data } = await fetchSuppliers(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
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
  queryModel.status = '';
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
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NSpace wrap>
          <NInput
            v-model:value="queryModel.keyword"
            clearable
            placeholder="搜索供应商编码、名称、协议类型"
            class="lg:w-320px"
          />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
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
