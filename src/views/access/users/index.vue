<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { createAdminUser, fetchAdminUsers } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

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

const queryModel = reactive({
  keyword: '',
  status: ''
});

const formModel = reactive<Api.Admin.CreateUserPayload>({
  username: '',
  password: '',
  displayName: '',
  email: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'username',
    title: '用户名',
    render: row => pickValue(row, ['username', 'userName'])
  },
  {
    key: 'displayName',
    title: '显示名',
    render: row => pickValue(row, ['displayName', 'nickName', 'name'])
  },
  {
    key: 'email',
    title: '邮箱',
    render: row => pickValue(row, ['email'])
  },
  {
    key: 'status',
    title: '状态',
    render: row => pickValue(row, ['status', 'userStatus'])
  },
  {
    key: 'createdAt',
    title: '创建时间',
    render: row => pickValue(row, ['createdAt', 'createTime', 'gmtCreate'])
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
          onClick: () => openRaw(row)
        },
        { default: () => '查看原始' }
      )
  }
]);

const rules: Record<string, App.Global.FormRule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'input'] }]
};

function resetForm() {
  formModel.username = '';
  formModel.password = '';
  formModel.displayName = '';
  formModel.email = '';
}

function openCreate() {
  resetForm();
  createVisible.value = true;
}

function openRaw(row: Api.Admin.RawRecord) {
  rawRecord.value = row;
  rawVisible.value = true;
}

async function loadUsers() {
  loading.value = true;

  try {
    const { data } = await fetchAdminUsers(
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
  await loadUsers();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.status = '';
  pageNum.value = 1;
  await loadUsers();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadUsers();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadUsers();
}

async function submitCreate() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    await createAdminUser({
      username: formModel.username.trim(),
      password: formModel.password,
      displayName: formModel.displayName.trim(),
      email: formModel.email?.trim() || undefined
    });
    window.$message?.success('后台用户创建成功');
    createVisible.value = false;
    pageNum.value = 1;
    await loadUsers();
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadUsers();
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
            placeholder="搜索用户名、邮箱、显示名"
            class="lg:w-320px"
          />
          <NSelect v-model:value="queryModel.status" :options="statusOptions" class="min-w-160px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
          <NButton type="primary" @click="openCreate">新增后台用户</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="后台用户列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['userId', 'id', 'username'])"
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

    <NModal v-model:show="createVisible" preset="card" title="新增后台用户" class="w-520px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96">
        <NFormItem label="用户名" path="username">
          <NInput v-model:value="formModel.username" />
        </NFormItem>
        <NFormItem label="登录密码" path="password">
          <NInput v-model:value="formModel.password" type="password" show-password-on="click" />
        </NFormItem>
        <NFormItem label="显示名" path="displayName">
          <NInput v-model:value="formModel.displayName" />
        </NFormItem>
        <NFormItem label="邮箱" path="email">
          <NInput v-model:value="formModel.email" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="createVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitCreate">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="用户原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
