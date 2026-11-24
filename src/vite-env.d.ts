/// <reference types="vite/client" />

declare module 'virtual:sites-assets' {
  export const assets: ReadonlyMap<string, { body: string; mime: string }>;
}
