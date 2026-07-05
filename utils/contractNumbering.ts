import { getSystemSetting, saveSystemSetting } from '../services/apiSystem';

export interface ContractNumberingConfig {
  prefix: string;
  suffix: string;
  pattern: string; // e.g. "{num}/HĐ-{suffix}", "HĐ-{year}/{num}", "{num}/HĐ-{year}", "{num}/HĐ", "HĐ-{year}-{num}"
  currentNumber: number; // Last issued number, next will be currentNumber + 1
  year: number;
  digits: number; // padding, e.g. 4 for 0015, or 0 for no padding (e.g. 15)
}

const STORAGE_KEY = 'contract_numbering_config';

export const DEFAULT_CONFIG: ContractNumberingConfig = {
  prefix: 'HĐ',
  suffix: 'CNHQ',
  pattern: '{num}/HĐKT/{year}',
  currentNumber: 0,
  year: new Date().getFullYear(),
  digits: 0 // No padding by default (e.g. 1/HĐ-CNHQ, 12/HĐ-CNHQ)
};

/**
 * Loads the contract numbering configuration from database or localStorage.
 */
export async function getContractNumberingConfig(): Promise<ContractNumberingConfig> {
  try {
    // 1. Try to get from database first
    const dbValue = await getSystemSetting(STORAGE_KEY);
    if (dbValue) {
      const parsed = JSON.parse(dbValue) as ContractNumberingConfig;
      if (parsed && typeof parsed.currentNumber === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read contract numbering config from DB:', e);
  }

  // 2. Fallback to localStorage
  try {
    const localValue = localStorage.getItem(STORAGE_KEY);
    if (localValue) {
      const parsed = JSON.parse(localValue) as ContractNumberingConfig;
      if (parsed && typeof parsed.currentNumber === 'number') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read contract numbering config from localStorage:', e);
  }

  return { ...DEFAULT_CONFIG, year: new Date().getFullYear() };
}

/**
 * Saves the contract numbering configuration to both DB and localStorage.
 */
export async function saveContractNumberingConfig(config: ContractNumberingConfig): Promise<boolean> {
  const serialized = JSON.stringify(config);
  
  // Save to localStorage immediately
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error('Error saving config to localStorage:', e);
  }

  // Save to Cloud DB
  try {
    const success = await saveSystemSetting(STORAGE_KEY, serialized);
    return success;
  } catch (e) {
    console.error('Error saving config to DB:', e);
    return false;
  }
}

/**
 * Formats a raw number into the contract code style per the configuration.
 */
export function formatContractCode(num: number, year: number, config: ContractNumberingConfig): string {
  const numStr = config.digits > 0 ? String(num).padStart(config.digits, '0') : String(num);
  const suffixStr = config.suffix || '';
  const prefixStr = config.prefix || 'HĐ';
  
  let formatted = config.pattern || '{num}/HĐKT/{year}';
  formatted = formatted
    .replace('{num}', numStr)
    .replace('{year}', String(year))
    .replace('{prefix}', prefixStr)
    .replace('{suffix}', suffixStr);

  return formatted;
}

/**
 * Checks for year rollover and returns the NEXT contract number and year.
 * Does NOT persist or save the config; it is a helper.
 */
export function peekNextContractCode(config: ContractNumberingConfig): { code: string, nextNum: number, nextYear: number } {
  const currentYear = new Date().getFullYear();
  let targetYear = config.year;
  let nextNum = config.currentNumber + 1;

  // Auto roll-over when the year changes
  if (currentYear !== config.year) {
    targetYear = currentYear;
    nextNum = 1; // reset to 1
  }

  const code = formatContractCode(nextNum, targetYear, {
    ...config,
    year: targetYear,
    currentNumber: nextNum
  });

  return {
    code,
    nextNum,
    nextYear: targetYear
  };
}

/**
 * Increments the contract counter and returns the generated code, persisting the state.
 */
export async function allocateNextContractCode(): Promise<string> {
  const config = await getContractNumberingConfig();
  const { code, nextNum, nextYear } = peekNextContractCode(config);

  // Update current counter and year
  config.currentNumber = nextNum;
  config.year = nextYear;

  await saveContractNumberingConfig(config);
  return code;
}
