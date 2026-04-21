<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NButton, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns, FormInst, SelectOption } from 'naive-ui';
import {
  createProductPlatformPrice,
  createProductSupplierMapping,
  deleteProductSupplierMapping,
  fetchChannelOrderPolicy,
  fetchChannels,
  fetchProductDetail,
  fetchProductDiscountRules,
  fetchProductPlatformPricing,
  fetchProductRoutePolicy,
  fetchProductSupplierMappings,
  fetchSupplierProducts,
  fetchSuppliers,
  previewProductRoute,
  saveChannelPrice,
  saveProductRoutePolicy,
  updateProduct,
  updateProductPlatformPrice,
  updateProductSupplierMapping
} from '@/service/api';
import {
  extractListData,
  extractObjectData,
  extractPagedData,
  formatAmountFen,
  getEntityId,
  normalizeQuery,
  pickNumber,
  pickValue,
  toBoolean,
  toPrettyJson
} from '@/utils/admin';

const route = useRoute();
const productId = computed(() => String(route.params.id || ''));

const loading = ref(false);
const savingBasic = ref(false);
const mappingsLoading = ref(false);
const mappingSubmitting = ref(false);
const platformPricesLoading = ref(false);
const platformPriceSubmitting = ref(false);
const channelPricesLoading = ref(false);
const channelPriceSubmitting = ref(false);
const routeLoading = ref(false);
const routeSubmitting = ref(false);
const previewLoading = ref(false);
const rawVisible = ref(false);
const rawTitle = ref('原始数据');
const rawRecord = ref<unknown>({});

const mappingModalVisible = ref(false);
const platformPriceModalVisible = ref(false);
const routeItemModalVisible = ref(false);

const editingMappingId = ref('');
const editingPlatformPriceId = ref('');
const editingRouteItemId = ref('');

const product = ref<Api.Admin.RawRecord>({});
const mappingRows = ref<Api.Admin.RawRecord[]>([]);
const platformPriceRows = ref<Api.Admin.RawRecord[]>([]);
const channelPriceRows = ref<Api.Admin.RawRecord[]>([]);
const discountRules = ref<Api.Admin.RawRecord[]>([]);
const routePolicy = ref<Api.Admin.RawRecord>({});
const routePreview = ref<Api.Admin.RawRecord>({});
const routeItems = ref<Api.Admin.RawRecord[]>([]);

const suppliers = ref<Api.Admin.RawRecord[]>([]);
const channels = ref<Api.Admin.RawRecord[]>([]);
const supplierProducts = ref<Api.Admin.RawRecord[]>([]);

const basicFormRef = ref<FormInst | null>(null);
const mappingFormRef = ref<FormInst | null>(null);
const platformPriceFormRef = ref<FormInst | null>(null);
const channelPriceFormRef = ref<FormInst | null>(null);
const routeFormRef = ref<FormInst | null>(null);
const routeItemFormRef = ref<FormInst | null>(null);
const previewFormRef = ref<FormInst | null>(null);

const basicForm = reactive<Api.Admin.SaveProductPayload>({
  productCode: '',
  productName: '',
  carrierCode: 'CMCC',
  provinceName: '',
  faceValue: 0,
  productType: 'FAST',
  salesUnit: '',
  status: 'ACTIVE'
});

const mappingForm = reactive({
  supplierId: '',
  supplierProductId: '',
  matchMode: 'MANUAL',
  priorityNo: 1,
  isDefault: false,
  isFallback: true,
  purchasePriceMode: 'SNAPSHOT',
  purchasePriceFen: null as number | null,
  routeWeight: null as number | null,
  mappingStatus: 'ACTIVE',
  effectiveRange: null as [number, number] | null,
  remark: ''
});

const platformPriceForm = reactive({
  priceType: 'STANDARD',
  currency: 'CNY',
  saleAmountFen: 0,
  minSaleAmountFen: null as number | null,
  maxSaleAmountFen: null as number | null,
  grossProfitMode: 'FIXED',
  grossProfitValue: null as number | null,
  pricingStatus: 'ACTIVE',
  effectiveRange: null as [number, number] | null,
  remark: ''
});

const channelPriceForm = reactive<Api.Admin.SaveChannelPricePayload>({
  channelId: '',
  productId: '',
  salePrice: 0
});

const routeForm = reactive({
  policyCode: '',
  policyName: '',
  routeMode: 'GROSS_PROFIT_FIRST',
  failoverEnabled: true,
  priceProtectEnabled: true,
  maxPurchasePriceFen: null as number | null,
  profitSortEnabled: true,
  inventoryCheckEnabled: true,
  supplierHealthCheckEnabled: true,
  timeoutFallbackEnabled: true,
  timeoutMs: 3000,
  routeExplainEnabled: true,
  policyStatus: 'ACTIVE',
  remark: ''
});

const routeItemForm = reactive({
  mappingId: '',
  priorityNo: 1,
  weightValue: null as number | null,
  candidateStatus: 'ACTIVE',
  minSuccessRate: null as number | null,
  maxTimeoutMs: null as number | null,
  maxPurchasePriceFen: null as number | null,
  allowFallback: true,
  remark: ''
});

const previewForm = reactive<Api.Admin.ProductRoutePreviewPayload>({
  channelId: '',
  mobile: '',
  faceValue: undefined,
  productType: undefined,
  carrierCode: undefined,
  provinceName: ''
});

const carrierOptions = [
  { label: '中国移动', value: 'CMCC' },
  { label: '中国电信', value: 'CTCC' },
  { label: '中国联通', value: 'CUCC' },
  { label: '广电', value: 'CBN' }
];

const productTypeOptions = [
  { label: 'FAST', value: 'FAST' },
  { label: 'MIXED', value: 'MIXED' }
];

const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const priceTypeOptions = [
  { label: '默认供货价', value: 'STANDARD' },
  { label: '底价保护', value: 'FLOOR' },
  { label: '建议价', value: 'SUGGESTED' }
];

const pricingStatusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const routeModeOptions = [
  { label: '利润优先', value: 'GROSS_PROFIT_FIRST' },
  { label: '固定优先级', value: 'PRIORITY' },
  { label: '最低采购价', value: 'LOWEST_COST' },
  { label: '权重路由', value: 'WEIGHTED' },
  { label: '仅人工指定', value: 'MANUAL_ONLY' }
];

const mappingStatusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' }
];

const supplierOptions = computed<SelectOption[]>(() =>
  suppliers.value.map(item => ({
    label: `${pickValue(item, ['supplierName'])} (${pickValue(item, ['supplierCode'])})`,
    value: getEntityId(item, ['supplierId', 'id', 'supplierCode'])
  }))
);

const supplierProductOptions = computed<SelectOption[]>(() =>
  supplierProducts.value.map(item => ({
    label: `${pickValue(item, ['supplierProductCode'])} | ${pickValue(item, ['supplierProductName', 'productName'])} | ${formatAmountFen(item.costPriceFen)}`,
    value: getEntityId(item, ['id', 'supplierProductId', 'snapshotId', 'supplierProductCode'])
  }))
);

const channelOptions = computed<SelectOption[]>(() =>
  channels.value.map(item => ({
    label: `${pickValue(item, ['channelName'])} (${pickValue(item, ['channelCode'])})`,
    value: getEntityId(item, ['channelId', 'id', 'channelCode'])
  }))
);

const mappingOptions = computed<SelectOption[]>(() =>
  mappingRows.value.map(item => ({
    label: `${pickValue(item, ['supplierName'])} / ${pickValue(item, ['supplierProductCode'])} / ${formatAmountFen(item.purchasePriceFen ?? item.costPriceFen)}`,
    value: getEntityId(item, ['mappingId', 'id'])
  }))
);

const currentDefaultSupplyPrice = computed(() => {
  const activePrice =
    platformPriceRows.value.find(item => pickValue(item, ['pricingStatus', 'status'], '').toUpperCase() === 'ACTIVE') ||
    platformPriceRows.value[0];

  return activePrice ? formatAmountFen(activePrice.saleAmountFen ?? activePrice.salePriceFen) : '-';
});

const bestPurchasePriceFen = computed(() => {
  const values = mappingRows.value
    .filter(item => pickValue(item, ['mappingStatus', 'status'], 'ACTIVE').toUpperCase() === 'ACTIVE')
    .map(item => Number(item.purchasePriceFen ?? item.costPriceFen))
    .filter(item => !Number.isNaN(item) && item > 0);

  if (!values.length) {
    return null;
  }

  return Math.min(...values);
});

const bestPurchasePriceText = computed(() => formatAmountFen(bestPurchasePriceFen.value));

const routePreviewCandidates = computed(() =>
  extractListData(routePreview.value.candidates ?? routePreview.value.candidateList ?? routePreview.value.items)
);

const selectedRouteSupplier = computed(() =>
  extractObjectData(routePreview.value.selectedSupplier ?? routePreview.value.selectedRoute ?? routePreview.value.selected)
);

const basicRules: Record<string, App.Global.FormRule[]> = {
  productCode: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  productName: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  provinceName: [{ required: true, message: '请输入省份', trigger: 'blur' }],
  faceValue: [{ required: true, type: 'number', message: '请输入面值', trigger: 'blur' }],
  salesUnit: [{ required: true, message: '请输入销售单位', trigger: 'blur' }]
};

const mappingRules: Record<string, App.Global.FormRule[]> = {
  supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  supplierProductId: [{ required: true, message: '请选择供应商商品', trigger: 'change' }]
};

const platformPriceRules: Record<string, App.Global.FormRule[]> = {
  saleAmountFen: [{ required: true, type: 'number', message: '请输入默认供货价(分)', trigger: 'blur' }]
};

const channelPriceRules: Record<string, App.Global.FormRule[]> = {
  channelId: [{ required: true, message: '请选择渠道', trigger: 'change' }],
  salePrice: [{ required: true, type: 'number', message: '请输入渠道供货价(分)', trigger: 'blur' }]
};

const routeRules: Record<string, App.Global.FormRule[]> = {
  policyName: [{ required: true, message: '请输入策略名称', trigger: 'blur' }]
};

const routeItemRules: Record<string, App.Global.FormRule[]> = {
  mappingId: [{ required: true, message: '请选择供应商映射', trigger: 'change' }]
};

function toIsoRange(range: [number, number] | null) {
  if (!range?.length) {
    return {};
  }

  const [start, end] = range;

  return {
    effectiveFrom: new Date(start).toISOString(),
    effectiveTo: new Date(end).toISOString()
  };
}

function toDateRange(record: Api.Admin.RawRecord, startKeys: string[], endKeys: string[]) {
  const startText = pickValue(record, startKeys, '');
  const endText = pickValue(record, endKeys, '');

  if (!startText || startText === '-' || !endText || endText === '-') {
    return null;
  }

  const start = new Date(startText).getTime();
  const end = new Date(endText).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return [start, end] as [number, number];
}

function openRaw(title: string, value: unknown) {
  rawTitle.value = title;
  rawRecord.value = value;
  rawVisible.value = true;
}

function syncBasicForm(record: Api.Admin.RawRecord) {
  basicForm.productCode = pickValue(record, ['productCode'], '');
  basicForm.productName = pickValue(record, ['productName'], '');
  basicForm.carrierCode = pickValue(record, ['carrierCode'], 'CMCC') as Api.Admin.CarrierCode;
  basicForm.provinceName = pickValue(record, ['provinceName', 'province'], '');
  basicForm.faceValue = Number(record.faceValue ?? record.faceValueAmountFen ?? 0) / (record.faceValueAmountFen ? 100 : 1);
  basicForm.productType = pickValue(record, ['productType'], 'FAST') as Api.Admin.ProductType;
  basicForm.salesUnit = pickValue(record, ['salesUnit'], '');
  basicForm.status = pickValue(record, ['status', 'standardStatus'], 'ACTIVE') as Api.Admin.ProductStatus;
}

function syncRouteForm(record: Api.Admin.RawRecord) {
  routeForm.policyCode = pickValue(record, ['policyCode'], '');
  routeForm.policyName = pickValue(record, ['policyName'], '');
  routeForm.routeMode = pickValue(record, ['routeMode'], 'GROSS_PROFIT_FIRST');
  routeForm.failoverEnabled = toBoolean(record.failoverEnabled ?? true);
  routeForm.priceProtectEnabled = toBoolean(record.priceProtectEnabled ?? true);
  routeForm.maxPurchasePriceFen = pickNumber(record, ['maxPurchasePriceFen'], 0) || null;
  routeForm.profitSortEnabled = toBoolean(record.profitSortEnabled ?? true);
  routeForm.inventoryCheckEnabled = toBoolean(record.inventoryCheckEnabled ?? true);
  routeForm.supplierHealthCheckEnabled = toBoolean(record.supplierHealthCheckEnabled ?? true);
  routeForm.timeoutFallbackEnabled = toBoolean(record.timeoutFallbackEnabled ?? true);
  routeForm.timeoutMs = pickNumber(record, ['timeoutMs'], 3000) || 3000;
  routeForm.routeExplainEnabled = toBoolean(record.routeExplainEnabled ?? true);
  routeForm.policyStatus = pickValue(record, ['policyStatus', 'status'], 'ACTIVE');
  routeForm.remark = pickValue(record, ['remark'], '');
}

function syncRouteItems(record: Api.Admin.RawRecord) {
  const items = extractListData(record.items ?? record.candidates ?? record.routeItems);

  routeItems.value = items.map((item, index) => ({
    id: getEntityId(item, ['id', 'routeItemId']) || `local-route-item-${index}`,
    mappingId: getEntityId(item, ['mappingId']),
    supplierId: getEntityId(item, ['supplierId']),
    priorityNo: pickNumber(item, ['priorityNo'], index + 1),
    weightValue: item.weightValue ?? null,
    candidateStatus: pickValue(item, ['candidateStatus', 'status'], 'ACTIVE'),
    minSuccessRate: item.minSuccessRate ?? null,
    maxTimeoutMs: item.maxTimeoutMs ?? null,
    maxPurchasePriceFen: item.maxPurchasePriceFen ?? null,
    allowFallback: toBoolean(item.allowFallback ?? true),
    remark: pickValue(item, ['remark'], '')
  }));
}

async function loadSuppliersAndChannels() {
  const [supplierData, channelData] = await Promise.all([fetchSuppliers({ pageNum: 1, pageSize: 200 }), fetchChannels({ pageNum: 1, pageSize: 200 })]);
  suppliers.value = Array.isArray(supplierData) ? extractListData(supplierData) : extractPagedData(supplierData).records;
  channels.value = extractPagedData(channelData).records;
}

async function loadProduct() {
  loading.value = true;

  try {
    const detail = await fetchProductDetail(productId.value);
    product.value = extractObjectData(detail);
    syncBasicForm(product.value);
    previewForm.faceValue = Number(product.value.faceValueAmountFen ?? 0) || undefined;
    previewForm.productType = pickValue(product.value, ['productType'], '') || undefined;
    previewForm.carrierCode = pickValue(product.value, ['carrierCode'], '') || undefined;
    previewForm.provinceName = pickValue(product.value, ['provinceName'], '');
  } finally {
    loading.value = false;
  }
}

async function loadMappings() {
  mappingsLoading.value = true;

  try {
    const data = await fetchProductSupplierMappings(productId.value);
    mappingRows.value = extractListData(data);
  } finally {
    mappingsLoading.value = false;
  }
}

async function loadPlatformPrices() {
  platformPricesLoading.value = true;

  try {
    const data = await fetchProductPlatformPricing(productId.value);
    platformPriceRows.value = extractListData(data);
  } finally {
    platformPricesLoading.value = false;
  }
}

async function loadChannelPrices() {
  channelPricesLoading.value = true;

  try {
    const rows = await Promise.all(
      channels.value.map(async channel => {
        const channelId = getEntityId(channel, ['channelId', 'id', 'channelCode']);

        try {
          const policy = extractObjectData(await fetchChannelOrderPolicy(channelId));
          const policies = extractListData(policy.pricePolicies);
          const current = policies.find(item => getEntityId(item, ['productId']) === productId.value);

          if (!current) {
            return null;
          }

          const priceFen = Number(current.saleAmountFen ?? current.salePriceFen ?? 0);
          const purchaseFen = bestPurchasePriceFen.value ?? 0;

          return {
            id: `${channelId}-${productId.value}`,
            channelId,
            channelCode: pickValue(channel, ['channelCode']),
            channelName: pickValue(channel, ['channelName']),
            supplyPriceFen: priceFen,
            bestPurchasePriceFen: purchaseFen,
            estimatedProfitFen: priceFen - purchaseFen,
            status: pickValue(current, ['status'], 'ACTIVE'),
            effectiveFrom: pickValue(current, ['effectiveFrom'], ''),
            effectiveTo: pickValue(current, ['effectiveTo'], ''),
            rawPolicy: current
          } satisfies Api.Admin.RawRecord;
        } catch {
          return null;
        }
      })
    );

    channelPriceRows.value = rows.filter(Boolean) as Api.Admin.RawRecord[];
  } finally {
    channelPricesLoading.value = false;
  }
}

async function loadRoutePolicy() {
  routeLoading.value = true;

  try {
    const data = await fetchProductRoutePolicy(productId.value);
    routePolicy.value = extractObjectData(data);
    syncRouteForm(routePolicy.value);
    syncRouteItems(routePolicy.value);
  } finally {
    routeLoading.value = false;
  }
}

async function loadDiscountRules() {
  try {
    const data = await fetchProductDiscountRules({ productId: productId.value });
    discountRules.value = extractListData(data);
  } catch {
    discountRules.value = [];
  }
}

async function reloadAll() {
  await loadSuppliersAndChannels();
  await Promise.all([loadProduct(), loadMappings(), loadPlatformPrices(), loadRoutePolicy(), loadDiscountRules()]);
  await loadChannelPrices();
}

async function handleSaveBasic() {
  await basicFormRef.value?.validate();
  savingBasic.value = true;

  try {
    await updateProduct(productId.value, {
      ...basicForm,
      productCode: basicForm.productCode.trim(),
      productName: basicForm.productName.trim(),
      provinceName: basicForm.provinceName.trim(),
      faceValue: Number(basicForm.faceValue),
      salesUnit: basicForm.salesUnit.trim()
    });

    window.$message?.success('商品基础信息已保存');
    await loadProduct();
  } finally {
    savingBasic.value = false;
  }
}

function resetMappingForm() {
  editingMappingId.value = '';
  mappingForm.supplierId = '';
  mappingForm.supplierProductId = '';
  mappingForm.matchMode = 'MANUAL';
  mappingForm.priorityNo = 1;
  mappingForm.isDefault = false;
  mappingForm.isFallback = true;
  mappingForm.purchasePriceMode = 'SNAPSHOT';
  mappingForm.purchasePriceFen = null;
  mappingForm.routeWeight = null;
  mappingForm.mappingStatus = 'ACTIVE';
  mappingForm.effectiveRange = null;
  mappingForm.remark = '';
  supplierProducts.value = [];
}

async function handleSupplierChange(value: string) {
  mappingForm.supplierId = value;
  mappingForm.supplierProductId = '';

  if (!value) {
    supplierProducts.value = [];
    return;
  }

  const data = await fetchSupplierProducts(value);
  supplierProducts.value = extractListData(data);
}

function openCreateMapping() {
  resetMappingForm();
  mappingModalVisible.value = true;
}

async function openEditMapping(row: Api.Admin.RawRecord) {
  resetMappingForm();
  editingMappingId.value = getEntityId(row, ['mappingId', 'id']);
  mappingForm.supplierId = getEntityId(row, ['supplierId']);
  await handleSupplierChange(mappingForm.supplierId);
  mappingForm.supplierProductId = getEntityId(row, ['supplierProductId']);
  mappingForm.matchMode = pickValue(row, ['matchMode'], 'MANUAL');
  mappingForm.priorityNo = pickNumber(row, ['priorityNo'], 1);
  mappingForm.isDefault = toBoolean(row.isDefault);
  mappingForm.isFallback = toBoolean(row.isFallback ?? true);
  mappingForm.purchasePriceMode = pickValue(row, ['purchasePriceMode'], 'SNAPSHOT');
  mappingForm.purchasePriceFen = pickNumber(row, ['purchasePriceFen'], 0) || null;
  mappingForm.routeWeight = pickNumber(row, ['routeWeight'], 0) || null;
  mappingForm.mappingStatus = pickValue(row, ['mappingStatus', 'status'], 'ACTIVE');
  mappingForm.effectiveRange = toDateRange(row, ['effectiveFrom'], ['effectiveTo']);
  mappingForm.remark = pickValue(row, ['remark'], '');
  mappingModalVisible.value = true;
}

async function submitMapping() {
  await mappingFormRef.value?.validate();
  mappingSubmitting.value = true;

  try {
    const supplierProduct = supplierProducts.value.find(
      item => getEntityId(item, ['id', 'supplierProductId', 'snapshotId', 'supplierProductCode']) === mappingForm.supplierProductId
    );

    const payload = normalizeQuery({
      productId: productId.value,
      supplierId: mappingForm.supplierId,
      supplierProductId: mappingForm.supplierProductId,
      supplierProductCode: supplierProduct ? pickValue(supplierProduct, ['supplierProductCode'], '') : undefined,
      matchMode: mappingForm.matchMode,
      priorityNo: Number(mappingForm.priorityNo),
      isDefault: toBoolean(mappingForm.isDefault),
      isFallback: toBoolean(mappingForm.isFallback),
      purchasePriceMode: mappingForm.purchasePriceMode,
      purchasePriceFen: mappingForm.purchasePriceFen ?? undefined,
      routeWeight: mappingForm.routeWeight ?? undefined,
      mappingStatus: mappingForm.mappingStatus,
      remark: mappingForm.remark.trim() || undefined,
      ...toIsoRange(mappingForm.effectiveRange)
    }) as Api.Admin.SaveProductSupplierMappingPayload;

    if (editingMappingId.value) {
      await updateProductSupplierMapping(editingMappingId.value, payload);
      window.$message?.success('供应商映射已更新');
    } else {
      await createProductSupplierMapping(payload);
      window.$message?.success('供应商映射已创建');
    }

    mappingModalVisible.value = false;
    await Promise.all([loadMappings(), loadChannelPrices(), loadRoutePolicy()]);
  } finally {
    mappingSubmitting.value = false;
  }
}

function removeMapping(row: Api.Admin.RawRecord) {
  const mappingId = getEntityId(row, ['mappingId', 'id']);

  window.$dialog?.warning({
    title: '确认删除供应商映射',
    content: `删除后，该商品与 ${pickValue(row, ['supplierName'])} / ${pickValue(row, ['supplierProductCode'])} 的供货关系会被解除。`,
    positiveText: '确认删除',
    negativeText: '取消',
    async onPositiveClick() {
      await deleteProductSupplierMapping(mappingId);
      window.$message?.success('供应商映射已删除');
      await Promise.all([loadMappings(), loadChannelPrices(), loadRoutePolicy()]);
    }
  });
}

function resetPlatformPriceForm() {
  editingPlatformPriceId.value = '';
  platformPriceForm.priceType = 'STANDARD';
  platformPriceForm.currency = 'CNY';
  platformPriceForm.saleAmountFen = 0;
  platformPriceForm.minSaleAmountFen = null;
  platformPriceForm.maxSaleAmountFen = null;
  platformPriceForm.grossProfitMode = 'FIXED';
  platformPriceForm.grossProfitValue = null;
  platformPriceForm.pricingStatus = 'ACTIVE';
  platformPriceForm.effectiveRange = null;
  platformPriceForm.remark = '';
}

function openCreatePlatformPrice() {
  resetPlatformPriceForm();
  platformPriceModalVisible.value = true;
}

function openEditPlatformPrice(row: Api.Admin.RawRecord) {
  resetPlatformPriceForm();
  editingPlatformPriceId.value = getEntityId(row, ['priceId', 'id']);
  platformPriceForm.priceType = pickValue(row, ['priceType'], 'STANDARD');
  platformPriceForm.currency = pickValue(row, ['currency'], 'CNY');
  platformPriceForm.saleAmountFen = pickNumber(row, ['saleAmountFen', 'salePriceFen'], 0);
  platformPriceForm.minSaleAmountFen = pickNumber(row, ['minSaleAmountFen'], 0) || null;
  platformPriceForm.maxSaleAmountFen = pickNumber(row, ['maxSaleAmountFen'], 0) || null;
  platformPriceForm.grossProfitMode = pickValue(row, ['grossProfitMode'], 'FIXED');
  platformPriceForm.grossProfitValue = row.grossProfitValue ?? null;
  platformPriceForm.pricingStatus = pickValue(row, ['pricingStatus', 'status'], 'ACTIVE');
  platformPriceForm.effectiveRange = toDateRange(row, ['effectiveFrom'], ['effectiveTo']);
  platformPriceForm.remark = pickValue(row, ['remark'], '');
  platformPriceModalVisible.value = true;
}

async function submitPlatformPrice() {
  await platformPriceFormRef.value?.validate();
  platformPriceSubmitting.value = true;

  try {
    const payload = normalizeQuery({
      productId: productId.value,
      priceType: platformPriceForm.priceType,
      currency: platformPriceForm.currency,
      saleAmountFen: Number(platformPriceForm.saleAmountFen),
      minSaleAmountFen: platformPriceForm.minSaleAmountFen ?? undefined,
      maxSaleAmountFen: platformPriceForm.maxSaleAmountFen ?? undefined,
      grossProfitMode: platformPriceForm.grossProfitMode,
      grossProfitValue: platformPriceForm.grossProfitValue ?? undefined,
      pricingStatus: platformPriceForm.pricingStatus,
      remark: platformPriceForm.remark.trim() || undefined,
      ...toIsoRange(platformPriceForm.effectiveRange)
    }) as Api.Admin.SaveProductPlatformPricePayload;

    if (editingPlatformPriceId.value) {
      await updateProductPlatformPrice(editingPlatformPriceId.value, payload);
      window.$message?.success('平台默认供货价已更新');
    } else {
      await createProductPlatformPrice(payload);
      window.$message?.success('平台默认供货价已创建');
    }

    platformPriceModalVisible.value = false;
    await loadPlatformPrices();
  } finally {
    platformPriceSubmitting.value = false;
  }
}

async function submitChannelPrice() {
  await channelPriceFormRef.value?.validate();

  if (bestPurchasePriceFen.value !== null && Number(channelPriceForm.salePrice) <= bestPurchasePriceFen.value) {
    window.$message?.warning('当前渠道供货价不高于最优采购价，毛利可能为负，请确认后再调整。');
  }

  channelPriceSubmitting.value = true;

  try {
    await saveChannelPrice({
      channelId: channelPriceForm.channelId,
      productId: productId.value,
      salePrice: Number(channelPriceForm.salePrice)
    });

    window.$message?.success('渠道供货价已保存');
    await loadChannelPrices();
  } finally {
    channelPriceSubmitting.value = false;
  }
}

function resetRouteItemForm() {
  editingRouteItemId.value = '';
  routeItemForm.mappingId = '';
  routeItemForm.priorityNo = routeItems.value.length + 1;
  routeItemForm.weightValue = null;
  routeItemForm.candidateStatus = 'ACTIVE';
  routeItemForm.minSuccessRate = null;
  routeItemForm.maxTimeoutMs = null;
  routeItemForm.maxPurchasePriceFen = null;
  routeItemForm.allowFallback = true;
  routeItemForm.remark = '';
}

function openCreateRouteItem() {
  resetRouteItemForm();
  routeItemModalVisible.value = true;
}

function openEditRouteItem(row: Api.Admin.RawRecord) {
  resetRouteItemForm();
  editingRouteItemId.value = getEntityId(row, ['id']);
  routeItemForm.mappingId = getEntityId(row, ['mappingId']);
  routeItemForm.priorityNo = pickNumber(row, ['priorityNo'], 1);
  routeItemForm.weightValue = row.weightValue ?? null;
  routeItemForm.candidateStatus = pickValue(row, ['candidateStatus', 'status'], 'ACTIVE');
  routeItemForm.minSuccessRate = row.minSuccessRate ?? null;
  routeItemForm.maxTimeoutMs = row.maxTimeoutMs ?? null;
  routeItemForm.maxPurchasePriceFen = row.maxPurchasePriceFen ?? null;
  routeItemForm.allowFallback = toBoolean(row.allowFallback ?? true);
  routeItemForm.remark = pickValue(row, ['remark'], '');
  routeItemModalVisible.value = true;
}

async function submitRouteItem() {
  await routeItemFormRef.value?.validate();

  const selectedMapping = mappingRows.value.find(item => getEntityId(item, ['mappingId', 'id']) === routeItemForm.mappingId);
  if (!selectedMapping) {
    window.$message?.error('请选择有效的供应商映射');
    return;
  }

  const nextRow = {
    id: editingRouteItemId.value || `local-route-item-${Date.now()}`,
    mappingId: routeItemForm.mappingId,
    supplierId: getEntityId(selectedMapping, ['supplierId']),
    supplierName: pickValue(selectedMapping, ['supplierName']),
    supplierProductCode: pickValue(selectedMapping, ['supplierProductCode']),
    priorityNo: Number(routeItemForm.priorityNo),
    weightValue: routeItemForm.weightValue,
    candidateStatus: routeItemForm.candidateStatus,
    minSuccessRate: routeItemForm.minSuccessRate,
    maxTimeoutMs: routeItemForm.maxTimeoutMs,
    maxPurchasePriceFen: routeItemForm.maxPurchasePriceFen,
    allowFallback: toBoolean(routeItemForm.allowFallback),
    remark: routeItemForm.remark.trim()
  } satisfies Api.Admin.RawRecord;

  if (editingRouteItemId.value) {
    routeItems.value = routeItems.value.map(item => (getEntityId(item, ['id']) === editingRouteItemId.value ? nextRow : item));
  } else {
    routeItems.value = [...routeItems.value, nextRow];
  }

  routeItemModalVisible.value = false;
}

function removeRouteItem(row: Api.Admin.RawRecord) {
  const routeItemId = getEntityId(row, ['id']);
  routeItems.value = routeItems.value.filter(item => getEntityId(item, ['id']) !== routeItemId);
}

async function submitRoutePolicy() {
  await routeFormRef.value?.validate();
  routeSubmitting.value = true;

  try {
    await saveProductRoutePolicy(productId.value, normalizeQuery({
      policyCode: routeForm.policyCode.trim() || undefined,
      policyName: routeForm.policyName.trim(),
      routeMode: routeForm.routeMode,
      failoverEnabled: toBoolean(routeForm.failoverEnabled),
      priceProtectEnabled: toBoolean(routeForm.priceProtectEnabled),
      maxPurchasePriceFen: routeForm.maxPurchasePriceFen ?? undefined,
      profitSortEnabled: toBoolean(routeForm.profitSortEnabled),
      inventoryCheckEnabled: toBoolean(routeForm.inventoryCheckEnabled),
      supplierHealthCheckEnabled: toBoolean(routeForm.supplierHealthCheckEnabled),
      timeoutFallbackEnabled: toBoolean(routeForm.timeoutFallbackEnabled),
      timeoutMs: Number(routeForm.timeoutMs) || undefined,
      routeExplainEnabled: toBoolean(routeForm.routeExplainEnabled),
      policyStatus: routeForm.policyStatus,
      remark: routeForm.remark.trim() || undefined,
      items: routeItems.value.map(item => ({
        id: getEntityId(item, ['id']).startsWith('local-') ? undefined : getEntityId(item, ['id']),
        mappingId: getEntityId(item, ['mappingId']),
        supplierId: getEntityId(item, ['supplierId']),
        priorityNo: Number(item.priorityNo) || 1,
        weightValue: item.weightValue ?? undefined,
        candidateStatus: pickValue(item, ['candidateStatus'], 'ACTIVE'),
        minSuccessRate: item.minSuccessRate ?? undefined,
        maxTimeoutMs: item.maxTimeoutMs ?? undefined,
        maxPurchasePriceFen: item.maxPurchasePriceFen ?? undefined,
        allowFallback: toBoolean(item.allowFallback),
        remark: pickValue(item, ['remark'], '')
      }))
    }) as Api.Admin.SaveProductRoutePolicyPayload);

    window.$message?.success('路由策略已保存');
    await Promise.all([loadRoutePolicy(), loadChannelPrices()]);
  } finally {
    routeSubmitting.value = false;
  }
}

async function submitRoutePreview() {
  previewLoading.value = true;

  try {
    const data = await previewProductRoute(
      productId.value,
      normalizeQuery({
        channelId: previewForm.channelId || undefined,
        mobile: previewForm.mobile?.trim() || undefined,
        faceValue: previewForm.faceValue || undefined,
        productType: previewForm.productType || undefined,
        carrierCode: previewForm.carrierCode || undefined,
        provinceName: previewForm.provinceName?.trim() || undefined
      }) as Api.Admin.ProductRoutePreviewPayload
    );

    routePreview.value = extractObjectData(data);
    window.$message?.success('路由预览已生成');
  } finally {
    previewLoading.value = false;
  }
}

const mappingColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'supplierName', title: '供应商', render: row => pickValue(row, ['supplierName']) },
  { key: 'supplierProductCode', title: '供应商商品编码', render: row => pickValue(row, ['supplierProductCode']) },
  { key: 'supplierProductName', title: '供应商商品名称', render: row => pickValue(row, ['supplierProductName', 'productName']) },
  { key: 'purchasePriceFen', title: '采购折扣价', render: row => formatAmountFen(row.purchasePriceFen ?? row.costPriceFen) },
  { key: 'priorityNo', title: '优先级', render: row => pickValue(row, ['priorityNo']) },
  {
    key: 'flags',
    title: '路由标记',
    render: row =>
      h(NSpace, { size: 6 }, () => [
        toBoolean(row.isDefault) ? h(NTag, { type: 'success', size: 'small' }, { default: () => '默认' }) : null,
        toBoolean(row.isFallback) ? h(NTag, { type: 'warning', size: 'small' }, { default: () => '候补' }) : null
      ])
  },
  { key: 'mappingStatus', title: '状态', render: row => pickValue(row, ['mappingStatus', 'status']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => openEditMapping(row) },
          { default: () => '编辑' }
        ),
        h(
          NButton,
          { size: 'small', type: 'error', ghost: true, onClick: () => removeMapping(row) },
          { default: () => '删除' }
        ),
        h(
          NButton,
          { size: 'small', quaternary: true, onClick: () => openRaw('供应商映射原始数据', row) },
          { default: () => '原始数据' }
        )
      ])
  }
]);

const platformPriceColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'priceType', title: '价格类型', render: row => pickValue(row, ['priceType']) },
  { key: 'saleAmountFen', title: '默认供货价', render: row => formatAmountFen(row.saleAmountFen ?? row.salePriceFen) },
  { key: 'minSaleAmountFen', title: '最低供货价', render: row => formatAmountFen(row.minSaleAmountFen) },
  { key: 'maxSaleAmountFen', title: '最高供货价', render: row => formatAmountFen(row.maxSaleAmountFen) },
  { key: 'pricingStatus', title: '状态', render: row => pickValue(row, ['pricingStatus', 'status']) },
  { key: 'effectiveFrom', title: '生效时间', render: row => pickValue(row, ['effectiveFrom']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => openEditPlatformPrice(row) },
          { default: () => '编辑' }
        ),
        h(
          NButton,
          { size: 'small', quaternary: true, onClick: () => openRaw('平台价格原始数据', row) },
          { default: () => '原始数据' }
        )
      ])
  }
]);

const channelPriceColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'channelName', title: '渠道', render: row => pickValue(row, ['channelName']) },
  { key: 'channelCode', title: '渠道编码', render: row => pickValue(row, ['channelCode']) },
  { key: 'supplyPriceFen', title: '渠道供货价', render: row => formatAmountFen(row.supplyPriceFen) },
  { key: 'bestPurchasePriceFen', title: '当前最优采购价', render: row => formatAmountFen(row.bestPurchasePriceFen) },
  {
    key: 'estimatedProfitFen',
    title: '预估毛利',
    render: row => {
      const value = Number(row.estimatedProfitFen);

      return h(
        'span',
        { class: value < 0 ? 'text-#dc2626 font-600' : 'text-#0f766e font-600' },
        formatAmountFen(value)
      );
    }
  },
  { key: 'status', title: '状态', render: row => pickValue(row, ['status']) },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(
        NButton,
        { size: 'small', quaternary: true, onClick: () => openRaw('渠道供货价原始策略', row.rawPolicy ?? row) },
        { default: () => '原始数据' }
      )
  }
]);

const routeItemColumns = computed<DataTableColumns<Api.Admin.RawRecord>>(() => [
  { key: 'supplierName', title: '供应商', render: row => pickValue(row, ['supplierName']) },
  { key: 'supplierProductCode', title: '供应商商品编码', render: row => pickValue(row, ['supplierProductCode']) },
  { key: 'priorityNo', title: '优先级', render: row => pickValue(row, ['priorityNo']) },
  { key: 'weightValue', title: '权重', render: row => pickValue(row, ['weightValue']) },
  { key: 'candidateStatus', title: '状态', render: row => pickValue(row, ['candidateStatus']) },
  { key: 'maxPurchasePriceFen', title: '采购价上限', render: row => formatAmountFen(row.maxPurchasePriceFen) },
  {
    key: 'allowFallback',
    title: '允许候补',
    render: row => (toBoolean(row.allowFallback) ? '是' : '否')
  },
  {
    key: 'actions',
    title: '操作',
    render: row =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          { size: 'small', type: 'primary', ghost: true, onClick: () => openEditRouteItem(row) },
          { default: () => '编辑' }
        ),
        h(
          NButton,
          { size: 'small', type: 'error', ghost: true, onClick: () => removeRouteItem(row) },
          { default: () => '移除' }
        )
      ])
  }
]);

const previewCandidateColumns: DataTableColumns<Api.Admin.RawRecord> = [
  { key: 'supplierName', title: '候选供应商', render: row => pickValue(row, ['supplierName']) },
  { key: 'supplierProductCode', title: '供应商商品编码', render: row => pickValue(row, ['supplierProductCode']) },
  { key: 'purchasePriceFen', title: '采购价', render: row => formatAmountFen(row.purchasePriceFen ?? row.costPriceFen) },
  { key: 'estimatedProfitFen', title: '预估毛利', render: row => formatAmountFen(row.estimatedProfitFen) },
  { key: 'available', title: '可售', render: row => (toBoolean(row.available) ? '是' : '否') },
  { key: 'reason', title: '说明', render: row => pickValue(row, ['reason', 'message']) }
];

onMounted(() => {
  channelPriceForm.productId = productId.value;
  reloadAll();
});
</script>

<template>
  <NSpace vertical :size="16">
    <NCard :bordered="false" class="card-wrapper" :loading="loading">
      <div class="flex flex-col gap-8px lg:flex-row lg:items-center lg:justify-between">
        <div class="flex flex-col gap-6px">
          <h2 class="m-0 text-24px text-#0f172a font-700">
            {{ pickValue(product, ['productName'], '商品详情') }}
          </h2>
          <span class="text-14px text-#64748b">
            商品编码：{{ pickValue(product, ['productCode']) }} | 运营商：{{ pickValue(product, ['carrierCode']) }} | 省份：{{
              pickValue(product, ['provinceName'])
            }}
          </span>
        </div>
        <NSpace>
          <NTag type="info" round>当前默认供货价：{{ currentDefaultSupplyPrice }}</NTag>
          <NTag type="success" round>当前最优采购价：{{ bestPurchasePriceText }}</NTag>
          <NButton @click="reloadAll">刷新详情</NButton>
        </NSpace>
      </div>
    </NCard>

    <NGrid cols="1 l:3" responsive="screen" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="基础概览" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="商品名称">{{ pickValue(product, ['productName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="商品编码">{{ pickValue(product, ['productCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="运营商">{{ pickValue(product, ['carrierCode']) }}</NDescriptionsItem>
            <NDescriptionsItem label="省份">{{ pickValue(product, ['provinceName']) }}</NDescriptionsItem>
            <NDescriptionsItem label="面值">{{ formatAmountFen(product.faceValueAmountFen) }}</NDescriptionsItem>
            <NDescriptionsItem label="类型">{{ pickValue(product, ['productType']) }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="供货概览" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="映射供应商数">{{ mappingRows.length }}</NDescriptionsItem>
            <NDescriptionsItem label="默认映射">{{ mappingRows.filter(item => toBoolean(item.isDefault)).length }}</NDescriptionsItem>
            <NDescriptionsItem label="候补映射">{{ mappingRows.filter(item => toBoolean(item.isFallback)).length }}</NDescriptionsItem>
            <NDescriptionsItem label="平台默认供货价">{{ currentDefaultSupplyPrice }}</NDescriptionsItem>
            <NDescriptionsItem label="当前最优采购价">{{ bestPurchasePriceText }}</NDescriptionsItem>
            <NDescriptionsItem label="渠道报价数">{{ channelPriceRows.length }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="路由概览" :bordered="false" class="card-wrapper">
          <NDescriptions label-placement="left" bordered :column="1">
            <NDescriptionsItem label="路由模式">{{ routeForm.routeMode }}</NDescriptionsItem>
            <NDescriptionsItem label="利润优先">{{ routeForm.profitSortEnabled ? '启用' : '关闭' }}</NDescriptionsItem>
            <NDescriptionsItem label="库存校验">{{ routeForm.inventoryCheckEnabled ? '启用' : '关闭' }}</NDescriptionsItem>
            <NDescriptionsItem label="失败切换">{{ routeForm.failoverEnabled ? '启用' : '关闭' }}</NDescriptionsItem>
            <NDescriptionsItem label="候选队列">{{ routeItems.length }}</NDescriptionsItem>
            <NDescriptionsItem label="营销折扣规则">{{ discountRules.length }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
    </NGrid>

    <NTabs type="line" animated>
      <NTabPane name="basic" tab="基础信息">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NCard title="编辑商品信息" :bordered="false" class="card-wrapper">
              <NForm ref="basicFormRef" :model="basicForm" :rules="basicRules" label-placement="left" label-width="104">
                <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                  <NGi>
                    <NFormItem label="商品编码" path="productCode">
                      <NInput v-model:value="basicForm.productCode" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="商品名称" path="productName">
                      <NInput v-model:value="basicForm.productName" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="运营商">
                      <NSelect v-model:value="basicForm.carrierCode" :options="carrierOptions" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="省份" path="provinceName">
                      <NInput v-model:value="basicForm.provinceName" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="面值" path="faceValue">
                      <NInputNumber v-model:value="basicForm.faceValue" :min="0.01" class="w-full" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="商品类型">
                      <NSelect v-model:value="basicForm.productType" :options="productTypeOptions" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="销售单位" path="salesUnit">
                      <NInput v-model:value="basicForm.salesUnit" />
                    </NFormItem>
                  </NGi>
                  <NGi>
                    <NFormItem label="状态">
                      <NSelect v-model:value="basicForm.status" :options="statusOptions" />
                    </NFormItem>
                  </NGi>
                </NGrid>
                <NButton type="primary" :loading="savingBasic" @click="handleSaveBasic">保存商品</NButton>
              </NForm>
            </NCard>
          </NGi>
          <NGi>
            <NSpace vertical :size="16">
              <RawJsonCard title="商品详情原始 JSON" :value="product" />
              <RawJsonCard title="营销折扣规则原始 JSON" :value="discountRules" />
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="mappings" tab="供应商映射">
        <NCard :bordered="false" class="card-wrapper">
          <div class="mb-16px flex flex-wrap justify-between gap-12px">
            <div class="text-14px text-#64748b">
              同一个平台商品可以挂多个供应商商品，系统将根据利润优先、库存可售和候补顺序进行选择。
            </div>
            <NButton type="primary" @click="openCreateMapping">新增供应商映射</NButton>
          </div>

          <NDataTable
            :columns="mappingColumns"
            :data="mappingRows"
            :loading="mappingsLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="row => getEntityId(row, ['mappingId', 'id'])"
          />
        </NCard>
      </NTabPane>

      <NTabPane name="pricing" tab="供货价格">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="平台默认供货价" :bordered="false" class="card-wrapper">
                <div class="mb-16px flex justify-end">
                  <NButton type="primary" @click="openCreatePlatformPrice">新增默认供货价</NButton>
                </div>
                <NDataTable
                  :columns="platformPriceColumns"
                  :data="platformPriceRows"
                  :loading="platformPricesLoading"
                  :pagination="{ pageSize: 8 }"
                  :row-key="row => getEntityId(row, ['priceId', 'id'])"
                />
              </NCard>

              <NCard title="渠道供货价配置" :bordered="false" class="card-wrapper">
                <NForm
                  ref="channelPriceFormRef"
                  :model="channelPriceForm"
                  :rules="channelPriceRules"
                  label-placement="left"
                  label-width="110"
                >
                  <NFormItem label="渠道" path="channelId">
                    <NSelect v-model:value="channelPriceForm.channelId" :options="channelOptions" />
                  </NFormItem>
                  <NFormItem label="供货价(分)" path="salePrice">
                    <NInputNumber v-model:value="channelPriceForm.salePrice" :min="0" class="w-full" />
                  </NFormItem>
                  <div class="mb-12px text-13px text-#64748b">
                    当前最优采购价：{{ bestPurchasePriceText }}。系统将优先消耗高利润、库存可售的供应商货源。
                  </div>
                  <NButton type="primary" :loading="channelPriceSubmitting" @click="submitChannelPrice">保存渠道供货价</NButton>
                </NForm>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NCard title="渠道供货价列表" :bordered="false" class="card-wrapper">
              <NDataTable
                :columns="channelPriceColumns"
                :data="channelPriceRows"
                :loading="channelPricesLoading"
                :pagination="{ pageSize: 10 }"
                :row-key="row => getEntityId(row, ['id'])"
              />
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>

      <NTabPane name="route" tab="路由策略">
        <NGrid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16">
          <NGi>
            <NSpace vertical :size="16">
              <NCard title="路由主策略" :bordered="false" class="card-wrapper">
                <NForm ref="routeFormRef" :model="routeForm" :rules="routeRules" label-placement="left" label-width="120">
                  <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                    <NGi>
                      <NFormItem label="策略编码">
                        <NInput v-model:value="routeForm.policyCode" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="策略名称" path="policyName">
                        <NInput v-model:value="routeForm.policyName" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="路由模式">
                        <NSelect v-model:value="routeForm.routeMode" :options="routeModeOptions" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="策略状态">
                        <NSelect v-model:value="routeForm.policyStatus" :options="pricingStatusOptions" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="采购价上限">
                        <NInputNumber v-model:value="routeForm.maxPurchasePriceFen" :min="0" class="w-full" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="超时阈值(ms)">
                        <NInputNumber v-model:value="routeForm.timeoutMs" :min="0" class="w-full" />
                      </NFormItem>
                    </NGi>
                  </NGrid>

                  <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                    <NGi>
                      <NFormItem label="失败切换"><NSwitch v-model:value="routeForm.failoverEnabled" /></NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="价格保护"><NSwitch v-model:value="routeForm.priceProtectEnabled" /></NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="利润排序"><NSwitch v-model:value="routeForm.profitSortEnabled" /></NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="库存校验"><NSwitch v-model:value="routeForm.inventoryCheckEnabled" /></NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="健康度校验"><NSwitch v-model:value="routeForm.supplierHealthCheckEnabled" /></NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="超时候补"><NSwitch v-model:value="routeForm.timeoutFallbackEnabled" /></NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="记录解释"><NSwitch v-model:value="routeForm.routeExplainEnabled" /></NFormItem>
                    </NGi>
                  </NGrid>

                  <NFormItem label="备注">
                    <NInput v-model:value="routeForm.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
                  </NFormItem>
                </NForm>
              </NCard>

              <NCard title="候选供应商队列" :bordered="false" class="card-wrapper">
                <div class="mb-16px flex justify-end">
                  <NButton type="primary" @click="openCreateRouteItem">新增候选项</NButton>
                </div>
                <NDataTable
                  :columns="routeItemColumns"
                  :data="routeItems"
                  :loading="routeLoading"
                  :pagination="{ pageSize: 8 }"
                  :row-key="row => getEntityId(row, ['id'])"
                />
                <div class="mt-16px">
                  <NButton type="primary" :loading="routeSubmitting" @click="submitRoutePolicy">保存路由策略</NButton>
                </div>
              </NCard>
            </NSpace>
          </NGi>

          <NGi>
            <NSpace vertical :size="16">
              <NCard title="路由预览" :bordered="false" class="card-wrapper">
                <NForm
                  ref="previewFormRef"
                  :model="previewForm"
                  label-placement="left"
                  label-width="110"
                >
                  <NFormItem label="渠道">
                    <NSelect v-model:value="previewForm.channelId" :options="channelOptions" clearable />
                  </NFormItem>
                  <NFormItem label="手机号">
                    <NInput v-model:value="previewForm.mobile" placeholder="可选，用于模拟真实匹配" />
                  </NFormItem>
                  <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                    <NGi>
                      <NFormItem label="面值(分)">
                        <NInputNumber v-model:value="previewForm.faceValue" :min="1" class="w-full" />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="商品类型">
                        <NSelect v-model:value="previewForm.productType" :options="productTypeOptions" clearable />
                      </NFormItem>
                    </NGi>
                  </NGrid>
                  <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
                    <NGi>
                      <NFormItem label="运营商">
                        <NSelect v-model:value="previewForm.carrierCode" :options="carrierOptions" clearable />
                      </NFormItem>
                    </NGi>
                    <NGi>
                      <NFormItem label="省份">
                        <NInput v-model:value="previewForm.provinceName" />
                      </NFormItem>
                    </NGi>
                  </NGrid>
                  <NButton type="primary" :loading="previewLoading" @click="submitRoutePreview">执行路由预览</NButton>
                </NForm>

                <div class="mt-16px rounded-8px bg-#f8fafc p-12px text-14px text-#475569">
                  当前推荐模式为“利润优先”。系统会综合渠道供货价、采购价、库存状态、供应商健康度和候补顺序给出最终路由。
                </div>
              </NCard>

              <NCard title="预览结果" :bordered="false" class="card-wrapper">
                <NDescriptions label-placement="left" bordered :column="1" class="mb-16px">
                  <NDescriptionsItem label="最终供应商">
                    {{ pickValue(selectedRouteSupplier, ['supplierName', 'name']) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="最终商品编码">
                    {{ pickValue(selectedRouteSupplier, ['supplierProductCode']) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="预计采购价">
                    {{ formatAmountFen(selectedRouteSupplier.purchasePriceFen ?? selectedRouteSupplier.costPriceFen) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="预计渠道供货价">
                    {{ formatAmountFen(routePreview.supplyPriceFen ?? routePreview.saleAmountFen) }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="预计毛利">
                    {{ formatAmountFen(routePreview.estimatedProfitFen ?? routePreview.grossProfitAmountFen) }}
                  </NDescriptionsItem>
                </NDescriptions>

                <NDataTable
                  :columns="previewCandidateColumns"
                  :data="routePreviewCandidates"
                  :pagination="{ pageSize: 6 }"
                  :row-key="row => getEntityId(row, ['id', 'supplierId', 'supplierProductCode'])"
                />

                <div class="mt-16px">
                  <RawJsonCard title="路由预览原始 JSON" :value="routePreview" />
                </div>
              </NCard>
            </NSpace>
          </NGi>
        </NGrid>
      </NTabPane>
    </NTabs>

    <NModal v-model:show="mappingModalVisible" preset="card" :title="editingMappingId ? '编辑供应商映射' : '新增供应商映射'" class="w-760px">
      <NForm ref="mappingFormRef" :model="mappingForm" :rules="mappingRules" label-placement="left" label-width="120">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="供应商" path="supplierId">
              <NSelect v-model:value="mappingForm.supplierId" :options="supplierOptions" @update:value="handleSupplierChange" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="供应商商品" path="supplierProductId">
              <NSelect v-model:value="mappingForm.supplierProductId" :options="supplierProductOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="匹配方式">
              <NInput v-model:value="mappingForm.matchMode" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="优先级">
              <NInputNumber v-model:value="mappingForm.priorityNo" :min="1" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="采购价模式">
              <NInput v-model:value="mappingForm.purchasePriceMode" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="采购折扣价(分)">
              <NInputNumber v-model:value="mappingForm.purchasePriceFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="路由权重">
              <NInputNumber v-model:value="mappingForm.routeWeight" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NSelect v-model:value="mappingForm.mappingStatus" :options="mappingStatusOptions" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="生效时间">
              <NDatePicker v-model:value="mappingForm.effectiveRange" type="datetimerange" clearable class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="默认映射">
              <NSwitch v-model:value="mappingForm.isDefault" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="候补映射">
              <NSwitch v-model:value="mappingForm.isFallback" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="备注">
          <NInput v-model:value="mappingForm.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="mappingModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="mappingSubmitting" @click="submitMapping">保存</NButton>
        </div>
      </template>
    </NModal>

    <NModal
      v-model:show="platformPriceModalVisible"
      preset="card"
      :title="editingPlatformPriceId ? '编辑平台默认供货价' : '新增平台默认供货价'"
      class="w-760px"
    >
      <NForm
        ref="platformPriceFormRef"
        :model="platformPriceForm"
        :rules="platformPriceRules"
        label-placement="left"
        label-width="120"
      >
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi>
            <NFormItem label="价格类型">
              <NSelect v-model:value="platformPriceForm.priceType" :options="priceTypeOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="币种">
              <NInput v-model:value="platformPriceForm.currency" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="默认供货价(分)" path="saleAmountFen">
              <NInputNumber v-model:value="platformPriceForm.saleAmountFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="最低供货价(分)">
              <NInputNumber v-model:value="platformPriceForm.minSaleAmountFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="最高供货价(分)">
              <NInputNumber v-model:value="platformPriceForm.maxSaleAmountFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="毛利模式">
              <NInput v-model:value="platformPriceForm.grossProfitMode" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="毛利值">
              <NInputNumber v-model:value="platformPriceForm.grossProfitValue" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态">
              <NSelect v-model:value="platformPriceForm.pricingStatus" :options="pricingStatusOptions" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="生效时间">
              <NDatePicker v-model:value="platformPriceForm.effectiveRange" type="datetimerange" clearable class="w-full" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="备注">
          <NInput v-model:value="platformPriceForm.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="platformPriceModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="platformPriceSubmitting" @click="submitPlatformPrice">保存</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="routeItemModalVisible" preset="card" :title="editingRouteItemId ? '编辑候选供应商' : '新增候选供应商'" class="w-720px">
      <NForm ref="routeItemFormRef" :model="routeItemForm" :rules="routeItemRules" label-placement="left" label-width="120">
        <NGrid cols="1 s:2" responsive="screen" :x-gap="16">
          <NGi span="2">
            <NFormItem label="供应商映射" path="mappingId">
              <NSelect v-model:value="routeItemForm.mappingId" :options="mappingOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="优先级">
              <NInputNumber v-model:value="routeItemForm.priorityNo" :min="1" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="权重">
              <NInputNumber v-model:value="routeItemForm.weightValue" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="候选状态">
              <NSelect v-model:value="routeItemForm.candidateStatus" :options="mappingStatusOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="最小成功率">
              <NInputNumber v-model:value="routeItemForm.minSuccessRate" :min="0" :max="1" :step="0.01" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="最大超时(ms)">
              <NInputNumber v-model:value="routeItemForm.maxTimeoutMs" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="采购价上限(分)">
              <NInputNumber v-model:value="routeItemForm.maxPurchasePriceFen" :min="0" class="w-full" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="允许候补">
              <NSwitch v-model:value="routeItemForm.allowFallback" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="备注">
          <NInput v-model:value="routeItemForm.remark" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <NButton @click="routeItemModalVisible = false">取消</NButton>
          <NButton type="primary" @click="submitRouteItem">保存</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="rawVisible" preset="card" :title="rawTitle" class="w-760px">
      <NCode :code="toPrettyJson(rawRecord)" language="json" word-wrap />
    </NModal>
  </NSpace>
</template>
