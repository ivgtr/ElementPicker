import type { CopyFormat } from '@/shared/messages';
import type { CopyMode } from './settings';

const ROOT_ATTRIBUTE = 'data-element-picker-root';
const OVERLAY_ATTRIBUTE = 'data-element-picker-overlay';
const PANEL_ATTRIBUTE = 'data-element-picker-panel';
const TOAST_ATTRIBUTE = 'data-element-picker-toast';
const SHORTCUT_HINT_ATTRIBUTE = 'data-element-picker-shortcut-hint';
const SETTINGS_BUTTON_ATTRIBUTE = 'data-element-picker-settings-button';
const SETTINGS_POPUP_ATTRIBUTE = 'data-element-picker-settings-popup';

const FORMAT_LABELS: Record<CopyFormat, string> = {
  html: 'HTML',
  markdown: 'Markdown',
  text: 'Text',
};

const COPY_MODE_LABELS: Record<CopyMode, string> = {
  direct: 'Direct copy',
  confirm: 'Choose format',
};

type ToastKind = 'success' | 'error' | 'info';

export type SelectedMenuCallbacks = {
  onSelectFormat: (format: CopyFormat) => void;
  onCancel: () => void;
};

export type SelectedMenuState = {
  targetLabel: string;
};

export type SettingsMenuCallbacks = {
  onSelectCopyMode: (copyMode: CopyMode) => void;
  onSelectDefaultFormat: (format: CopyFormat) => void;
  onClose: () => void;
};

export type SettingsMenuState = {
  defaultFormat: CopyFormat;
  copyMode: CopyMode;
};

export type SettingsButtonCallbacks = {
  onToggle: () => void;
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
  private settingsButton: HTMLButtonElement | null = null;
  private settingsPopup: HTMLDivElement | null = null;
  private shortcutHint: HTMLDivElement | null = null;
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
        button.addEventListener('click', () => callbacks.onSelectFormat(format));
        panel.append(button);
      }

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = 'Cancel';
      cancelButton.dataset.variant = 'secondary';
      cancelButton.addEventListener('click', callbacks.onCancel);
      panel.append(cancelButton);
    });
  }

  showSettingsButton(callbacks: SettingsButtonCallbacks): void {
    if (this.settingsButton) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '⚙';
    button.setAttribute(SETTINGS_BUTTON_ATTRIBUTE, '');
    button.setAttribute('aria-label', 'Settings');
    button.title = 'Settings';
    stopPageEventsInside(button);
    button.addEventListener('click', callbacks.onToggle);

    this.shadowRoot.append(button);
    this.settingsButton = button;
  }

  hideSettingsButton(): void {
    this.settingsButton?.remove();
    this.settingsButton = null;
  }

  showSettingsPopup(
    menuState: SettingsMenuState,
    callbacks: SettingsMenuCallbacks
  ): void {
    this.hideSettingsPopup();

    const popup = document.createElement('div');
    popup.setAttribute(SETTINGS_POPUP_ATTRIBUTE, '');
    stopPageEventsInside(popup);

    const header = document.createElement('div');
    header.setAttribute('data-element-picker-settings-header', '');

    const heading = document.createElement('div');
    heading.textContent = 'Settings';
    heading.setAttribute('data-element-picker-settings-heading', '');
    header.append(heading);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.dataset.variant = 'secondary';
    closeButton.dataset.size = 'compact';
    closeButton.addEventListener('click', callbacks.onClose);
    header.append(closeButton);

    popup.append(header);

    popup.append(
      createSettingsRow(
        'Copy mode',
        'Copy mode',
        Object.keys(COPY_MODE_LABELS) as CopyMode[],
        (copyMode) => COPY_MODE_LABELS[copyMode],
        menuState.copyMode,
        callbacks.onSelectCopyMode
      )
    );

    popup.append(
      createSettingsRow(
        'Default format',
        'Default format',
        Object.keys(FORMAT_LABELS) as CopyFormat[],
        (format) => FORMAT_LABELS[format],
        menuState.defaultFormat,
        callbacks.onSelectDefaultFormat
      )
    );

    this.shadowRoot.append(popup);
    this.settingsPopup = popup;
  }

  hideSettingsPopup(): void {
    this.settingsPopup?.remove();
    this.settingsPopup = null;
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

  showShortcutHint(): void {
    if (this.shortcutHint) {
      return;
    }

    const shortcutHint = document.createElement('div');
    shortcutHint.setAttribute(SHORTCUT_HINT_ATTRIBUTE, '');
    shortcutHint.textContent =
      'W/S 親子移動  A/D 兄弟移動  Enter 選択  Esc/右クリック キャンセル';

    this.shadowRoot.append(shortcutHint);
    this.shortcutHint = shortcutHint;
  }

  hideShortcutHint(): void {
    this.shortcutHint?.remove();
    this.shortcutHint = null;
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
    this.hideSettingsPopup();
    this.hideSettingsButton();
    this.hideShortcutHint();
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

const createSettingsRow = <T extends string>(
  labelText: string,
  ariaLabel: string,
  options: T[],
  getLabel: (option: T) => string,
  selectedValue: T,
  onSelect: (option: T) => void
): HTMLDivElement => {
  const row = document.createElement('div');
  row.setAttribute('data-element-picker-settings-row', '');

  const label = document.createElement('div');
  label.textContent = labelText;
  label.setAttribute('data-element-picker-settings-label', '');
  row.append(label);

  const segmentedControl = document.createElement('div');
  segmentedControl.setAttribute('data-element-picker-segmented-control', '');
  segmentedControl.setAttribute('role', 'radiogroup');
  segmentedControl.setAttribute('aria-label', ariaLabel);
  segmentedControl.style.setProperty(
    '--element-picker-option-min-width',
    `${getOptionMinWidth(options.map(getLabel))}px`
  );

  for (const option of options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = getLabel(option);
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(option === selectedValue));
    if (option === selectedValue) {
      button.dataset.selected = 'true';
    }
    button.addEventListener('click', () => onSelect(option));
    segmentedControl.append(button);
  }

  row.append(segmentedControl);
  return row;
};

const getOptionMinWidth = (labels: string[]): number => {
  const longestLabelLength = Math.max(...labels.map((label) => label.length));
  return Math.max(86, Math.min(116, longestLabelLength * 9 + 28));
};

const stopPageEventsInside = (element: HTMLElement): void => {
  for (const eventName of [
    'pointerdown',
    'pointermove',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'wheel',
  ]) {
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
      --ep-bg: #111111;
      --ep-panel-bg: #171615;
      --ep-panel-bg-strong: #1d1b19;
      --ep-control-bg: #201e1b;
      --ep-control-bg-hover: #2a2521;
      --ep-control-bg-active: #33241f;
      --ep-text: #e6e0d0;
      --ep-muted-text: #9a9487;
      --ep-dim-text: #756f65;
      --ep-accent: #b24a3b;
      --ep-accent-strong: #d0644e;
      --ep-accent-soft: rgba(178, 74, 59, 0.16);
      --ep-success: #7b9b6f;
      --ep-error: #c15b4f;
      --ep-info: #b7a36a;
      --ep-border: #3b352e;
      --ep-border-strong: #5a4a3d;
      --ep-border-muted: rgba(230, 224, 208, 0.12);
      --ep-radius: 4px;
      --ep-radius-soft: 6px;
      --ep-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      --ep-font:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
      --ep-z-overlay: 2147483646;
      --ep-z-ui: 2147483647;
      color-scheme: dark;
      font-family:
        var(--ep-font);
    }

    [${OVERLAY_ATTRIBUTE}] {
      position: fixed;
      z-index: var(--ep-z-overlay);
      box-sizing: border-box;
      border: 1px solid var(--ep-accent-strong);
      background:
        linear-gradient(rgba(178, 74, 59, 0.08), rgba(178, 74, 59, 0.08));
      box-shadow:
        inset 0 0 0 1px rgba(17, 17, 17, 0.38),
        0 0 0 1px rgba(230, 224, 208, 0.2);
      pointer-events: none;
    }

    [${PANEL_ATTRIBUTE}] {
      position: fixed;
      z-index: var(--ep-z-ui);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-sizing: border-box;
      max-width: calc(100vw - 16px);
      padding: 5px;
      border: 1px solid var(--ep-border);
      border-radius: var(--ep-radius-soft);
      background: var(--ep-panel-bg);
      box-shadow: var(--ep-shadow);
      color: var(--ep-text);
    }

    [${PANEL_ATTRIBUTE}] [data-element-picker-target-label] {
      max-width: min(184px, 32vw);
      overflow: hidden;
      padding: 0 6px 0 3px;
      color: var(--ep-muted-text);
      font: 600 11px/1 var(--ep-font);
      letter-spacing: 0;
      text-overflow: ellipsis;
      text-transform: lowercase;
      white-space: nowrap;
    }

    [${PANEL_ATTRIBUTE}] [data-element-picker-settings-heading] {
      color: var(--ep-text);
      font: 700 12px/1 var(--ep-font);
      letter-spacing: 0;
      white-space: nowrap;
    }

    [${PANEL_ATTRIBUTE}] button,
    [${SETTINGS_BUTTON_ATTRIBUTE}],
    [${SETTINGS_POPUP_ATTRIBUTE}] button {
      box-sizing: border-box;
      border: 1px solid var(--ep-border-strong);
      border-radius: var(--ep-radius);
      background: var(--ep-control-bg);
      color: var(--ep-text);
      cursor: pointer;
      font-family: var(--ep-font);
      font-weight: 700;
      letter-spacing: 0;
      outline: none;
    }

    [${PANEL_ATTRIBUTE}] button:hover,
    [${SETTINGS_BUTTON_ATTRIBUTE}]:hover,
    [${SETTINGS_POPUP_ATTRIBUTE}] button:hover {
      border-color: var(--ep-accent);
      background: var(--ep-control-bg-hover);
      color: #f1e9d6;
    }

    [${PANEL_ATTRIBUTE}] button:active,
    [${SETTINGS_BUTTON_ATTRIBUTE}]:active,
    [${SETTINGS_POPUP_ATTRIBUTE}] button:active {
      border-color: var(--ep-accent-strong);
      background: var(--ep-control-bg-active);
      transform: translateY(1px);
    }

    [${PANEL_ATTRIBUTE}] button:focus-visible,
    [${SETTINGS_BUTTON_ATTRIBUTE}]:focus-visible,
    [${SETTINGS_POPUP_ATTRIBUTE}] button:focus-visible {
      box-shadow: 0 0 0 2px rgba(208, 100, 78, 0.35);
    }

    [${PANEL_ATTRIBUTE}] button {
      min-width: 40px;
      min-height: 26px;
      padding: 0 8px;
      font-size: 11px;
      line-height: 1;
    }

    [${PANEL_ATTRIBUTE}] button[data-icon-button="true"] {
      min-width: 28px;
      width: 28px;
      padding: 0;
      font-size: 13px;
    }

    [${PANEL_ATTRIBUTE}] button:disabled,
    [${PANEL_ATTRIBUTE}] button:disabled:hover {
      border-color: var(--ep-border);
      background: #161412;
      color: var(--ep-dim-text);
      box-shadow: none;
      cursor: not-allowed;
      opacity: 1;
    }

    [${PANEL_ATTRIBUTE}] button[data-variant="secondary"] {
      border-color: var(--ep-border);
      background: transparent;
      color: var(--ep-muted-text);
    }

    [${PANEL_ATTRIBUTE}] button[data-variant="secondary"]:hover {
      border-color: var(--ep-border-strong);
      background: var(--ep-control-bg-hover);
      color: var(--ep-text);
    }

    [${SETTINGS_BUTTON_ATTRIBUTE}] {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: var(--ep-z-ui);
      width: 30px;
      height: 30px;
      padding: 0;
      box-shadow: var(--ep-shadow);
      color: var(--ep-muted-text);
      font-size: 14px;
      line-height: 1;
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] {
      position: fixed;
      right: 12px;
      bottom: 50px;
      z-index: var(--ep-z-ui);
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      box-sizing: border-box;
      width: min(340px, calc(100vw - 24px));
      padding: 10px;
      border: 1px solid var(--ep-border);
      border-radius: var(--ep-radius-soft);
      background: var(--ep-panel-bg);
      box-shadow: var(--ep-shadow);
      color: var(--ep-text);
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] [data-element-picker-settings-header] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-bottom: 7px;
      border-bottom: 1px solid var(--ep-border-muted);
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] [data-element-picker-settings-heading] {
      color: var(--ep-text);
      font: 700 12px/1.2 var(--ep-font);
      letter-spacing: 0;
      text-transform: lowercase;
      white-space: nowrap;
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] [data-element-picker-settings-row] {
      display: grid;
      grid-template-columns: minmax(92px, 0.42fr) minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] [data-element-picker-settings-label] {
      min-width: 0;
      overflow: hidden;
      color: var(--ep-muted-text);
      font: 600 11px/1.2 var(--ep-font);
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] [data-element-picker-segmented-control] {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(var(--element-picker-option-min-width), 1fr));
      gap: 4px;
      min-width: 0;
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] button {
      min-height: 26px;
      min-width: 0;
      padding: 0 8px;
      font-size: 11px;
      line-height: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] button[data-selected="true"] {
      border-color: var(--ep-accent);
      background: var(--ep-accent-soft);
      color: #f0c3b9;
      box-shadow:
        inset 0 0 0 1px rgba(208, 100, 78, 0.26),
        0 0 0 1px rgba(178, 74, 59, 0.08);
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] button[data-variant="secondary"] {
      border-color: var(--ep-border);
      background: transparent;
      color: var(--ep-muted-text);
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] button[data-variant="secondary"]:hover {
      border-color: var(--ep-border-strong);
      background: var(--ep-control-bg-hover);
      color: var(--ep-text);
    }

    [${SETTINGS_POPUP_ATTRIBUTE}] button[data-size="compact"] {
      flex: 0 0 auto;
      min-height: 24px;
      padding: 0 8px;
    }

    [${SHORTCUT_HINT_ATTRIBUTE}] {
      position: fixed;
      left: 10px;
      bottom: 8px;
      z-index: var(--ep-z-overlay);
      box-sizing: border-box;
      max-width: calc(100vw - 20px);
      min-height: 24px;
      padding: 5px 8px;
      border: 1px solid var(--ep-border);
      border-radius: var(--ep-radius);
      background: rgba(17, 17, 17, 0.82);
      color: var(--ep-muted-text);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      font: 600 11px/1.25 var(--ep-font);
      letter-spacing: 0;
      pointer-events: none;
      text-align: left;
      user-select: none;
      white-space: normal;
    }

    @media (max-width: 560px) {
      [${SETTINGS_BUTTON_ATTRIBUTE}] {
        top: 12px;
        bottom: auto;
      }

      [${SETTINGS_POPUP_ATTRIBUTE}] {
        top: 52px;
        bottom: auto;
      }

      [${SHORTCUT_HINT_ATTRIBUTE}] {
        max-width: calc(100vw - 20px);
      }

      [${SETTINGS_POPUP_ATTRIBUTE}] [data-element-picker-settings-row] {
        grid-template-columns: 1fr;
        gap: 5px;
      }
    }

    [${TOAST_ATTRIBUTE}] {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: var(--ep-z-ui);
      max-width: min(360px, calc(100vw - 24px));
      box-sizing: border-box;
      padding: 8px 10px;
      border: 1px solid var(--ep-border);
      border-left-color: var(--ep-info);
      border-left-width: 3px;
      border-radius: var(--ep-radius);
      background: var(--ep-panel-bg);
      color: var(--ep-text);
      box-shadow: var(--ep-shadow);
      font: 600 12px/1.35 var(--ep-font);
      letter-spacing: 0;
    }

    [${TOAST_ATTRIBUTE}][data-kind="success"] {
      border-left-color: var(--ep-success);
      color: #dce8d4;
    }

    [${TOAST_ATTRIBUTE}][data-kind="error"] {
      border-left-color: var(--ep-error);
      color: #efd1ca;
    }

    [${TOAST_ATTRIBUTE}][data-kind="info"] {
      border-left-color: var(--ep-info);
      color: var(--ep-text);
    }

    @media (max-width: 560px) {
      [${TOAST_ATTRIBUTE}] {
        top: 54px;
      }
    }
  `;

  return style;
};
