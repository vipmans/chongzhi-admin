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
      displayName: string;
      email?: string;
    }

    interface CreateRolePayload {
      roleCode: string;
      roleName: string;
    }

    interface CreateChannelPayload {
      channelCode: string;
      channelName: string;
      channelType: string;
    }

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

    interface SaveChannelLimitPayload {
      channelId: string;
      singleLimit: number;
      dailyLimit: number;
      monthlyLimit: number;
      qpsLimit: number;
    }

    interface RechargeChannelPayload {
      amount: number;
      remark?: string;
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
