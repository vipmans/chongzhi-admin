<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createRiskRule, fetchRiskRules } from '@/service/api';
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
  status: ''
});

const formModel = reactive({
  ruleCode: '',
  ruleName: '',
  ruleType: 'AMOUNT_THRESHOLD',
  priority: 1,
  configText: '{\n  "thresholdAmount": 100,\n  "decision": "REVIEW"\n}'
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const ruleTypeOptions = [
  { label: 'AMOUNT_THRESHOLD', value: 'AMOUNT_THRESHOLD' },
  { label: 'BLACK_WHITE', value: 'BLACK_WHITE' },
  { label: 'CUSTOM', value: 'CUSTOM' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'ruleCode',
    title: '规则编码',
    render: row => pickValue(row, ['ruleCode', 'code'])
  },
  {
    key: 'ruleName',
    title: '规则名称',
    render: row => pickValue(row, ['ruleName', 'name'])
  },
  {
    key: 'ruleType',
    title: '规则类型',
    render: row => pickValue(row, ['ruleType', 'type'])
  },
  {
    key: 'priority',
    title: '优先级',
    render: row => pickValue(row, ['priority'])
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
  ruleCode: [{ required: true, message: '请输入规则编码', trigger: 'blur' }],
  ruleName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  configText: [{ required: true, message: '请输入配置 JSON', trigger: 'blur' }]
};

function openCreate() {
  formModel.ruleCode = '';
  formModel.ruleName = '';
  formModel.ruleType = 'AMOUNT_THRESHOLD';
  formModel.priority = 1;
  formModel.configText = '{\n  "thresholdAmount": 100,\n  "decision": "REVIEW"\n}';
  modalVisible.value = true;
}

function useRuleTemplate(value: string) {
  formModel.ruleType = value;

  if (value === 'AMOUNT_THRESHOLD') {
    formModel.configText = '{\n  "thresholdAmount": 100,\n  "decision": "REVIEW"\n}';
  } else if (value === 'BLACK_WHITE') {
    formModel.configText = '{\n  "matchField": "mobile",\n  "listType": "BLACK"\n}';
  } else {
    formModel.configText = '{\n  "key": "value"\n}';
  }
}

async function loadRules() {
  loading.value = true;

  try {
    const { data } = await fetchRiskRules(
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

async function handleSearch() {
  pageNum.value = 1;
  await loadRules();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  pageNum.value = 1;
  await loadRules();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadRules();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadRules();
}

async function submitRule() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    await createRiskRule({
      ruleCode: formModel.ruleCode.trim(),
      ruleName: formModel.ruleName.trim(),
      ruleType: formModel.ruleType,
      priority: Number(formModel.priority),
      configJson: JSON.parse(formModel.configText)
    });
    window.$message?.success('风控规则创建成功');
    modalVisible.value = false;
    pageNum.value = 1;
    await loadRules();
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : '配置 JSON 格式错误');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadRules();
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
            placeholder="搜索规则编码、名称、类型"
            class="lg:w-320px"
          />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增规则</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="风控规则列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['ruleId', 'id', 'ruleCode'])"
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

    <NModal v-model:show="modalVisible" preset="card" title="新增风控规则" class="w-720px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96">
        <NFormItem label="规则编码" path="ruleCode">
          <NInput v-model:value="formModel.ruleCode" />
        </NFormItem>
        <NFormItem label="规则名称" path="ruleName">
          <NInput v-model:value="formModel.ruleName" />
        </NFormItem>
        <NFormItem label="规则类型">
          <NSelect v-model:value="formModel.ruleType" :options="ruleTypeOptions" @update:value="useRuleTemplate" />
        </NFormItem>
        <NFormItem label="优先级">
          <NInputNumber v-model:value="formModel.priority" :min="1" class="w-full" />
        </NFormItem>
        <NFormItem label="配置 JSON" path="configText">
          <NInput v-model:value="formModel.configText" type="textarea" :autosize="{ minRows: 8, maxRows: 16 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitRule">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="规则原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
