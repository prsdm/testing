/// <reference types="vite/client" />

import type {} from "react";

interface ImportMetaEnv {
  readonly MODE: string;
  readonly VITE_IS_DEMO?: string;
  readonly VITE_PREVIEW_MODE?: string;
  readonly VITE_KIMIRO_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "react" {
  interface HTMLAttributes<T> {
    inert?: boolean;
  }
}
