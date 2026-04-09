<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createRiskBlackWhiteList, fetchRiskBlackWhiteLists } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const loading = ref(false);
const submitting = ref(false);
const modalVisible = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const formRef = ref<FormInst | null>(null);

const queryModel = reactive({
  keyword: '',
  status: '',
  listType: ''
});

const formModel = reactive<Api.Admin.SaveBlackWhiteListPayload>({
  entryType: '',
  targetValue: '',
  listType: 'BLACK',
  remark: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const listTypeOptions = [
  { label: '全部名单', value: '' },
  { label: 'BLACK', value: 'BLACK' },
  { label: 'WHITE', value: 'WHITE' }
];

const createListTypeOptions = listTypeOptions.filter(item => item.value);

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'entryType',
    title: '条目类型',
    render: row => pickValue(row, ['entryType'])
  },
  {
    key: 'targetValue',
    title: '目标值',
    render: row => pickValue(row, ['targetValue'])
  },
  {
    key: 'listType',
    title: '名单类型',
    render: row => pickValue(row, ['listType'])
  },
  {
    key: 'remark',
    title: '备注',
    render: row => pickValue(row, ['remark'])
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
            rawRecord.value = row;
            rawVisible.value = true;
          }
        },
        { default: () => '查看原始' }
      )
  }
]);

const rules: Record<string, App.Global.FormRule[]> = {
  entryType: [{ required: true, message: '请输入条目类型', trigger: 'blur' }],
  targetValue: [{ required: true, message: '请输入目标值', trigger: 'blur' }]
};

function openCreate() {
  formModel.entryType = '';
  formModel.targetValue = '';
  formModel.listType = 'BLACK';
  formModel.remark = '';
  modalVisible.value = true;
}

async function loadRows() {
  loading.value = true;

  try {
    const { data } = await fetchRiskBlackWhiteLists(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        keyword: queryModel.keyword,
        status: queryModel.status || undefined
      })
    );

    const pageData = extractPagedData(data);
    rows.value = queryModel.listType
      ? pageData.records.filter(item => pickValue(item, ['listType'], '') === queryModel.listType)
      : pageData.records;
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
  queryModel.listType = '';
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

async function submitRow() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    await createRiskBlackWhiteList({
      entryType: formModel.entryType.trim(),
      targetValue: formModel.targetValue.trim(),
      listType: formModel.listType,
      remark: formModel.remark?.trim() || undefined
    });
    window.$message?.success('黑白名单条目创建成功');
    modalVisible.value = false;
    pageNum.value = 1;
    await loadRows();
  } finally {
    submitting.value = false;
  }
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
          <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索条目类型、目标值、备注" class="lg:w-320px" />
          <NSelect v-model:value="queryModel.listType" :options="listTypeOptions" class="min-w-160px" />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增条目</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="黑白名单列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['id', 'entryId', 'targetValue'])"
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

    <NModal v-model:show="modalVisible" preset="card" title="新增黑白名单条目" class="w-560px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96">
        <NFormItem label="条目类型" path="entryType">
          <NInput v-model:value="formModel.entryType" placeholder="例如 MOBILE / CHANNEL" />
        </NFormItem>
        <NFormItem label="目标值" path="targetValue">
          <NInput v-model:value="formModel.targetValue" />
        </NFormItem>
        <NFormItem label="名单类型">
          <NSelect v-model:value="formModel.listType" :options="createListTypeOptions" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="formModel.remark" type="textarea" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitRow">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="条目原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
