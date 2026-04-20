<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createChannel, fetchChannels } from '@/service/api';
import {
  extractPagedData,
  formatBooleanLabel,
  getEntityId,
  normalizeQuery,
  pickValue,
  toBoolean,
  toPrettyJson
} from '@/utils/admin';

const router = useRouter();

const loading = ref(false);
const submitting = ref(false);
const createVisible = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const formRef = ref<FormInst | null>(null);

const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(100);

const defaultSort = {
  sortBy: 'createdAt',
  sortOrder: 'desc' as const
};

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
  cooperationStatus: '',
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

const cooperationOptions = [
  { label: '全部合作状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'PAUSED', value: 'PAUSED' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'channelCode',
    title: '渠道编码',
    render: row => pickValue(row, ['channelCode', 'code'])
  },
  {
    key: 'channelName',
    title: '渠道名称',
    render: row => pickValue(row, ['channelName', 'name'])
  },
  {
    key: 'channelType',
    title: '渠道类型',
    render: row => pickValue(row, ['channelType', 'type'])
  },
  {
    key: 'contactName',
    title: '联系人',
    render: row => pickValue(row, ['contactName'])
  },
  {
    key: 'accessAccount',
    title: '门户登录账号',
    render: row => pickValue(row, ['accessAccount'])
  },
  {
    key: 'protocolType',
    title: '协议',
    render: row => pickValue(row, ['protocolType'])
  },
  {
    key: 'cooperationStatus',
    title: '合作状态',
    render: row => pickValue(row, ['cooperationStatus'])
  },
  {
    key: 'supportsConsumptionLog',
    title: '消费日志',
    render: row => formatBooleanLabel(row.supportsConsumptionLog, '支持', '不支持')
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    render: row => pickValue(row, ['updatedAt', 'createdAt'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const channelId = getEntityId(row, ['channelId', 'id', 'channelCode']);

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => router.push(`/channels/detail/${channelId}`)
          },
          { default: () => '详情' }
        ),
        h(
          NButton,
          {
            size: 'small',
            secondary: true,
            onClick: () =>
              router.push({
                path: '/channels/recharge',
                query: { channelId }
              })
          },
          { default: () => '充值' }
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
  accessAccount: [{ required: true, message: '请输入渠道门户登录账号', trigger: 'blur' }],
  accessPassword: [
    { required: true, message: '请输入渠道门户登录密码', trigger: 'blur' },
    { min: 6, message: '渠道门户登录密码至少 6 位', trigger: 'blur' }
  ]
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
  formModel.settlementMode = 'PREPAID';
  formModel.status = 'ACTIVE';
  formModel.remark = '';
}

function openCreate() {
  resetForm();
  createVisible.value = true;
}

function buildCreatedChannelRecord(result: Api.Admin.RawRecord) {
  const channelId = getEntityId(result, ['resourceId']) || `local-${Date.now()}`;
  const now = new Date().toISOString();

  return {
    id: channelId,
    channelId,
    channelCode: formModel.channelCode.trim(),
    channelName: formModel.channelName.trim(),
    channelType: formModel.channelType.trim(),
    contactName: formModel.contactName?.trim() || null,
    contactPhone: formModel.contactPhone?.trim() || null,
    contactEmail: formModel.contactEmail?.trim() || null,
    baseUrl: formModel.baseUrl?.trim() || null,
    protocolType: formModel.protocolType?.trim() || null,
    accessAccount: formModel.accessAccount?.trim() || null,
    accessPassword: '******',
    cooperationStatus: formModel.cooperationStatus?.trim() || 'ACTIVE',
    supportsConsumptionLog: toBoolean(formModel.supportsConsumptionLog),
    settlementMode: formModel.settlementMode?.trim() || null,
    status: formModel.status?.trim() || 'ACTIVE',
    remark: formModel.remark?.trim() || null,
    createdAt: now,
    updatedAt: now
  } satisfies Api.Admin.RawRecord;
}

function prependCreatedChannel(row: Api.Admin.RawRecord) {
  const nextChannelId = getEntityId(row, ['channelId', 'id']);
  const nextChannelCode = pickValue(row, ['channelCode'], '').toLowerCase();
  const hadExisting = rows.value.some(item => {
    const currentId = getEntityId(item, ['channelId', 'id']);
    const currentCode = pickValue(item, ['channelCode'], '').toLowerCase();

    return currentId === nextChannelId || currentCode === nextChannelCode;
  });
  const filteredRows = rows.value.filter(item => {
    const currentId = getEntityId(item, ['channelId', 'id']);
    const currentCode = pickValue(item, ['channelCode'], '').toLowerCase();

    return currentId !== nextChannelId && currentCode !== nextChannelCode;
  });

  rows.value = [row, ...filteredRows].slice(0, pageSize.value);
  total.value = hadExisting ? total.value : total.value + 1;
  pageNum.value = 1;
}

async function loadChannels() {
  loading.value = true;

  try {
    const pageData = extractPagedData(
      await fetchChannels(
        normalizeQuery({
          pageNum: pageNum.value,
          pageSize: pageSize.value,
          ...defaultSort,
          ...queryModel
        })
      )
    );

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

async function validateUniqueChannelIdentity() {
  const channelCode = formModel.channelCode.trim();
  const accessAccount = formModel.accessAccount?.trim();
  const codeResponse = await fetchChannels({ pageNum: 1, pageSize: 100, keyword: channelCode });
  const codeMatched = extractPagedData(codeResponse).records.some(
    item => pickValue(item, ['channelCode'], '').toLowerCase() === channelCode.toLowerCase()
  );

  if (codeMatched) {
    window.$message?.error('渠道编码已存在，请更换后再提交');
    return false;
  }

  if (accessAccount) {
    const accountResponse = await fetchChannels({ pageNum: 1, pageSize: 100, keyword: accessAccount });
    const accountMatched = extractPagedData(accountResponse).records.some(
      item => pickValue(item, ['accessAccount'], '').toLowerCase() === accessAccount.toLowerCase()
    );

    if (accountMatched) {
      window.$message?.error('渠道门户登录账号已存在，请更换后再提交');
      return false;
    }
  }

  return true;
}

async function submitCreate() {
  await formRef.value?.validate();
  const isUnique = await validateUniqueChannelIdentity();

  if (!isUnique) {
    return;
  }

  submitting.value = true;

  try {
    const result = await createChannel(
      normalizeQuery({
        ...formModel,
        channelCode: formModel.channelCode.trim(),
        channelName: formModel.channelName.trim(),
        channelType: formModel.channelType.trim(),
        contactName: formModel.contactName?.trim(),
        contactPhone: formModel.contactPhone?.trim(),
        contactEmail: formModel.contactEmail?.trim(),
        baseUrl: formModel.baseUrl?.trim(),
        protocolType: formModel.protocolType?.trim(),
        accessAccount: formModel.accessAccount?.trim(),
        accessPassword: formModel.accessPassword?.trim(),
        cooperationStatus: formModel.cooperationStatus?.trim(),
        settlementMode: formModel.settlementMode?.trim(),
        status: formModel.status?.trim(),
        remark: formModel.remark?.trim(),
        supportsConsumptionLog: toBoolean(formModel.supportsConsumptionLog)
      }) as Api.Admin.CreateChannelPayload
    );
    const createdChannel = buildCreatedChannelRecord(result);

    window.$message?.success('渠道创建成功');
    prependCreatedChannel(createdChannel);
    createVisible.value = false;
    queryModel.keyword = '';
    queryModel.status = '';
    queryModel.cooperationStatus = '';
    queryModel.protocolType = '';
    queryModel.channelType = '';
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
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:5" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索渠道编码、名称、联系人、门户账号" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.status" :options="statusOptions" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.cooperationStatus" :options="cooperationOptions" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.protocolType" clearable placeholder="协议类型" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.channelType" clearable placeholder="渠道类型" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增渠道</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="渠道列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
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

    <NModal v-model:show="createVisible" preset="card" title="新增渠道" class="w-820px">
      <NAlert type="info" :show-icon="false" class="mb-16px">
        渠道创建时请同时配置“渠道门户登录账号/密码”，渠道后续将使用这组账号密码登录门户查看充值、消费和订单情况。
      </NAlert>

      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="120">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="渠道编码" path="channelCode">
              <NInput v-model:value="formModel.channelCode" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="渠道名称" path="channelName">
              <NInput v-model:value="formModel.channelName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="渠道类型" path="channelType">
              <NInput v-model:value="formModel.channelType" placeholder="例如 API / ENTERPRISE" />
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
            <NFormItem label="联系邮箱">
              <NInput v-model:value="formModel.contactEmail" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接口地址">
              <NInput v-model:value="formModel.baseUrl" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="协议类型">
              <NInput v-model:value="formModel.protocolType" placeholder="例如 REST" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="门户登录账号" path="accessAccount">
              <NInput v-model:value="formModel.accessAccount" placeholder="渠道门户登录账号" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="门户登录密码" path="accessPassword">
              <NInput
                v-model:value="formModel.accessPassword"
                type="password"
                show-password-on="click"
                placeholder="至少 6 位"
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="合作状态">
              <NInput v-model:value="formModel.cooperationStatus" placeholder="例如 ACTIVE / PAUSED" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="结算模式">
              <NInput v-model:value="formModel.settlementMode" placeholder="例如 PREPAID" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="消费日志能力">
              <NSwitch v-model:value="formModel.supportsConsumptionLog" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NInput v-model:value="formModel.status" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="备注">
          <NInput v-model:value="formModel.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="createVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitCreate">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="渠道原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
