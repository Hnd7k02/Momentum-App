// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, settle, type Mounted } from '../test/dom';
import { useLoadable, type Loadable } from './useLoadable';

/**
 * `useLoadable` after WP3 B2: it loads again whenever its inputs change, a
 * reply that arrives after a newer request never wins, and what is on
 * screen stays there while the next load is in flight.
 */

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: Error): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let mounted: Mounted | null = null;
afterEach(async () => {
  await mounted?.unmount();
  mounted = null;
});

function Probe({
  input,
  version = 0,
  load,
  seen,
}: {
  input: string;
  /** A refresh trigger, as the store's change version is. */
  version?: number;
  load(input: string): Promise<string>;
  seen: Loadable<string>[];
}) {
  const { state } = useLoadable(() => load(input), [input], [version]);
  seen.push(state);
  return null;
}

const last = <T,>(list: T[]): T => list[list.length - 1]!;

describe('useLoadable reloads when its inputs change', () => {
  it('loads once per input, and again for a new one', async () => {
    const calls: string[] = [];
    const seen: Loadable<string>[] = [];
    const load = async (input: string) => {
      calls.push(input);
      return `value for ${input}`;
    };
    mounted = await mount(<Probe input="7" load={load} seen={seen} />);
    await settle();
    expect(calls).toEqual(['7']);
    expect(last(seen)).toEqual({ status: 'ready', value: 'value for 7', refreshFailed: false });

    // A re-render with the same input is not a reason to load.
    await mounted.rerender(<Probe input="7" load={load} seen={seen} />);
    await settle();
    expect(calls).toEqual(['7']);

    await mounted.rerender(<Probe input="30" load={load} seen={seen} />);
    await settle();
    expect(calls).toEqual(['7', '30']);
    expect(last(seen)).toEqual({ status: 'ready', value: 'value for 30', refreshFailed: false });
  });

  it('keeps the previous value on screen while the next one loads', async () => {
    const pending = new Map<string, Deferred<string>>();
    const seen: Loadable<string>[] = [];
    const load = (input: string) => {
      const next = deferred<string>();
      pending.set(input, next);
      return next.promise;
    };
    mounted = await mount(<Probe input="a" load={load} seen={seen} />);
    pending.get('a')!.resolve('A');
    await settle();
    await mounted.rerender(<Probe input="b" load={load} seen={seen} />);
    await settle();
    expect(last(seen)).toEqual({ status: 'ready', value: 'A', refreshFailed: false });
    pending.get('b')!.resolve('B');
    await settle();
    expect(last(seen)).toEqual({ status: 'ready', value: 'B', refreshFailed: false });
  });

  it('never lets a late reply for an old input overwrite the newer one', async () => {
    const pending = new Map<string, Deferred<string>>();
    const seen: Loadable<string>[] = [];
    const load = (input: string) => {
      const next = deferred<string>();
      pending.set(input, next);
      return next.promise;
    };
    mounted = await mount(<Probe input="old" load={load} seen={seen} />);
    await mounted.rerender(<Probe input="new" load={load} seen={seen} />);
    pending.get('new')!.resolve('NEW');
    await settle();
    pending.get('old')!.resolve('OLD');
    await settle();
    expect(last(seen)).toEqual({ status: 'ready', value: 'NEW', refreshFailed: false });
    expect(seen.some((state) => state.status === 'ready' && state.value === 'OLD')).toBe(false);
  });

  it('marks a failed refresh stale without dropping what is shown', async () => {
    const seen: Loadable<string>[] = [];
    let broken = false;
    const load = async (input: string) => {
      if (broken) throw new Error('no');
      return input;
    };
    mounted = await mount(<Probe input="fine" load={load} seen={seen} />);
    await settle();
    broken = true;
    await mounted.rerender(<Probe input="fine" version={1} load={load} seen={seen} />);
    await settle();
    expect(last(seen)).toEqual({ status: 'ready', value: 'fine', refreshFailed: true });
  });

  it('reports a failed load for new inputs as a failure, never as the old value', async () => {
    // Yesterday's day, last range's figures: the value on screen answers a
    // question nobody is asking any more, so it is not offered as stale.
    const seen: Loadable<string>[] = [];
    const load = async (input: string) => {
      if (input === 'broken') throw new Error('no');
      return input;
    };
    mounted = await mount(<Probe input="fine" load={load} seen={seen} />);
    await settle();
    await mounted.rerender(<Probe input="broken" load={load} seen={seen} />);
    await settle();
    expect(last(seen).status).toBe('failed');
  });

  it('keeps a new input a failure through a refresh that fails as well', async () => {
    const seen: Loadable<string>[] = [];
    const load = async (input: string) => {
      if (input === 'broken') throw new Error('no');
      return input;
    };
    mounted = await mount(<Probe input="fine" load={load} seen={seen} />);
    await settle();
    await mounted.rerender(<Probe input="broken" load={load} seen={seen} />);
    await settle();
    await mounted.rerender(<Probe input="broken" version={1} load={load} seen={seen} />);
    await settle();
    expect(last(seen).status).toBe('failed');
  });

  it('reports a first load that fails as a failure, not as empty', async () => {
    const seen: Loadable<string>[] = [];
    mounted = await mount(<Probe input="x" load={async () => Promise.reject(new Error('down'))} seen={seen} />);
    await settle();
    expect(last(seen).status).toBe('failed');
  });

  it('reloads when a dependency held in state changes', async () => {
    const calls: number[] = [];
    let bump: () => void = () => undefined;
    function Counter() {
      const [version, setVersion] = useState(0);
      bump = () => setVersion((value) => value + 1);
      useLoadable(async () => {
        calls.push(version);
        return version;
      }, [version]);
      return null;
    }
    mounted = await mount(<Counter />);
    await settle();
    await act(async () => bump());
    await settle();
    expect(calls).toEqual([0, 1]);
  });
});
