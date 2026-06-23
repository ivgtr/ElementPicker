import { START_ELEMENT_PICKER } from '@/shared/messages';

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { type: START_ELEMENT_PICKER });
  } catch (error) {
    console.warn('[Element Picker] Failed to start element picker.', error);
  }
});
