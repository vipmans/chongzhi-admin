<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchAccounts } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const loading = ref(false);
const rows = ref<Api.Admin.RawRecord[]>([]);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

const queryModel = reactive({
  keyword: '',
  status: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'accountNo', title: '账户号', render: row => pickValue(row, ['accountNo', 'accountId', 'id']) },
  { key: 'accountType', title: '账户类型', render: row => pickValue(row, ['accountType', 'type']) },
  { key: 'ownerId', title: '主体', render: row => pickValue(row, ['ownerId', 'channelId', 'supplierId']) },
  { key: 'balance', title: '余额', render: row => pickValue(row, ['balance', 'availableBalance']) },
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
          onClick: () => {
            rawRecord.value = row;
            rawVisible.value = true;
          }
        },
        { default: () => '查看原始' }
      )
  }
]);

async function loadRows() {
  loading.value = true;

  try {
    const data = await fetchAccounts(
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
  await loadRows();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  pageNum.value = 1;
  await loadRows();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadRows();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadRows();
}

onMounted(() => {
  loadRows();
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
            placeholder="搜索账户号、主体、状态"
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

    <NCard title="账户信息" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['accountNo', 'accountId', 'id'])"
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

    <NModal v-model:show="rawVisible" preset="card" title="账户原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
