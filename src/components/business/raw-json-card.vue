<script setup lang="ts">
import { computed } from 'vue';
import { toPrettyJson } from '@/utils/admin';

interface Props {
  title?: string;
  value: unknown;
}

const props = withDefaults(defineProps<Props>(), {
  title: '原始响应'
});

const jsonText = computed(() => toPrettyJson(props.value));
</script>

<template>
  <NCard :title="title" size="small" :segmented="{ content: true }">
    <NCode :code="jsonText" language="json" word-wrap />
  </NCard>
</template>
