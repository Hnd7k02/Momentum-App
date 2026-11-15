/** Types of `pruefdaten-plan.mjs`, for the test profile that reads the same plan. */

export interface PlannedSet {
  reps: number;
  /** For a bodyweight exercise: what was added to the body weight. */
  kg: number;
}

export interface PlannedExercise {
  id: string;
  /** What is typed into the live build's exercise search. */
  search: string;
  /** The name the live build shows. */
  name: string;
  bodyweight?: boolean;
}

/** One session: its exercises in the order they are done, each with its sets. */
export type PlannedWorkout = Record<string, PlannedSet[]>;

export const EXERCISES: Record<string, PlannedExercise>;
export const WRITTEN_WEEKS: number;
export const FIRST_DAY: string;
export const STAGE5B_LAST_DAY: string;
export const BODY_WEIGHT_ON_DAY: Record<number, number>;
export function dayOffset(day: string, days: number): string;
export function trainingBetween(first: string, last: string): Map<string, PlannedWorkout>;
export function answersOn(index: number): [sleep: number, mood: number];
