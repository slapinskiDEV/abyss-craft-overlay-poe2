// Writes the executable icon (electron-builder `win.icon`) from the same generator as the tray icon.
import { mkdirSync, writeFileSync } from 'node:fs';
import { diamondIco, diamondPng } from '../src/main/app-icon';

mkdirSync('build', { recursive: true });
writeFileSync('build/icon.ico', diamondIco());
writeFileSync('build/icon.png', diamondPng(256));
console.log('wrote build/icon.ico and build/icon.png');
