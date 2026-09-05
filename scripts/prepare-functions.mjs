import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const runtimeRoot = join(projectRoot, 'functions', 'runtime-src');

const runtimeSourceFiles = Object.freeze([
  'src/services/trustedBookingCompensationExecution.js',
  'src/features/commissions/bookingCompensation.js',
  'src/features/commissions/compensationEngine.js',
  'src/features/commissions/compensationRules.js',
  'src/features/settings/operators.js',
  'src/lib/datetime/timestamps.js',
  'src/lib/money/idr.js',
  'src/lib/validation/indonesianPhone.js',
]);

await rm(runtimeRoot, { force: true, recursive: true });

for (const sourcePath of runtimeSourceFiles) {
  const source = join(projectRoot, sourcePath);
  const destination = join(runtimeRoot, relative('src', sourcePath));
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

console.log(`Prepared ${runtimeSourceFiles.length} trusted Functions runtime source files.`);
