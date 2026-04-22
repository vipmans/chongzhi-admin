declare namespace Api {
  namespace Auth {
    type AdminDataScope = 'ALL' | 'SELF_CREATED' | 'SELF_ASSIGNED';

    interface LoginUser {
      id?: string;
      username?: string;
      displayName?: string;
      status?: string;
      primaryRoleCode?: string | null;
      roleCodes?: string[];
      permissionCodes?: string[];
      menuCodes?: string[];
      dataScope?: AdminDataScope | null;
    }

    interface LoginToken {
      accessToken: string;
      refreshToken: string;
      expiresInSeconds?: number;
      user?: LoginUser;
    }

    interface PortalMe {
      channelId: string;
      channelCode: string;
      channelName: string;
      status: string;
      roleCodes: string[];
      permissions: string[];
    }

    interface PortalLoginToken {
      accessToken: string;
      expiresInSeconds?: number;
      me: PortalMe;
    }

    interface SessionUser {
      userName: string;
      displayName?: string;
      primaryRoleCode?: string | null;
      roleCodes: string[];
      permissionCodes: string[];
      menuCodes: string[];
      dataScope?: AdminDataScope | null;
    }
  }
}
