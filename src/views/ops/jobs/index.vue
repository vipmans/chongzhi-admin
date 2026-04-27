<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  cancelJob,
  fetchJobArtifacts,
  fetchJobDeadLetters,
  fetchJobDetail,
  fetchJobItems,
  fetchJobs,
  retryJob
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  extractPagedData,
  getEntityId,
  normalizeQuery,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

const jobsLoading = ref(false);
const deadLoading = ref(false);
const detailLoading = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});
const detailVisible = ref(false);

const jobs = ref<Api.Admin.RawRecord[]>([]);
const deadLetters = ref<Api.Admin.RawRecord[]>([]);
const jobsTotal = ref(0);
const jobsPageNum = ref(1);
const jobsPageSize = ref(20);
const deadTotal = ref(0);
const deadPageNum = ref(1);
const deadPageSize = ref(20);

const detailRecord = ref<Api.Admin.RawRecord>({});
const jobAttempts = ref<Api.Admin.RawRecord[]>([]);
const jobItems = ref<Api.Admin.RawRecord[]>([]);
const jobArtifacts = ref<Api.Admin.RawRecord[]>([]);
const activeJobId = ref('');

const queryModel = reactive({
  keyword: '',
  status: ''
});

const deadQueryModel = reactive({
  keyword: ''
});

const detailJob = computed(() => extractObjectData(detailRecord.value.job));

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

async function loadJobs() {
  jobsLoading.value = true;

  try {
    const data = await fetchJobs(
      normalizeQuery({
        pageNum: jobsPageNum.value,
        pageSize: jobsPageSize.value,
        ...queryModel
      })
    );

    const pageData = extractPagedData(data);
    jobs.value = pageData.records;
    jobsTotal.value = pageData.total;
    jobsPageNum.value = pageData.pageNum;
    jobsPageSize.value = pageData.pageSize;
  } finally {
    jobsLoading.value = false;
  }
}

async function loadDeadLetters() {
  deadLoading.value = true;

  try {
    const data = await fetchJobDeadLetters(
      normalizeQuery({
        pageNum: deadPageNum.value,
        pageSize: deadPageSize.value,
        ...deadQueryModel
      })
    );

    const pageData = extractPagedData(data);
    deadLetters.value = pageData.records;
    deadTotal.value = pageData.total;
    deadPageNum.value = pageData.pageNum;
    deadPageSize.value = pageData.pageSize;
  } finally {
    deadLoading.value = false;
  }
}

async function loadJobDetail(jobId: string) {
  detailLoading.value = true;
  activeJobId.value = jobId;

  try {
    const [detailData, itemsData, artifactsData] = await Promise.all([
      fetchJobDetail(jobId),
      fetchJobItems(jobId),
      fetchJobArtifacts(jobId)
    ]);

    detailRecord.value = extractObjectData(detailData);
    jobAttempts.value = extractListData(detailRecord.value.attempts);
    jobItems.value = extractListData(itemsData);
    jobArtifacts.value = extractListData(artifactsData);
  } finally {
    detailLoading.value = false;
  }
}

async function openDetailModal(jobId: string) {
  detailVisible.value = true;
  await loadJobDetail(jobId);
}

async function handleRetry(jobId: string) {
  await retryJob(jobId);
  window.$message?.success('任务已提交重试');
  await Promise.all([loadJobs(), activeJobId.value === jobId ? loadJobDetail(jobId) : Promise.resolve()]);
}

async function handleCancel(jobId: string) {
  await cancelJob(jobId);
  window.$message?.success('任务已取消');
  await Promise.all([loadJobs(), activeJobId.value === jobId ? loadJobDetail(jobId) : Promise.resolve()]);
}

async function handleJobSearch() {
  jobsPageNum.value = 1;
  await loadJobs();
}

async function handleJobReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  jobsPageNum.value = 1;
  await loadJobs();
}

async function handleDeadSearch() {
  deadPageNum.value = 1;
  await loadDeadLetters();
}

async function handleDeadReset() {
  deadQueryModel.keyword = '';
  deadPageNum.value = 1;
  await loadDeadLetters();
}

function openArtifact(url: string) {
  if (!url) {
    window.$message?.warning('当前 artifact 未返回下载地址');
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

const jobColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'jobType',
    title: '任务类型',
    render: row => pickValue(row, ['jobType', 'type'])
  },
  {
    key: 'businessKey',
    title: '业务键',
    render: row => pickValue(row, ['businessKey', 'bizKey'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => pickValue(row, ['status'])
  },
  {
    key: 'attemptCount',
    title: '重试次数',
    render: row => `${pickValue(row, ['attemptCount'], '0')} / ${pickValue(row, ['maxAttempts'], '-')}`
  },
  {
    key: 'schedule',
    title: '计划执行时间',
    render: row => pickValue(row, ['nextRunAt', 'nextRetryAt', 'scheduledAt', 'updatedAt'])
  },
  {
    key: 'lastError',
    title: '最近错误',
    width: 260,
    ellipsis: { tooltip: true },
    render: row => pickValue(row, ['lastError'], '-')
  },
  {
    key: 'actions',
    title: '操作',
    width: 280,
    render: row => {
      const jobId = getEntityId(row, ['jobId', 'id']);

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            ghost: true,
            type: 'primary',
            onClick: () => openDetailModal(jobId)
          },
          { default: () => '详情' }
        ),
        h(
          NButton,
          {
            size: 'small',
            ghost: true,
            onClick: () => handleRetry(jobId)
          },
          { default: () => '重试' }
        ),
        h(
          NButton,
          {
            size: 'small',
            ghost: true,
            type: 'warning',
            onClick: () => handleCancel(jobId)
          },
          { default: () => '取消' }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            onClick: () => openRaw(`任务 ${jobId}`, row)
          },
          { default: () => '原始数据' }
        )
      ]);
    }
  }
]);

const deadColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'jobType',
    title: '任务类型',
    render: row => pickValue(row, ['jobType', 'type'])
  },
  {
    key: 'businessKey',
    title: '业务键',
    render: row => pickValue(row, ['businessKey', 'bizKey'])
  },
  {
    key: 'lastError',
    title: '失败原因',
    width: 320,
    ellipsis: { tooltip: true },
    render: row => pickValue(row, ['lastError', 'reason', 'message'])
  },
  {
    key: 'createdAt',
    title: '进入死信时间',
    render: row => pickValue(row, ['createdAt', 'updatedAt'])
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
          onClick: () => openRaw('死信任务原始数据', row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const attemptColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'attemptNo', title: 'Attempt', render: row => pickValue(row, ['attemptNo']) },
  { key: 'status', title: '状态', render: row => pickValue(row, ['status']) },
  { key: 'durationMs', title: '耗时(ms)', render: row => pickValue(row, ['durationMs']) },
  { key: 'createdAt', title: '执行时间', render: row => pickValue(row, ['createdAt']) },
  {
    key: 'errorMessage',
    title: '错误信息',
    width: 320,
    ellipsis: { tooltip: true },
    render: row => pickValue(row, ['errorMessage'], '-')
  }
]);

const itemColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'itemNo', title: '明细项', render: row => pickValue(row, ['itemNo']) },
  { key: 'status', title: '状态', render: row => pickValue(row, ['status']) },
  { key: 'createdAt', title: '创建时间', render: row => pickValue(row, ['createdAt']) },
  { key: 'updatedAt', title: '更新时间', render: row => pickValue(row, ['updatedAt']) },
  {
    key: 'errorMessage',
    title: '错误信息',
    width: 260,
    ellipsis: { tooltip: true },
    render: row => pickValue(row, ['errorMessage'], '-')
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
          onClick: () => openRaw(`任务明细 ${pickValue(row, ['itemNo'], '')}`, row)
        },
        { default: () => '原始数据' }
      )
  }
]);

const artifactColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'artifactType', title: '产物类型', render: row => pickValue(row, ['artifactType']) },
  { key: 'fileName', title: '文件名', render: row => pickValue(row, ['fileName']) },
  { key: 'filePath', title: '文件路径', width: 300, ellipsis: { tooltip: true }, render: row => pickValue(row, ['filePath']) },
  { key: 'createdAt', title: '生成时间', render: row => pickValue(row, ['createdAt']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => openArtifact(pickValue(row, ['downloadUrl'], ''))
          },
          { default: () => '下载' }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            onClick: () => openRaw(`任务产物 ${pickValue(row, ['fileName'], '')}`, row)
          },
          { default: () => '原始数据' }
        )
      ])
  }
]);

onMounted(() => {
  loadJobs();
  loadDeadLetters();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      异步任务管理已接入任务详情、执行 attempts、批量 items 和 artifact 下载，方便排查导出、批处理和回调类任务。
    </NAlert>

    <NTabs type="line" animated>
      <NTabPane name="jobs" tab="异步任务">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px">
            <NSpace wrap>
              <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索任务类型、业务键" class="lg:w-320px" />
              <NInput v-model:value="queryModel.status" clearable placeholder="状态" class="lg:w-200px" />
            </NSpace>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleJobReset">重置</NButton>
              <NButton type="primary" @click="handleJobSearch">查询</NButton>
            </div>
          </div>

          <NDataTable
            :columns="jobColumns"
            :data="jobs"
            :loading="jobsLoading"
            remote
            :row-key="row => getEntityId(row, ['jobId', 'id'])"
          />
          <div class="mt-16px flex justify-end">
            <NPagination
              :page="jobsPageNum"
              :page-size="jobsPageSize"
              :item-count="jobsTotal"
              show-size-picker
              :page-sizes="[10, 20, 50, 100]"
              @update:page="
                value => {
                  jobsPageNum = value;
                  loadJobs();
                }
              "
              @update:page-size="
                value => {
                  jobsPageSize = value;
                  jobsPageNum = 1;
                  loadJobs();
                }
              "
            />
          </div>
        </NCard>
      </NTabPane>

      <NTabPane name="dead" tab="死信队列">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px">
            <NSpace wrap>
              <NInput v-model:value="deadQueryModel.keyword" clearable placeholder="搜索业务键或错误原因" class="lg:w-320px" />
            </NSpace>
            <div class="flex flex-wrap justify-end gap-12px">
              <NButton @click="handleDeadReset">重置</NButton>
              <NButton type="primary" @click="handleDeadSearch">查询</NButton>
            </div>
          </div>

          <NDataTable
            :columns="deadColumns"
            :data="deadLetters"
            :loading="deadLoading"
            remote
            :row-key="row => getEntityId(row, ['jobId', 'id'])"
          />
          <div class="mt-16px flex justify-end">
            <NPagination
              :page="deadPageNum"
              :page-size="deadPageSize"
              :item-count="deadTotal"
              show-size-picker
              :page-sizes="[10, 20, 50, 100]"
              @update:page="
                value => {
                  deadPageNum = value;
                  loadDeadLetters();
                }
              "
              @update:page-size="
                value => {
                  deadPageSize = value;
                  deadPageNum = 1;
                  loadDeadLetters();
                }
              "
            />
          </div>
        </NCard>
      </NTabPane>
    </NTabs>

    <NModal v-model:show="detailVisible" preset="card" title="任务详情" class="w-1120px">
      <NSpace vertical :size="16">
        <NCard :bordered="false" class="bg-#f8fafc" :loading="detailLoading">
          <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-col gap-6px">
              <h3 class="m-0 text-20px text-#0f172a font-700">
                {{ getEntityId(detailJob, ['id', 'jobId']) || activeJobId || '任务详情' }}
              </h3>
              <span class="text-14px text-#64748b">
                类型：{{ pickValue(detailJob, ['jobType']) }} | 业务键：{{ pickValue(detailJob, ['businessKey']) }} | 状态：{{
                  pickValue(detailJob, ['status'])
                }}
              </span>
            </div>
            <NSpace>
              <NButton size="small" @click="loadJobDetail(activeJobId)">刷新详情</NButton>
              <NButton size="small" @click="handleRetry(activeJobId)">重试任务</NButton>
              <NButton size="small" type="warning" ghost @click="handleCancel(activeJobId)">取消任务</NButton>
            </NSpace>
          </div>
        </NCard>

        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="任务概览" :bordered="false" class="card-wrapper" :loading="detailLoading">
              <NDescriptions bordered :column="1" label-placement="left">
                <NDescriptionsItem label="任务 ID">{{ getEntityId(detailJob, ['id', 'jobId']) }}</NDescriptionsItem>
                <NDescriptionsItem label="任务类型">{{ pickValue(detailJob, ['jobType']) }}</NDescriptionsItem>
                <NDescriptionsItem label="业务键">{{ pickValue(detailJob, ['businessKey']) }}</NDescriptionsItem>
                <NDescriptionsItem label="状态">{{ pickValue(detailJob, ['status']) }}</NDescriptionsItem>
                <NDescriptionsItem label="重试次数">
                  {{ pickValue(detailJob, ['attemptCount']) }} / {{ pickValue(detailJob, ['maxAttempts']) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="下次执行时间">
                  {{ pickValue(detailJob, ['nextRunAt']) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="最近错误">{{ pickValue(detailJob, ['lastError']) }}</NDescriptionsItem>
                <NDescriptionsItem label="创建时间">{{ pickValue(detailJob, ['createdAt']) }}</NDescriptionsItem>
                <NDescriptionsItem label="更新时间">{{ pickValue(detailJob, ['updatedAt']) }}</NDescriptionsItem>
              </NDescriptions>
            </NCard>
          </NGi>
          <NGi>
            <RawJsonCard title="任务载荷 JSON" :value="detailJob.payloadJson || detailRecord" />
          </NGi>
        </NGrid>

        <NTabs type="line" animated>
          <NTabPane name="attempts" tab="执行记录">
            <NDataTable
              :columns="attemptColumns"
              :data="jobAttempts"
              :loading="detailLoading"
              :pagination="{ pageSize: 8 }"
              :row-key="row => getEntityId(row, ['id', 'attemptNo'])"
            />
          </NTabPane>

          <NTabPane name="items" tab="任务明细项">
            <NDataTable
              :columns="itemColumns"
              :data="jobItems"
              :loading="detailLoading"
              :pagination="{ pageSize: 8 }"
              :row-key="row => getEntityId(row, ['id', 'itemNo'])"
            />
          </NTabPane>

          <NTabPane name="artifacts" tab="任务产物">
            <NDataTable
              :columns="artifactColumns"
              :data="jobArtifacts"
              :loading="detailLoading"
              :pagination="{ pageSize: 8 }"
              :row-key="row => getEntityId(row, ['id', 'fileName'])"
            />
          </NTabPane>
        </NTabs>
      </NSpace>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
