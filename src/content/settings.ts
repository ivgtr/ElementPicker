import type { CopyFormat } from '@/shared/messages';

export type PickerSettings = {
  defaultFormat: CopyFormat;
};

export const PICKER_SETTINGS_STORAGE_KEY = 'element-picker:settings';

export const DEFAULT_PICKER_SETTINGS: PickerSettings = {
  defaultFormat: 'markdown',
};

export const loadPickerSettings = async (): Promise<PickerSettings> => {
  const storedValue = await getStoredSettings();

  if (!isPickerSettings(storedValue)) {
    return DEFAULT_PICKER_SETTINGS;
  }

  return {
    ...DEFAULT_PICKER_SETTINGS,
    defaultFormat: storedValue.defaultFormat,
  };
};

export const savePickerSettings = async (settings: PickerSettings): Promise<void> => {
  await setStoredSettings(settings);
};

const getStoredSettings = async (): Promise<unknown> => {
  const items = await chrome.storage.local.get(PICKER_SETTINGS_STORAGE_KEY);
  return items[PICKER_SETTINGS_STORAGE_KEY];
};

const setStoredSettings = async (settings: PickerSettings): Promise<void> => {
  await chrome.storage.local.set({ [PICKER_SETTINGS_STORAGE_KEY]: settings });
};

const isPickerSettings = (value: unknown): value is PickerSettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'defaultFormat' in value &&
    isCopyFormat(value.defaultFormat)
  );
};

const isCopyFormat = (value: unknown): value is CopyFormat => {
  return value === 'html' || value === 'markdown' || value === 'text';
};
