// Small typed settings store in userData (SoT §4.1). Corrupt files are backed up and reset.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AppSettings } from '../preload/api-types';
import { defaultSettings, mergeSettings, sanitizeSettings } from './settings-model';

export class SettingsStore {
  private current: AppSettings;
  private readonly defaults: AppSettings;
  private readonly file: string;

  constructor(userDataDir: string, osLocale: string) {
    this.file = join(userDataDir, 'settings.json');
    this.defaults = defaultSettings(osLocale);
    this.current = this.read();
  }

  get(): AppSettings {
    return this.current;
  }

  update(patch: unknown): AppSettings {
    this.current = mergeSettings(this.current, patch, this.defaults);
    this.write();
    return this.current;
  }

  private read(): AppSettings {
    if (!existsSync(this.file)) return this.defaults;
    try {
      return sanitizeSettings(JSON.parse(readFileSync(this.file, 'utf8')), this.defaults);
    } catch {
      copyFileSync(this.file, `${this.file}.bak`);
      return this.defaults;
    }
  }

  private write(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(this.current, null, 2)}\n`);
    renameSync(tmp, this.file);
  }
}
