<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createChannel, fetchChannels, updateChannel } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toBoolean, toPrettyJson } from '@/utils/admin';

const router = useRouter();

type ChannelFormMode = 'create' | 'edit';

const loading = ref(false);
const submitting = ref(false);
const formVisible = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const formRef = ref<FormInst | null>(null);
const formMode = ref<ChannelFormMode>('create');
const editingChannelId = ref('');

const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

const queryModel = reactive<Api.Admin.ChannelListQuery>({
  keyword: '',
  status: '',
  cooperationStatus: '',
  protocolType: '',
  channelType: ''
});

const formModel = reactive<Api.Admin.CreateChannelPayload>({
  channelCode: '',
  channelName: '',
  channelType: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  baseUrl: '',
  protocolType: '',
  accessAccount: '',
  accessPassword: '',
  cooperationStatus: 'ACTIVE',
  supportsConsumptionLog: false,
  settlementMode: '',
  status: 'ACTIVE',
  remark: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const cooperationStatusOptions = [
  { label: '全部合作状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'PAUSED', value: 'PAUSED' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const formStatusOptions = statusOptions.filter(option => option.value);
const formCooperationStatusOptions = cooperationStatusOptions.filter(option => option.value);

function asOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value).trim();
  return text || undefined;
}

function buildChannelPayload(source: Api.Admin.RawRecord | Api.Admin.CreateChannelPayload): Api.Admin.CreateChannelPayload {
  return normalizeQuery({
    channelCode: asOptionalString(source.channelCode),
    channelName: asOptionalString(source.channelName),
    channelType: asOptionalString(source.channelType),
    contactName: asOptionalString(source.contactName),
    contactPhone: asOptionalString(source.contactPhone),
    contactEmail: asOptionalString(source.contactEmail),
    baseUrl: asOptionalString(source.baseUrl),
    protocolType: asOptionalString(source.protocolType),
    accessAccount: asOptionalString(source.accessAccount),
    accessPassword: asOptionalString(source.accessPassword),
    cooperationStatus: asOptionalString(source.cooperationStatus),
    supportsConsumptionLog: toBoolean(source.supportsConsumptionLog),
    settlementMode: asOptionalString(source.settlementMode),
    status: asOptionalString(source.status),
    remark: asOptionalString(source.remark)
  }) as Api.Admin.CreateChannelPayload;
}

function getPortalStatusType(status: string) {
  if (['APPROVED', 'ACTIVE', 'ENABLED'].includes(status)) {
    return 'success';
  }

  if (['PENDING', 'WAITING_APPROVAL'].includes(status)) {
    return 'warning';
  }

  if (['REJECTED', 'DISABLED'].includes(status)) {
    return 'error';
  }

  return 'default';
}

function getStatusType(status: string) {
  if (['ACTIVE', 'APPROVED', 'ENABLED'].includes(status)) {
    return 'success';
  }

  if (['PAUSED', 'PENDING'].includes(status)) {
    return 'warning';
  }

  if (['INACTIVE', 'DISABLED', 'REJECTED'].includes(status)) {
    return 'error';
  }

  return 'default';
}

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'channelCode',
    title: '渠道编码',
    width: 150,
    render: row => pickValue(row, ['channelCode', 'code'])
  },
  {
    key: 'channelName',
    title: '渠道名称',
    width: 180,
    render: row => pickValue(row, ['channelName', 'name'])
  },
  {
    key: 'channelType',
    title: '渠道类型',
    width: 120,
    render: row => pickValue(row, ['channelType', 'type'])
  },
  {
    key: 'contact',
    title: '联系人',
    width: 180,
    render: row =>
      h('div', { class: 'flex flex-col gap-4px' }, [
        h('span', { class: 'text-13px text-#0f172a' }, pickValue(row, ['contactName'])),
        h('span', { class: 'text-12px text-#64748b' }, pickValue(row, ['contactPhone']))
      ])
  },
  {
    key: 'portalStatus',
    title: '渠道平台账号',
    width: 140,
    render: row => {
      const status = pickValue(row, ['portalStatus'], '-');
      return h(NTag, { size: 'small', type: getPortalStatusType(status) }, { default: () => status });
    }
  },
  {
    key: 'cooperationStatus',
    title: '合作状态',
    width: 120,
    render: row => {
      const status = pickValue(row, ['cooperationStatus'], '-');
      return h(NTag, { size: 'small', type: getStatusType(status) }, { default: () => status });
    }
  },
  {
    key: 'status',
    title: '主体状态',
    width: 120,
    render: row => {
      const status = pickValue(row, ['status'], '-');
      return h(NTag, { size: 'small', type: getStatusType(status) }, { default: () => status });
    }
  },
  {
    key: 'settlementMode',
    title: '结算模式',
    width: 120,
    render: row => pickValue(row, ['settlementMode'])
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 180,
    render: row => pickValue(row, ['updatedAt', 'createdAt'])
  },
  {
    key: 'actions',
    title: '操作',
    width: 360,
    render: row => {
      const channelId = getEntityId(row, ['channelId', 'id', 'channelCode']);
      const currentStatus = pickValue(row, ['status'], 'ACTIVE');
      const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const actionLabel = currentStatus === 'ACTIVE' ? '停用渠道' : '启用渠道';

      return h(NSpace, { size: 8, wrap: false }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            secondary: true,
            onClick: () => router.push(`/channels/detail/${channelId}`)
          },
          { default: () => '详情配置' }
        ),
        h(
          NButton,
          {
            size: 'small',
            onClick: () => openEdit(row)
          },
          { default: () => '编辑档案' }
        ),
        h(
          NButton,
          {
            size: 'small',
            type: currentStatus === 'ACTIVE' ? 'warning' : 'success',
            ghost: true,
            onClick: () => handleToggleStatus(row, nextStatus)
          },
          { default: () => actionLabel }
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

const rules: Record<string, App.Global.FormRule[]> = {
  channelCode: [{ required: true, message: '请输入渠道编码', trigger: 'blur' }],
  channelName: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  channelType: [{ required: true, message: '请输入渠道类型', trigger: 'blur' }],
  contactEmail: [{ type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'input'] }]
};

function resetForm() {
  formModel.channelCode = '';
  formModel.channelName = '';
  formModel.channelType = '';
  formModel.contactName = '';
  formModel.contactPhone = '';
  formModel.contactEmail = '';
  formModel.baseUrl = '';
  formModel.protocolType = '';
  formModel.accessAccount = '';
  formModel.accessPassword = '';
  formModel.cooperationStatus = 'ACTIVE';
  formModel.supportsConsumptionLog = false;
  formModel.settlementMode = '';
  formModel.status = 'ACTIVE';
  formModel.remark = '';
}

function fillForm(row: Api.Admin.RawRecord) {
  formModel.channelCode = String(row.channelCode ?? '');
  formModel.channelName = String(row.channelName ?? '');
  formModel.channelType = String(row.channelType ?? '');
  formModel.contactName = String(row.contactName ?? '');
  formModel.contactPhone = String(row.contactPhone ?? '');
  formModel.contactEmail = String(row.contactEmail ?? '');
  formModel.baseUrl = String(row.baseUrl ?? '');
  formModel.protocolType = String(row.protocolType ?? '');
  formModel.accessAccount = String(row.accessAccount ?? '');
  formModel.accessPassword = String(row.accessPassword ?? '');
  formModel.cooperationStatus = String(row.cooperationStatus ?? 'ACTIVE');
  formModel.supportsConsumptionLog = toBoolean(row.supportsConsumptionLog);
  formModel.settlementMode = String(row.settlementMode ?? '');
  formModel.status = String(row.status ?? 'ACTIVE');
  formModel.remark = String(row.remark ?? '');
}

function openCreate() {
  resetForm();
  editingChannelId.value = '';
  formMode.value = 'create';
  formVisible.value = true;
}

function openEdit(row: Api.Admin.RawRecord) {
  fillForm(row);
  editingChannelId.value = getEntityId(row, ['channelId', 'id', 'channelCode']);
  formMode.value = 'edit';
  formVisible.value = true;
}

async function loadChannels() {
  loading.value = true;

  try {
    const data = await fetchChannels(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
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
  await loadChannels();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  queryModel.cooperationStatus = '';
  queryModel.protocolType = '';
  queryModel.channelType = '';
  pageNum.value = 1;
  await loadChannels();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadChannels();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadChannels();
}

async function handleToggleStatus(row: Api.Admin.RawRecord, status: string) {
  const channelId = getEntityId(row, ['channelId', 'id', 'channelCode']);

  if (!channelId) {
    return;
  }

  submitting.value = true;

  try {
    await updateChannel(channelId, {
      ...buildChannelPayload(row),
      status
    });

    window.$message?.success(`渠道已更新为 ${status}`);
    await loadChannels();
  } finally {
    submitting.value = false;
  }
}

async function submitForm() {
  await formRef.value?.validate();

  if (formModel.accessPassword && formModel.accessPassword.length < 6) {
    window.$message?.error('接入密码至少需要 6 位');
    return;
  }

  submitting.value = true;

  try {
    const payload = buildChannelPayload(formModel);

    if (formMode.value === 'create') {
      await createChannel(payload);
      window.$message?.success('渠道商主体创建成功');
    } else {
      await updateChannel(editingChannelId.value, payload);
      window.$message?.success('渠道商主体更新成功');
    }

    formVisible.value = false;
    pageNum.value = 1;
    await loadChannels();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadChannels();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      渠道商主体档案已按桌面版 `api.json` 对齐为可新增、可查询、可编辑、可停用管理。
      这里录入的是渠道商基础资料、接口接入信息和合作状态；外部渠道登录使用的“渠道管理平台账号/密码”请进入详情页的“门户账号”模块开通和审核，不属于公司内部后台账号。
    </NAlert>

    <NAlert type="warning" :show-icon="false">
      当前 `api.json` 未提供渠道商删除接口，因此本页严格按接口能力提供“停用/启用”替代删除操作，不伪造不可用按钮。
    </NAlert>

    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:3 l:5" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索渠道编码、名称、联系人" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.status" :options="statusOptions" placeholder="主体状态" />
          </NGi>
          <NGi>
            <NSelect
              v-model:value="queryModel.cooperationStatus"
              :options="cooperationStatusOptions"
              placeholder="合作状态"
            />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.channelType" clearable placeholder="渠道类型" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.protocolType" clearable placeholder="协议类型" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增渠道商</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="渠道商列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :scroll-x="1650"
        :row-key="row => getEntityId(row, ['channelId', 'id', 'channelCode'])"
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

    <NModal
      v-model:show="formVisible"
      preset="card"
      :title="formMode === 'create' ? '新增渠道商主体' : '编辑渠道商主体'"
      class="w-920px"
    >
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="110">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="渠道编码" path="channelCode">
              <NInput v-model:value="formModel.channelCode" :disabled="formMode === 'edit'" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="渠道名称" path="channelName">
              <NInput v-model:value="formModel.channelName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="渠道类型" path="channelType">
              <NInput v-model:value="formModel.channelType" placeholder="例如 API、代理商、企业客户" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="协议类型">
              <NInput v-model:value="formModel.protocolType" placeholder="例如 OPEN_API、MANUAL" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="联系人">
              <NInput v-model:value="formModel.contactName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="联系电话">
              <NInput v-model:value="formModel.contactPhone" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="联系邮箱" path="contactEmail">
              <NInput v-model:value="formModel.contactEmail" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="结算模式">
              <NInput v-model:value="formModel.settlementMode" placeholder="例如 预付费、后付费" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="渠道回调地址">
              <NInput v-model:value="formModel.baseUrl" placeholder="用于对接或渠道平台基础地址" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接入账号">
              <NInput v-model:value="formModel.accessAccount" placeholder="渠道接口接入账号，不是内部员工账号" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接入密码">
              <NInput
                v-model:value="formModel.accessPassword"
                type="password"
                show-password-on="click"
                placeholder="最少 6 位，供接口接入或外部接入使用"
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="合作状态">
              <NSelect v-model:value="formModel.cooperationStatus" :options="formCooperationStatusOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="主体状态">
              <NSelect v-model:value="formModel.status" :options="formStatusOptions" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="支持消费日志">
              <NSwitch v-model:value="formModel.supportsConsumptionLog" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="备注">
              <NInput v-model:value="formModel.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
      <template #footer>
        <div class="flex justify-between gap-12px">
          <span class="text-12px text-#64748b">
            外部渠道登录账号请在详情页“门户账号”中单独开通、审核和重置密码。
          </span>
          <div class="flex gap-12px">
            <NButton @click="formVisible = false">取消</NButton>
            <NButton type="primary" :loading="submitting" @click="submitForm">保存</NButton>
          </div>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="渠道原始数据" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
