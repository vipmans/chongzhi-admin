<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { cancelJob, fetchJobDeadLetters, fetchJobDetail, fetchJobs, retryJob } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const jobsLoading = ref(false);
const deadLoading = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const jobs = ref<Api.Admin.RawRecord[]>([]);
const deadLetters = ref<Api.Admin.RawRecord[]>([]);
const jobsTotal = ref(0);
const jobsPageNum = ref(1);
const jobsPageSize = ref(20);
const deadTotal = ref(0);
const deadPageNum = ref(1);
const deadPageSize = ref(20);

const queryModel = reactive({
  keyword: '',
  status: ''
});

const deadQueryModel = reactive({
  keyword: ''
});

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
    title: '调度时间',
    render: row => pickValue(row, ['nextRetryAt', 'scheduledAt', 'updatedAt'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const jobId = getEntityId(row, ['jobId', 'id']);

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            ghost: true,
            onClick: async () => {
              const detail = await fetchJobDetail(jobId);
              rawTitle.value = `任务详情 ${jobId}`;
              rawRecord.value = detail;
              rawVisible.value = true;
            }
          },
          { default: () => '详情' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: async () => {
              await retryJob(jobId);
              window.$message?.success('任务已提交重试');
              await loadJobs();
            }
          },
          { default: () => '重试' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'warning',
            ghost: true,
            onClick: async () => {
              await cancelJob(jobId);
              window.$message?.success('任务已取消');
              await loadJobs();
            }
          },
          { default: () => '取消' }
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
    render: row => pickValue(row, ['lastError', 'reason', 'message'])
  },
  {
    key: 'createdAt',
    title: '入死信时间',
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
          onClick: () => {
            rawTitle.value = '任务死信原始数据';
            rawRecord.value = row;
            rawVisible.value = true;
          }
        },
        { default: () => '原始数据' }
      )
  }
]);

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

onMounted(() => {
  loadJobs();
  loadDeadLetters();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      这里用于追踪 Worker 异步任务执行情况。运营可对失败或卡住的任务做重试、取消和死信排查。
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

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
