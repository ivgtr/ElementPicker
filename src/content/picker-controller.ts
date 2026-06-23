import { copyTextToClipboard, createCopyText } from './copy';
import { PickerUi } from './ui';
import type { CopyFormat } from '@/shared/messages';

type PickerState = 'idle' | 'selecting' | 'format-selecting' | 'copying';

export class PickerController {
  private state: PickerState = 'idle';
  private ui: PickerUi | null = null;
  private hoveredElement: HTMLElement | null = null;
  private selectedElement: HTMLElement | null = null;

  start(): void {
    if (this.ui) {
      this.cleanup();
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

    if (this.state === 'format-selecting') {
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

    this.selectedElement = target;
    this.state = 'format-selecting';
    this.ui?.showOverlay(target);
    this.ui?.showFormatMenu(target, { x: event.clientX, y: event.clientY }, {
      onSelect: (format) => {
        void this.copySelection(format);
      },
      onCancel: () => this.cancel(),
    });
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

    if (this.state === 'format-selecting' && this.selectedElement) {
      this.ui?.showOverlay(this.selectedElement);
    }
  };

  private async copySelection(format: CopyFormat): Promise<void> {
    if (!this.selectedElement || this.state !== 'format-selecting') {
      return;
    }

    this.state = 'copying';
    this.ui?.hideFormatMenu();

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
    ui?.hideFormatMenu();
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
    if (!(target instanceof HTMLElement) || this.ui?.isPickerNode(target)) {
      return null;
    }

    if (target === document.documentElement) {
      return null;
    }

    return target;
  }

  private shouldBlockPageEvents(): boolean {
    return this.state === 'selecting' || this.state === 'format-selecting';
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
