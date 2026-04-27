<script setup lang="ts">
import { computed, h, nextTick, onMounted, reactive, ref } from 'vue';
import { NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import {
  addComplaintProgressLog,
  assignComplaint,
  closeComplaint,
  createComplaint,
  exportComplaints,
  fetchAdminUsers,
  fetchComplaintDetail,
  fetchComplaints,
  fetchComplaintStats,
  reopenComplaint,
  saveComplaintFeedback,
  saveComplaintResult,
  transferComplaint,
  updateComplaintStatus
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

type ComplaintActionMode =
  | 'assign'
  | 'transfer'
  | 'status'
  | 'result'
  | 'feedback'
  | 'progress'
  | 'close'
  | 'reopen';

type CreateComplaintFormModel = {
  orderNo: string;
  channelId: string;
  mobile: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  source: string;
  extText: string;
};

type ComplaintActionFormModel = {
  assigneeUserId: string;
  status: string;
  reason: string;
  result: string;
  feedback: string;
  content: string;
};

const loading = ref(false);
const statsLoading = ref(false);
const exporting = ref(false);
const detailLoading = ref(false);
const usersLoading = ref(false);
const creating = ref(false);
const actionSubmitting = ref(false);

const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

const stats = ref<Api.Admin.RawRecord>({});
const detailVisible = ref(false);
const createVisible = ref(false);
const actionVisible = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const detailRecord = ref<Api.Admin.RawRecord>({});
const progressLogs = ref<Api.Admin.RawRecord[]>([]);
const activeComplaintId = ref('');
const activeComplaintNo = ref('');
const actionMode = ref<ComplaintActionMode>('assign');

const createFormRef = ref<FormInst | null>(null);
const actionFormRef = ref<FormInst | null>(null);

const queryModel = reactive<Api.Admin.ComplaintListQuery>({
  keyword: '',
  status: '',
  orderNo: '',
  channelId: ''
});

const createForm = reactive<CreateComplaintFormModel>({
  orderNo: '',
  channelId: '',
  mobile: '',
  title: '',
  content: '',
  category: 'AFTER_SALE',
  priority: 'MEDIUM',
  source: 'MANUAL',
  extText: ''
});

const actionForm = reactive<ComplaintActionFormModel>({
  assigneeUserId: '',
  status: '',
  reason: '',
  result: '',
  feedback: '',
  content: ''
});

const userOptions = ref<SelectOption[]>([]);

const commonStatusOptions = [
  { label: '全部状态', value: '' },
  { label: 'OPEN', value: 'OPEN' },
  { label: 'PROCESSING', value: 'PROCESSING' },
  { label: 'CLOSED', value: 'CLOSED' }
];

const createRules: Record<string, App.Global.FormRule[]> = {
  title: [{ required: true, message: '请输入工单标题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入投诉内容', trigger: 'blur' }]
};

const actionRules: Record<string, App.Global.FormRule[]> = {
  assigneeUserId: [{ required: true, message: '请选择处理人', trigger: 'change' }],
  status: [{ required: true, message: '请输入工单状态', trigger: 'blur' }],
  result: [{ required: true, message: '请输入处理结果', trigger: 'blur' }],
  feedback: [{ required: true, message: '请输入用户反馈', trigger: 'blur' }],
  content: [{ required: true, message: '请输入进展记录', trigger: 'blur' }]
};

const statsCards = computed(() => [
  { label: '工单总数', value: pickValue(stats.value, ['total'], '0') },
  { label: '待处理', value: pickValue(stats.value, ['openCount'], '0') },
  { label: '处理中', value: pickValue(stats.value, ['processingCount'], '0') },
  { label: '已关闭', value: pickValue(stats.value, ['closedCount'], '0') },
  { label: '分配给我', value: pickValue(stats.value, ['assignedToMeCount'], '0') },
  { label: '我创建的', value: pickValue(stats.value, ['createdByMeCount'], '0') }
]);

const detailComplaint = computed(() => {
  const nested = detailRecord.value.complaint;
  return nested ? extractObjectData(nested) : extractObjectData(detailRecord.value);
});

const actionTitleMap: Record<ComplaintActionMode, string> = {
  assign: '分配工单',
  transfer: '转派工单',
  status: '更新工单状态',
  result: '登记处理结果',
  feedback: '登记用户反馈',
  progress: '追加进展记录',
  close: '关闭工单',
  reopen: '重新打开工单'
};

function getStatusTagType(status: string) {
  const normalized = status.toUpperCase();

  if (normalized.includes('CLOSE') || normalized.includes('DONE') || normalized.includes('SUCCESS')) {
    return 'success';
  }

  if (normalized.includes('PROCESS') || normalized.includes('HANDLE')) {
    return 'warning';
  }

  if (normalized.includes('REJECT') || normalized.includes('FAIL')) {
    return 'error';
  }

  return 'default';
}

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function resetCreateForm() {
  createForm.orderNo = '';
  createForm.channelId = '';
  createForm.mobile = '';
  createForm.title = '';
  createForm.content = '';
  createForm.category = 'AFTER_SALE';
  createForm.priority = 'MEDIUM';
  createForm.source = 'MANUAL';
  createForm.extText = '';
}

function resetActionForm() {
  actionForm.assigneeUserId = '';
  actionForm.status = '';
  actionForm.reason = '';
  actionForm.result = '';
  actionForm.feedback = '';
  actionForm.content = '';
}

function applyDetailData(data: unknown) {
  const detail = extractObjectData(data);
  detailRecord.value = detail;
  progressLogs.value = extractListData(detail.progressLogs);
  const complaint = detail.complaint ? extractObjectData(detail.complaint) : detail;
  activeComplaintId.value = getEntityId(complaint, ['id', 'complaintId']);
  activeComplaintNo.value = pickValue(complaint, ['complaintNo'], '');
}

async function loadRows() {
  loading.value = true;

  try {
    const data = await fetchComplaints(
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

async function loadStats() {
  statsLoading.value = true;

  try {
    const data = await fetchComplaintStats();
    stats.value = extractObjectData(data);
  } finally {
    statsLoading.value = false;
  }
}

async function ensureUserOptions() {
  if (userOptions.value.length || usersLoading.value) {
    return;
  }

  usersLoading.value = true;

  try {
    const data = await fetchAdminUsers({
      pageNum: 1,
      pageSize: 200,
      status: 'ACTIVE'
    });

    const pageData = extractPagedData(data);
    userOptions.value = pageData.records
      .map(item => {
        const userId = getEntityId(item, ['userId', 'id']);

        if (!userId) {
          return null;
        }

        const username = pickValue(item, ['username', 'userName'], userId);
        const displayName = pickValue(item, ['displayName', 'name'], username);

        return {
          label: `${displayName} (${username})`,
          value: userId
        } satisfies SelectOption;
      })
      .filter(Boolean) as SelectOption[];
  } finally {
    usersLoading.value = false;
  }
}

async function loadDetail(complaintId: string) {
  detailLoading.value = true;

  try {
    const data = await fetchComplaintDetail(complaintId);
    applyDetailData(data);
  } finally {
    detailLoading.value = false;
  }
}

async function reloadAll() {
  await Promise.all([loadRows(), loadStats()]);
}

async function handleSearch() {
  pageNum.value = 1;
  await loadRows();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  queryModel.orderNo = '';
  queryModel.channelId = '';
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

async function openCreateModal() {
  resetCreateForm();
  createVisible.value = true;
  await nextTick();
  createFormRef.value?.restoreValidation?.();
}

async function submitCreate() {
  await createFormRef.value?.validate();

  let ext: Api.Admin.JsonObject | undefined;

  if (createForm.extText.trim()) {
    try {
      ext = JSON.parse(createForm.extText) as Api.Admin.JsonObject;
    } catch {
      window.$message?.error('扩展字段 ext 必须是合法 JSON');
      return;
    }
  }

  creating.value = true;

  try {
    await createComplaint({
      orderNo: createForm.orderNo.trim() || undefined,
      channelId: createForm.channelId.trim() || undefined,
      mobile: createForm.mobile.trim() || undefined,
      title: createForm.title.trim(),
      content: createForm.content.trim(),
      category: createForm.category.trim() || undefined,
      priority: createForm.priority.trim() || undefined,
      source: createForm.source.trim() || undefined,
      ext
    });

    window.$message?.success('投诉工单已创建');
    createVisible.value = false;
    await reloadAll();
  } finally {
    creating.value = false;
  }
}

async function openDetailModal(row: Api.Admin.RawRecord) {
  const complaintId = getEntityId(row, ['id', 'complaintId']);

  if (!complaintId) {
    return;
  }

  detailVisible.value = true;
  await loadDetail(complaintId);
}

async function openActionModal(mode: ComplaintActionMode, row?: Api.Admin.RawRecord) {
  const complaintId = row ? getEntityId(row, ['id', 'complaintId']) : activeComplaintId.value;

  if (!complaintId) {
    window.$message?.warning('未找到投诉工单编号');
    return;
  }

  activeComplaintId.value = complaintId;
  activeComplaintNo.value = row ? pickValue(row, ['complaintNo'], '') : activeComplaintNo.value;
  actionMode.value = mode;
  resetActionForm();

  if (mode === 'assign' || mode === 'transfer') {
    await ensureUserOptions();
  }

  actionVisible.value = true;
  await nextTick();
  actionFormRef.value?.restoreValidation?.();
}

async function submitAction() {
  await actionFormRef.value?.validate();

  actionSubmitting.value = true;

  try {
    if (actionMode.value === 'assign') {
      await assignComplaint(activeComplaintId.value, {
        assigneeUserId: actionForm.assigneeUserId
      });
    }

    if (actionMode.value === 'transfer') {
      await transferComplaint(activeComplaintId.value, {
        assigneeUserId: actionForm.assigneeUserId
      });
    }

    if (actionMode.value === 'status') {
      await updateComplaintStatus(activeComplaintId.value, {
        status: actionForm.status.trim(),
        reason: actionForm.reason.trim() || undefined
      });
    }

    if (actionMode.value === 'result') {
      await saveComplaintResult(activeComplaintId.value, {
        result: actionForm.result.trim()
      });
    }

    if (actionMode.value === 'feedback') {
      await saveComplaintFeedback(activeComplaintId.value, {
        feedback: actionForm.feedback.trim()
      });
    }

    if (actionMode.value === 'progress') {
      await addComplaintProgressLog(activeComplaintId.value, {
        content: actionForm.content.trim()
      });
    }

    if (actionMode.value === 'close') {
      await closeComplaint(activeComplaintId.value, {
        reason: actionForm.reason.trim() || undefined
      });
    }

    if (actionMode.value === 'reopen') {
      await reopenComplaint(activeComplaintId.value, {
        reason: actionForm.reason.trim() || undefined
      });
    }

    window.$message?.success(`${actionTitleMap[actionMode.value]}成功`);
    actionVisible.value = false;
    await Promise.all([loadRows(), loadStats(), loadDetail(activeComplaintId.value)]);
  } finally {
    actionSubmitting.value = false;
  }
}

async function handleExport() {
  exporting.value = true;

  try {
    const data = extractObjectData(await exportComplaints());
    openRaw('投诉导出任务', data);
    window.$message?.success('导出任务已创建，可查看返回的 artifact 下载地址');
  } finally {
    exporting.value = false;
  }
}

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'complaintNo',
    title: '工单号',
    render: row => pickValue(row, ['complaintNo'])
  },
  {
    key: 'orderNo',
    title: '订单号',
    render: row => pickValue(row, ['orderNo'])
  },
  {
    key: 'channelId',
    title: '渠道',
    render: row => pickValue(row, ['channelId'])
  },
  {
    key: 'mobile',
    title: '手机号',
    render: row => pickValue(row, ['mobile'])
  },
  {
    key: 'title',
    title: '投诉标题',
    width: 260,
    ellipsis: { tooltip: true },
    render: row => pickValue(row, ['title'])
  },
  {
    key: 'category',
    title: '分类',
    render: row => pickValue(row, ['category'])
  },
  {
    key: 'priority',
    title: '优先级',
    render: row => pickValue(row, ['priority'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      return h(NTag, { size: 'small', type: getStatusTagType(status) }, { default: () => status });
    }
  },
  {
    key: 'assignedToUsername',
    title: '当前处理人',
    render: row => pickValue(row, ['assignedToUsername'], '未分配')
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    render: row => pickValue(row, ['updatedAt'])
  },
  {
    key: 'actions',
    title: '操作',
    width: 320,
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => openDetailModal(row)
          },
          { default: () => '详情' }
        ),
        h(
          NButton,
          {
            size: 'small',
            ghost: true,
            onClick: () => openActionModal('assign', row)
          },
          { default: () => '分配' }
        ),
        h(
          NButton,
          {
            size: 'small',
            ghost: true,
            type: 'warning',
            onClick: () => openActionModal('status', row)
          },
          { default: () => '改状态' }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            onClick: () => openRaw(`投诉工单 ${pickValue(row, ['complaintNo'], '')}`, row)
          },
          { default: () => '原始数据' }
        )
      ])
  }
]);

onMounted(() => {
  reloadAll();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      投诉管理已按新 API 接入完整工单流转，支持创建、分配、转派、处理结果登记、反馈记录、进展日志、关闭与重开。
    </NAlert>

    <NGrid cols="2 s:3 m:6" responsive="screen" :x-gap="12" :y-gap="12">
      <NGi v-for="item in statsCards" :key="item.label">
        <NCard :bordered="false" class="card-wrapper" :loading="statsLoading">
          <div class="flex flex-col gap-6px">
            <span class="text-13px text-#64748b">{{ item.label }}</span>
            <span class="text-26px text-#0f172a font-700">{{ item.value }}</span>
          </div>
        </NCard>
      </NGi>
    </NGrid>

    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索标题、内容、手机号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.orderNo" clearable placeholder="订单号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.channelId" clearable placeholder="渠道 ID" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.status" :options="commonStatusOptions" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-between gap-12px">
          <NSpace>
            <NButton type="primary" @click="openCreateModal">创建投诉工单</NButton>
            <NButton :loading="exporting" @click="handleExport">导出工单</NButton>
          </NSpace>
          <NSpace>
            <NButton @click="handleReset">重置</NButton>
            <NButton type="primary" @click="handleSearch">查询</NButton>
          </NSpace>
        </div>
      </div>
    </NCard>

    <NCard title="投诉工单列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['id', 'complaintId', 'complaintNo'])"
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

    <NModal v-model:show="createVisible" preset="card" title="创建投诉工单" class="w-760px">
      <NForm
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-placement="left"
        label-width="96"
      >
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="订单号">
              <NInput v-model:value="createForm.orderNo" placeholder="可选，便于自动关联订单上下文" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="渠道 ID">
              <NInput v-model:value="createForm.channelId" placeholder="可选" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="手机号">
              <NInput v-model:value="createForm.mobile" placeholder="可选" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="投诉来源">
              <NInput v-model:value="createForm.source" placeholder="如 MANUAL / USER / CHANNEL" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="工单分类">
              <NInput v-model:value="createForm.category" placeholder="如 AFTER_SALE / RECHARGE_FAIL" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="优先级">
              <NInput v-model:value="createForm.priority" placeholder="如 LOW / MEDIUM / HIGH" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="工单标题" path="title">
          <NInput v-model:value="createForm.title" />
        </NFormItem>
        <NFormItem label="投诉内容" path="content">
          <NInput v-model:value="createForm.content" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
        </NFormItem>
        <NFormItem label="扩展 JSON">
          <NInput
            v-model:value="createForm.extText"
            type="textarea"
            placeholder='可选，如 { "sourceTicketNo": "TS-1001" }'
            :autosize="{ minRows: 4, maxRows: 8 }"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="createVisible = false">取消</NButton>
          <NButton type="primary" :loading="creating" @click="submitCreate">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="投诉工单详情" class="w-1080px">
      <NSpace vertical :size="16">
        <NCard :bordered="false" class="bg-#f8fafc">
          <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-col gap-6px">
              <h3 class="m-0 text-20px text-#0f172a font-700">
                {{ pickValue(detailComplaint, ['complaintNo'], '投诉工单') }}
              </h3>
              <span class="text-14px text-#64748b">
                状态：{{ pickValue(detailComplaint, ['status']) }} | 当前处理人：{{
                  pickValue(detailComplaint, ['assignedToUsername'], '未分配')
                }}
              </span>
            </div>
            <NSpace>
              <NButton size="small" @click="loadDetail(activeComplaintId)">刷新</NButton>
              <NButton size="small" @click="openActionModal('assign')">分配</NButton>
              <NButton size="small" @click="openActionModal('transfer')">转派</NButton>
              <NButton size="small" @click="openActionModal('status')">改状态</NButton>
              <NButton size="small" @click="openActionModal('result')">结果</NButton>
              <NButton size="small" @click="openActionModal('feedback')">反馈</NButton>
              <NButton size="small" @click="openActionModal('progress')">进展</NButton>
              <NButton size="small" type="warning" ghost @click="openActionModal('close')">关闭</NButton>
              <NButton size="small" type="primary" ghost @click="openActionModal('reopen')">重开</NButton>
            </NSpace>
          </div>
        </NCard>

        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="工单信息" :bordered="false" class="card-wrapper" :loading="detailLoading">
              <NDescriptions bordered :column="1" label-placement="left">
                <NDescriptionsItem label="工单号">{{ pickValue(detailComplaint, ['complaintNo']) }}</NDescriptionsItem>
                <NDescriptionsItem label="订单号">{{ pickValue(detailComplaint, ['orderNo']) }}</NDescriptionsItem>
                <NDescriptionsItem label="渠道 ID">{{ pickValue(detailComplaint, ['channelId']) }}</NDescriptionsItem>
                <NDescriptionsItem label="手机号">{{ pickValue(detailComplaint, ['mobile']) }}</NDescriptionsItem>
                <NDescriptionsItem label="分类">{{ pickValue(detailComplaint, ['category']) }}</NDescriptionsItem>
                <NDescriptionsItem label="优先级">{{ pickValue(detailComplaint, ['priority']) }}</NDescriptionsItem>
                <NDescriptionsItem label="来源">{{ pickValue(detailComplaint, ['source']) }}</NDescriptionsItem>
                <NDescriptionsItem label="创建人">
                  {{ pickValue(detailComplaint, ['createdByUsername']) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="处理人">
                  {{ pickValue(detailComplaint, ['assignedToUsername'], '未分配') }}
                </NDescriptionsItem>
                <NDescriptionsItem label="最近分配时间">
                  {{ pickValue(detailComplaint, ['lastAssignedAt']) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="关闭时间">{{ pickValue(detailComplaint, ['closedAt']) }}</NDescriptionsItem>
                <NDescriptionsItem label="重开时间">{{ pickValue(detailComplaint, ['reopenedAt']) }}</NDescriptionsItem>
                <NDescriptionsItem label="创建时间">{{ pickValue(detailComplaint, ['createdAt']) }}</NDescriptionsItem>
                <NDescriptionsItem label="更新时间">{{ pickValue(detailComplaint, ['updatedAt']) }}</NDescriptionsItem>
              </NDescriptions>
            </NCard>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <NCard title="投诉内容" :bordered="false" class="card-wrapper" :loading="detailLoading">
                <div class="text-16px text-#0f172a font-600">{{ pickValue(detailComplaint, ['title']) }}</div>
                <p class="mb-0 mt-12px whitespace-pre-wrap text-14px text-#334155">
                  {{ pickValue(detailComplaint, ['content']) }}
                </p>
              </NCard>

              <NCard title="处理结果与反馈" :bordered="false" class="card-wrapper" :loading="detailLoading">
                <NSpace vertical :size="12">
                  <div>
                    <div class="text-13px text-#64748b">处理结果</div>
                    <div class="mt-4px whitespace-pre-wrap text-14px text-#0f172a">
                      {{ pickValue(detailComplaint, ['resultText'], '暂无') }}
                    </div>
                  </div>
                  <div>
                    <div class="text-13px text-#64748b">用户反馈</div>
                    <div class="mt-4px whitespace-pre-wrap text-14px text-#0f172a">
                      {{ pickValue(detailComplaint, ['feedbackText'], '暂无') }}
                    </div>
                  </div>
                </NSpace>
              </NCard>
            </NSpace>
          </NGi>
        </NGrid>

        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="进展日志" :bordered="false" class="card-wrapper" :loading="detailLoading">
              <NTimeline>
                <NTimelineItem
                  v-for="item in progressLogs"
                  :key="getEntityId(item, ['id', 'createdAt'])"
                  :title="pickValue(item, ['actionType'], 'PROGRESS')"
                  :content="`${pickValue(item, ['operatorUsername'], 'system')}：${pickValue(item, ['content'])}`"
                  :time="pickValue(item, ['createdAt'])"
                />
              </NTimeline>
              <NEmpty v-if="!progressLogs.length && !detailLoading" description="暂无进展日志" />
            </NCard>
          </NGi>

          <NGi>
            <RawJsonCard title="投诉快照 JSON" :value="detailComplaint.snapshot || detailComplaint" />
          </NGi>
        </NGrid>
      </NSpace>
    </NModal>

    <NModal v-model:show="actionVisible" preset="card" :title="actionTitleMap[actionMode]" class="w-560px">
      <NForm
        ref="actionFormRef"
        :model="actionForm"
        :rules="actionRules"
        label-placement="left"
        label-width="98"
      >
        <NAlert type="info" :show-icon="false" class="mb-16px">
          当前工单：{{ activeComplaintNo || activeComplaintId }}
        </NAlert>

        <template v-if="actionMode === 'assign' || actionMode === 'transfer'">
          <NFormItem label="处理人" path="assigneeUserId">
            <NSelect
              v-model:value="actionForm.assigneeUserId"
              :options="userOptions"
              :loading="usersLoading"
              clearable
              filterable
              placeholder="选择后台处理人"
            />
          </NFormItem>
        </template>

        <template v-else-if="actionMode === 'status'">
          <NFormItem label="工单状态" path="status">
            <NInput v-model:value="actionForm.status" placeholder="如 OPEN / PROCESSING / CLOSED" />
          </NFormItem>
          <NFormItem label="变更原因">
            <NInput v-model:value="actionForm.reason" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" />
          </NFormItem>
        </template>

        <template v-else-if="actionMode === 'result'">
          <NFormItem label="处理结果" path="result">
            <NInput v-model:value="actionForm.result" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
          </NFormItem>
        </template>

        <template v-else-if="actionMode === 'feedback'">
          <NFormItem label="用户反馈" path="feedback">
            <NInput v-model:value="actionForm.feedback" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
          </NFormItem>
        </template>

        <template v-else-if="actionMode === 'progress'">
          <NFormItem label="进展内容" path="content">
            <NInput v-model:value="actionForm.content" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
          </NFormItem>
        </template>

        <template v-else>
          <NFormItem :label="actionMode === 'close' ? '关闭原因' : '重开原因'">
            <NInput v-model:value="actionForm.reason" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
          </NFormItem>
        </template>
      </NForm>

      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="actionVisible = false">取消</NButton>
          <NButton type="primary" :loading="actionSubmitting" @click="submitAction">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-840px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
