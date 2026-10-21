// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../test/dom';
import { currentWorld, useWorld, type World } from './world';

/**
 * The world scope (D145): a screen declares its world, the document carries
 * it, and the claim is counted rather than toggled.
 */
function Screen({ world }: { world: World }) {
  useWorld(world);
  return <div data-screen={world} />;
}

const root = () => document.documentElement;
const themeColour = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;

function withThemeMeta(initial: string): void {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', initial);
  document.head.appendChild(meta);
}

/** The tokens the hook reads, as the stylesheet would provide them. */
function withTokens(): void {
  const style = document.createElement('style');
  style.setAttribute('data-test-tokens', '');
  style.textContent = ':root { --status-bar: #f4f4f8; } [data-world="gym"] { --status-bar: #0b0e17; }';
  document.head.appendChild(style);
}

afterEach(() => {
  root().removeAttribute('data-world');
  document.querySelectorAll('[data-test-tokens], meta[name="theme-color"]').forEach((el) => el.remove());
});

describe('useWorld', () => {
  it('puts the Gym world on the document while a Gym screen is mounted, and takes it off again', async () => {
    expect(root().hasAttribute('data-world')).toBe(false);
    const view = await mount(<Screen world="gym" />);
    expect(root().getAttribute('data-world')).toBe('gym');
    expect(currentWorld()).toBe('gym');
    await view.unmount();
    expect(root().hasAttribute('data-world')).toBe(false);
    expect(currentWorld()).toBe('mind');
  });

  it('a Mind screen claims nothing', async () => {
    const view = await mount(<Screen world="mind" />);
    expect(root().hasAttribute('data-world')).toBe(false);
    await view.unmount();
  });

  it('counts the claims: a workout over the hub holds the world until both have gone', async () => {
    const hub = await mount(<Screen world="gym" />);
    const workout = await mount(<Screen world="gym" />);
    expect(root().getAttribute('data-world')).toBe('gym');
    await hub.unmount();
    expect(root().getAttribute('data-world')).toBe('gym');
    await workout.unmount();
    expect(root().hasAttribute('data-world')).toBe(false);
  });

  it('follows a screen that changes world, as Bereiche does when the area switches', async () => {
    const view = await mount(<Screen world="mind" />);
    expect(root().hasAttribute('data-world')).toBe(false);
    await view.rerender(<Screen world="gym" />);
    expect(root().getAttribute('data-world')).toBe('gym');
    await view.rerender(<Screen world="mind" />);
    expect(root().hasAttribute('data-world')).toBe(false);
    await view.unmount();
  });

  it('rewrites theme-color from the --status-bar token of the world in force', async () => {
    withTokens();
    withThemeMeta('#f4f4f8');
    const view = await mount(<Screen world="gym" />);
    expect(themeColour()).toBe('#0b0e17');
    await view.unmount();
    expect(themeColour()).toBe('#f4f4f8');
  });

  it('leaves theme-color alone when the stylesheet names no status-bar colour', async () => {
    withThemeMeta('#abcdef');
    const view = await mount(<Screen world="gym" />);
    expect(themeColour()).toBe('#abcdef');
    await view.unmount();
  });
});
