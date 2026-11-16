import { describe, expect, it, vi } from 'vitest';
import { stillness } from './stillness';

/**
 * No glass over a moving body (D146, block 7B): the gate between a sheet
 * that wants to stand and whatever can still draw beneath it.
 */
describe('the gate between a sheet and a moving body', () => {
  it('with nothing that can move, everything is still at once', () => {
    expect(stillness.isStill()).toBe(true);
    expect(stillness.isWanted()).toBe(false);
  });

  it('a mover is not still until it says so, and is forgotten when it leaves', () => {
    const body = stillness.join();
    expect(stillness.isStill()).toBe(false);
    body.rest(true);
    expect(stillness.isStill()).toBe(true);
    body.rest(false);
    expect(stillness.isStill()).toBe(false);
    body.leave();
    expect(stillness.isStill()).toBe(true);
  });

  it('a sheet asks, the mover is told, and the sheet is told when the mover rests', () => {
    const body = stillness.join();
    const told = vi.fn();
    const stop = stillness.subscribe(told);
    const release = stillness.ask();
    expect(stillness.isWanted()).toBe(true);
    expect(told).toHaveBeenCalledTimes(1);
    expect(stillness.isStill()).toBe(false);
    body.rest(true);
    expect(told).toHaveBeenCalledTimes(2);
    expect(stillness.isStill()).toBe(true);
    release();
    expect(stillness.isWanted()).toBe(false);
    expect(told).toHaveBeenCalledTimes(3);
    stop();
    body.leave();
  });

  it('stays wanted until the last of two sheets has gone, and a release counts once', () => {
    const first = stillness.ask();
    const second = stillness.ask();
    first();
    first();
    expect(stillness.isWanted()).toBe(true);
    second();
    expect(stillness.isWanted()).toBe(false);
  });

  it('every mover has to rest, not one of two', () => {
    const one = stillness.join();
    const two = stillness.join();
    one.rest(true);
    expect(stillness.isStill()).toBe(false);
    two.rest(true);
    expect(stillness.isStill()).toBe(true);
    one.leave();
    two.leave();
  });

  it('says nothing twice: a mover that reports the same state again tells nobody', () => {
    const body = stillness.join();
    const told = vi.fn();
    const stop = stillness.subscribe(told);
    body.rest(true);
    body.rest(true);
    expect(told).toHaveBeenCalledTimes(1);
    stop();
    body.leave();
  });
});
