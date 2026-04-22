declare namespace Api {
  namespace Admin {
    type Primitive = string | number | boolean | null;

    type JsonValue = Primitive | JsonObject | JsonValue[];

    interface JsonObject {
      [key: string]: JsonValue;
    }

    interface RawRecord {
      [key: string]: any;
    }

    type RawList = RawRecord[];

    type SortOrder = 'asc' | 'desc';
    type DataScope = 'ALL' | 'SELF_CREATED' | 'SELF_ASSIGNED';
    type UserStatus = 'ACTIVE' | 'DISABLED';

    interface PagedQuery {
      pageNum?: number;
      pageSize?: number;
      keyword?: string;
      status?: string;
      startTime?: string;
      endTime?: string;
      sortBy?: string;
      sortOrder?: SortOrder;
    }

    interface PagedResponse<T = RawRecord> {
      records: T[];
      pageNum: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }

    interface ProductListQuery extends PagedQuery {
      carrierCode?: CarrierCode;
      productType?: ProductType;
      status?: ProductStatus;
    }

    interface ChannelListQuery extends PagedQuery {
      cooperationStatus?: string;
      protocolType?: string;
      channelType?: string;
    }

    interface OrderListQuery extends PagedQuery {
      orderNo?: string;
      channelOrderNo?: string;
      mobile?: string;
      channelId?: string;
      productId?: string;
      mainStatus?: string;
      supplierStatus?: string;
      notifyStatus?: string;
      refundStatus?: string;
      exceptionTag?: string;
      supplierOrderNo?: string;
    }

    interface OrderEventListQuery extends Omit<PagedQuery, 'keyword' | 'status'> {}

    interface LedgerEntryListQuery extends PagedQuery {
      accountId?: string;
      orderNo?: string;
      channelId?: string;
      entryType?: string;
      bizNo?: string;
    }

    interface NotificationTaskListQuery extends PagedQuery {
      taskNo?: string;
      bizNo?: string;
      deliveryStatus?: string;
    }

    interface DeliveryLogListQuery extends Omit<PagedQuery, 'keyword' | 'status'> {}

    interface SupplierListQuery extends Omit<PagedQuery, 'status' | 'startTime' | 'endTime'> {
      cooperationStatus?: string;
      healthStatus?: string;
      protocolType?: string;
    }

    interface SupplierProductListQuery {
      carrierCode?: CarrierCode | string;
      province?: string;
      faceValue?: number;
      status?: string;
      updatedStartTime?: string;
      updatedEndTime?: string;
    }

    interface ChannelProductListQuery {
      carrierCode?: CarrierCode | string;
      province?: string;
      faceValue?: number;
      status?: string;
    }

    interface SupplierConsumptionLogListQuery extends Omit<PagedQuery, 'keyword' | 'status' | 'sortBy' | 'sortOrder'> {
      mobile?: string;
      orderNo?: string;
      supplierOrderNo?: string;
    }

    type SupplierListResponse = PagedResponse<RawRecord> | RawList;

    interface LoginPayload {
      username: string;
      password: string;
    }

    interface RefreshPayload {
      refreshToken: string;
    }

    interface LogoutPayload {
      refreshToken: string;
    }

    interface CreateUserPayload {
      username: string;
      password: string;
      roleCode: string;
      displayName?: string;
      email?: string;
      mobile1?: string;
      mobile2?: string;
      wechat?: string;
      qq?: string;
      remark?: string;
      status?: UserStatus;
    }

    interface UpdateUserStatusPayload {
      status: UserStatus;
    }

    interface AssignUserRolePayload {
      roleCode: string;
    }

    interface CreateRolePayload {
      roleCode: string;
      roleName: string;
      permissionCodes?: string[];
      menuCodes?: string[];
      dataScope?: DataScope;
    }

    interface OpenChannelPortalAccountPayload {
      portalAccount: string;
      password: string;
    }

    interface RejectChannelPortalAccountPayload {
      reason: string;
    }

    interface ResetChannelPortalPasswordPayload {
      password: string;
    }

    interface SaveSupplierPayload {
      supplierCode?: string;
      supplierName: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      baseUrl?: string;
      protocolType: string;
      credentialMode?: string;
      accessAccount?: string;
      accessPassword?: string;
      cooperationStatus?: string;
      supportsBalanceQuery?: boolean;
      supportsRechargeRecords?: boolean;
      supportsConsumptionLog?: boolean;
      remark?: string;
      healthStatus?: string;
      status?: string;
    }

    interface CreateChannelPayload {
      channelCode: string;
      channelName: string;
      channelType: string;
      contactName?: string;
      contactPhone?: string;
      contactEmail?: string;
      baseUrl?: string;
      protocolType?: string;
      accessAccount?: string;
      accessPassword?: string;
      cooperationStatus?: string;
      supportsConsumptionLog?: boolean;
      settlementMode?: string;
      status?: string;
      remark?: string;
    }

    type SaveChannelPayload = CreateChannelPayload;

    interface CreateChannelApiKeyPayload {
      channelId: string;
      accessKey: string;
      secretKey: string;
    }

    interface SaveChannelCallbackConfigPayload {
      channelId: string;
      callbackUrl: string;
      signSecret: string;
      timeoutSeconds?: number;
    }

    interface SaveChannelProductPayload {
      channelId: string;
      productId: string;
    }

    interface SaveChannelPricePayload {
      channelId: string;
      productId: string;
      salePrice: number;
    }

    interface SaveProductSupplierMappingPayload {
      productId: string;
      supplierId: string;
      supplierProductId: string;
      supplierProductCode?: string;
      matchMode?: string;
      priorityNo?: number;
      isDefault?: boolean;
      isFallback?: boolean;
      purchasePriceMode?: string;
      purchasePriceFen?: number;
      routeWeight?: number;
      mappingStatus?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      remark?: string;
    }

    interface SaveProductPlatformPricePayload {
      productId: string;
      priceType: string;
      currency: string;
      saleAmountFen: number;
      minSaleAmountFen?: number;
      maxSaleAmountFen?: number;
      grossProfitMode?: string;
      grossProfitValue?: number;
      pricingStatus?: string;
      effectiveFrom?: string;
      effectiveTo?: string;
      remark?: string;
    }

    interface SaveProductRoutePolicyPayload {
      policyCode?: string;
      policyName?: string;
      routeMode: string;
      failoverEnabled?: boolean;
      priceProtectEnabled?: boolean;
      maxPurchasePriceFen?: number;
      profitSortEnabled?: boolean;
      inventoryCheckEnabled?: boolean;
      supplierHealthCheckEnabled?: boolean;
      timeoutFallbackEnabled?: boolean;
      timeoutMs?: number;
      routeExplainEnabled?: boolean;
      policyStatus?: string;
      remark?: string;
      items?: JsonObject[];
    }

    interface ProductRoutePreviewPayload {
      channelId?: string;
      mobile?: string;
      faceValue?: number;
      productType?: ProductType | string;
      carrierCode?: CarrierCode | string;
      provinceName?: string;
    }

    interface SaveChannelLimitPayload {
      channelId: string;
      singleLimit: number;
      dailyLimit: number;
      monthlyLimit: number;
      qpsLimit: number;
    }

    interface SaveChannelSplitPolicyPayload {
      enabled: boolean;
      allowedFaceValues: number[];
      preferMaxSingleFaceValue: boolean;
      maxSplitPieces: number;
      provinceOverride?: string;
      carrierOverride?: string;
    }

    interface RechargeChannelPayload {
      amount: number;
      remark?: string;
    }

    interface SupplierRechargeRecordPayload {
      rechargeType: string;
      amountFen: number;
      currency?: string;
      beforeBalanceFen?: number;
      afterBalanceFen?: number;
      recordSource: string;
      supplierTradeNo?: string;
      remark?: string;
      rawPayload?: JsonObject;
      status?: string;
    }

    interface SaveSupplierConfigPayload {
      supplierId: string;
      configJson: JsonObject;
      credential: string;
      callbackSecret: string;
      timeoutMs?: number;
    }

    type CarrierCode = 'CMCC' | 'CTCC' | 'CUCC' | 'CBN';

    type ProductType = 'FAST' | 'MIXED';

    type ProductStatus = 'ACTIVE' | 'INACTIVE';

    interface SaveProductPayload {
      productCode: string;
      productName: string;
      carrierCode: CarrierCode;
      provinceName: string;
      faceValue: number;
      productType: ProductType;
      salesUnit: string;
      status: ProductStatus;
    }

    interface SaveRiskRulePayload {
      ruleCode: string;
      ruleName: string;
      ruleType: string;
      configJson: JsonObject;
      priority?: number;
    }

    type ListType = 'BLACK' | 'WHITE';

    interface SaveBlackWhiteListPayload {
      entryType: string;
      targetValue: string;
      listType: ListType;
      remark?: string;
    }

    interface MarkOrderExceptionPayload {
      exceptionTag: string;
    }

    interface AddOrderRemarkPayload {
      remark: string;
    }
  }
}
