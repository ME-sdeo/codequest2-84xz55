/// <reference types="vite/client" /> // Version: ^4.4.0

interface ImportMetaEnv {
  /**
   * Backend API endpoint URL
   */
  readonly VITE_API_URL: string;

  /**
   * WebSocket server URL for real-time updates
   */
  readonly VITE_WS_URL: string;

  /**
   * Azure DevOps client identifier
   */
  readonly VITE_ADO_CLIENT_ID: string;

  /**
   * Azure DevOps tenant identifier
   */
  readonly VITE_ADO_TENANT_ID: string;

  /**
   * Application environment (development/staging/production)
   */
  readonly VITE_ENVIRONMENT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Static asset imports
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.woff2' {
  const content: string;
  export default content;
}