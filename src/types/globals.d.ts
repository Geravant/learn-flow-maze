// Global type definitions for WebContainer and other browser APIs

declare global {
  var __WS_TOKEN__: string | undefined;
  var global: typeof globalThis;
  
  interface Window {
    crossOriginIsolated?: boolean;
    global?: typeof globalThis;
  }
  
  namespace NodeJS {
    interface Global {
      __WS_TOKEN__?: string;
    }
  }
}

export {};