// ============================================
// Habit Build - UI Utilities
// ============================================

/**
 * Select a single element
 */
export function $(selector: string, parent: ParentNode = document): Element | null {
  return parent.querySelector(selector);
}

/**
 * Select all matching elements
 */
export function $$(selector: string, parent: ParentNode = document): Element[] {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * Create an element with optional attributes and children
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        el.className = value;
      } else if (key.startsWith('data')) {
        el.dataset[key.slice(4).toLowerCase()] = value;
      } else {
        el.setAttribute(key, value);
      }
    });
  }
  
  if (children) {
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
  }
  
  return el;
}

/**
 * Add event listener with automatic cleanup
 */
export function on<K extends keyof HTMLElementEventMap>(
  element: Element | null,
  event: K,
  handler: (e: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions
): () => void {
  if (!element) return () => {};
  
  element.addEventListener(event, handler as EventListener, options);
  return () => element.removeEventListener(event, handler as EventListener, options);
}

/**
 * Delegate event handling to parent element
 */
export function delegate<K extends keyof HTMLElementEventMap>(
  parent: Element | null,
  event: K,
  selector: string,
  handler: (e: HTMLElementEventMap[K], target: Element) => void
): () => void {
  if (!parent) return () => {};
  
  const listener = (e: Event) => {
    const target = (e.target as Element).closest(selector);
    if (target && parent.contains(target)) {
      handler(e as HTMLElementEventMap[K], target);
    }
  };
  
  parent.addEventListener(event, listener);
  return () => parent.removeEventListener(event, listener);
}

/**
 * Show an element
 */
export function show(element: Element | null): void {
  if (!element) return;
  (element as HTMLElement).style.display = '';
  element.removeAttribute('hidden');
}

/**
 * Hide an element
 */
export function hide(element: Element | null): void {
  if (!element) return;
  element.setAttribute('hidden', '');
}

/**
 * Toggle element visibility
 */
export function toggle(element: Element | null, visible?: boolean): void {
  if (!element) return;
  const isVisible = visible ?? element.hasAttribute('hidden');
  isVisible ? show(element) : hide(element);
}

/**
 * Add class to element
 */
export function addClass(element: Element | null, ...classes: string[]): void {
  if (!element) return;
  element.classList.add(...classes);
}

/**
 * Remove class from element
 */
export function removeClass(element: Element | null, ...classes: string[]): void {
  if (!element) return;
  element.classList.remove(...classes);
}

/**
 * Toggle class on element
 */
export function toggleClass(
  element: Element | null, 
  className: string, 
  force?: boolean
): void {
  if (!element) return;
  element.classList.toggle(className, force);
}

/**
 * Set HTML content safely
 */
export function setHTML(element: Element | null, html: string): void {
  if (!element) return;
  element.innerHTML = html;
}

/**
 * Set text content
 */
export function setText(element: Element | null, text: string): void {
  if (!element) return;
  element.textContent = text;
}

/**
 * Get form data as object
 */
export function getFormData(form: HTMLFormElement): Record<string, string> {
  const formData = new FormData(form);
  const data: Record<string, string> = {};
  
  formData.forEach((value, key) => {
    data[key] = value.toString();
  });
  
  return data;
}

/**
 * Animate element with a class
 */
export function animate(
  element: Element | null,
  animationClass: string,
  duration: number = 300
): Promise<void> {
  return new Promise(resolve => {
    if (!element) {
      resolve();
      return;
    }
    
    element.classList.add(animationClass);
    
    setTimeout(() => {
      element.classList.remove(animationClass);
      resolve();
    }, duration);
  });
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
