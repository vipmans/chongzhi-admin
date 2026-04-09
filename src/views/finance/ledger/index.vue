<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchLedgerEntries } from '@/service/api';
import { extractPagedData, getDateTimeRange, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const loading = ref(false);
const rows = ref<Api.Admin.RawRecord[]>([]);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const timeRange = ref<[number, number] | null>(null);

const queryModel = reactive<Api.Admin.LedgerEntryListQuery>({
  keyword: '',
  orderNo: '',
  accountId: '',
  channelId: '',
  entryType: '',
  bizNo: ''
});

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'entryNo', title: '流水号', render: row => pickValue(row, ['entryNo', 'ledgerNo', 'id']) },
  { key: 'orderNo', title: '订单号', render: row => pickValue(row, ['orderNo']) },
  { key: 'accountNo', title: '账户号', render: row => pickValue(row, ['accountNo', 'accountId']) },
  { key: 'entryType', title: '流水类型', render: row => pickValue(row, ['entryType', 'direction']) },
  { key: 'amount', title: '金额', render: row => pickValue(row, ['amount']) },
  { key: 'createdAt', title: '创建时间', render: row => pickValue(row, ['createdAt', 'createTime']) },
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
    const { data } = await fetchLedgerEntries(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        ...queryModel,
        ...getDateTimeRange(timeRange.value)
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
  queryModel.orderNo = '';
  queryModel.accountId = '';
  queryModel.channelId = '';
  queryModel.entryType = '';
  queryModel.bizNo = '';
  timeRange.value = null;
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
        <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="通用关键词" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.orderNo" clearable placeholder="订单号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.accountId" clearable placeholder="账户ID" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.channelId" clearable placeholder="渠道ID" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.entryType" clearable placeholder="流水类型" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.bizNo" clearable placeholder="业务编号" />
          </NGi>
          <NGi span="1 s:2">
            <NDatePicker v-model:value="timeRange" type="datetimerange" clearable class="w-full" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="账务流水" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['entryNo', 'ledgerNo', 'id'])"
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

    <NModal v-model:show="rawVisible" preset="card" title="流水原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
