<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInst, SelectOption } from 'naive-ui';
import { fetchChannelDetail, fetchChannels, rechargeChannel } from '@/service/api';
import { extractObjectData, extractPagedData, getEntityId, pickValue } from '@/utils/admin';

const route = useRoute();

const loading = ref(false);
const channels = ref<Api.Admin.RawRecord[]>([]);
const channel = ref<Api.Admin.RawRecord>({});
const selectedChannelId = ref('');
const formRef = ref<FormInst | null>(null);
const submitting = ref(false);

const formModel = reactive<Api.Admin.RechargeChannelPayload>({
  amount: 0,
  remark: ''
});

const channelOptions = computed<SelectOption[]>(() =>
  channels.value.map(item => ({
    label: `${pickValue(item, ['channelName'])} (${pickValue(item, ['channelCode'])})`,
    value: getEntityId(item, ['channelId', 'id'])
  }))
);

const rules: Record<string, App.Global.FormRule[]> = {
  amount: [{ required: true, type: 'number', message: '请输入充值金额', trigger: 'blur' }],
  remark: [{ required: true, message: '请输入充值备注', trigger: 'blur' }]
};

function resolveChannelId(value: unknown) {
  const rawValue = Array.isArray(value) ? String(value[0] || '') : String(value || '');

  if (!rawValue) {
    return '';
  }

  const matched = channels.value.find(item => {
    const id = getEntityId(item, ['channelId', 'id']);
    const code = pickValue(item, ['channelCode'], '');
    return rawValue === id || rawValue === code;
  });

  return matched ? getEntityId(matched, ['channelId', 'id']) : '';
}

async function loadChannels() {
  const data = await fetchChannels({ pageNum: 1, pageSize: 100, sortBy: 'updatedAt', sortOrder: 'desc' });
  const pageData = extractPagedData(data);
  channels.value = pageData.records;

  const routeChannelId = resolveChannelId(route.query.channelId);
  selectedChannelId.value = routeChannelId || getEntityId(pageData.records[0] || {}, ['channelId', 'id']);
}

async function loadChannelDetail() {
  if (!selectedChannelId.value) {
    channel.value = {};
    return;
  }

  loading.value = true;

  try {
    const data = await fetchChannelDetail(selectedChannelId.value);
    channel.value = extractObjectData(data);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (!selectedChannelId.value) {
    window.$message?.warning('请先选择渠道');
    return;
  }

  await formRef.value?.validate();
  submitting.value = true;

  try {
    await rechargeChannel(selectedChannelId.value, {
      amount: Number(formModel.amount),
      remark: formModel.remark.trim()
    });
    window.$message?.success('渠道充值已提交');
    formModel.amount = 0;
    formModel.remark = '';
  } finally {
    submitting.value = false;
  }
}

watch(selectedChannelId, () => {
  loadChannelDetail();
});

onMounted(async () => {
  await loadChannels();
  await loadChannelDetail();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :show-icon="false">
      新版 API 的渠道充值页仅支持选择渠道并提交充值申请，不再提供余额快照和充值记录查询接口。
    </NAlert>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="选择渠道" :bordered="false" class="card-wrapper">
          <NSelect
            v-model:value="selectedChannelId"
            :options="channelOptions"
            filterable
            placeholder="请选择要充值的渠道"
          />
        </NCard>
      </NGi>

      <NGi span="2">
        <NCard title="渠道主体信息" :bordered="false" class="card-wrapper" :loading="loading">
          <NDescriptions bordered :column="3">
            <NDescriptionsItem label="渠道编码">{{ pickValue(channel, ['channelCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道名称">{{ pickValue(channel, ['channelName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道类型">{{ pickValue(channel, ['channelType']) }}</NDescriptionsItem>
            <NDescriptionsItem label="状态">{{ pickValue(channel, ['status']) }}</NDescriptionsItem>
            <NDescriptionsItem label="结算模式">{{ pickValue(channel, ['settlementMode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ pickValue(channel, ['updatedAt', 'createdAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="渠道充值" :bordered="false" class="card-wrapper">
      <NForm ref="formRef" :model="formModel" :rules="rules" label-placement="left" label-width="96" class="max-w-640px">
        <NFormItem label="充值金额" path="amount">
          <NInputNumber v-model:value="formModel.amount" :min="0.01" class="w-full" placeholder="单位：元" />
        </NFormItem>
        <NFormItem label="充值备注" path="remark">
          <NInput
            v-model:value="formModel.remark"
            type="textarea"
            placeholder="例如：财务已确认打款，后台人工充值"
            :autosize="{ minRows: 4, maxRows: 6 }"
          />
        </NFormItem>
        <NButton type="primary" :loading="submitting" @click="handleSubmit">确认充值</NButton>
      </NForm>
    </NCard>
  </NSpace>
</template>
