// Electron image of the app icon (app-icon.ts) with a 2x representation for high-DPI displays.
import { nativeImage, type NativeImage } from 'electron';
import { diamondPng } from './app-icon';

export function appIcon(size: number): NativeImage {
  const image = nativeImage.createFromBuffer(diamondPng(size));
  image.addRepresentation({ scaleFactor: 2, buffer: diamondPng(size * 2) });
  return image;
}
