<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { fetchAuditLogs } from '@/service/api';
import { extractPagedData, getDateTimeRange, getEntityId, normalizeQuery, pickValue, toPrettyJson } from '@/utils/admin';

const loading = ref(false);
const rows = ref<Api.Admin.RawRecord[]>([]);
const rawVisible = ref(false);
const rawRecord = ref<Api.Admin.RawRecord>({});
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(20);
const timeRange = ref<[number, number] | null>(null);

const queryModel = reactive({
  keyword: ''
});

const columns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'operatorUsername', title: '操作人', render: row => pickValue(row, ['operatorUsername']) },
  { key: 'action', title: '操作动作', render: row => pickValue(row, ['action']) },
  { key: 'resourceType', title: '资源类型', render: row => pickValue(row, ['resourceType']) },
  { key: 'resourceId', title: '资源 ID', render: row => pickValue(row, ['resourceId']) },
  { key: 'ip', title: 'IP', render: row => pickValue(row, ['ip']) },
  { key: 'createdAt', title: '操作时间', render: row => pickValue(row, ['createdAt']) },
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

async function loadRows() {
  loading.value = true;

  try {
    const data = await fetchAuditLogs(
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

onMounted(() => {
  loadRows();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px">
        <NSpace wrap>
          <NInput v-model:value="queryModel.keyword" clearable placeholder="搜索操作人、动作、资源类型" class="lg:w-360px" />
          <NDatePicker v-model:value="timeRange" type="datetimerange" clearable class="min-w-280px" />
        </NSpace>
        <div class="flex flex-wrap justify-end gap-12px">
          <NButton
            @click="
              queryModel.keyword = '';
              timeRange = null;
              pageNum = 1;
              loadRows();
            "
          >
            重置
          </NButton>
          <NButton
            type="primary"
            @click="
              pageNum = 1;
              loadRows();
            "
          >
            查询
          </NButton>
        </div>
      </div>
    </NCard>

    <NCard title="操作审计日志" :bordered="false" class="card-wrapper">
      <NDataTable
        :columns="columns"
        :data="rows"
        :loading="loading"
        remote
        :row-key="row => getEntityId(row, ['id', 'requestId'])"
      />
      <div class="mt-16px flex justify-end">
        <NPagination
          :page="pageNum"
          :page-size="pageSize"
          :item-count="total"
          show-size-picker
          :page-sizes="[10, 20, 50, 100]"
          @update:page="
            value => {
              pageNum = value;
              loadRows();
            }
          "
          @update:page-size="
            value => {
              pageSize = value;
              pageNum = 1;
              loadRows();
            }
          "
        />
      </div>
    </NCard>

    <NModal v-model:show="rawVisible" preset="card" title="审计日志原始数据" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
