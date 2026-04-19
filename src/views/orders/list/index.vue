<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSpace } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchOrders } from '@/service/api';
import {
  extractPagedData,
  getDateTimeRange,
  getEntityId,
  normalizeQuery,
  pickValue,
  toPrettyJson
} from '@/utils/admin';

const router = useRouter();
const loading = ref(false);
const rows = ref<Api.Admin.RawRecord[]>([]);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const timeRange = ref<[number, number] | null>(null);

const queryModel = reactive<Api.Admin.OrderListQuery>({
  keyword: '',
  orderNo: '',
  channelOrderNo: '',
  mobile: '',
  mainStatus: '',
  notifyStatus: '',
  exceptionTag: ''
});

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'orderNo', title: '订单号', render: row => pickValue(row, ['orderNo']) },
  { key: 'channelOrderNo', title: '渠道单号', render: row => pickValue(row, ['channelOrderNo']) },
  { key: 'channelId', title: '渠道', render: row => pickValue(row, ['channelId', 'channelCode']) },
  { key: 'mobile', title: '手机号', render: row => pickValue(row, ['mobile']) },
  { key: 'amount', title: '面值', render: row => pickValue(row, ['faceValueAmountFen', 'amount', 'faceValue']) },
  { key: 'mainStatus', title: '主状态', render: row => pickValue(row, ['mainStatus', 'status']) },
  { key: 'supplierStatus', title: '供应商状态', render: row => pickValue(row, ['supplierStatus']) },
  { key: 'notifyStatus', title: '通知状态', render: row => pickValue(row, ['notifyStatus']) },
  { key: 'createdAt', title: '创建时间', render: row => pickValue(row, ['createdAt', 'createTime']) },
  {
    key: 'actions',
    title: '操作',
    render: row => {
      const orderNo = pickValue(row, ['orderNo'], '');

      return h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => router.push(`/orders/detail/${orderNo}`)
          },
          { default: () => '订单详情' }
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

async function loadOrders() {
  loading.value = true;

  try {
    const { data } = await fetchOrders(
      normalizeQuery({
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        ...queryModel,
        ...getDateTimeRange(timeRange.value)
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
  await loadOrders();
}

async function handleReset() {
  queryModel.keyword = '';
  queryModel.orderNo = '';
  queryModel.channelOrderNo = '';
  queryModel.mobile = '';
  queryModel.mainStatus = '';
  queryModel.notifyStatus = '';
  queryModel.exceptionTag = '';
  timeRange.value = null;
  pageNum.value = 1;
  await loadOrders();
}

async function handlePageChange(page: number) {
  pageNum.value = page;
  await loadOrders();
}

async function handlePageSizeChange(size: number) {
  pageSize.value = size;
  pageNum.value = 1;
  await loadOrders();
}

onMounted(() => {
  loadOrders();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
          <NGi>
            <NInput v-model:value="queryModel.keyword" clearable placeholder="通用关键词" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.orderNo" clearable placeholder="订单号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.channelOrderNo" clearable placeholder="渠道单号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.mobile" clearable placeholder="手机号" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.mainStatus" clearable placeholder="主状态" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.notifyStatus" clearable placeholder="通知状态" />
          </NGi>
          <NGi>
            <NInput v-model:value="queryModel.exceptionTag" clearable placeholder="异常标签" />
          </NGi>
          <NGi span="1 s:2">
            <NDatePicker v-model:value="timeRange" type="datetimerange" clearable class="w-full" />
          </NGi>
        </NGrid>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton @click="handleReset">重置</NButton>
          <NButton @click="handleSearch">查询</NButton>
        </div>
      </div>
    </NCard>

    <NCard title="订单列表" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['id', 'orderId', 'orderNo'])"
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

    <NModal v-model:show="rawVisible" preset="card" title="订单原始数据" class="w-720px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
