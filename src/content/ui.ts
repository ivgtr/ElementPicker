import type { CopyFormat } from '@/shared/messages';

const ROOT_ATTRIBUTE = 'data-element-picker-root';
const OVERLAY_ATTRIBUTE = 'data-element-picker-overlay';
const PANEL_ATTRIBUTE = 'data-element-picker-panel';
const TOAST_ATTRIBUTE = 'data-element-picker-toast';

const FORMAT_LABELS: Record<CopyFormat, string> = {
  html: 'HTML',
  markdown: 'Markdown',
  text: 'Text',
};

type ToastKind = 'success' | 'error' | 'info';

export type SelectedMenuCallbacks = {
  onSelectFormat: (format: CopyFormat) => void;
  onSelectParent: () => void;
  onSelectChild: () => void;
  onOpenSettings: () => void;
  onCancel: () => void;
};

export type SelectedMenuState = {
  targetLabel: string;
  canSelectParent: boolean;
  canSelectChild: boolean;
  defaultFormat: CopyFormat;
};

export type SettingsMenuCallbacks = {
  onSelectDefaultFormat: (format: CopyFormat) => void;
  onClose: () => void;
};

export type SettingsMenuState = {
  defaultFormat: CopyFormat;
};

export type PickerPanelPlacement = {
  target: HTMLElement;
  position?: { x: number; y: number };
};

export type PickerPanelRenderer = (panel: HTMLDivElement) => void;

export class PickerUi {
  private readonly root: HTMLDivElement;
  private readonly shadowRoot: ShadowRoot;
  private overlay: HTMLDivElement | null = null;
  private panel: HTMLDivElement | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: number | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.setAttribute(ROOT_ATTRIBUTE, '');
    this.root.style.all = 'initial';

    this.shadowRoot = this.root.attachShadow({ mode: 'closed' });
    this.shadowRoot.append(createStyleElement());
    document.documentElement.append(this.root);
  }

  isPickerNode(node: Node | null): boolean {
    return node === this.root || (node instanceof Node && this.root.contains(node));
  }

  isPickerEvent(event: Event): boolean {
    return event.composedPath().includes(this.root);
  }

  showOverlay(target: HTMLElement): void {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.setAttribute(OVERLAY_ATTRIBUTE, '');
      this.shadowRoot.append(this.overlay);
    }

    const rect = target.getBoundingClientRect();
    Object.assign(this.overlay.style, {
      display: rect.width > 0 && rect.height > 0 ? 'block' : 'none',
      left: `${Math.max(rect.left, 0)}px`,
      top: `${Math.max(rect.top, 0)}px`,
      width: `${Math.max(rect.width, 0)}px`,
      height: `${Math.max(rect.height, 0)}px`,
    });
  }

  hideOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  showSelectedMenu(
    placement: PickerPanelPlacement,
    menuState: SelectedMenuState,
    callbacks: SelectedMenuCallbacks
  ): void {
    this.showPanel(placement, (panel) => {
      const label = document.createElement('div');
      label.textContent = menuState.targetLabel;
      label.setAttribute('data-element-picker-target-label', '');
      panel.append(label);

      for (const format of Object.keys(FORMAT_LABELS) as CopyFormat[]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = FORMAT_LABELS[format];
        if (format === menuState.defaultFormat) {
          button.setAttribute('aria-current', 'true');
          button.dataset.defaultFormat = 'true';
          button.title = 'Default format';
        }
        button.addEventListener('click', () => callbacks.onSelectFormat(format));
        panel.append(button);
      }

      const parentButton = document.createElement('button');
      parentButton.type = 'button';
      parentButton.textContent = 'Parent';
      parentButton.disabled = !menuState.canSelectParent;
      parentButton.title = menuState.canSelectParent
        ? 'Select parent element'
        : 'No selectable parent';
      parentButton.dataset.variant = 'secondary';
      parentButton.addEventListener('click', callbacks.onSelectParent);
      panel.append(parentButton);

      const childButton = document.createElement('button');
      childButton.type = 'button';
      childButton.textContent = 'Child';
      childButton.disabled = !menuState.canSelectChild;
      childButton.title = menuState.canSelectChild ? 'Select child element' : 'No selectable child';
      childButton.dataset.variant = 'secondary';
      childButton.addEventListener('click', callbacks.onSelectChild);
      panel.append(childButton);

      const settingsButton = document.createElement('button');
      settingsButton.type = 'button';
      settingsButton.textContent = '⚙';
      settingsButton.setAttribute('aria-label', 'Settings');
      settingsButton.dataset.variant = 'secondary';
      settingsButton.dataset.iconButton = 'true';
      settingsButton.addEventListener('click', callbacks.onOpenSettings);
      panel.append(settingsButton);

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancel';
      cancelButton.dataset.variant = 'secondary';
      cancelButton.addEventListener('click', callbacks.onCancel);
      panel.append(cancelButton);
    });
  }

  showSettingsMenu(
    placement: PickerPanelPlacement,
    menuState: SettingsMenuState,
    callbacks: SettingsMenuCallbacks
  ): void {
    this.showPanel(placement, (panel) => {
      panel.dataset.layout = 'settings';

      const heading = document.createElement('div');
      heading.textContent = 'Default format';
      heading.setAttribute('data-element-picker-settings-heading', '');
      panel.append(heading);

      for (const format of Object.keys(FORMAT_LABELS) as CopyFormat[]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = FORMAT_LABELS[format];
        if (format === menuState.defaultFormat) {
          button.setAttribute('aria-pressed', 'true');
          button.dataset.defaultFormat = 'true';
        }
        button.addEventListener('click', () => callbacks.onSelectDefaultFormat(format));
        panel.append(button);
      }

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Cancel';
      closeButton.dataset.variant = 'secondary';
      closeButton.addEventListener('click', callbacks.onClose);
      panel.append(closeButton);
    });
  }

  showPanel(placement: PickerPanelPlacement, render: PickerPanelRenderer): void {
    this.hidePanel();

    const panel = document.createElement('div');
    panel.setAttribute(PANEL_ATTRIBUTE, '');
    stopPageEventsInside(panel);
    render(panel);

    this.shadowRoot.append(panel);
    this.panel = panel;

    const targetRect = placement.target.getBoundingClientRect();
    const desiredX =
      placement.position && Number.isFinite(placement.position.x)
        ? placement.position.x
        : targetRect.left;
    const desiredY =
      placement.position && Number.isFinite(placement.position.y)
        ? placement.position.y
        : targetRect.bottom + 8;

    placeWithinViewport(panel, desiredX, desiredY);
  }

  hidePanel(): void {
    this.panel?.remove();
    this.panel = null;
  }

  showToast(message: string, kind: ToastKind): void {
    this.hideToast();

    const toast = document.createElement('div');
    toast.setAttribute(TOAST_ATTRIBUTE, '');
    toast.dataset.kind = kind;
    toast.textContent = message;

    this.shadowRoot.append(toast);
    this.toast = toast;
    this.toastTimer = window.setTimeout(() => this.hideToast(), 2200);
  }

  hideToast(): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.toast?.remove();
    this.toast = null;
  }

  destroy(): void {
    this.hideToast();
    this.hidePanel();
    this.hideOverlay();
    this.root.remove();
  }
}

const placeWithinViewport = (element: HTMLElement, x: number, y: number): void => {
  const margin = 8;
  const rect = element.getBoundingClientRect();
  const left = Math.min(Math.max(x, margin), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(y, margin), window.innerHeight - rect.height - margin);

  Object.assign(element.style, {
    left: `${Math.max(left, margin)}px`,
    top: `${Math.max(top, margin)}px`,
  });
};

const stopPageEventsInside = (element: HTMLElement): void => {
  for (const eventName of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click']) {
    element.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }
};

const createStyleElement = (): HTMLStyleElement => {
  const style = document.createElement('style');

  style.textContent = `
    :host {
      color-scheme: light;
      font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    [${OVERLAY_ATTRIBUTE}] {
      position: fixed;
      z-index: 2147483646;
      box-sizing: border-box;
      border: 2px solid #dc2626;
      background: rgba(220, 38, 38, 0.08);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9);
      pointer-events: none;
    }

    [${PANEL_ATTRIBUTE}] {
      position: fixed;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 5px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 8px;
      background: #ffffff;
      box-shadow:
        0 16px 40px rgba(15, 23, 42, 0.18),
        0 2px 8px rgba(15, 23, 42, 0.1);
    }

    [${PANEL_ATTRIBUTE}] [data-element-picker-target-label] {
      max-width: 180px;
      overflow: hidden;
      color: #111827;
      font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [${PANEL_ATTRIBUTE}] [data-element-picker-settings-heading] {
      color: #111827;
      font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      white-space: nowrap;
    }

    [${PANEL_ATTRIBUTE}] button {
      min-width: 40px;
      min-height: 28px;
      padding: 0 9px;
      border: 0;
      border-radius: 6px;
      background: #111827;
      color: #ffffff;
      font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      cursor: pointer;
    }

    [${PANEL_ATTRIBUTE}] button[data-icon-button="true"] {
      min-width: 30px;
      width: 30px;
      padding: 0;
      font-size: 14px;
    }

    [${PANEL_ATTRIBUTE}] button[data-default-format="true"] {
      box-shadow:
        inset 0 0 0 1px #f59e0b,
        0 0 0 1px rgba(245, 158, 11, 0.35);
    }

    [${PANEL_ATTRIBUTE}] button:disabled,
    [${PANEL_ATTRIBUTE}] button:disabled:hover {
      background: #e5e7eb;
      color: #9ca3af;
      box-shadow: inset 0 0 0 1px #d1d5db;
      cursor: not-allowed;
      opacity: 1;
    }

    [${PANEL_ATTRIBUTE}] button:hover {
      background: #374151;
    }

    [${PANEL_ATTRIBUTE}] button[data-variant="secondary"] {
      background: #f3f4f6;
      color: #111827;
    }

    [${PANEL_ATTRIBUTE}] button[data-variant="secondary"]:hover {
      background: #e5e7eb;
    }

    [${TOAST_ATTRIBUTE}] {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      max-width: min(360px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 10px 12px;
      border-radius: 8px;
      background: #111827;
      color: #ffffff;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
      font: 500 13px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    [${TOAST_ATTRIBUTE}][data-kind="success"] {
      background: #166534;
    }

    [${TOAST_ATTRIBUTE}][data-kind="error"] {
      background: #991b1b;
    }
  `;

  return style;
};
