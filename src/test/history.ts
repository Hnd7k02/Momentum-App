/**
 * A history for tests of what Back closes (block 7C; shared since the
 * tidy-up of WP3).
 *
 * The test DOM does not walk its history, so a small one stands in that
 * behaves as a browser's does where it matters here: `pushState` is at
 * once, a traversal lands in a later task and reports with `popstate`.
 */
interface Entry {
  state: unknown;
  url: string;
}

export class FakeHistory {
  entries: Entry[] = [{ state: null, url: '#/areas/gym/muscles' }];
  index = 0;
  get state(): unknown {
    return this.entries[this.index]!.state;
  }
  get length(): number {
    return this.entries.length;
  }
  get url(): string {
    return this.entries[this.index]!.url;
  }
  pushState(state: unknown, _unused: string, url?: string): void {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ state, url: url ?? this.url });
    this.index += 1;
  }
  replaceState(state: unknown, _unused: string, url?: string): void {
    this.entries[this.index] = { state, url: url ?? this.url };
  }
  go(delta: number): void {
    setTimeout(() => {
      const next = this.index + delta;
      if (next < 0 || next >= this.entries.length) return;
      this.index = next;
      window.dispatchEvent(new PopStateEvent('popstate', { state: this.state }));
    }, 0);
  }
  back(): void {
    this.go(-1);
  }
  forward(): void {
    this.go(1);
  }
}
