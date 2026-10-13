/** Injected by Vite from apps/web/package.json and git at build time (see vite.config.ts). */
export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";
export const APP_COMMIT: string | null = typeof __APP_COMMIT__ === "string" && __APP_COMMIT__ ? __APP_COMMIT__ : null;
