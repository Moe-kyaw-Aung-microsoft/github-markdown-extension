/**
 * Selector Observer - Reactive DOM observation utility
 * 
 * Inspired by refined-github's selector-observer, this module provides:
 * - Reactive observation of elements matching CSS selectors
 * - Automatic handling of dynamically added elements
 * - Integration with AbortSignal for cleanup
 * - Efficient MutationObserver-based implementation
 */

export interface ObserveOptions {
  /** AbortSignal for cleanup when feature is unloaded */
  signal?: AbortSignal;
  /** Process elements that already exist in the DOM (default: true) */
  processExisting?: boolean;
}

type ElementCallback = (element: Element) => void;

interface ObserverEntry {
  selector: string;
  callback: ElementCallback;
  seenClass: string;
}

// Track active observers for cleanup
const activeObservers = new Map<MutationObserver, ObserverEntry[]>();

/**
 * Generate a unique class name to mark processed elements
 */
function generateSeenClass(selector: string): string {
  // Create a simple hash from the selector
  let hash = 0;
  for (let i = 0; i < selector.length; i++) {
    const char = selector.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `rgh-seen-${Math.abs(hash).toString(36)}`;
}

/**
 * Process an element if it matches the selector and hasn't been seen
 */
function processElement(
  element: Element,
  selector: string,
  callback: ElementCallback,
  seenClass: string
): void {
  if (element.matches(selector) && !element.classList.contains(seenClass)) {
    element.classList.add(seenClass);
    try {
      callback(element);
    } catch (error) {
      console.error(`[SelectorObserver] Callback failed for "${selector}":`, error);
    }
  }
}

/**
 * Process a node and its descendants for matching elements
 */
function processNode(
  node: Node,
  entries: ObserverEntry[]
): void {
  if (!(node instanceof Element)) return;

  for (const { selector, callback, seenClass } of entries) {
    // Check the node itself
    processElement(node, selector, callback, seenClass);

    // Check descendants
    const descendants = node.querySelectorAll(selector);
    for (const descendant of descendants) {
      processElement(descendant, selector, callback, seenClass);
    }
  }
}

/**
 * Observe elements matching a CSS selector
 * 
 * This function watches for elements matching the selector and calls
 * the callback for each matching element. It handles:
 * - Elements already in the DOM
 * - Elements dynamically added later
 * - Automatic cleanup via AbortSignal
 * 
 * @param selector - CSS selector to match
 * @param callback - Function to call for each matching element
 * @param options - Configuration options
 * 
 * @example
 * ```ts
 * // Watch for issue headers and add a button
 * observe('.issue-header', (header) => {
 *   header.appendChild(createExportButton());
 * }, { signal });
 * 
 * // Multiple selectors (call observe multiple times)
 * observe('.comment-body', processComment, { signal });
 * observe('.discussion-header', addDiscussionButton, { signal });
 * ```
 */
export default function observe(
  selector: string,
  callback: ElementCallback,
  options: ObserveOptions = {}
): void {
  const { signal, processExisting = true } = options;

  // Check if already aborted
  if (signal?.aborted) return;

  const seenClass = generateSeenClass(selector);
  const entry: ObserverEntry = { selector, callback, seenClass };

  // Ensure body exists before proceeding
  const startObserving = () => {
    if (!document.body) {
      // Wait for body to be available
      const bodyObserver = new MutationObserver(() => {
        if (document.body) {
          bodyObserver.disconnect();
          startObserving();
        }
      });
      bodyObserver.observe(document.documentElement, { childList: true });
      return;
    }

    // Process existing elements
    if (processExisting) {
      const existing = document.querySelectorAll(selector);
      for (const element of existing) {
        processElement(element, selector, callback, seenClass);
      }
    }

    // Create mutation observer
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Process added nodes
        for (const node of mutation.addedNodes) {
          processNode(node, [entry]);
        }

        // Also check if attributes changed might make an element match
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          processElement(mutation.target, selector, callback, seenClass);
        }
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-component', 'data-hidden-regular'],
    });

    // Track observer
    activeObservers.set(observer, [entry]);

    // Setup cleanup on abort
    signal?.addEventListener('abort', () => {
      observer.disconnect();
      activeObservers.delete(observer);
    });
  };

  startObserving();
}

/**
 * Wait for an element to appear in the DOM
 * 
 * @param selector - CSS selector to wait for
 * @param options - Configuration options
 * @returns Promise that resolves with the element, or rejects if aborted
 * 
 * @example
 * ```ts
 * const header = await waitFor('.issue-header', { signal });
 * header.appendChild(createButton());
 * ```
 */
export function waitFor(
  selector: string,
  options: { signal?: AbortSignal; timeout?: number } = {}
): Promise<Element> {
  const { signal, timeout = 10000 } = options;

  return new Promise((resolve, reject) => {
    // Check if already aborted
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    // Check if element already exists
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    // Setup timeout
    const timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for "${selector}"`));
    }, timeout);

    // Setup abort handler
    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      reject(new DOMException('Aborted', 'AbortError'));
    });

    // Create observer
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

/**
 * Check if an element exists in the DOM
 */
export function exists(selector: string): boolean {
  return document.querySelector(selector) !== null;
}

/**
 * Query for a single element, typed
 */
export function select<T extends Element = Element>(
  selector: string,
  context: ParentNode = document
): T | null {
  return context.querySelector<T>(selector);
}

/**
 * Query for multiple elements, typed
 */
export function selectAll<T extends Element = Element>(
  selector: string,
  context: ParentNode = document
): T[] {
  return Array.from(context.querySelectorAll<T>(selector));
}
