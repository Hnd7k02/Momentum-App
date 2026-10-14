import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * A minimal renderer for hook and component tests that need effects and a
 * DOM (WP3, Stage 1). The file using it opts in with
 * `// @vitest-environment happy-dom`; nothing else in the suite runs in a
 * DOM, so nothing else changes.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface Mounted {
  container: HTMLElement;
  rerender(node: ReactNode): Promise<void>;
  unmount(): Promise<void>;
}

export async function mount(node: ReactNode): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(node);
  });
  return {
    container,
    async rerender(next) {
      await act(async () => root!.render(next));
    },
    async unmount() {
      await act(async () => root!.unmount());
      container.remove();
    },
  };
}

/** Lets pending promises and the effects they trigger settle. */
export async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
}
