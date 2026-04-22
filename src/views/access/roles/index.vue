<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton, NDescriptions, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createAdminRole, fetchAdminRoleDetail, fetchAdminRoles } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const loading = ref(false);
const submitting = ref(false);
const detailLoading = ref(false);
const createVisible = ref(false);
const detailVisible = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const detailRecord = ref<Api.Admin.RawRecord>({});
const formRef = ref<FormInst | null>(null);
const rows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);

const queryModel = reactive({
  keyword: '',
  status: ''
});

const formModel = reactive<Api.Admin.CreateRolePayload>({
  roleCode: '',
  roleName: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'roleCode',
    title: '角色编码',
    render: row => pickValue(row, ['roleCode', 'code'])
  },
  {
    key: 'roleName',
    title: '角色名称',
    render: row => pickValue(row, ['roleName', 'name'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      const type = status === 'ACTIVE' ? 'success' : status === 'INACTIVE' ? 'warning' : 'default';

      return h(NTag, { size: 'small', type }, { default: () => status });
    }
  },
  {
    key: 'createdAt',
    title: '创建时间',
    render: row => pickValue(row, ['createdAt', 'createTime'])
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    render: row => pickValue(row, ['updatedAt', 'updateTime'])
  },
  {
    key: 'actions',
    title: '操作',
    width: 220,
    render: row =>
      h('div', { class: 'flex items-center gap-8px' }, [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            secondary: true,
            onClick: () => openDetail(row)
          },
          { default: () => '详情配置' }
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            onClick: () => openRaw(row)
          },
          { default: () => '原始数据' }
        )
      ])
  }
]);

const rules: Record<string, App.Global.FormRule[]> = {
  roleCode: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { min: 2, message: '角色编码至少 2 位', trigger: 'blur' }
  ],
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }]
};

function resetForm() {
  formModel.roleCode = '';
  formModel.roleName = '';
}

function openCreate() {
  resetForm();
  createVisible.value = true;
}

function openRaw(row: Api.Admin.RawRecord) {
  rawRecord.value = row;
  rawVisible.value = true;
}

async function openDetail(row: Api.Admin.RawRecord) {
  const roleId = getEntityId(row, ['roleId', 'id']);

  if (!roleId) {
    detailRecord.value = row;
    detailVisible.value = true;
    return;
  }

  detailLoading.value = true;
  detailVisible.value = true;

  try {
    detailRecord.value = await fetchAdminRoleDetail(roleId);
  } finally {
    detailLoading.value = false;
  }
}

async function loadRoles() {
  loading.value = true;

  try {
    const pageData = extractPagedData(
      await fetchAdminRoles(
        normalizeQuery({
          pageNum: pageNum.value,
          pageSize: pageSize.value,
          sortBy: 'createdAt',
          sortOrder: 'desc',
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
  await loadRoles();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  pageNum.value = 1;
  await loadRoles();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadRoles();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadRoles();
}

async function submitCreate() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    await createAdminRole({
      roleCode: formModel.roleCode.trim(),
      roleName: formModel.roleName.trim()
    });

    window.$message?.success('角色创建成功');
    createVisible.value = false;
    pageNum.value = 1;
    await loadRoles();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadRoles();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      已恢复角色列表与角色创建、角色详情配置能力。根据当前 `api.json`，角色模块已落地接口为列表查询、创建、详情查询；
      若后续后端补充角色修改或删除接口，再继续接入对应按钮和表单。
    </NAlert>

    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NSpace wrap>
          <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索角色编码或名称" class="lg:w-320px" />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增角色</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="角色列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['roleId', 'id', 'roleCode'])"
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

    <NModal v-model:show="createVisible" preset="card" title="新增角色" class="w-480px">
      <NAlert type="info" :show-icon="false" class="mb-16px">
        当前支持新建角色编码与角色名称，创建后可在后台用户页继续为用户分配角色。
      </NAlert>

      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96">
        <NFormItem label="角色编码" path="roleCode">
          <NInput v-model:value="formModel.roleCode" />
        </NFormItem>
        <NFormItem label="角色名称" path="roleName">
          <NInput v-model:value="formModel.roleName" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="createVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitCreate">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="角色详情配置" class="w-760px">
      <NSpin :show="detailLoading">
        <NDescriptions label-placement="left" bordered :column="2" class="mb-16px">
          <NDescriptionsItem label="角色ID">
            {{ pickValue(detailRecord, ['id', 'roleId'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="角色编码">
            {{ pickValue(detailRecord, ['roleCode'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="角色名称">
            {{ pickValue(detailRecord, ['roleName'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="状态">
            {{ pickValue(detailRecord, ['status'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="创建时间">
            {{ pickValue(detailRecord, ['createdAt', 'createTime'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="更新时间">
            {{ pickValue(detailRecord, ['updatedAt', 'updateTime'], '-') }}
          </NDescriptionsItem>
        </NDescriptions>

        <NAlert type="warning" :show-icon="false" class="mb-16px">
          当前后端仅提供角色详情查询接口，暂未提供角色修改、删除、权限树保存等接口，因此本页先恢复为只读配置视图。
        </NAlert>

        <NCode :code="toPrettyJson(detailRecord)" language="json" word-wrap />
      </NSpin>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="角色原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
