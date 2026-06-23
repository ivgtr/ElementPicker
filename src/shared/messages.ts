export const START_ELEMENT_PICKER = 'element-picker:start';

export type CopyFormat = 'html' | 'markdown' | 'text';

export type ElementPickerMessage = {
  type: typeof START_ELEMENT_PICKER;
};

export const isElementPickerMessage = (
  message: unknown
): message is ElementPickerMessage => {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === START_ELEMENT_PICKER
  );
};
