/**
 * Runs automatically on `npm pack` / `npm install`: makes sure the bundled
 * skill's own dependency (undici) exists in skill/tools/node_modules, so the
 * packed tarball is fully self-contained (target machines install nothing).
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const undici = join(root, 'skill', 'tools', 'node_modules', 'undici');

if (!existsSync(undici)) {
  console.log('prepare: installing skill/tools dependencies (undici)...');
  execSync('npm install --no-audit --no-fund', { cwd: join(root, 'skill', 'tools'), stdio: 'inherit' });
} else {
  console.log('prepare: skill/tools dependencies already present');
}
