<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst } from 'naive-ui';
import { CUSTOMER_SERVICE_ROLE_CODES, SUPPORT_ROLE_CODES, hasAnyRole } from '@/constants/auth';
import { createAdminRole, fetchAdminRoleDetail, fetchAdminRoles } from '@/service/api';
import { extractPagedData, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

type RoleCreateFormModel = {
  roleCode: string;
  roleName: string;
  permissionCodesText: string;
  menuCodesText: string;
  dataScope: Api.Admin.DataScope;
};

type RoleTemplate = {
  key: 'support' | 'customerService';
  title: string;
  roleCode: string;
  roleName: string;
  platformLabel: string;
  positionLabel: string;
  description: string;
  dataScope: Api.Admin.DataScope;
  menuCodes: string[];
  permissionCodes: string[];
  aliasCodes: string[];
};

type RoleProfile = {
  platformLabel: string;
  positionLabel: string;
  description: string;
};

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

const formModel = reactive<RoleCreateFormModel>({
  roleCode: '',
  roleName: '',
  permissionCodesText: '',
  menuCodesText: '',
  dataScope: 'ALL'
});

const roleTemplates: RoleTemplate[] = [
  {
    key: 'customerService',
    title: '平台客服角色',
    roleCode: 'CUSTOMER_SERVICE',
    roleName: '平台客服',
    platformLabel: '平台客服',
    positionLabel: '客服/售后处理',
    description: '负责订单查询、通知跟进和售后投诉处理，不再复用技术支持角色。',
    dataScope: 'SELF_ASSIGNED',
    menuCodes: ['orders_list', 'complaints_list', 'notifications_tasks', 'notifications_dead-letters'],
    permissionCodes: [],
    aliasCodes: [...CUSTOMER_SERVICE_ROLE_CODES]
  },
  {
    key: 'support',
    title: '技术支持角色',
    roleCode: 'SUPPORT',
    roleName: '技术支持',
    platformLabel: '技术支持平台',
    positionLabel: '运维/排障支持',
    description: '负责系统运维、异步任务重试、日志排障和审计分析，不承担客服售后职责。',
    dataScope: 'ALL',
    menuCodes: ['ops_jobs', 'ops_mobile-segments', 'ops_audit-logs', 'ops_login-logs'],
    permissionCodes: [],
    aliasCodes: [...SUPPORT_ROLE_CODES]
  }
];

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'DISABLED', value: 'DISABLED' }
];

const dataScopeOptions = [
  { label: '全部数据', value: 'ALL' },
  { label: '仅本人创建', value: 'SELF_CREATED' },
  { label: '仅本人分配', value: 'SELF_ASSIGNED' }
];

function parseCodes(text: string) {
  return text
    .split(/[\n,，]+/g)
    .map(item => item.trim())
    .filter(Boolean);
}

function getRoleCode(row: Api.Admin.RawRecord) {
  return String(pickValue(row, ['roleCode', 'code'], '') || '').trim().toUpperCase();
}

function getRoleName(row: Api.Admin.RawRecord) {
  return String(pickValue(row, ['roleName', 'name'], '') || '').trim();
}

function getRoleProfile(row: Api.Admin.RawRecord): RoleProfile {
  const roleCode = getRoleCode(row);
  const roleName = getRoleName(row);

  if (hasAnyRole([roleCode], ['SUPER_ADMIN']) || /超级管理员/.test(roleName)) {
    return {
      platformLabel: '权限平台',
      positionLabel: '超级管理员',
      description: '统一管理后台账号、角色、菜单和全局权限。'
    };
  }

  if (hasAnyRole([roleCode], ['OPS']) || /运营/.test(roleName)) {
    return {
      platformLabel: '运营平台',
      positionLabel: '平台运营',
      description: '负责渠道、商品、供应商、订单和通知等核心运营流程。'
    };
  }

  if (hasAnyRole([roleCode], ['FINANCE']) || /财务/.test(roleName)) {
    return {
      platformLabel: '财务平台',
      positionLabel: '平台财务',
      description: '负责账户、账务流水、结算与资金类数据管理。'
    };
  }

  if (hasAnyRole([roleCode], ['RISK']) || /风控/.test(roleName)) {
    return {
      platformLabel: '风控平台',
      positionLabel: '风控专员',
      description: '负责风控规则、黑白名单和交易风险决策。'
    };
  }

  if (hasAnyRole([roleCode], [...SUPPORT_ROLE_CODES]) || /技术支持/.test(roleName)) {
    return {
      platformLabel: '技术支持平台',
      positionLabel: '技术支持',
      description: '负责系统运维、任务重试、日志排查和技术支持。'
    };
  }

  if (hasAnyRole([roleCode], [...CUSTOMER_SERVICE_ROLE_CODES]) || /客服|投诉|售后/.test(roleName)) {
    return {
      platformLabel: '平台客服',
      positionLabel: '客服/售后',
      description: '负责订单跟进、通知核查和投诉售后处理。'
    };
  }

  return {
    platformLabel: '待归类',
    positionLabel: '自定义角色',
    description: '按后端返回的权限码、菜单码和数据范围生效。'
  };
}

function fillTemplate(template: RoleTemplate) {
  formModel.roleCode = template.roleCode;
  formModel.roleName = template.roleName;
  formModel.permissionCodesText = template.permissionCodes.join('\n');
  formModel.menuCodesText = template.menuCodes.join('\n');
  formModel.dataScope = template.dataScope;
  createVisible.value = true;
}

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
    key: 'platformLabel',
    title: '平台归属',
    render: row => {
      const profile = getRoleProfile(row);
      return h(NTag, { size: 'small', type: 'info' }, { default: () => profile.platformLabel });
    }
  },
  {
    key: 'positionLabel',
    title: '角色定位',
    render: row => {
      const profile = getRoleProfile(row);
      return h('div', { class: 'flex flex-col gap-4px' }, [
        h('span', { class: 'text-13px font-600 text-#0f172a' }, profile.positionLabel),
        h('span', { class: 'text-12px text-#64748b' }, profile.description)
      ]);
    }
  },
  {
    key: 'status',
    title: '状态',
    render: row => {
      const status = pickValue(row, ['status'], '-');
      const type = status === 'ACTIVE' ? 'success' : status === 'DISABLED' ? 'warning' : 'default';

      return h(NTag, { size: 'small', type }, { default: () => status });
    }
  },
  {
    key: 'permissionCodes',
    title: '权限码数',
    render: row => String(Array.isArray(row.permissionCodes) ? row.permissionCodes.length : 0)
  },
  {
    key: 'menuCodes',
    title: '菜单码数',
    render: row => String(Array.isArray(row.menuCodes) ? row.menuCodes.length : 0)
  },
  {
    key: 'dataScope',
    title: '数据范围',
    render: row => pickValue(row, ['dataScope'])
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
  formModel.permissionCodesText = '';
  formModel.menuCodesText = '';
  formModel.dataScope = 'ALL';
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
      roleName: formModel.roleName.trim(),
      permissionCodes: parseCodes(formModel.permissionCodesText),
      menuCodes: parseCodes(formModel.menuCodesText),
      dataScope: formModel.dataScope
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
      根据桌面版 `api.json` 与需求文档，`SUPPORT` 在统一管理平台中代表“技术支持”，不再表示客服角色。
      平台客服需要作为独立后台角色创建，建议使用 `CUSTOMER_SERVICE` 作为标准角色编码。
    </NAlert>

    <NCard title="内置角色模板" :bordered="false" class="card-wrapper">
      <div class="grid gap-16px xl:grid-cols-2">
        <NCard
          v-for="template in roleTemplates"
          :key="template.key"
          size="small"
          embedded
          class="border border-solid border-#e2e8f0"
        >
          <div class="flex flex-col gap-12px">
            <div class="flex items-start justify-between gap-12px">
              <div>
                <div class="text-16px font-600 text-#0f172a">{{ template.title }}</div>
                <div class="mt-4px text-13px text-#64748b">{{ template.description }}</div>
              </div>
              <NButton type="primary" secondary @click="fillTemplate(template)">使用模板</NButton>
            </div>

            <div class="flex flex-wrap gap-8px">
              <NTag size="small" type="info">{{ template.platformLabel }}</NTag>
              <NTag size="small" type="success">{{ template.positionLabel }}</NTag>
              <NTag size="small">推荐编码：{{ template.roleCode }}</NTag>
              <NTag size="small">数据范围：{{ template.dataScope }}</NTag>
            </div>

            <div class="text-13px text-#334155">
              识别别名：{{ template.aliasCodes.join(' / ') }}
            </div>

            <div class="text-13px text-#334155">
              推荐菜单码：{{ template.menuCodes.join('、') || '按实际菜单补充' }}
            </div>
          </div>
        </NCard>
      </div>
    </NCard>

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
        :scroll-x="1700"
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

    <NModal v-model:show="createVisible" preset="card" title="新增角色" class="w-720px">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="108">
        <NFormItem label="角色编码" path="roleCode">
          <NInput v-model:value="formModel.roleCode" placeholder="例如：CUSTOMER_SERVICE 或 SUPPORT" />
        </NFormItem>
        <NFormItem label="角色名称" path="roleName">
          <NInput v-model:value="formModel.roleName" placeholder="例如：平台客服、技术支持" />
        </NFormItem>
        <NFormItem label="数据范围">
          <NSelect v-model:value="formModel.dataScope" :options="dataScopeOptions" />
        </NFormItem>
        <NFormItem label="权限码">
          <NInput
            v-model:value="formModel.permissionCodesText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 6 }"
            placeholder="支持逗号或换行分隔，例如：admin.user.read,admin.user.write"
          />
        </NFormItem>
        <NFormItem label="菜单码">
          <NInput
            v-model:value="formModel.menuCodesText"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 6 }"
            placeholder="支持逗号或换行分隔，例如：orders_list,notifications_tasks"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="createVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitCreate">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="detailVisible" preset="card" title="角色详情配置" class="w-860px">
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
          <NDescriptionsItem label="平台归属">
            {{ getRoleProfile(detailRecord).platformLabel }}
          </NDescriptionsItem>
          <NDescriptionsItem label="角色定位">
            {{ getRoleProfile(detailRecord).positionLabel }}
          </NDescriptionsItem>
          <NDescriptionsItem label="状态">
            {{ pickValue(detailRecord, ['status'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="数据范围">
            {{ pickValue(detailRecord, ['dataScope'], '-') }}
          </NDescriptionsItem>
          <NDescriptionsItem label="创建时间">
            {{ pickValue(detailRecord, ['createdAt', 'createTime'], '-') }}
          </NDescriptionsItem>
        </NDescriptions>

        <NAlert type="info" :show-icon="false" class="mb-16px">
          {{ getRoleProfile(detailRecord).description }}
        </NAlert>

        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="权限码" :bordered="false" class="card-wrapper">
              <div class="flex flex-wrap gap-8px">
                <NTag v-for="code in detailRecord.permissionCodes || []" :key="code" type="primary" size="small">
                  {{ code }}
                </NTag>
                <span v-if="!(detailRecord.permissionCodes || []).length" class="text-13px text-#64748b">暂无权限码</span>
              </div>
            </NCard>
          </NGi>
          <NGi>
            <NCard title="菜单码" :bordered="false" class="card-wrapper">
              <div class="flex flex-wrap gap-8px">
                <NTag v-for="code in detailRecord.menuCodes || []" :key="code" type="success" size="small">
                  {{ code }}
                </NTag>
                <span v-if="!(detailRecord.menuCodes || []).length" class="text-13px text-#64748b">暂无菜单码</span>
              </div>
            </NCard>
          </NGi>
        </NGrid>

        <NCode class="mt-16px" :code="toPrettyJson(detailRecord)" language="json" word-wrap />
      </NSpin>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" title="角色原始数据" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
