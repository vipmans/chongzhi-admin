<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInst } from 'naive-ui';
import {
  addOrderRemark,
  closeOrder,
  fetchOrderDetail,
  fetchOrderEvents,
  markOrderException,
  retryOrderNotify
} from '@/service/api';
import {
  extractObjectData,
  extractPagedData,
  getDateTimeRange,
  getEntityId,
  normalizeQuery,
  pickValue
} from '@/utils/admin';

const route = useRoute();
const orderNo = computed(() => String(route.params.orderNo || ''));
const loading = ref(false);
const eventsLoading = ref(false);
const detail = ref<Api.Admin.RawRecord>({});
const events = ref<Api.Admin.RawRecord[]>([]);
const eventTotal = ref(0);
const eventPageNum = ref(1);
const eventPageSize = ref(10);
const eventTimeRange = ref<[number, number] | null>(null);
const exceptionVisible = ref(false);
const remarkVisible = ref(false);
const exceptionFormRef = ref<FormInst | null>(null);
const remarkFormRef = ref<FormInst | null>(null);
const exceptionForm = reactive<Api.Admin.MarkOrderExceptionPayload>({
  exceptionTag: ''
});
const remarkForm = reactive<Api.Admin.AddOrderRemarkPayload>({
  remark: ''
});

const basicInfo = computed(() => extractObjectData(detail.value.basicInfo));
const paymentInfo = computed(() => extractObjectData(detail.value.paymentInfo));
const fulfillmentInfo = computed(() => extractObjectData(detail.value.fulfillmentInfo));
const notificationInfo = computed(() => extractObjectData(detail.value.notificationInfo));
const riskInfo = computed(() => extractObjectData(detail.value.riskInfo));
const ledgerInfo = computed(() => extractObjectData(detail.value.ledgerInfo));
const businessSnapshot = computed(() => extractObjectData(detail.value.businessSnapshot));

const exceptionRules: Record<string, App.Global.FormRule[]> = {
  exceptionTag: [{ required: true, message: '请输入异常标签', trigger: 'blur' }]
};

const remarkRules: Record<string, App.Global.FormRule[]> = {
  remark: [{ required: true, message: '请输入备注', trigger: 'blur' }]
};

async function loadDetail() {
  loading.value = true;

  try {
    const data = await fetchOrderDetail(orderNo.value);
    detail.value = extractObjectData(data);
  } finally {
    loading.value = false;
  }
}

async function loadEvents() {
  eventsLoading.value = true;

  try {
    const data = await fetchOrderEvents(
      orderNo.value,
      normalizeQuery({
        pageNum: eventPageNum.value,
        pageSize: eventPageSize.value,
        ...getDateTimeRange(eventTimeRange.value)
      })
    );

    const pageData = extractPagedData(data);
    events.value = pageData.records;
    eventTotal.value = pageData.total;
    eventPageNum.value = pageData.pageNum;
    eventPageSize.value = pageData.pageSize;
  } finally {
    eventsLoading.value = false;
  }
}

async function reloadAll() {
  await Promise.all([loadDetail(), loadEvents()]);
}

async function handleClose() {
  await closeOrder(orderNo.value);
  window.$message?.success('订单已关闭');
  await reloadAll();
}

async function handleRetryNotify() {
  await retryOrderNotify(orderNo.value);
  window.$message?.success('订单通知已重试');
  await reloadAll();
}

async function submitException() {
  await exceptionFormRef.value?.validate();
  await markOrderException(orderNo.value, { exceptionTag: exceptionForm.exceptionTag.trim() });
  window.$message?.success('订单已标记异常');
  exceptionVisible.value = false;
  exceptionForm.exceptionTag = '';
  await reloadAll();
}

async function submitRemark() {
  await remarkFormRef.value?.validate();
  await addOrderRemark(orderNo.value, { remark: remarkForm.remark.trim() });
  window.$message?.success('订单备注已追加');
  remarkVisible.value = false;
  remarkForm.remark = '';
  await reloadAll();
}

async function handleEventPageChange(page: number) {
  eventPageNum.value = page;
  await loadEvents();
}

async function handleEventPageSizeChange(size: number) {
  eventPageSize.value = size;
  eventPageNum.value = 1;
  await loadEvents();
}

async function handleEventSearch() {
  eventPageNum.value = 1;
  await loadEvents();
}

async function handleEventReset() {
  eventTimeRange.value = null;
  eventPageNum.value = 1;
  await loadEvents();
}

onMounted(() => {
  reloadAll();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper" :loading="loading">
      <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">订单 {{ orderNo }}</h2>
          <span class="text-14px text-#64748b">
            主状态：{{ pickValue(fulfillmentInfo, ['mainStatus']) }} | 供应商状态：{{
              pickValue(fulfillmentInfo, ['supplierStatus'])
            }}
          </span>
        </div>
        <NSpace>
          <NButton @click="reloadAll">刷新</NButton>
          <NButton @click="exceptionVisible = true">标记异常</NButton>
          <NButton @click="remarkVisible = true">追加备注</NButton>
          <NButton @click="handleRetryNotify">重试通知</NButton>
          <NButton type="error" ghost @click="handleClose">关闭订单</NButton>
        </NSpace>
      </div>
    </NCard>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="基础信息" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="订单号">{{ pickValue(basicInfo, ['orderNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道单号">{{ pickValue(basicInfo, ['channelOrderNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道">{{ pickValue(basicInfo, ['channelId']) }}</NDescriptionsItem>
            <NDescriptionsItem label="手机号">{{ pickValue(basicInfo, ['mobile']) }}</NDescriptionsItem>
            <NDescriptionsItem label="省份">{{ pickValue(basicInfo, ['province']) }}</NDescriptionsItem>
            <NDescriptionsItem label="运营商">{{ pickValue(basicInfo, ['ispName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="商品">{{ pickValue(basicInfo, ['productId']) }}</NDescriptionsItem>
            <NDescriptionsItem label="面值(分)">{{ pickValue(basicInfo, ['faceValueAmountFen']) }}</NDescriptionsItem>
            <NDescriptionsItem label="创建时间">{{ pickValue(basicInfo, ['createdAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="完成时间">{{ pickValue(basicInfo, ['finishedAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="支付与账务" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="币种">{{ pickValue(paymentInfo, ['currency']) }}</NDescriptionsItem>
            <NDescriptionsItem label="销售金额(分)">{{ pickValue(paymentInfo, ['saleAmountFen']) }}</NDescriptionsItem>
            <NDescriptionsItem label="采购金额(分)">
              {{ pickValue(paymentInfo, ['purchaseAmountFen']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="毛利(分)">
              {{ pickValue(paymentInfo, ['grossProfitAmountFen']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="支付状态">{{ pickValue(paymentInfo, ['paymentStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="退款状态">{{ pickValue(paymentInfo, ['refundStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="账务退款状态">{{ pickValue(ledgerInfo, ['refundStatus']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="履约与通知" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="主状态">{{ pickValue(fulfillmentInfo, ['mainStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="供应商状态">
              {{ pickValue(fulfillmentInfo, ['supplierStatus']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="监控状态">{{ pickValue(fulfillmentInfo, ['monitorStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="异常标签">{{ pickValue(fulfillmentInfo, ['exceptionTag']) }}</NDescriptionsItem>
            <NDescriptionsItem label="通知状态">{{ pickValue(notificationInfo, ['notifyStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="最新任务号">
              {{ pickValue(notificationInfo, ['latestTaskNo']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="最新任务状态">
              {{ pickValue(notificationInfo, ['latestTaskStatus']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="回调地址">{{ pickValue(notificationInfo, ['callbackUrl']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="风控信息" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="决策结果">{{ pickValue(riskInfo, ['decision']) }}</NDescriptionsItem>
            <NDescriptionsItem label="原因">{{ pickValue(riskInfo, ['reason']) }}</NDescriptionsItem>
            <NDescriptionsItem label="命中规则">{{ pickValue(riskInfo, ['hitRules']) }}</NDescriptionsItem>
            <NDescriptionsItem label="订单备注">{{ pickValue(fulfillmentInfo, ['remark']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
    </NGrid>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <RawJsonCard title="业务快照" :value="businessSnapshot" />
      </NGi>
      <NGi>
        <RawJsonCard title="订单详情原始 JSON" :value="detail" />
      </NGi>
    </NGrid>

    <NCard title="订单事件轨迹" :bordered="false" class="card-wrapper">
      <div class="mb-16px flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
        <NDatePicker v-model:value="eventTimeRange" type="datetimerange" clearable class="min-w-280px" />
        <NSpace>
          <NButton @click="handleEventReset">重置</NButton>
          <NButton @click="handleEventSearch">筛选</NButton>
        </NSpace>
      </div>

      <NTimeline>
        <NTimelineItem
          v-for="item in events"
          :key="getEntityId(item, ['eventId', 'id', 'createdAt'])"
          :title="pickValue(item, ['eventType', 'type', 'status'])"
          :content="pickValue(item, ['eventDesc', 'message', 'remark'])"
          :time="pickValue(item, ['createdAt', 'createTime'])"
        />
      </NTimeline>
      <NEmpty v-if="!events.length && !eventsLoading" description="暂无订单事件" />

      <div class="mt-16px flex justify-end">
        <NPagination
          :page="eventPageNum"
          :page-size="eventPageSize"
          :item-count="eventTotal"
          :disabled="eventsLoading"
          show-size-picker
          :page-sizes="[10, 20, 50]"
          @update:page="handleEventPageChange"
          @update:page-size="handleEventPageSizeChange"
        />
      </div>
    </NCard>

    <NModal v-model:show="exceptionVisible" preset="card" title="标记订单异常" class="w-480px">
      <NForm
        ref="exceptionFormRef"
        :model="exceptionForm"
        :rules="exceptionRules"
        label-placement="left"
        label-width="96"
      >
        <NFormItem label="异常标签" path="exceptionTag">
          <NInput v-model:value="exceptionForm.exceptionTag" placeholder="例如 SUPPLIER_TIMEOUT" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="exceptionVisible = false">取消</NButton>
          <NButton type="primary" @click="submitException">提交</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="remarkVisible" preset="card" title="追加订单备注" class="w-560px">
      <NForm ref="remarkFormRef" :model="remarkForm" :rules="remarkRules" label-placement="left" label-width="96">
        <NFormItem label="备注" path="remark">
          <NInput v-model:value="remarkForm.remark" type="textarea" :autosize="{ minRows: 5, maxRows: 8 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="remarkVisible = false">取消</NButton>
          <NButton type="primary" @click="submitRemark">提交</NButton>
        </div>
      </template>
    </NModal>
  </NSpace>
</template>
