/**
 * No glass over a moving body (D146, block 7B).
 *
 * A sheet is glass: it blurs what lies under it, and its scrim dims it.
 * Blurring a canvas that is still drawing costs a blur per frame, so the
 * rule is that a sheet stands over a *still* body. This is the one place
 * the two meet without knowing each other:
 *
 * - whatever can still draw by itself — today the 3D body's viewer — joins
 *   as a **mover**, and says when it has come to rest and will draw nothing
 *   more by itself;
 * - a sheet that is about to stand **asks for stillness**, and stands once
 *   every mover has said so.
 *
 * With no mover on the screen — every screen but Muskelgruppen — a sheet
 * stands at once, in the render that opened it, exactly as before. On
 * Muskelgruppen a body that is at rest answers in the same tick; one that
 * coasts stops; one that travels to a group the user chose in the list
 * finishes that travel first. While a sheet stands the mover is held, and
 * it is released when the last sheet has gone.
 *
 * It is a general gate rather than a prop on two sheets so that the rule
 * holds for a sheet nobody thought of: the plan chooser that opens from
 * the empty state, and whatever a later block opens over the body.
 */

type Listener = () => void;

interface Mover {
  still: boolean;
}

const movers = new Set<Mover>();
const listeners = new Set<Listener>();
/** Sheets that stand or are about to. */
let wanted = 0;

function emit(): void {
  for (const listener of [...listeners]) listener();
}

export const stillness = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Whether something asks the movers to hold still. */
  isWanted(): boolean {
    return wanted > 0;
  },

  /** Whether nothing on the screen can draw by itself: every mover rests, or there is none. */
  isStill(): boolean {
    for (const mover of movers) if (!mover.still) return false;
    return true;
  },

  /** A sheet asks for stillness. Returns the release, to call when it has gone. */
  ask(): () => void {
    wanted += 1;
    emit();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      wanted -= 1;
      emit();
    };
  },

  /** Something that can draw by itself joins; it reports with `rest` and leaves when it is gone. */
  join(): { rest(still: boolean): void; leave(): void } {
    const mover: Mover = { still: false };
    movers.add(mover);
    emit();
    return {
      rest(still: boolean) {
        if (mover.still === still) return;
        mover.still = still;
        emit();
      },
      leave() {
        if (movers.delete(mover)) emit();
      },
    };
  },
};
