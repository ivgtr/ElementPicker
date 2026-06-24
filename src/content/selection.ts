export type SelectableElementOptions = {
  isPickerNode?: (node: Node | null) => boolean;
};

export type SelectionDirection = 'parent' | 'child' | 'previous-sibling' | 'next-sibling';

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

export const getSelectablePreviousSibling = (
  element: HTMLElement,
  options: SelectableElementOptions = {}
): HTMLElement | null => {
  return getSelectableSibling(element, options, 'previous');
};

export const getSelectableNextSibling = (
  element: HTMLElement,
  options: SelectableElementOptions = {}
): HTMLElement | null => {
  return getSelectableSibling(element, options, 'next');
};

export const moveSelection = (
  element: HTMLElement,
  direction: SelectionDirection,
  options: SelectableElementOptions = {}
): HTMLElement | null => {
  switch (direction) {
    case 'parent':
      return getSelectableParent(element, options);
    case 'child':
      return getSelectableChild(element, options);
    case 'previous-sibling':
      return getSelectablePreviousSibling(element, options);
    case 'next-sibling':
      return getSelectableNextSibling(element, options);
  }
};

const getSelectableSibling = (
  element: HTMLElement,
  options: SelectableElementOptions,
  direction: 'previous' | 'next'
): HTMLElement | null => {
  const siblings = Array.from(element.parentElement?.children ?? []).filter(
    (candidate): candidate is HTMLElement =>
      candidate instanceof HTMLElement && isSelectableElement(candidate, options)
  );

  if (siblings.length === 0) {
    return null;
  }

  const currentIndex = siblings.indexOf(element);

  if (currentIndex === -1) {
    return direction === 'previous' ? siblings.at(-1) ?? null : siblings[0] ?? null;
  }

  if (siblings.length === 1) {
    return siblings[0] === element ? null : siblings[0];
  }

  const nextIndex =
    direction === 'previous'
      ? (currentIndex - 1 + siblings.length) % siblings.length
      : (currentIndex + 1) % siblings.length;

  return siblings[nextIndex] ?? null;
};
