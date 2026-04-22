<script setup lang="ts">
import { reactive } from 'vue';
import { useAuthStore } from '@/store/modules/auth';
import { useNaiveForm } from '@/hooks/common/form';

defineOptions({
  name: 'PwdLogin'
});

const authStore = useAuthStore();
const { formRef, validate } = useNaiveForm();

interface FormModel {
  username: string;
  password: string;
}

const model = reactive<FormModel>({
  username: '',
  password: ''
});

const rules: Record<keyof FormModel, App.Global.FormRule[]> = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function handleSubmit() {
  await validate();
  await authStore.login(model.username, model.password);
}
</script>

<template>
  <NForm ref="formRef" :model="model" :rules="rules" size="large" :show-label="false" @keyup.enter="handleSubmit">
    <NFormItem path="username">
      <NInput v-model:value="model.username" placeholder="请输入管理员用户名" />
    </NFormItem>
    <NFormItem path="password">
      <NInput v-model:value="model.password" type="password" show-password-on="click" placeholder="请输入登录密码" />
    </NFormItem>
    <NSpace vertical :size="24">
      <NButton type="primary" size="large" round block :loading="authStore.loginLoading" @click="handleSubmit">
        登录后台
      </NButton>
      <NAlert type="info" :show-icon="false">
        当前前端仅提供后台管理员密码登录。根据现有 api.json，暂不支持忘记密码、验证码登录或前端自助找回密码流程。
      </NAlert>
    </NSpace>
  </NForm>
</template>
