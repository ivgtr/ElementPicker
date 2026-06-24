import type { CopyFormat } from '@/shared/messages';

export type CopyMode = 'direct' | 'confirm';

export type PickerSettings = {
  defaultFormat: CopyFormat;
  copyMode: CopyMode;
};

export const PICKER_SETTINGS_STORAGE_KEY = 'element-picker:settings';

export const DEFAULT_PICKER_SETTINGS: PickerSettings = {
  defaultFormat: 'markdown',
  copyMode: 'confirm',
};

export const loadPickerSettings = async (): Promise<PickerSettings> => {
  const storedValue = await getStoredSettings();

  if (!isPartialPickerSettings(storedValue)) {
    return DEFAULT_PICKER_SETTINGS;
  }

  return {
    ...DEFAULT_PICKER_SETTINGS,
    ...(isCopyFormat(storedValue.defaultFormat)
      ? { defaultFormat: storedValue.defaultFormat }
      : {}),
    ...(isCopyMode(storedValue.copyMode) ? { copyMode: storedValue.copyMode } : {}),
  };
};

export const savePickerSettings = async (settings: PickerSettings): Promise<void> => {
  if (!isPickerSettings(settings)) {
    throw new Error('Invalid picker settings.');
  }

  await setStoredSettings(settings);
};

const getStoredSettings = async (): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(PICKER_SETTINGS_STORAGE_KEY, (items) => {
      const error = getRuntimeLastError();

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(items[PICKER_SETTINGS_STORAGE_KEY]);
    });
  });
};

const setStoredSettings = async (settings: PickerSettings): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [PICKER_SETTINGS_STORAGE_KEY]: settings }, () => {
      const error = getRuntimeLastError();

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
};

const isPickerSettings = (value: unknown): value is PickerSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'defaultFormat' in value &&
    isCopyFormat(value.defaultFormat) &&
    'copyMode' in value &&
    isCopyMode(value.copyMode)
  );
};

const isPartialPickerSettings = (
  value: unknown
): value is Partial<PickerSettings> => {
  return typeof value === 'object' && value !== null;
};

const isCopyFormat = (value: unknown): value is CopyFormat => {
  return value === 'html' || value === 'markdown' || value === 'text';
};

const isCopyMode = (value: unknown): value is CopyMode => {
  return value === 'direct' || value === 'confirm';
};

const getRuntimeLastError = (): { message?: string } | undefined => {
  return (chrome.runtime as typeof chrome.runtime & { lastError?: { message?: string } })
    .lastError;
};
