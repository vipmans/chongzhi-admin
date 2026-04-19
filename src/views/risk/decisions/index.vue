<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchRiskDecisions } from '@/service/api';
import {
  extractPagedData,
  getDateTimeRange,
  getEntityId,
  normalizeQuery,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

const loading = ref(false);
const rows = ref<Api.Admin.RawRecord[]>([]);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const timeRange = ref<[number, number] | null>(null);

const queryModel = reactive({
  keyword: '',
  status: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'PASS', value: 'PASS' },
  { label: 'REVIEW', value: 'REVIEW' },
  { label: 'REJECT', value: 'REJECT' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'orderNo', title: '订单号', render: row => pickValue(row, ['orderNo']) },
  { key: 'decision', title: '决策结果', render: row => pickValue(row, ['decision', 'result']) },
  { key: 'reason', title: '决策原因', render: row => pickValue(row, ['reason']) },
  { key: 'ruleCode', title: '命中规则', render: row => pickValue(row, ['ruleCode', 'matchedRuleCode']) },
  { key: 'createdAt', title: '决策时间', render: row => pickValue(row, ['createdAt', 'createTime']) },
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
    const { data } = await fetchRiskDecisions(
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
  queryModel.status = '';
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
        <NSpace wrap>
          <NInput
            v-model:value="queryModel.keyword"
            clearable
            placeholder="搜索订单号、规则、决策结果"
            class="lg:w-320px"
          />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
          <NDatePicker v-model:value="timeRange" type="datetimerange" clearable class="min-w-280px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="风控决策记录" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['id', 'decisionId', 'orderNo'])"
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

    <NModal v-model:show="rawVisible" preset="card" title="决策原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
