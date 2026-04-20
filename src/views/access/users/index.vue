<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton, NSelect, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import { assignAdminUserRole, createAdminUser, fetchAdminRoles, fetchAdminUsers } from '@/service/api';
import { getSubsystemLabelsByRoleCodes } from '@/constants/auth';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

type AdminUserCreateFormModel = {
  username: string;
  password: string;
  roleCode: string;
  displayName?: string;
  mobile?: string;
  mobile2?: string;
  email?: string;
  wechat?: string;
  qq?: string;
  remark?: string;
};

const loading = ref(false);
const rolesLoading = ref(false);
const submitting = ref(false);
const assigningUserId = ref('');
const createVisible = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const formRef = ref<FormInst | null>(null);

const rows = ref<Api.Admin.RawRecord[]>([]);
const roleRows = ref<Api.Admin.RawRecord[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const roleDraftMap = ref<Record<string, string>>({});

const queryModel = reactive({
  keyword: '',
  status: ''
});

const formModel = reactive<AdminUserCreateFormModel>({
  username: '',
  password: '',
  roleCode: '',
  displayName: '',
  email: '',
  mobile: '',
  mobile2: '',
  wechat: '',
  qq: '',
  remark: ''
});

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const roleOptions = computed<SelectOption[]>(
  () =>
    roleRows.value
      .map(role => {
        const roleCode = pickValue(role, ['roleCode'], '');

        if (!roleCode) {
          return null;
        }

        return {
          label: `${pickValue(role, ['roleName'], roleCode)} (${roleCode})`,
          value: roleCode
        } satisfies SelectOption;
      })
      .filter(Boolean) as SelectOption[]
);

function getRoleCodes(row: Api.Admin.RawRecord) {
  if (Array.isArray(row.roleCodes)) {
    return row.roleCodes.filter(Boolean).map((roleCode: unknown) => String(roleCode));
  }

  if (row.roleCode) {
    return [String(row.roleCode)];
  }

  return [];
}

function getPrimaryRoleCode(row: Api.Admin.RawRecord) {
  return getRoleCodes(row)[0] || '';
}

function syncRoleDrafts() {
  const nextDraftMap: Record<string, string> = {};

  rows.value.forEach(row => {
    const userId = getEntityId(row, ['userId', 'id']);

    if (!userId) {
      return;
    }

    nextDraftMap[userId] = roleDraftMap.value[userId] || getPrimaryRoleCode(row);
  });

  roleDraftMap.value = nextDraftMap;
}

function updateRowRole(userId: string, roleCode: string) {
  rows.value = rows.value.map(row => {
    const currentUserId = getEntityId(row, ['userId', 'id']);

    if (currentUserId !== userId) {
      return row;
    }

    return {
      ...row,
      roleCodes: roleCode ? [roleCode] : [],
      roleCode
    };
  });

  roleDraftMap.value = {
    ...roleDraftMap.value,
    [userId]: roleCode
  };
}

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
    key: 'roleCodes',
    title: '当前角色',
    render: row => {
      const roleCodes = getRoleCodes(row);

      if (!roleCodes.length) {
        return h(NTag, { size: 'small' }, { default: () => '未分配角色' });
      }

      return h(NSpace, { size: 6, wrap: true }, () =>
        roleCodes.map(roleCode => h(NTag, { size: 'small', type: 'primary' }, { default: () => roleCode }))
      );
    }
  },
  {
    key: 'subsystems',
    title: '可进入子系统',
    render: row => {
      const subsystemLabels = getSubsystemLabelsByRoleCodes(getRoleCodes(row));

      return h(NSpace, { size: 6, wrap: true }, () =>
        subsystemLabels.map(label => h(NTag, { size: 'small', type: 'success' }, { default: () => label }))
      );
    }
  },
  {
    key: 'mobile',
    title: '手机号1',
    render: row => pickValue(row, ['mobile'])
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
    key: 'assignRole',
    title: '分配角色',
    width: 300,
    render: row => {
      const userId = getEntityId(row, ['userId', 'id']);
      const selectedRoleCode = roleDraftMap.value[userId] || '';

      return h(NSpace, { size: 8, wrap: false }, () => [
        h(NSelect, {
          value: selectedRoleCode || null,
          options: roleOptions.value,
          loading: rolesLoading.value,
          placeholder: '选择一个角色',
          clearable: true,
          filterable: true,
          style: { width: '180px' },
          'onUpdate:value': (value: string | null) => {
            roleDraftMap.value = {
              ...roleDraftMap.value,
              [userId]: value || ''
            };
          }
        }),
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            loading: assigningUserId.value === userId,
            disabled: !selectedRoleCode,
            onClick: () => handleAssignRole(row)
          },
          { default: () => '保存角色' }
        )
      ]);
    }
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
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, message: '用户名至少 3 位', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入登录密码', trigger: 'blur' },
    { min: 6, message: '登录密码至少 6 位', trigger: 'blur' }
  ],
  roleCode: [{ required: true, message: '请选择一个角色', trigger: 'change' }],
  email: [{ type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'input'] }]
};

function resetForm() {
  formModel.username = '';
  formModel.password = '';
  formModel.roleCode = '';
  formModel.displayName = '';
  formModel.email = '';
  formModel.mobile = '';
  formModel.mobile2 = '';
  formModel.wechat = '';
  formModel.qq = '';
  formModel.remark = '';
}

function openCreate() {
  resetForm();
  createVisible.value = true;
}

function openRaw(row: Api.Admin.RawRecord) {
  rawRecord.value = row;
  rawVisible.value = true;
}

function buildCreatedUserRecord(userId: string) {
  const now = new Date().toISOString();
  const username = formModel.username.trim();
  const displayName = formModel.displayName?.trim() || username;

  return {
    id: userId,
    userId,
    username,
    displayName,
    roleCodes: formModel.roleCode ? [formModel.roleCode] : [],
    roleCode: formModel.roleCode || null,
    email: formModel.email?.trim() || null,
    mobile: formModel.mobile?.trim() || null,
    mobile2: formModel.mobile2?.trim() || null,
    wechat: formModel.wechat?.trim() || null,
    qq: formModel.qq?.trim() || null,
    remark: formModel.remark?.trim() || null,
    status: 'ACTIVE',
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now
  } satisfies Api.Admin.RawRecord;
}

function prependCreatedUser(row: Api.Admin.RawRecord) {
  const nextUserId = getEntityId(row, ['userId', 'id']);
  const nextUsername = pickValue(row, ['username'], '').toLowerCase();
  const hadExisting = rows.value.some(item => {
    const currentUserId = getEntityId(item, ['userId', 'id']);
    const currentUsername = pickValue(item, ['username'], '').toLowerCase();

    return currentUserId === nextUserId || currentUsername === nextUsername;
  });
  const filteredRows = rows.value.filter(item => {
    const currentUserId = getEntityId(item, ['userId', 'id']);
    const currentUsername = pickValue(item, ['username'], '').toLowerCase();

    return currentUserId !== nextUserId && currentUsername !== nextUsername;
  });

  rows.value = [row, ...filteredRows].slice(0, pageSize.value);
  total.value = hadExisting ? total.value : total.value + 1;
  pageNum.value = 1;
  syncRoleDrafts();
}

async function loadUsers() {
  loading.value = true;

  try {
    const pageData = extractPagedData(
      await fetchAdminUsers(
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
    syncRoleDrafts();
  } finally {
    loading.value = false;
  }
}

async function loadRoles() {
  rolesLoading.value = true;

  try {
    const pageData = extractPagedData(
      await fetchAdminRoles({
        pageNum: 1,
        pageSize: 100,
        status: 'ACTIVE',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
    );

    roleRows.value = pageData.records;
  } finally {
    rolesLoading.value = false;
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

async function handleAssignRole(row: Api.Admin.RawRecord) {
  const userId = getEntityId(row, ['userId', 'id']);
  const selectedRoleCode = roleDraftMap.value[userId];

  if (!userId || !selectedRoleCode) {
    window.$message?.warning('请先选择一个角色');
    return;
  }

  assigningUserId.value = userId;

  try {
    await assignAdminUserRole(userId, {
      roleCode: selectedRoleCode
    });

    updateRowRole(userId, selectedRoleCode);
    window.$message?.success('角色分配成功');
  } finally {
    assigningUserId.value = '';
  }
}

async function submitCreate() {
  await formRef.value?.validate();
  submitting.value = true;

  try {
    const displayName = formModel.displayName?.trim() || formModel.username.trim();
    const createResult = await createAdminUser({
      username: formModel.username.trim(),
      password: formModel.password,
      displayName,
      email: formModel.email?.trim() || undefined,
      mobile: formModel.mobile?.trim() || undefined,
      mobile2: formModel.mobile2?.trim() || undefined,
      wechat: formModel.wechat?.trim() || undefined,
      qq: formModel.qq?.trim() || undefined,
      remark: formModel.remark?.trim() || undefined
    });

    const userId = getEntityId(createResult, ['resourceId']);
    let roleBindFailed = false;

    if (userId && formModel.roleCode) {
      try {
        await assignAdminUserRole(userId, {
          roleCode: formModel.roleCode
        });
      } catch {
        roleBindFailed = true;
      }
    }

    if (userId) {
      prependCreatedUser(buildCreatedUserRecord(userId));
    } else {
      await loadUsers();
    }

    if (roleBindFailed) {
      window.$message?.warning('用户已创建，但角色分配失败，请在列表中重新分配角色');
    } else {
      window.$message?.success('后台用户创建成功');
    }

    createVisible.value = false;
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoles()]);
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
            placeholder="搜索用户名、邮箱、显示名、手机号"
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
      <NAlert type="info" :show-icon="false" class="mb-16px">
        用户只能分配一个角色。分配角色后，用户只能进入该角色对应的子系统。
      </NAlert>

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

    <NModal v-model:show="createVisible" preset="card" title="新增后台用户" class="w-920px">
      <NAlert type="info" :show-icon="false" class="mb-16px">
        用户名、登录密码、选择角色为必填项。其他信息都为选填项。显示名未填写时，系统会自动使用用户名。
      </NAlert>

      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="108">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="用户名" path="username">
              <NInput v-model:value="formModel.username" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="登录密码" path="password">
              <NInput v-model:value="formModel.password" type="password" show-password-on="click" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="选择角色" path="roleCode">
              <NSelect
                v-model:value="formModel.roleCode"
                :options="roleOptions"
                :loading="rolesLoading"
                filterable
                clearable
                placeholder="请选择一个角色"
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="显示名">
              <NInput v-model:value="formModel.displayName" placeholder="不填写时默认使用用户名" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="手机号1">
              <NInput v-model:value="formModel.mobile" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="手机号2">
              <NInput v-model:value="formModel.mobile2" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="邮箱" path="email">
              <NInput v-model:value="formModel.email" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="微信">
              <NInput v-model:value="formModel.wechat" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="QQ号">
              <NInput v-model:value="formModel.qq" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="备注信息">
              <NInput v-model:value="formModel.remark" />
            </NFormItem>
          </NGi>
        </NGrid>
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
