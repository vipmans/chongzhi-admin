<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  fetchAccounts,
  fetchAdminUsers,
  fetchChannels,
  fetchNotificationTasks,
  fetchOrders,
  fetchProducts
} from '@/service/api';
import { extractPagedData } from '@/utils/admin';
import { useAuthStore } from '@/store/modules/auth';

const authStore = useAuthStore();
const loading = ref(false);

const metrics = ref({
  users: 0,
  channels: 0,
  products: 0,
  orders: 0,
  tasks: 0,
  accounts: 0
});

const moduleCards = computed(() => [
  { label: '后台权限', hint: '管理员登录、后台用户、角色管理' },
  { label: '渠道管理', hint: '渠道主体、凭证、回调、授权、价格、限额、充值' },
  { label: '商品中心', hint: '平台商品列表、新增、编辑' },
  { label: '风控管理', hint: '规则、黑白名单、风控决策查询' },
  { label: '订单中心', hint: '订单详情、轨迹、异常处理、备注、重试通知' },
  { label: '账务与通知', hint: '账户、流水、通知任务、死信与人工补偿' }
]);

async function loadDashboard() {
  loading.value = true;

  try {
    const [usersRes, channelsRes, productsRes, ordersRes, tasksRes, accountsRes] = await Promise.all([
      fetchAdminUsers(),
      fetchChannels(),
      fetchProducts(),
      fetchOrders(),
      fetchNotificationTasks(),
      fetchAccounts()
    ]);

    metrics.value = {
      users: extractPagedData(usersRes.data).total,
      channels: extractPagedData(channelsRes.data).total,
      products: extractPagedData(productsRes.data).total,
      orders: extractPagedData(ordersRes.data).total,
      tasks: extractPagedData(tasksRes.data).total,
      accounts: extractPagedData(accountsRes.data).total
    };
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadDashboard();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper">
      <div class="flex flex-col gap-12px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-8px">
          <span class="text-14px text-#64748b">ISP 话费充值平台</span>
          <h2 class="text-28px text-#0f172a font-700">管理员工作台</h2>
          <p class="m-0 text-14px text-#475569">当前登录账号：{{ authStore.userInfo.userName || '未识别账号' }}</p>
        </div>
        <NButton type="primary" secondary :loading="loading" @click="loadDashboard">刷新概览</NButton>
      </div>
    </NCard>

    <NGrid cols="1 s:2 m:3 l:6" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <MetricCard label="后台用户" :value="metrics.users" hint="来自 /admin/users/" />
      </NGi>
      <NGi>
        <MetricCard label="渠道数" :value="metrics.channels" hint="来自 /admin/channels" />
      </NGi>
      <NGi>
        <MetricCard label="商品数" :value="metrics.products" hint="来自 /admin/products" />
      </NGi>
      <NGi>
        <MetricCard label="订单数" :value="metrics.orders" hint="来自 /admin/orders/" />
      </NGi>
      <NGi>
        <MetricCard label="通知任务" :value="metrics.tasks" hint="来自 /admin/notifications/tasks" />
      </NGi>
      <NGi>
        <MetricCard label="账户数" :value="metrics.accounts" hint="来自 /admin/accounts" />
      </NGi>
    </NGrid>

    <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="V1 已落地模块" :bordered="false" class="card-wrapper">
          <NList :bordered="false">
            <NListItem v-for="item in moduleCards" :key="item.label">
              <div class="flex flex-col gap-4px">
                <strong class="text-15px text-#0f172a">{{ item.label }}</strong>
                <span class="text-13px text-#64748b">{{ item.hint }}</span>
              </div>
            </NListItem>
          </NList>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="实施说明" :bordered="false" class="card-wrapper">
          <NSpace vertical :size="12">
            <NAlert type="info" :show-icon="false">当前前端直接调用线上服务，不依赖本地 mock。</NAlert>
            <NAlert type="warning" :show-icon="false">
              响应 schema 在文档中并不完整，各业务页均保留原始 JSON 兜底展示。
            </NAlert>
            <NAlert type="success" :show-icon="false">
              权限控制当前仅基于登录态；后续补齐当前用户和授权接口后，可再升级为细粒度角色权限。
            </NAlert>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>
  </NSpace>
</template>
