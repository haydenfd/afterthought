import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);

const omit = new Set((process.env.npm_config_omit ?? '').split(',').filter(Boolean));
const devDependenciesOmitted = omit.has('dev') || process.env.NODE_ENV === 'production';

let electronDir;

try {
  electronDir = dirname(require.resolve('electron/package.json'));
} catch {
  if (devDependenciesOmitted) {
    process.exit(0);
  }

  console.error(
    'Electron is not installed. Run `npm install` before starting the app.',
  );
  process.exit(1);
}

const installedPath = getInstalledElectronPath(electronDir);

if (installedPath && existsSync(installedPath)) {
  process.exit(0);
}

const installScript = join(electronDir, 'install.js');
const result = spawnSync(process.execPath, [installScript], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

function getInstalledElectronPath(electronPackageDir) {
  try {
    const executablePath = readFileSync(join(electronPackageDir, 'path.txt'), 'utf8');

    return join(electronPackageDir, 'dist', executablePath);
  } catch {
    return null;
  }
}
