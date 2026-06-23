import { copyTextToClipboard, createCopyText } from './copy';
import { getSelectableChild, getSelectableParent, isSelectableElement } from './selection';
import {
  DEFAULT_PICKER_SETTINGS,
  loadPickerSettings,
  savePickerSettings,
  type PickerSettings,
} from './settings';
import { PickerUi } from './ui';
import type { CopyFormat } from '@/shared/messages';

type PickerState = 'idle' | 'selecting' | 'selected' | 'previewing' | 'settings' | 'copying';

export class PickerController {
  private state: PickerState = 'idle';
  private ui: PickerUi | null = null;
  private hoveredElement: HTMLElement | null = null;
  private selectedElement: HTMLElement | null = null;
  private settings: PickerSettings = DEFAULT_PICKER_SETTINGS;
  private stateBeforeSettings: Extract<PickerState, 'selecting' | 'selected'> = 'selecting';
  private startRequestId = 0;

  async start(): Promise<void> {
    const requestId = (this.startRequestId += 1);

    if (this.ui) {
      this.cleanup();
    }

    try {
      this.settings = await loadPickerSettings();
    } catch (error) {
      console.warn('[Element Picker] Failed to load settings.', error);
      this.settings = DEFAULT_PICKER_SETTINGS;
    }

    if (requestId !== this.startRequestId) {
      return;
    }

    this.state = 'selecting';
    this.ui = new PickerUi();
    this.addEventListeners();
    this.ui.showToast('Select an element to copy.', 'info');
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

    if (this.state === 'settings') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.closeSettingsMenu();
      return;
    }

    if (this.state === 'selected' || this.state === 'previewing') {
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

    const target = this.findSelectableElement(
      document.elementFromPoint(event.clientX, event.clientY)
    );

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
    if (event.key !== 'Escape' || this.state === 'idle') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
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

  private confirmSelection(element: HTMLElement, position: { x: number; y: number }): void {
    this.selectedElement = element;
    this.state = 'selected';
    this.ui?.showOverlay(element);
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
        canSelectParent:
          getSelectableParent(this.selectedElement, this.getSelectionOptions()) !== null,
        canSelectChild:
          getSelectableChild(this.selectedElement, this.getSelectionOptions()) !== null,
        defaultFormat: this.settings.defaultFormat,
      },
      {
        onSelectFormat: (format) => {
          void this.copySelection(format);
        },
        onSelectParent: () => this.moveSelection('parent'),
        onSelectChild: () => this.moveSelection('child'),
        onOpenSettings: () => this.openSettingsMenu(),
        onCancel: () => this.cancel(),
      }
    );
  }

  private openSettingsMenu(): void {
    if (!this.selectedElement || this.state !== 'selected') {
      return;
    }

    this.stateBeforeSettings = this.state;
    this.state = 'settings';
    this.showSettingsMenu();
  }

  private showSettingsMenu(): void {
    if (!this.selectedElement) {
      return;
    }

    this.ui?.showSettingsMenu(
      { target: this.selectedElement },
      { defaultFormat: this.settings.defaultFormat },
      {
        onSelectDefaultFormat: (format) => {
          void this.updateDefaultFormat(format);
        },
        onClose: () => this.closeSettingsMenu(),
      }
    );
  }

  private async updateDefaultFormat(defaultFormat: CopyFormat): Promise<void> {
    if (this.state !== 'settings') {
      return;
    }

    const previousSettings = this.settings;
    this.settings = { ...this.settings, defaultFormat };
    this.showSettingsMenu();

    try {
      await savePickerSettings(this.settings);
      this.ui?.showToast('Settings saved.', 'success');
    } catch (error) {
      console.warn('[Element Picker] Failed to save settings.', error);
      this.settings = previousSettings;
      this.showSettingsMenu();
      this.ui?.showToast('Failed to save settings.', 'error');
    }
  }

  private closeSettingsMenu(): void {
    if (this.state !== 'settings') {
      return;
    }

    this.state = this.stateBeforeSettings;

    if (this.state === 'selected') {
      this.showSelectedMenu();
      return;
    }

    this.ui?.hidePanel();
  }

  private moveSelection(direction: 'parent' | 'child'): void {
    if (!this.selectedElement || this.state !== 'selected') {
      return;
    }

    const nextElement =
      direction === 'parent'
        ? getSelectableParent(this.selectedElement, this.getSelectionOptions())
        : getSelectableChild(this.selectedElement, this.getSelectionOptions());

    if (!nextElement) {
      this.showSelectedMenu();
      return;
    }

    this.selectedElement = nextElement;
    this.ui?.showOverlay(nextElement);
    this.showSelectedMenu();
  }

  private async copySelection(format: CopyFormat): Promise<void> {
    if (!this.selectedElement || this.state !== 'selected') {
      return;
    }

    this.state = 'copying';
    this.ui?.hidePanel();

    try {
      const text = createCopyText(this.selectedElement, format);
      await copyTextToClipboard(text);
      this.ui?.showToast('Copied to clipboard.', 'success');
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
    ui?.hideOverlay();
    this.hoveredElement = null;
    this.selectedElement = null;
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

  private hasConfirmedSelection(): boolean {
    return (
      this.state === 'selected' ||
      this.state === 'previewing' ||
      this.state === 'settings' ||
      this.state === 'copying'
    );
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
