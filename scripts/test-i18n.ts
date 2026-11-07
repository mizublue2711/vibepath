import { vi } from '../src/locales/vi';
import { en } from '../src/locales/en';

function getLeafKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      keys = keys.concat(getLeafKeys(obj[k], full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

const viKeys = getLeafKeys(vi);
const enKeys = getLeafKeys(en);

console.log(`Checking translation key parity... (${viKeys.length} keys total)`);

const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

if (missingInEn.length > 0 || missingInVi.length > 0) {
  console.error('FAILED: Translation keys do not match 1:1!');
  if (missingInEn.length > 0) console.error('Missing in en.ts:', missingInEn);
  if (missingInVi.length > 0) console.error('Missing in vi.ts:', missingInVi);
  process.exit(1);
}

// Check for empty or non-string values
for (const k of viKeys) {
  const getVal = (dict: any, path: string) =>
    path.split('.').reduce((acc, part) => acc?.[part], dict);
  const vVal = getVal(vi, k);
  const eVal = getVal(en, k);

  if (typeof vVal !== 'string' || vVal.trim() === '') {
    console.error(`FAILED: vi.ts has empty value for key: ${k}`);
    process.exit(1);
  }
  if (typeof eVal !== 'string' || eVal.trim() === '') {
    console.error(`FAILED: en.ts has empty value for key: ${k}`);
    process.exit(1);
  }
}

console.log('PASSED: 100% 1:1 key parity and non-empty values validated for all locales!');
