import { copySelectionToClipboard } from './copy';
import { isSelectableElement, moveSelection, type SelectionDirection } from './selection';
import {
  DEFAULT_PICKER_SETTINGS,
  loadPickerSettings,
  savePickerSettings,
  type CopyMode,
  type PickerSettings,
} from './settings';
import { PickerUi } from './ui';
import type { CopyFormat } from '@/shared/messages';

type PickerState = 'idle' | 'selecting' | 'selected' | 'copying';

export class PickerController {
  private state: PickerState = 'idle';
  private ui: PickerUi | null = null;
  private hoveredElement: HTMLElement | null = null;
  private selectedElement: HTMLElement | null = null;
  private settings: PickerSettings = DEFAULT_PICKER_SETTINGS;
  private settingsOpen = false;
  private startRequestId = 0;

  async start(): Promise<void> {
    const requestId = (this.startRequestId += 1);
    let didFallbackToDefaultSettings = false;

    if (this.ui) {
      this.cleanup();
    }

    try {
      this.settings = await loadPickerSettings();
    } catch (error) {
      console.warn('[Element Picker] Failed to load settings.', error);
      this.settings = { ...DEFAULT_PICKER_SETTINGS };
      didFallbackToDefaultSettings = true;
    }

    if (requestId !== this.startRequestId) {
      return;
    }

    this.state = 'selecting';
    this.ui = new PickerUi();
    this.ui.showShortcutHint();
    this.ui.showSettingsButton({
      onToggle: () => this.toggleSettingsPopup(),
    });
    this.addEventListeners();
    this.ui.showToast(
      didFallbackToDefaultSettings
        ? 'Failed to load settings. Using defaults.'
        : 'Select an element to copy.',
      didFallbackToDefaultSettings ? 'error' : 'info'
    );
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.state !== 'selecting' || this.ui?.isPickerEvent(event)) {
      return;
    }

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const element = this.findSelectableElement(target);

    if (!element) {
      this.hoveredElement = null;
      this.ui?.hideOverlay();
      return;
    }

    this.hoveredElement = element;
    this.ui?.showOverlay(element);
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.ui?.isPickerEvent(event)) {
      return;
    }

    if (this.state === 'selected') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.cancel();
      return;
    }

    if (this.state !== 'selecting') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const target =
      this.hoveredElement ??
      this.findSelectableElement(document.elementFromPoint(event.clientX, event.clientY));

    if (!target) {
      return;
    }

    this.confirmSelection(target, { x: event.clientX, y: event.clientY });
  };

  private readonly suppressPagePointerEvent = (event: MouseEvent): void => {
    if (!this.shouldBlockPageEvents() || this.ui?.isPickerEvent(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.state === 'idle') {
      return;
    }

    const selectionDirection = getSelectionDirection(event);

    if (selectionDirection) {
      if (this.ui?.isPickerEvent(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (!this.canMoveSelectionWithShortcut()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.moveSelectionWithShortcut(selectionDirection);
      return;
    }

    if (event.key === 'Enter') {
      if (this.ui?.isPickerEvent(event) || isEditableEventTarget(event.target)) {
        return;
      }

      if (this.state !== 'selecting') {
        return;
      }

      const target = this.hoveredElement;

      if (!target) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.confirmSelection(target);
      return;
    }

    if (event.key !== 'Escape') {
      return;
    }

    if (this.settingsOpen) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.closeSettingsPopup();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.cancel();
  };

  private readonly handleViewportChange = (): void => {
    if (this.state === 'selecting' && this.hoveredElement) {
      this.ui?.showOverlay(this.hoveredElement);
      return;
    }

    if (this.hasConfirmedSelection() && this.selectedElement) {
      this.ui?.showOverlay(this.selectedElement);
    }
  };

  private confirmSelection(element: HTMLElement, position?: { x: number; y: number }): void {
    this.selectedElement = element;
    this.state = 'selected';
    this.ui?.showOverlay(element);

    if (this.settings.copyMode === 'direct') {
      void this.copySelection(this.settings.defaultFormat);
      return;
    }

    this.showSelectedMenu(position);
  }

  private showSelectedMenu(position?: { x: number; y: number }): void {
    if (!this.selectedElement) {
      return;
    }

    this.ui?.showSelectedMenu(
      { target: this.selectedElement, position },
      {
        targetLabel: createElementLabel(this.selectedElement),
      },
      {
        onSelectFormat: (format) => {
          void this.copySelection(format);
        },
        onCancel: () => this.cancel(),
      }
    );
  }

  private toggleSettingsPopup(): void {
    if (this.settingsOpen) {
      this.closeSettingsPopup();
      return;
    }

    this.openSettingsPopup();
  }

  private openSettingsPopup(): void {
    if (this.state === 'idle' || this.state === 'copying') {
      return;
    }

    this.settingsOpen = true;
    this.showSettingsPopup();
  }

  private showSettingsPopup(): void {
    this.ui?.showSettingsPopup(
      {
        defaultFormat: this.settings.defaultFormat,
        copyMode: this.settings.copyMode,
      },
      {
        onSelectCopyMode: (copyMode) => {
          void this.updateCopyMode(copyMode);
        },
        onSelectDefaultFormat: (format) => {
          void this.updateDefaultFormat(format);
        },
        onClose: () => this.closeSettingsPopup(),
      }
    );
  }

  private async updateDefaultFormat(defaultFormat: CopyFormat): Promise<void> {
    await this.updateSettings({ defaultFormat });
  }

  private async updateCopyMode(copyMode: CopyMode): Promise<void> {
    await this.updateSettings({ copyMode });
  }

  private async updateSettings(settingsPatch: Partial<PickerSettings>): Promise<void> {
    if (!this.settingsOpen) {
      return;
    }

    const previousSettings = this.settings;
    this.settings = { ...this.settings, ...settingsPatch };
    this.showSettingsPopup();

    try {
      await savePickerSettings(this.settings);
    } catch (error) {
      console.warn('[Element Picker] Failed to save settings.', error);
      this.settings = previousSettings;
      this.showSettingsPopup();
      this.ui?.showToast('Failed to save settings.', 'error');
    }
  }

  private closeSettingsPopup(): void {
    if (!this.settingsOpen) {
      return;
    }

    this.settingsOpen = false;
    this.ui?.hideSettingsPopup();
  }

  private moveSelectionWithShortcut(direction: SelectionDirection): void {
    const currentElement =
      this.state === 'selecting' ? this.hoveredElement : this.selectedElement;

    if (!currentElement) {
      return;
    }

    const nextElement = moveSelection(currentElement, direction, this.getSelectionOptions());

    if (!nextElement) {
      return;
    }

    if (this.state === 'selecting') {
      this.hoveredElement = nextElement;
    } else {
      this.selectedElement = nextElement;
    }

    this.ui?.showOverlay(nextElement);

    if (this.state === 'selected') {
      this.showSelectedMenu();
    }
  }

  private async copySelection(format: CopyFormat): Promise<void> {
    if (!this.selectedElement || this.state !== 'selected') {
      return;
    }

    this.state = 'copying';
    this.ui?.hidePanel();
    this.ui?.hideSettingsPopup();
    this.ui?.hideSettingsButton();
    this.settingsOpen = false;

    try {
      await copySelectionToClipboard(this.selectedElement, format);
      this.ui?.showToast(`${getCopyFormatLabel(format)} copied`, 'success');
      this.finishAfterToast();
    } catch (error) {
      console.warn('[Element Picker] Failed to copy selection.', error);
      this.ui?.showToast('Failed to copy selection.', 'error');
      this.finishAfterToast();
    }
  }

  private cancel(): void {
    this.ui?.showToast('Selection cancelled.', 'info');
    this.finishAfterToast();
  }

  private finishAfterToast(): void {
    const ui = this.ui;

    this.removeEventListeners();
    ui?.hidePanel();
    ui?.hideSettingsPopup();
    ui?.hideSettingsButton();
    ui?.hideShortcutHint();
    ui?.hideOverlay();
    this.hoveredElement = null;
    this.selectedElement = null;
    this.settingsOpen = false;
    this.state = 'idle';

    window.setTimeout(() => {
      if (this.ui === ui) {
        this.cleanup();
      }
    }, 2400);
  }

  private findSelectableElement(target: Element | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    return isSelectableElement(target, this.getSelectionOptions()) ? target : null;
  }

  private getSelectionOptions(): { isPickerNode: (node: Node | null) => boolean } {
    return {
      isPickerNode: (node) => this.ui?.isPickerNode(node) ?? false,
    };
  }

  private shouldBlockPageEvents(): boolean {
    return this.state !== 'idle' && this.state !== 'copying';
  }

  private canMoveSelectionWithShortcut(): boolean {
    return this.state === 'selecting' || this.state === 'selected';
  }

  private hasConfirmedSelection(): boolean {
    return this.state === 'selected' || this.state === 'copying';
  }

  private addEventListeners(): void {
    document.addEventListener('pointermove', this.handlePointerMove, true);
    document.addEventListener('mousedown', this.suppressPagePointerEvent, true);
    document.addEventListener('mouseup', this.suppressPagePointerEvent, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('scroll', this.handleViewportChange, true);
    window.addEventListener('resize', this.handleViewportChange, true);
  }

  private removeEventListeners(): void {
    document.removeEventListener('pointermove', this.handlePointerMove, true);
    document.removeEventListener('mousedown', this.suppressPagePointerEvent, true);
    document.removeEventListener('mouseup', this.suppressPagePointerEvent, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('scroll', this.handleViewportChange, true);
    window.removeEventListener('resize', this.handleViewportChange, true);
  }

  private cleanup(): void {
    this.removeEventListeners();
    this.ui?.destroy();
    this.ui = null;
    this.hoveredElement = null;
    this.selectedElement = null;
    this.settingsOpen = false;
    this.state = 'idle';
  }
}

const createElementLabel = (element: HTMLElement): string => {
  const parts = [element.tagName.toLowerCase()];

  if (element.id) {
    parts.push(`#${element.id}`);
  }

  for (const className of Array.from(element.classList).slice(0, 2)) {
    parts.push(`.${className}`);
  }

  return parts.join('');
};

const getCopyFormatLabel = (format: CopyFormat): string => {
  switch (format) {
    case 'html':
      return 'HTML';
    case 'markdown':
      return 'Markdown';
    case 'text':
      return 'Text';
  }
};

const getSelectionDirection = (event: KeyboardEvent): SelectionDirection | null => {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }

  switch (event.key.toLowerCase()) {
    case 'w':
      return 'parent';
    case 's':
      return 'child';
    case 'a':
      return 'previous-sibling';
    case 'd':
      return 'next-sibling';
    default:
      return null;
  }
};

const isEditableEventTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }

  if (target instanceof HTMLSelectElement) {
    return true;
  }

  return (
    target.isContentEditable ||
    target.closest('[contenteditable="true"], [contenteditable=""]') !== null
  );
};
