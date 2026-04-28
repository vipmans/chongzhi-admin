/** The storage namespace */
declare namespace StorageType {
  interface Session {
    /** The theme color */
    themeColor: string;
  }

  interface Local {
    /** The i18n language */
    lang: App.I18n.LangType;
    /** The token */
    token: string;
    /** The refresh token */
    refreshToken: string;
    /** The access token expiry timestamp in ms */
    accessTokenExpiresAt: number;
    /** The refresh token expiry timestamp in ms */
    refreshTokenExpiresAt: number;
    /** The last auth activity timestamp in ms */
    lastAuthActivityAt: number;
    /** The current login username */
    loginUsername: string;
    /** The current login display name */
    loginDisplayName: string;
    /** The current login primary role */
    loginPrimaryRoleCode: string | null;
    /** The current login role codes */
    loginRoleCodes: string[];
    /** The current login permission codes */
    loginPermissionCodes: string[];
    /** The current login menu codes */
    loginMenuCodes: string[];
    /** The current login data scope */
    loginDataScope: Api.Auth.AdminDataScope | null;
    /** Fixed sider with mix-menu */
    mixSiderFixed: CommonType.YesOrNo;
    /** The theme color */
    themeColor: string;
    /** The dark mode */
    darkMode: boolean;
    /** The theme settings */
    themeSettings: App.Theme.ThemeSetting;
    /**
     * The override theme flags
     *
     * The value is the build time of the project
     */
    overrideThemeFlag: string;
    /** The global tabs */
    globalTabs: App.Global.Tab[];
    /** The backup theme setting before is mobile */
    backupThemeSettingBeforeIsMobile: {
      layout: UnionKey.ThemeLayoutMode;
      siderCollapse: boolean;
    };
  }
}
