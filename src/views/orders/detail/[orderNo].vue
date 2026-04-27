<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInst } from 'naive-ui';
import {
  addOrderRemark,
  closeOrder,
  fetchOrderDetail,
  fetchOrderEvents,
  manualUpdateOrderStatus,
  markOrderException,
  refreshOrderStatus,
  retryOrderNotify,
  retryOrderRecharge
} from '@/service/api';
import {
  extractObjectData,
  extractPagedData,
  formatAmountFen,
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

const actionLoading = reactive({
  close: false,
  notify: false,
  refresh: false,
  recharge: false
});

const exceptionVisible = ref(false);
const remarkVisible = ref(false);
const manualStatusVisible = ref(false);
const exceptionFormRef = ref<FormInst | null>(null);
const remarkFormRef = ref<FormInst | null>(null);
const manualStatusFormRef = ref<FormInst | null>(null);

const exceptionForm = reactive<Api.Admin.MarkOrderExceptionPayload>({
  exceptionTag: ''
});

const remarkForm = reactive<Api.Admin.AddOrderRemarkPayload>({
  remark: ''
});

const manualStatusForm = reactive<Api.Admin.OrderManualStatusPayload>({
  mainStatus: '',
  supplierStatus: '',
  refundStatus: '',
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

const manualStatusRules: Record<string, App.Global.FormRule[]> = {
  mainStatus: [{ required: true, message: '请输入主状态', trigger: 'blur' }]
};

function fillManualStatusForm() {
  manualStatusForm.mainStatus = pickValue(fulfillmentInfo.value, ['mainStatus'], '');
  manualStatusForm.supplierStatus = pickValue(fulfillmentInfo.value, ['supplierStatus'], '');
  manualStatusForm.refundStatus = pickValue(paymentInfo.value, ['refundStatus'], '');
  manualStatusForm.remark = pickValue(fulfillmentInfo.value, ['remark'], '');
}

async function loadDetail() {
  loading.value = true;

  try {
    const data = await fetchOrderDetail(orderNo.value);
    detail.value = extractObjectData(data);
    fillManualStatusForm();
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
  actionLoading.close = true;

  try {
    await closeOrder(orderNo.value);
    window.$message?.success('订单已关闭');
    await reloadAll();
  } finally {
    actionLoading.close = false;
  }
}

async function handleRetryNotify() {
  actionLoading.notify = true;

  try {
    await retryOrderNotify(orderNo.value);
    window.$message?.success('订单通知已提交重试');
    await reloadAll();
  } finally {
    actionLoading.notify = false;
  }
}

async function handleRefreshStatus() {
  actionLoading.refresh = true;

  try {
    await refreshOrderStatus(orderNo.value);
    window.$message?.success('已发起订单状态刷新');
    await reloadAll();
  } finally {
    actionLoading.refresh = false;
  }
}

async function handleRetryRecharge() {
  actionLoading.recharge = true;

  try {
    await retryOrderRecharge(orderNo.value);
    window.$message?.success('已发起重试充值');
    await reloadAll();
  } finally {
    actionLoading.recharge = false;
  }
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
  window.$message?.success('订单备注已保存');
  remarkVisible.value = false;
  remarkForm.remark = '';
  await reloadAll();
}

async function submitManualStatus() {
  await manualStatusFormRef.value?.validate();
  await manualUpdateOrderStatus(orderNo.value, {
    mainStatus: manualStatusForm.mainStatus.trim(),
    supplierStatus: manualStatusForm.supplierStatus.trim() || undefined,
    refundStatus: manualStatusForm.refundStatus.trim() || undefined,
    remark: manualStatusForm.remark.trim() || undefined
  });
  window.$message?.success('订单状态已人工改写');
  manualStatusVisible.value = false;
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

function openManualStatusModal() {
  fillManualStatusForm();
  manualStatusVisible.value = true;
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
            | 通知状态：{{ pickValue(notificationInfo, ['notifyStatus']) }}
          </span>
        </div>
        <NSpace>
          <NButton @click="reloadAll">刷新</NButton>
          <NButton :loading="actionLoading.refresh" @click="handleRefreshStatus">刷新状态</NButton>
          <NButton :loading="actionLoading.recharge" @click="handleRetryRecharge">重试充值</NButton>
          <NButton @click="openManualStatusModal">人工改态</NButton>
          <NButton @click="exceptionVisible = true">标记异常</NButton>
          <NButton @click="remarkVisible = true">追加备注</NButton>
          <NButton :loading="actionLoading.notify" @click="handleRetryNotify">重试通知</NButton>
          <NButton type="error" ghost :loading="actionLoading.close" @click="handleClose">关闭订单</NButton>
        </NSpace>
      </div>
    </NCard>

    <NAlert type="info" :show-icon="false">
      已按新 API 接入人工改态、主动刷新状态和重试充值，适合运营在供应商回调异常、补单兜底或人工核验场景下使用。
    </NAlert>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="基础信息" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="订单号">{{ pickValue(basicInfo, ['orderNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道单号">{{ pickValue(basicInfo, ['channelOrderNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道 ID">{{ pickValue(basicInfo, ['channelId']) }}</NDescriptionsItem>
            <NDescriptionsItem label="手机号">{{ pickValue(basicInfo, ['mobile']) }}</NDescriptionsItem>
            <NDescriptionsItem label="省份">{{ pickValue(basicInfo, ['province']) }}</NDescriptionsItem>
            <NDescriptionsItem label="运营商">{{ pickValue(basicInfo, ['ispName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="商品 ID">{{ pickValue(basicInfo, ['productId']) }}</NDescriptionsItem>
            <NDescriptionsItem label="请求商品类型">
              {{ pickValue(basicInfo, ['requestedProductType']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="面值">{{ formatAmountFen(basicInfo.faceValueAmountFen) }}</NDescriptionsItem>
            <NDescriptionsItem label="创建时间">{{ pickValue(basicInfo, ['createdAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="更新时间">{{ pickValue(basicInfo, ['updatedAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="完成时间">{{ pickValue(basicInfo, ['finishedAt']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="支付与账务" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="币种">{{ pickValue(paymentInfo, ['currency']) }}</NDescriptionsItem>
            <NDescriptionsItem label="销售金额">{{ formatAmountFen(paymentInfo.saleAmountFen) }}</NDescriptionsItem>
            <NDescriptionsItem label="采购金额">{{ formatAmountFen(paymentInfo.purchaseAmountFen) }}</NDescriptionsItem>
            <NDescriptionsItem label="毛利">{{ formatAmountFen(paymentInfo.grossProfitAmountFen) }}</NDescriptionsItem>
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
            <NDescriptionsItem label="告警时限">{{ pickValue(fulfillmentInfo, ['warningDeadlineAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="过期时限">{{ pickValue(fulfillmentInfo, ['expireDeadlineAt']) }}</NDescriptionsItem>
            <NDescriptionsItem label="通知状态">{{ pickValue(notificationInfo, ['notifyStatus']) }}</NDescriptionsItem>
            <NDescriptionsItem label="最新任务号">{{ pickValue(notificationInfo, ['latestTaskNo']) }}</NDescriptionsItem>
            <NDescriptionsItem label="最新任务状态">
              {{ pickValue(notificationInfo, ['latestTaskStatus']) }}
            </NDescriptionsItem>
            <NDescriptionsItem label="任务错误">{{ pickValue(notificationInfo, ['latestTaskLastError']) }}</NDescriptionsItem>
            <NDescriptionsItem label="回调地址">{{ pickValue(notificationInfo, ['callbackUrl']) }}</NDescriptionsItem>
            <NDescriptionsItem label="回调超时">{{ pickValue(notificationInfo, ['timeoutSeconds']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="风控信息" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="风控决策">{{ pickValue(riskInfo, ['decision']) }}</NDescriptionsItem>
            <NDescriptionsItem label="原因">{{ pickValue(riskInfo, ['reason']) }}</NDescriptionsItem>
            <NDescriptionsItem label="命中规则">{{ pickValue(riskInfo, ['hitRules']) }}</NDescriptionsItem>
            <NDescriptionsItem label="运营备注">{{ pickValue(fulfillmentInfo, ['remark']) }}</NDescriptionsItem>
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

    <NCard title="订单事件日志" :bordered="false" class="card-wrapper">
      <div class="mb-16px flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
        <NDatePicker v-model:value="eventTimeRange" type="datetimerange" clearable class="min-w-280px" />
        <NSpace>
          <NButton @click="handleEventReset">重置</NButton>
          <NButton type="primary" @click="handleEventSearch">筛选</NButton>
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

    <NModal v-model:show="manualStatusVisible" preset="card" title="人工改态" class="w-640px">
      <NForm
        ref="manualStatusFormRef"
        :model="manualStatusForm"
        :rules="manualStatusRules"
        label-placement="left"
        label-width="110"
      >
        <NAlert type="warning" :show-icon="false" class="mb-16px">
          人工改态会直接改写父订单及相关子单状态，请先确认已完成线下核验。
        </NAlert>
        <NFormItem label="主状态" path="mainStatus">
          <NInput v-model:value="manualStatusForm.mainStatus" placeholder="如 SUCCESS / FAILED / PROCESSING" />
        </NFormItem>
        <NFormItem label="供应商状态">
          <NInput v-model:value="manualStatusForm.supplierStatus" placeholder="如 RECHARGED / WAITING / FAILED" />
        </NFormItem>
        <NFormItem label="退款状态">
          <NInput v-model:value="manualStatusForm.refundStatus" placeholder="如 NONE / REFUNDED" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="manualStatusForm.remark" type="textarea" :autosize="{ minRows: 4, maxRows: 8 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="manualStatusVisible = false">取消</NButton>
          <NButton type="primary" @click="submitManualStatus">提交</NButton>
        </div>
      </template>
    </NModal>
  </NSpace>
</template>
