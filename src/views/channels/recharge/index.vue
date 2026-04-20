<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import {
  fetchChannelBalance,
  fetchChannelDetail,
  fetchChannelRechargeRecords,
  fetchChannels,
  rechargeChannel
} from '@/service/api';
import {
  downloadExcelTable,
  extractListData,
  extractObjectData,
  extractPagedData,
  formatAmountFen,
  getEntityId,
  getKeywordFilter,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

const route = useRoute();
const router = useRouter();

const channelsLoading = ref(false);
const loading = ref(false);
const submitting = ref(false);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const formRef = ref<FormInst | null>(null);

const channels = ref<Api.Admin.RawRecord[]>([]);
const selectedChannelId = ref('');
const channel = ref<Api.Admin.RawRecord>({});
const balance = ref<Api.Admin.RawRecord>({});
const rechargeRows = ref<Api.Admin.RawRecord[]>([]);

const channelSearchKeyword = ref('');
const logSearchKeyword = ref('');

const rechargeForm = reactive<Api.Admin.RechargeChannelPayload>({
  amount: 0,
  remark: ''
});

const defaultSort = {
  sortBy: 'createdAt',
  sortOrder: 'desc' as const
};

const hasChannels = computed(() => channels.value.length > 0);
const currentAvailableBalanceFen = computed(() => Number(balance.value.availableBalanceFen) || 0);
const currentFrozenBalanceFen = computed(() => Number(balance.value.frozenBalanceFen) || 0);

const currentChannelName = computed(() => pickValue(channel.value, ['channelName', 'name'], '未选择渠道'));
const currentChannelCode = computed(() => pickValue(channel.value, ['channelCode', 'code'], '-'));
const currentPortalAccount = computed(() => pickValue(channel.value, ['accessAccount'], '-'));

const channelSummary = computed(() => `${currentChannelName.value} / ${currentChannelCode.value}`);

const expectedBalanceFen = computed(() => {
  const rechargeFen = Math.round((Number(rechargeForm.amount) || 0) * 100);
  return currentAvailableBalanceFen.value + rechargeFen;
});

const channelOptions = computed<SelectOption[]>(() =>
  channels.value.map(item => ({
    label: `${pickValue(item, ['channelName', 'name'], '未命名渠道')} (${pickValue(item, ['channelCode', 'code'], '-')})`,
    value: getEntityId(item, ['channelId', 'id'])
  }))
);

const filteredChannels = computed(() => {
  if (!channelSearchKeyword.value.trim()) {
    return channels.value;
  }

  return getKeywordFilter(channels.value, channelSearchKeyword.value);
});

const filteredRows = computed(() => {
  if (!logSearchKeyword.value.trim()) {
    return rechargeRows.value;
  }

  return getKeywordFilter(rechargeRows.value, logSearchKeyword.value);
});

const totalRechargeFen = computed(() =>
  filteredRows.value.reduce((sum, item) => sum + (Number(item.amountFen) || 0), 0)
);

const rules: Record<string, App.Global.FormRule[]> = {
  amount: [{ required: true, type: 'number', message: '请输入充值金额', trigger: 'blur' }],
  remark: [{ required: true, message: '请输入充值备注', trigger: 'blur' }]
};

const channelColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
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
    key: 'accessAccount',
    title: '门户登录账号',
    render: row => pickValue(row, ['accessAccount'])
  },
  {
    key: 'channelType',
    title: '渠道类型',
    render: row => pickValue(row, ['channelType', 'type'])
  },
  {
    key: 'cooperationStatus',
    title: '合作状态',
    render: row => pickValue(row, ['cooperationStatus'])
  },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const channelId = getEntityId(row, ['channelId', 'id']);
      const active = selectedChannelId.value === channelId;

      return h(
        NButton,
        {
          size: 'small',
          type: active ? 'primary' : 'default',
          secondary: active,
          onClick: () => {
            selectedChannelId.value = channelId;
          }
        },
        { default: () => (active ? '已选择' : '选择') }
      );
    }
  }
]);

const rechargeColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  {
    key: 'recordId',
    title: '记录号',
    render: row => pickValue(row, ['recordId'])
  },
  {
    key: 'amountFen',
    title: '充值金额',
    render: row => formatAmountFen(row.amountFen)
  },
  {
    key: 'beforeBalanceFen',
    title: '充值前余额',
    render: row => formatAmountFen(row.beforeBalanceFen)
  },
  {
    key: 'afterBalanceFen',
    title: '充值后余额',
    render: row => formatAmountFen(row.afterBalanceFen)
  },
  {
    key: 'recordSource',
    title: '来源',
    render: row => pickValue(row, ['recordSource'])
  },
  {
    key: 'operatorUsername',
    title: '操作人',
    render: row => pickValue(row, ['operatorUsername'])
  },
  {
    key: 'remark',
    title: '备注',
    render: row => pickValue(row, ['remark'])
  },
  {
    key: 'createdAt',
    title: '充值时间',
    render: row => pickValue(row, ['createdAt'])
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
        { default: () => '原始数据' }
      )
  }
]);

function resolveChannelId(value: unknown, list = channels.value) {
  const rawValue = Array.isArray(value) ? String(value[0] || '') : String(value || '');

  if (!rawValue) {
    return '';
  }

  const matched = list.find(item => {
    const id = getEntityId(item, ['channelId', 'id']);
    const code = pickValue(item, ['channelCode', 'code'], '');

    return rawValue === id || rawValue === code;
  });

  return matched ? getEntityId(matched, ['channelId', 'id']) : '';
}

async function loadChannels() {
  channelsLoading.value = true;

  try {
    const pageData = extractPagedData(
      await fetchChannels({
        pageNum: 1,
        pageSize: 100,
        ...defaultSort
      })
    );
    const channelRecords = pageData.records;

    channels.value = channelRecords;

    const routeChannelId = resolveChannelId(route.query.channelId, channelRecords);
    const currentSelectedChannelId = resolveChannelId(selectedChannelId.value, channelRecords);
    const fallbackChannelId = getEntityId(channelRecords[0] || {}, ['channelId', 'id']);

    selectedChannelId.value = routeChannelId || currentSelectedChannelId || fallbackChannelId;
  } finally {
    channelsLoading.value = false;
  }
}

async function loadChannelRechargeData() {
  if (!selectedChannelId.value) {
    channel.value = {};
    balance.value = {};
    rechargeRows.value = [];
    return;
  }

  loading.value = true;

  try {
    const [channelData, balanceData, rechargeData] = await Promise.all([
      fetchChannelDetail(selectedChannelId.value),
      fetchChannelBalance(selectedChannelId.value),
      fetchChannelRechargeRecords(selectedChannelId.value)
    ]);

    channel.value = extractObjectData(channelData);
    balance.value = extractObjectData(balanceData);
    rechargeRows.value = extractListData(rechargeData);
  } finally {
    loading.value = false;
  }
}

async function handleRefresh() {
  await loadChannels();
  await loadChannelRechargeData();
}

async function handleSubmitRecharge() {
  if (!selectedChannelId.value) {
    window.$message?.warning('请先选择渠道');
    return;
  }

  await formRef.value?.validate();
  submitting.value = true;

  try {
    await rechargeChannel(selectedChannelId.value, {
      amount: Number(rechargeForm.amount),
      remark: (rechargeForm.remark || '').trim()
    });

    window.$message?.success('渠道充值已提交');
    rechargeForm.amount = 0;
    rechargeForm.remark = '';
    await loadChannelRechargeData();
  } finally {
    submitting.value = false;
  }
}

function handleResetChannelSearch() {
  channelSearchKeyword.value = '';
}

function handleResetLogSearch() {
  logSearchKeyword.value = '';
}

function handleExport() {
  if (!selectedChannelId.value) {
    window.$message?.warning('请先选择渠道');
    return;
  }

  if (!filteredRows.value.length) {
    window.$message?.warning('暂无可导出的充值记录');
    return;
  }

  const headers = [
    '渠道编码',
    '渠道名称',
    '门户登录账号',
    '记录号',
    '充值金额',
    '充值前余额',
    '充值后余额',
    '来源',
    '操作人',
    '备注',
    '充值时间'
  ];
  const rows = filteredRows.value.map(item => [
    pickValue(channel.value, ['channelCode', 'code']),
    pickValue(channel.value, ['channelName', 'name']),
    pickValue(channel.value, ['accessAccount']),
    pickValue(item, ['recordId']),
    formatAmountFen(item.amountFen),
    formatAmountFen(item.beforeBalanceFen),
    formatAmountFen(item.afterBalanceFen),
    pickValue(item, ['recordSource']),
    pickValue(item, ['operatorUsername']),
    pickValue(item, ['remark']),
    pickValue(item, ['createdAt'])
  ]);

  downloadExcelTable(
    `渠道充值日志-${pickValue(channel.value, ['channelCode', 'code'], selectedChannelId.value)}`,
    headers,
    rows
  );
  window.$message?.success('充值日志已导出');
}

function goToChannelDetail() {
  if (!selectedChannelId.value) {
    return;
  }

  router.push(`/channels/detail/${selectedChannelId.value}`);
}

watch(
  () => route.query.channelId,
  value => {
    const resolved = resolveChannelId(value);

    if (resolved && resolved !== selectedChannelId.value) {
      selectedChannelId.value = resolved;
    }
  }
);

watch(
  selectedChannelId,
  async value => {
    const nextQuery = value ? { channelId: value } : {};

    if (String(route.query.channelId || '') !== String(value || '')) {
      await router.replace({ path: '/channels/recharge', query: nextQuery });
    }

    await loadChannelRechargeData();
  },
  { flush: 'post' }
);

onMounted(async () => {
  await loadChannels();
  await loadChannelRechargeData();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">渠道充值</h2>
          <span class="text-14px text-#64748b">
            从渠道列表中选择渠道，填写充值金额并提交。充值完成后会刷新余额和充值日志。
          </span>
        </div>
        <NSpace>
          <NButton :loading="channelsLoading || loading" @click="handleRefresh">刷新数据</NButton>
          <NButton type="primary" ghost :disabled="!selectedChannelId" @click="goToChannelDetail">查看渠道详情</NButton>
        </NSpace>
      </div>
    </NCard>

    <NAlert v-if="!hasChannels" type="warning" :show-icon="false">
      当前没有可选渠道，请先到渠道列表创建渠道后再进行充值。
    </NAlert>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi span="2">
        <NCard title="选择渠道" :bordered="false" class="card-wrapper">
          <div class="mb-12px">
            <NSelect
              v-model:value="selectedChannelId"
              :options="channelOptions"
              :loading="channelsLoading"
              :disabled="!hasChannels"
              filterable
              placeholder="请选择要充值的渠道"
            />
          </div>

          <div class="mb-12px flex items-center justify-between gap-12px">
            <NInput
              v-model:value="channelSearchKeyword"
              clearable
              placeholder="搜索渠道编码、名称、门户账号"
              class="lg:w-360px"
            />
            <NButton :disabled="!channelSearchKeyword" @click="handleResetChannelSearch">重置</NButton>
          </div>

          <NDataTable
            :columns="channelColumns"
            :data="filteredChannels"
            :loading="channelsLoading"
            :pagination="{ pageSize: 5 }"
            :row-key="row => getEntityId(row, ['channelId', 'id'])"
          />
        </NCard>
      </NGi>

      <NGi>
        <NCard title="余额概览" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="12">
            <NStatistic label="当前渠道" :value="channelSummary" />
            <NStatistic label="门户登录账号" :value="currentPortalAccount" />
            <NStatistic label="当前可用余额" :value="formatAmountFen(currentAvailableBalanceFen)" />
            <NStatistic label="冻结余额" :value="formatAmountFen(currentFrozenBalanceFen)" />
            <NStatistic label="预计充值后余额" :value="formatAmountFen(expectedBalanceFen)" />
          </NSpace>

          <NAlert type="info" :show-icon="false" class="mt-16px">
            渠道每次充值后，系统会按“当前余额 + 本次充值金额”更新余额，渠道后续消费将在该额度内扣减。
          </NAlert>
        </NCard>
      </NGi>
    </NGrid>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="手动充值" :bordered="false" class="card-wrapper">
          <NForm ref="formRef" :model="rechargeForm" :rules="rules" label-placement="left" label-width="96">
            <NFormItem label="充值渠道">
              <NSelect
                v-model:value="selectedChannelId"
                :options="channelOptions"
                :loading="channelsLoading"
                :disabled="!hasChannels"
                filterable
                placeholder="请选择要充值的渠道"
              />
            </NFormItem>
            <NFormItem label="充值金额" path="amount">
              <NInputNumber
                v-model:value="rechargeForm.amount"
                :min="0.01"
                :disabled="!selectedChannelId"
                class="w-full"
                placeholder="单位：元"
              />
            </NFormItem>
            <NFormItem label="充值备注" path="remark">
              <NInput
                v-model:value="rechargeForm.remark"
                :disabled="!selectedChannelId"
                type="textarea"
                placeholder="例如：已确认打款到账，后台手动充值"
                :autosize="{ minRows: 4, maxRows: 6 }"
              />
            </NFormItem>
            <NButton
              type="primary"
              block
              :loading="submitting"
              :disabled="!selectedChannelId"
              @click="handleSubmitRecharge"
            >
              确认充值
            </NButton>
          </NForm>
        </NCard>
      </NGi>

      <NGi span="2">
        <NCard title="充值日志" :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
            <NSpace wrap>
              <NInput
                v-model:value="logSearchKeyword"
                clearable
                placeholder="搜索记录号、来源、操作人、备注"
                class="lg:w-360px"
              />
              <NButton :disabled="!logSearchKeyword" @click="handleResetLogSearch">重置</NButton>
            </NSpace>
            <NSpace>
              <NTag type="info">记录数：{{ filteredRows.length }}</NTag>
              <NTag type="success">累计充值：{{ formatAmountFen(totalRechargeFen) }}</NTag>
              <NButton type="primary" :disabled="!filteredRows.length" @click="handleExport">导出 Excel</NButton>
            </NSpace>
          </div>

          <NDataTable
            :columns="rechargeColumns"
            :data="filteredRows"
            :loading="loading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['recordId'])"
          />
        </NCard>
      </NGi>
    </NGrid>

    <NModal v-model:show="rawVisible" preset="card" title="充值记录原始数据" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
