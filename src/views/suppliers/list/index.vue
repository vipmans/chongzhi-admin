<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createSupplier, fetchSuppliers, updateSupplier } from '@/service/api';
import { extractListData, extractPagedData, getEntityId, normalizeQuery, toBoolean, toPrettyJson } from '@/utils/admin';

const router = useRouter();

type SupplierFormMode = 'create' | 'edit';

const loading = ref(false);
const submitting = ref(false);
const formVisible = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const formRef = ref<FormInst | null>(null);
const formMode = ref<SupplierFormMode>('create');
const editingSupplierId = ref('');

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
  cooperationStatus: 'ACTIVE',
  supportsBalanceQuery: true,
  supportsRechargeRecords: false,
  supportsConsumptionLog: false,
  remark: ''
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

const formCooperationOptions = cooperationOptions.filter(option => option.value);

function asOptionalString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = String(value).trim();
  return text || undefined;
}

function buildSupplierPayload(source: Api.Admin.RawRecord | Api.Admin.SaveSupplierPayload): Api.Admin.SaveSupplierPayload {
  return normalizeQuery({
    supplierCode: asOptionalString(source.supplierCode),
    supplierName: asOptionalString(source.supplierName),
    contactName: asOptionalString(source.contactName),
    contactPhone: asOptionalString(source.contactPhone),
    contactEmail: asOptionalString(source.contactEmail),
    baseUrl: asOptionalString(source.baseUrl),
    protocolType: asOptionalString(source.protocolType),
    credentialMode: asOptionalString(source.credentialMode),
    accessAccount: asOptionalString(source.accessAccount),
    accessPassword: asOptionalString(source.accessPassword),
    cooperationStatus: asOptionalString(source.cooperationStatus),
    supportsBalanceQuery: toBoolean(source.supportsBalanceQuery),
    supportsRechargeRecords: toBoolean(source.supportsRechargeRecords),
    supportsConsumptionLog: toBoolean(source.supportsConsumptionLog),
    remark: asOptionalString(source.remark)
  }) as Api.Admin.SaveSupplierPayload;
}

function getStatusType(status: string) {
  if (['HEALTHY', 'ACTIVE', 'ENABLED'].includes(status)) {
    return 'success';
  }

  if (['DEGRADED', 'PAUSED', 'PENDING'].includes(status)) {
    return 'warning';
  }

  if (['UNAVAILABLE', 'INACTIVE', 'DISABLED'].includes(status)) {
    return 'error';
  }

  return 'default';
}

function formatCapabilityRow(row: Api.Admin.RawRecord) {
  const capabilities: string[] = [];

  if (toBoolean(row.supportsBalanceQuery)) {
    capabilities.push('余额查询');
  }

  if (toBoolean(row.supportsRechargeRecords)) {
    capabilities.push('充值记录');
  }

  if (toBoolean(row.supportsConsumptionLog)) {
    capabilities.push('消费日志');
  }

  return capabilities.length ? capabilities.join('、') : '未开启';
}

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'supplierCode',
    title: '供应商编码',
    width: 150,
    render: row => String(row.supplierCode ?? '-')
  },
  {
    key: 'supplierName',
    title: '供应商名称',
    width: 180,
    render: row => String(row.supplierName ?? row.name ?? '-')
  },
  {
    key: 'contact',
    title: '联系人',
    width: 180,
    render: row =>
      h('div', { class: 'flex flex-col gap-4px' }, [
        h('span', { class: 'text-13px text-#0f172a' }, String(row.contactName ?? '-')),
        h('span', { class: 'text-12px text-#64748b' }, String(row.contactPhone ?? '-'))
      ])
  },
  {
    key: 'protocolType',
    title: '协议类型',
    width: 140,
    render: row => String(row.protocolType ?? '-')
  },
  {
    key: 'credentialMode',
    title: '鉴权方式',
    width: 120,
    render: row => String(row.credentialMode ?? '-')
  },
  {
    key: 'cooperationStatus',
    title: '合作状态',
    width: 120,
    render: row => {
      const status = String(row.cooperationStatus ?? '-');
      return h(NTag, { size: 'small', type: getStatusType(status) }, { default: () => status });
    }
  },
  {
    key: 'healthStatus',
    title: '健康状态',
    width: 120,
    render: row => {
      const status = String(row.healthStatus ?? '-');
      return h(NTag, { size: 'small', type: getStatusType(status) }, { default: () => status });
    }
  },
  {
    key: 'capabilities',
    title: '能力开关',
    width: 220,
    render: row => formatCapabilityRow(row)
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 180,
    render: row => String(row.updatedAt ?? row.createdAt ?? '-')
  },
  {
    key: 'actions',
    title: '操作',
    width: 360,
    render: row => {
      const supplierId = getEntityId(row, ['supplierId', 'id', 'supplierCode']);
      const currentStatus = String(row.cooperationStatus ?? 'ACTIVE');
      const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const actionLabel = currentStatus === 'ACTIVE' ? '暂停合作' : '恢复合作';

      return h(NSpace, { size: 8, wrap: false }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            secondary: true,
            onClick: () => router.push(`/suppliers/detail/${supplierId}`)
          },
          { default: () => '详情运营' }
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
            onClick: () => handleToggleCooperation(row, nextStatus)
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
  supplierName: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  protocolType: [{ required: true, message: '请输入协议类型', trigger: 'blur' }],
  contactEmail: [{ type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'input'] }]
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
  formModel.cooperationStatus = 'ACTIVE';
  formModel.supportsBalanceQuery = true;
  formModel.supportsRechargeRecords = false;
  formModel.supportsConsumptionLog = false;
  formModel.remark = '';
}

function fillForm(row: Api.Admin.RawRecord) {
  formModel.supplierCode = String(row.supplierCode ?? '');
  formModel.supplierName = String(row.supplierName ?? '');
  formModel.contactName = String(row.contactName ?? '');
  formModel.contactPhone = String(row.contactPhone ?? '');
  formModel.contactEmail = String(row.contactEmail ?? '');
  formModel.baseUrl = String(row.baseUrl ?? '');
  formModel.protocolType = String(row.protocolType ?? '');
  formModel.credentialMode = String(row.credentialMode ?? '');
  formModel.accessAccount = String(row.accessAccount ?? '');
  formModel.accessPassword = String(row.accessPassword ?? '');
  formModel.cooperationStatus = String(row.cooperationStatus ?? 'ACTIVE');
  formModel.supportsBalanceQuery = toBoolean(row.supportsBalanceQuery);
  formModel.supportsRechargeRecords = toBoolean(row.supportsRechargeRecords);
  formModel.supportsConsumptionLog = toBoolean(row.supportsConsumptionLog);
  formModel.remark = String(row.remark ?? '');
}

function openCreate() {
  resetForm();
  editingSupplierId.value = '';
  formMode.value = 'create';
  formVisible.value = true;
}

function openEdit(row: Api.Admin.RawRecord) {
  fillForm(row);
  editingSupplierId.value = getEntityId(row, ['supplierId', 'id', 'supplierCode']);
  formMode.value = 'edit';
  formVisible.value = true;
}

function applyLocalList(list: Api.Admin.RawRecord[]) {
  total.value = list.length;
  const start = (pageNum.value - 1) * pageSize.value;
  rows.value = list.slice(start, start + pageSize.value);
}

async function loadSuppliers() {
  loading.value = true;

  try {
    const data = await fetchSuppliers(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
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

async function handleToggleCooperation(row: Api.Admin.RawRecord, cooperationStatus: string) {
  const supplierId = getEntityId(row, ['supplierId', 'id', 'supplierCode']);

  if (!supplierId) {
    return;
  }

  submitting.value = true;

  try {
    await updateSupplier(supplierId, {
      ...buildSupplierPayload(row),
      cooperationStatus
    });

    window.$message?.success(`供应商合作状态已更新为 ${cooperationStatus}`);
    await loadSuppliers();
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
    const payload = buildSupplierPayload(formModel);

    if (formMode.value === 'create') {
      await createSupplier(payload);
      window.$message?.success('供应商创建成功');
    } else {
      await updateSupplier(editingSupplierId.value, payload);
      window.$message?.success('供应商更新成功');
    }

    formVisible.value = false;
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
    <NAlert type="info" :show-icon="false">
      供应商管理已按桌面版 `api.json` 补齐为可新增、可查询、可编辑、可停用合作的主体档案管理页，
      可录入供应商联系人、协议、接入账号、能力开关和合作状态等详细信息。
    </NAlert>

    <NAlert type="warning" :show-icon="false">
      当前 `api.json` 未提供供应商删除接口，因此本页严格使用“暂停合作/恢复合作”替代删除能力，不展示不可调用的假删除按钮。
    </NAlert>

    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:4" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索编码、名称、联系人" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.cooperationStatus" :options="cooperationOptions" placeholder="合作状态" />
          </NGi>
          <NGi>
            <NSelect v-model:value="queryModel.healthStatus" :options="healthOptions" placeholder="健康状态" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.protocolType" clearable placeholder="协议类型" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton type="primary" @click="handleSearch">查询</NButton>
          <NButton type="primary" secondary @click="openCreate">新增供应商</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="供应商列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :scroll-x="1750"
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

    <NModal
      v-model:show="formVisible"
      preset="card"
      :title="formMode === 'create' ? '新增供应商' : '编辑供应商'"
      class="w-920px"
    >
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="110">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="供应商编码">
              <NInput v-model:value="formModel.supplierCode" :disabled="formMode === 'edit'" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="供应商名称" path="supplierName">
              <NInput v-model:value="formModel.supplierName" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="协议类型" path="protocolType">
              <NInput v-model:value="formModel.protocolType" placeholder="例如 HTTP、直连、SDK" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="鉴权方式">
              <NInput v-model:value="formModel.credentialMode" placeholder="例如 TOKEN、BASIC、SIGN" />
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
            <NFormItem label="合作状态">
              <NSelect v-model:value="formModel.cooperationStatus" :options="formCooperationOptions" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="基础地址">
              <NInput v-model:value="formModel.baseUrl" placeholder="供应商接口网关或服务地址" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接入账号">
              <NInput v-model:value="formModel.accessAccount" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="接入密码">
              <NInput
                v-model:value="formModel.accessPassword"
                type="password"
                show-password-on="click"
                placeholder="最少 6 位"
              />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="余额查询">
              <NSwitch v-model:value="formModel.supportsBalanceQuery" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="充值记录">
              <NSwitch v-model:value="formModel.supportsRechargeRecords" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="消费日志">
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
        <div class="flex justify-end gap-12px">
          <NButton @click="formVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitForm">保存</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="供应商原始数据" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
