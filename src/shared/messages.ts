export const TOGGLE_ELEMENT_PICKER = 'element-picker:toggle';

export type CopyFormat = 'html' | 'markdown' | 'text';

export type ElementPickerMessage = {
  type: typeof TOGGLE_ELEMENT_PICKER;
};

export const isElementPickerMessage = (
  message: unknown
): message is ElementPickerMessage => {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === TOGGLE_ELEMENT_PICKER
  );
};
