export type SelectableElementOptions = {
  isPickerNode?: (node: Node | null) => boolean;
};

export const isSelectableElement = (
  element: Element | null,
  options: SelectableElementOptions = {}
): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (options.isPickerNode?.(element)) {
    return false;
  }

  if (element === document.documentElement) {
    return false;
  }

  const style = window.getComputedStyle(element);

  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

export const getSelectableParent = (
  element: HTMLElement,
  options: SelectableElementOptions = {}
): HTMLElement | null => {
  let candidate = element.parentElement;

  while (candidate) {
    if (candidate instanceof HTMLElement && isSelectableElement(candidate, options)) {
      return candidate;
    }

    candidate = candidate.parentElement;
  }

  return null;
};

export const getSelectableChild = (
  element: HTMLElement,
  options: SelectableElementOptions = {}
): HTMLElement | null => {
  const candidates = Array.from(element.children);

  while (candidates.length > 0) {
    const candidate = candidates.shift();

    if (!candidate) {
      continue;
    }

    if (candidate instanceof HTMLElement && isSelectableElement(candidate, options)) {
      return candidate;
    }

    candidates.unshift(...Array.from(candidate.children));
  }

  return null;
};
