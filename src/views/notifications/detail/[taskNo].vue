<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { fetchNotificationTaskDeliveryLogs, fetchNotificationTaskDetail, retryNotificationTask } from '@/service/api';
import { extractObjectData, extractPagedData, getDateTimeRange, getEntityId, normalizeQuery, pickValue } from '@/utils/admin';

const route = useRoute();
const taskNo = computed(() => String(route.params.taskNo || ''));
const loading = ref(false);
const logsLoading = ref(false);
const detail = ref<Api.Admin.RawRecord>({});
const deliveryLogs = ref<Api.Admin.RawRecord[]>([]);
const logTotal = ref(0);
const logPageNum = ref(1);
const logPageSize = ref(10);
const logTimeRange = ref<[number, number] | null>(null);

const basicInfo = computed(() => extractObjectData(detail.value.basicInfo));
const deliverySummary = computed(() => extractObjectData(detail.value.deliverySummary));
const payloadSnapshot = computed(() => extractObjectData(detail.value.payloadSnapshot));

async function loadDetail() {
  loading.value = true;

  try {
    const { data } = await fetchNotificationTaskDetail(taskNo.value);
    detail.value = extractObjectData(data);
  } finally {
    loading.value = false;
  }
}

async function loadLogs() {
  logsLoading.value = true;

  try {
    const { data } = await fetchNotificationTaskDeliveryLogs(
      taskNo.value,
      normalizeQuery({
        pageNum: logPageNum.value,
        pageSize: logPageSize.value,
        ...getDateTimeRange(logTimeRange.value)
      })
    );

    const pageData = extractPagedData(data);
    deliveryLogs.value = pageData.records;
    logTotal.value = pageData.total;
    logPageNum.value = pageData.pageNum;
    logPageSize.value = pageData.pageSize;
  } finally {
    logsLoading.value = false;
  }
}

async function reloadAll() {
  await Promise.all([loadDetail(), loadLogs()]);
}

async function handleRetry() {
  await retryNotificationTask(taskNo.value);
  window.$message?.success('通知任务已重试');
  await reloadAll();
}

async function handleLogPageChange(page: number) {
  logPageNum.value = page;
  await loadLogs();
}

async function handleLogPageSizeChange(size: number) {
  logPageSize.value = size;
  logPageNum.value = 1;
  await loadLogs();
}

async function handleLogSearch() {
  logPageNum.value = 1;
  await loadLogs();
}

async function handleLogReset() {
  logTimeRange.value = null;
  logPageNum.value = 1;
  await loadLogs();
}

onMounted(() => {
  reloadAll();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper" :loading="loading">
      <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">通知任务 {{ taskNo }}</h2>
          <span class="text-14px text-#64748b">
            任务状态：{{ pickValue(basicInfo, ['status']) }} | 投递状态：{{ pickValue(deliverySummary, ['deliveryStatus']) }}
          </span>
        </div>
        <NSpace>
          <NButton @click="reloadAll">刷新</NButton>
          <NButton type="primary" @click="handleRetry">手工重试</NButton>
        </NSpace>
      </div>
    </NCard>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="任务详情" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="任务号">{{ pickValue(basicInfo, ['taskNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="业务编号">{{ pickValue(basicInfo, ['bizNo', 'orderNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="任务状态">{{ pickValue(basicInfo, ['status']) }}</NDescriptionsItem>
            <NDescriptionsItem label="目标地址">{{ pickValue(basicInfo, ['targetUrl', 'callbackUrl']) }}</NDescriptionsItem>
            <NDescriptionsItem label="投递状态">{{ pickValue(deliverySummary, ['deliveryStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="投递次数">{{ pickValue(deliverySummary, ['attemptCount', 'retryCount']) }}</NDescriptionsItem>
            <NDescriptionsItem label="最后错误">{{ pickValue(deliverySummary, ['lastError', 'lastResult']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <RawJsonCard title="任务详情原始 JSON" :value="detail" />
      </NGi>
    </NGrid>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <RawJsonCard title="投递摘要" :value="deliverySummary" />
      </NGi>
      <NGi>
        <RawJsonCard title="回调载荷快照" :value="payloadSnapshot" />
      </NGi>
    </NGrid>

    <NCard title="投递日志" :bordered="false" class="card-wrapper">
      <div class="mb-16px flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
        <NDatePicker v-model:value="logTimeRange" type="datetimerange" clearable class="min-w-280px" />
        <NSpace>
          <NButton @click="handleLogReset">重置</NButton>
          <NButton @click="handleLogSearch">筛选</NButton>
        </NSpace>
      </div>

      <NList bordered>
        <NListItem v-for="item in deliveryLogs" :key="getEntityId(item, ['id', 'createdAt'])">
          <NSpace vertical :size="6">
            <div class="text-14px font-600">
              {{ pickValue(item, ['createdAt']) }} | HTTP {{ pickValue(item, ['responseStatus']) }} | 成功：{{
                pickValue(item, ['success'])
              }}
            </div>
            <div class="text-13px text-#64748b">请求载荷：{{ pickValue(item, ['requestPayloadJson']) }}</div>
            <div class="text-13px text-#64748b">响应体：{{ pickValue(item, ['responseBody']) }}</div>
          </NSpace>
        </NListItem>
      </NList>
      <NEmpty v-if="!deliveryLogs.length && !logsLoading" description="暂无投递日志" />

      <div class="mt-16px flex justify-end">
        <NPagination
          :page="logPageNum"
          :page-size="logPageSize"
          :item-count="logTotal"
          :disabled="logsLoading"
          show-size-picker
          :page-sizes="[10, 20, 50]"
          @update:page="handleLogPageChange"
          @update:page-size="handleLogPageSizeChange"
        />
      </div>
    </NCard>
  </NSpace>
</template>
