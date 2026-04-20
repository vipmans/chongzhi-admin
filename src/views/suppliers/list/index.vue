<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createSupplier, fetchSuppliers } from '@/service/api';
import {
  extractListData,
  extractPagedData,
  formatBooleanLabel,
  getEntityId,
  getKeywordFilter,
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
const pageSize = ref(20);

const queryModel = reactive<Api.Admin.SupplierListQuery>({
  keyword: '',
  cooperationStatus: '',
  healthStatus: '',
  protocolType: ''
});

const formModel = reactive<Api.Admin.SaveSupplierPayload>({
  supplierCode: '',
  supplierName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  baseUrl: '',
  protocolType: '',
  credentialMode: '',
  accessAccount: '',
  accessPassword: '',
  cooperationStatus: '',
  supportsBalanceQuery: true,
  supportsRechargeRecords: false,
  supportsConsumptionLog: false,
  remark: '',
  healthStatus: '',
  status: 'ACTIVE'
});

const healthOptions = [
  { label: '全部健康状态', value: '' },
  { label: 'HEALTHY', value: 'HEALTHY' },
  { label: 'DEGRADED', value: 'DEGRADED' },
  { label: 'UNAVAILABLE', value: 'UNAVAILABLE' }
];

const cooperationOptions = [
  { label: '全部合作状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'PAUSED', value: 'PAUSED' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'supplierCode',
    title: '供应商编码',
    render: row => pickValue(row, ['supplierCode', 'code'])
  },
  {
    key: 'supplierName',
    title: '供应商名称',
    render: row => pickValue(row, ['supplierName', 'name'])
  },
  {
    key: 'contactName',
    title: '联系人',
    render: row => pickValue(row, ['contactName', 'contact', 'contactPerson'])
  },
  {
    key: 'protocolType',
    title: '协议',
    render: row => pickValue(row, ['protocolType', 'protocol'])
  },
  {
    key: 'cooperationStatus',
    title: '合作状态',
    render: row => pickValue(row, ['cooperationStatus', 'status'])
  },
  {
    key: 'healthStatus',
    title: '健康状态',
    render: row => pickValue(row, ['healthStatus'])
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
      const supplierId = getEntityId(row, ['supplierId', 'id', 'supplierCode']);

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => router.push(`/suppliers/detail/${supplierId}`)
          },
          { default: () => '详情' }
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
  supplierName: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  protocolType: [{ required: true, message: '请输入协议类型', trigger: 'blur' }]
};

function resetForm() {
  formModel.supplierCode = '';
  formModel.supplierName = '';
  formModel.contactName = '';
  formModel.contactPhone = '';
  formModel.contactEmail = '';
  formModel.baseUrl = '';
  formModel.protocolType = '';
  formModel.credentialMode = '';
  formModel.accessAccount = '';
  formModel.accessPassword = '';
  formModel.cooperationStatus = '';
  formModel.supportsBalanceQuery = true;
  formModel.supportsRechargeRecords = false;
  formModel.supportsConsumptionLog = false;
  formModel.remark = '';
  formModel.healthStatus = '';
  formModel.status = 'ACTIVE';
}

function openCreate() {
  resetForm();
  createVisible.value = true;
}

function applyLocalList(list: Api.Admin.RawRecord[]) {
  let filtered = list;

  if (queryModel.keyword?.trim()) {
    filtered = getKeywordFilter(filtered, queryModel.keyword);
  }

  if (queryModel.cooperationStatus) {
    filtered = filtered.filter(row => pickValue(row, ['cooperationStatus'], '') === queryModel.cooperationStatus);
  }

  if (queryModel.healthStatus) {
    filtered = filtered.filter(row => pickValue(row, ['healthStatus'], '') === queryModel.healthStatus);
  }

  if (queryModel.protocolType) {
    filtered = filtered.filter(row =>
      pickValue(row, ['protocolType'], '').toLowerCase().includes(queryModel.protocolType!.toLowerCase())
    );
  }

  total.value = filtered.length;

  const start = (pageNum.value - 1) * pageSize.value;
  rows.value = filtered.slice(start, start + pageSize.value);
}

async function loadSuppliers() {
  loading.value = true;

  try {
    const { data } = await fetchSuppliers(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        ...queryModel
      })
    );

    if (Array.isArray(data)) {
      applyLocalList(extractListData(data));
      return;
    }

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
  await loadSuppliers();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.cooperationStatus = '';
  queryModel.healthStatus = '';
  queryModel.protocolType = '';
  pageNum.value = 1;
  await loadSuppliers();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadSuppliers();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadSuppliers();
}

async function submitCreate() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    await createSupplier(
      normalizeQuery({
        ...formModel,
        supplierCode: formModel.supplierCode?.trim(),
        supplierName: formModel.supplierName.trim(),
        contactName: formModel.contactName?.trim(),
        contactPhone: formModel.contactPhone?.trim(),
        contactEmail: formModel.contactEmail?.trim(),
        baseUrl: formModel.baseUrl?.trim(),
        protocolType: formModel.protocolType.trim(),
        credentialMode: formModel.credentialMode?.trim(),
        accessAccount: formModel.accessAccount?.trim(),
        accessPassword: formModel.accessPassword?.trim(),
        cooperationStatus: formModel.cooperationStatus?.trim(),
        remark: formModel.remark?.trim(),
        healthStatus: formModel.healthStatus?.trim(),
        status: formModel.status?.trim(),
        supportsBalanceQuery: toBoolean(formModel.supportsBalanceQuery),
        supportsRechargeRecords: toBoolean(formModel.supportsRechargeRecords),
        supportsConsumptionLog: toBoolean(formModel.supportsConsumptionLog)
      }) as Api.Admin.SaveSupplierPayload
    );

    window.$message?.success('供应商创建成功');
    createVisible.value = false;
    pageNum.value = 1;
    await loadSuppliers();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadSuppliers();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索名称、编码、联系人" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.cooperationStatus" :options="cooperationOptions" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.healthStatus" :options="healthOptions" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.protocolType" clearable placeholder="协议类型" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增供应商</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="供应商列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['supplierId', 'id', 'supplierCode'])"
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

    <NModal v-model:show="createVisible" preset="card" title="新增供应商" class="w-760px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="110">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="供应商编码">
              <NInput v-model:value="formModel.supplierCode" placeholder="可选，不填则由后端生成" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="供应商名称" path="supplierName">
              <NInput v-model:value="formModel.supplierName" />
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
            <NFormItem label="协议类型" path="protocolType">
              <NInput v-model:value="formModel.protocolType" placeholder="例如 HTTP / HTTPS / PRIVATE" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="认证模式">
              <NInput v-model:value="formModel.credentialMode" placeholder="例如 BASIC / TOKEN" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接入账号">
              <NInput v-model:value="formModel.accessAccount" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接入密码">
              <NInput v-model:value="formModel.accessPassword" type="password" show-password-on="click" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="合作状态">
              <NInput v-model:value="formModel.cooperationStatus" placeholder="例如 ACTIVE / PAUSED" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="健康状态">
              <NInput v-model:value="formModel.healthStatus" placeholder="例如 HEALTHY" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="支持余额查询">
              <NSwitch v-model:value="formModel.supportsBalanceQuery" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="支持充值记录">
              <NSwitch v-model:value="formModel.supportsRechargeRecords" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="支持消费日志">
              <NSwitch v-model:value="formModel.supportsConsumptionLog" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NInput v-model:value="formModel.status" placeholder="例如 ACTIVE" />
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

    <NModal v-model:show="rawVisible" preset="card" title="供应商原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
