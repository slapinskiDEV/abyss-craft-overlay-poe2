// Bundled data-pack location (spec 008): app resources in production, the repo in development.
import { join } from 'node:path';

export function dataPackPath(env: { isPackaged: boolean; resourcesPath: string; appPath: string }): string {
  return env.isPackaged
    ? join(env.resourcesPath, 'data-pack', 'pack.json')
    : join(env.appPath, 'src', 'data', 'normalized', 'pack', 'pack.json');
}
