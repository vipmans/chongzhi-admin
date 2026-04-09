declare namespace Api {
  namespace Auth {
    interface LoginUser {
      id?: string;
      username?: string;
      displayName?: string;
      status?: string;
      roleCodes?: string[];
    }

    interface LoginToken {
      accessToken: string;
      refreshToken: string;
      expiresInSeconds?: number;
      user?: LoginUser;
    }

    interface SessionUser {
      userName: string;
    }
  }
}
