<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchNotificationTasks, retryNotificationTask } from '@/service/api';
import { extractPagedData, getDateTimeRange, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const router = useRouter();
const loading = ref(false);
const rows = ref<Api.Admin.RawRecord[]>([]);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const timeRange = ref<[number, number] | null>(null);

const queryModel = reactive<Api.Admin.NotificationTaskListQuery>({
  keyword: '',
  taskNo: '',
  bizNo: '',
  deliveryStatus: '',
  status: ''
});

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'taskNo', title: '任务号', render: row => pickValue(row, ['taskNo']) },
  { key: 'bizNo', title: '业务编号', render: row => pickValue(row, ['bizNo', 'orderNo']) },
  { key: 'status', title: '任务状态', render: row => pickValue(row, ['status']) },
  { key: 'deliveryStatus', title: '投递状态', render: row => pickValue(row, ['deliveryStatus']) },
  { key: 'targetUrl', title: '目标地址', render: row => pickValue(row, ['targetUrl', 'callbackUrl']) },
  { key: 'attemptCount', title: '投递次数', render: row => pickValue(row, ['attemptCount', 'retryCount']) },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const taskNo = pickValue(row, ['taskNo'], '');

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => router.push(`/notifications/detail/${taskNo}`)
          },
          { default: () => '任务详情' }
        ),
        h(
          NButton,
          {
            size: 'small',
            onClick: async () => {
              await retryNotificationTask(taskNo);
              window.$message?.success('通知任务已重试');
              await loadRows();
            }
          },
          { default: () => '重试' }
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

async function loadRows() {
  loading.value = true;

  try {
    const { data } = await fetchNotificationTasks(
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
  queryModel.taskNo = '';
  queryModel.bizNo = '';
  queryModel.deliveryStatus = '';
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
        <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="通用关键词" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.taskNo" clearable placeholder="任务号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.bizNo" clearable placeholder="业务编号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.status" clearable placeholder="任务状态" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.deliveryStatus" clearable placeholder="投递状态" />
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

    <NCard title="通知任务列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['taskNo', 'id'])"
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

    <NModal v-model:show="rawVisible" preset="card" title="通知任务原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
