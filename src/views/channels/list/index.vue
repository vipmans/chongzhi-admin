<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createChannel, fetchChannels } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

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
const pageSize = ref(20);

const queryModel = reactive<Api.Admin.ChannelListQuery>({
  keyword: '',
  status: '',
  channelType: ''
});

const formModel = reactive<Api.Admin.CreateChannelPayload>({
  channelCode: '',
  channelName: '',
  channelType: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
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
    key: 'settlementMode',
    title: '结算模式',
    render: row => pickValue(row, ['settlementMode'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => pickValue(row, ['status'])
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
            ghost: true,
            onClick: () => router.push({ path: '/channels/recharge', query: { channelId } })
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
  channelType: [{ required: true, message: '请输入渠道类型', trigger: 'blur' }]
};

function resetForm() {
  formModel.channelCode = '';
  formModel.channelName = '';
  formModel.channelType = '';
}

function prependCreatedChannel(result: Api.Admin.RawRecord) {
  const resourceId = getEntityId(result, ['resourceId']) || `local-${Date.now()}`;
  const row = {
    id: resourceId,
    channelId: resourceId,
    channelCode: formModel.channelCode.trim(),
    channelName: formModel.channelName.trim(),
    channelType: formModel.channelType.trim(),
    status: 'ACTIVE',
    settlementMode: '-',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } satisfies Api.Admin.RawRecord;

  rows.value = [row, ...rows.value].slice(0, pageSize.value);
  total.value += 1;
  pageNum.value = 1;
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

async function submitCreate() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    const result = await createChannel({
      channelCode: formModel.channelCode.trim(),
      channelName: formModel.channelName.trim(),
      channelType: formModel.channelType.trim()
    });

    window.$message?.success('渠道创建成功');
    prependCreatedChannel(result);
    createVisible.value = false;
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
      新版 API 仅支持创建渠道主体基础档案。渠道凭证、回调、商品授权、供货价、限额与充值能力请进入详情页继续配置。
    </NAlert>

    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索渠道编码、名称" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.status" :options="statusOptions" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.channelType" clearable placeholder="渠道类型" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton
            type="primary"
            @click="
              resetForm();
              createVisible = true;
            "
          >
            新增渠道
          </NButton>
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

    <NModal v-model:show="createVisible" preset="card" title="新增渠道" class="w-560px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96">
        <NFormItem label="渠道编码" path="channelCode">
          <NInput v-model:value="formModel.channelCode" />
        </NFormItem>
        <NFormItem label="渠道名称" path="channelName">
          <NInput v-model:value="formModel.channelName" />
        </NFormItem>
        <NFormItem label="渠道类型" path="channelType">
          <NInput v-model:value="formModel.channelType" placeholder="例如 API / ENTERPRISE" />
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
