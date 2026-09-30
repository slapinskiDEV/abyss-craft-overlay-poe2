// CI (spec 011): the build's app version is <major>.<minor> from package.json plus the CI run number
// as patch, so every published build is newer than the last one for the updater.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const run = process.argv[2];
if (!run || !/^\d+$/.test(run)) throw new Error('usage: set-build-version <run number>');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const [major, minor] = pkg.version.split('.');
pkg.version = `${major}.${minor}.${run}`;
writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${pkg.version}\n`);
console.log(`version ${pkg.version}`);
