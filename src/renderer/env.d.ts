import type { OverlayApi } from '../preload/api-types';

declare global {
  interface Window {
    overlayApi: OverlayApi;
  }
}
export {};
