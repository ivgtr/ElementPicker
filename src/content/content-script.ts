import { isElementPickerMessage } from '@/shared/messages';
import type { PickerController } from './picker-controller';

const globalKey = '__ELEMENT_PICKER_CONTROLLER__';

type ElementPickerWindow = Window & {
  [globalKey]?: PickerController;
};

const pickerWindow = window as ElementPickerWindow;

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isElementPickerMessage(message)) {
    return;
  }

  void startPicker();
});

const startPicker = async (): Promise<void> => {
  const { PickerController } = await import('./picker-controller');

  pickerWindow[globalKey] ??= new PickerController();
  pickerWindow[globalKey]?.start();
};
