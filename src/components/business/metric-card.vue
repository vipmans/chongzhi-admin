<script setup lang="ts">
interface Props {
  label: string;
  value: string | number;
  hint?: string;
}

defineProps<Props>();
</script>

<template>
  <NCard size="small" :bordered="false" class="card-wrapper">
    <div class="flex-col gap-8px">
      <span class="text-14px text-#64748b">{{ label }}</span>
      <strong class="text-28px text-#0f172a font-700">{{ value }}</strong>
      <span class="text-12px text-#94a3b8">{{ hint || '基于当前接口可见数据汇总' }}</span>
    </div>
  </NCard>
</template>
