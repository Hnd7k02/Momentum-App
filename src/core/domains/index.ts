import { GYM, RUNNING } from '../config/constants';
import type {
  AppConfigSnapshot,
  DomainRecord,
  DomainSettingsFor,
  DomainType,
  StoredDomainType,
} from '../model';

/**
 * The domain registry (§4 of iteration 2).
 *
 * RC2 had two domains written into the scoring path by name. Iteration 2 has
 * four, and will have more, so "which domains exist and what does each one
 * need" is a table rather than a series of `if (type === 'sports')` branches.
 * Everything downstream — activation, the ledger, the Boss weighting — reads
 * this table instead of hard-coding a list.
 *
 * Three properties are load-bearing:
 *
 * 1. **`mental` is the stored name of Mind** (D66, D143). Renaming a
 *    discriminator every answer row references would be a data migration in
 *    exchange for a label, and the label belongs in the string layer.
 * 2. **`sports` is not in `DOMAIN_TYPES`.** RC2's generic Sport domain is
 *    history that still has to type-check and still has to be replayable; it
 *    is not a domain anyone can hold. Anything iterating live domains must
 *    iterate this list and will therefore never resurrect it.
 * 3. **`food` is in `DOMAIN_TYPES` and not in `OFFERED_DOMAIN_TYPES`** (D139).
 *    Food left the product in WP3 Stage 4, but the days it was on still
 *    replay with it — its ledger, its share of the Boss on those days — so
 *    the replay keeps iterating it. Nothing that offers a choice may.
 */

/** Every domain the replay knows, in display order — Food included (D139). */
export const DOMAIN_TYPES: DomainType[] = ['mental', 'gym', 'running', 'food'];

/** The domains a user can switch on: Mind and Gym, Laufen included (D139). */
export type OfferedDomainType = Exclude<DomainType, 'food'>;
export const OFFERED_DOMAIN_TYPES: OfferedDomainType[] = ['mental', 'gym', 'running'];

export function isOfferedDomain(type: StoredDomainType): type is OfferedDomainType {
  return (OFFERED_DOMAIN_TYPES as StoredDomainType[]).includes(type);
}

/**
 * How a domain earns its daily score.
 *
 * - `daily`  — judged on what was recorded that calendar day.
 * - `weekly` — judged on sessions against a weekly quota, so a rest day
 *              inside a training week is not absence.
 */
export type DomainCadence = 'daily' | 'weekly';

export interface DomainDefinition<T extends DomainType> {
  type: T;
  /** Default position in Today and Areas. */
  order: number;
  cadence: DomainCadence;
  /** Whether the user picks a number of sessions per week for this domain. */
  hasWeeklyTarget: boolean;
  defaultSettings: DomainSettingsFor<T>;
}

export const DOMAIN_DEFINITIONS: { [T in DomainType]: DomainDefinition<T> } = {
  mental: {
    type: 'mental',
    order: 0,
    cadence: 'daily',
    hasWeeklyTarget: false,
    defaultSettings: {},
  },
  gym: {
    type: 'gym',
    order: 1,
    cadence: 'weekly',
    hasWeeklyTarget: true,
    defaultSettings: { targetPerWeek: GYM.DEFAULT_TARGET_PER_WEEK },
  },
  running: {
    type: 'running',
    order: 2,
    cadence: 'weekly',
    hasWeeklyTarget: true,
    defaultSettings: { targetPerWeek: RUNNING.DEFAULT_TARGET_PER_WEEK },
  },
  food: {
    type: 'food',
    order: 3,
    cadence: 'daily',
    hasWeeklyTarget: false,
    defaultSettings: {},
  },
};

export function domainDefinition<T extends DomainType>(type: T): DomainDefinition<T> {
  return DOMAIN_DEFINITIONS[type];
}

/** RC2's generic Sport domain, which is history rather than a live domain. */
export function isLegacyDomain(type: StoredDomainType): type is 'sports' {
  return type === 'sports';
}

export function isLiveDomain(type: StoredDomainType): type is DomainType {
  return !isLegacyDomain(type);
}

/**
 * Every domain judged on a weekly quota, **including RC2's legacy Sport**.
 *
 * The legacy domain belongs here and nowhere else: it is not a domain anyone
 * can hold any more, but the weeks it was scored in still have to replay by
 * the rule they were scored by. Anything that reconstructs the past iterates
 * this list; anything that offers the user a choice iterates
 * `OFFERED_DOMAIN_TYPES`.
 */
export const WEEKLY_DOMAIN_TYPES: StoredDomainType[] = ['sports', 'gym', 'running'];

/** The weekly quota a domain was configured with, or `null` if it has none. */
export function weeklyTargetOf(
  domain: { type: StoredDomainType; enabled: boolean; settings: unknown },
): number | null {
  if (!domain.enabled) return null;
  const settings = domain.settings as { targetPerWeek?: unknown };
  return typeof settings?.targetPerWeek === 'number' ? settings.targetPerWeek : null;
}

/**
 * The weekly quotas a past day was lived under, read from its snapshot.
 *
 * A domain that was disabled that week is absent rather than zero: it asked
 * for nothing, so nothing was missed.
 */
export function weeklyTargetsIn(
  snapshot: AppConfigSnapshot,
): { domain: StoredDomainType; target: number }[] {
  const targets: { domain: StoredDomainType; target: number }[] = [];
  for (const type of WEEKLY_DOMAIN_TYPES) {
    const domain = snapshot.domains.find((entry) => entry.type === type);
    if (!domain) continue;
    const target = weeklyTargetOf(domain);
    if (target === null) continue;
    targets.push({ domain: type, target });
  }
  return targets;
}

/** One domain's weekly quota in a past snapshot, or `null` if it had none. */
export function weeklyTargetIn(
  snapshot: AppConfigSnapshot,
  type: StoredDomainType,
): number | null {
  return weeklyTargetsIn(snapshot).find((entry) => entry.domain === type)?.target ?? null;
}

/* ── Activation ────────────────────────────────────────────────────────── */

/**
 * Which domains a user has switched on.
 *
 * Activation is a *configuration* fact, so it lives in the domain records and
 * is captured by a config snapshot on every change. That is what makes
 * enabling Running in June leave January alone: January resolves to a
 * snapshot in which Running does not exist, and a domain that did not exist
 * cannot have missed anything.
 */
export interface DomainActivation {
  enabled: DomainType[];
  /** Domains the user could still switch on — never Food (D139). */
  available: OfferedDomainType[];
  /** True while RC2's generic Sport domain is still present and enabled. */
  legacySportActive: boolean;
}

export function activationOf(domains: readonly DomainRecord[]): DomainActivation {
  const enabled = DOMAIN_TYPES.filter((type) =>
    domains.some((domain) => domain.type === type && domain.enabled),
  );
  return {
    enabled,
    available: OFFERED_DOMAIN_TYPES.filter((type) => !enabled.includes(type)),
    legacySportActive: domains.some((domain) => domain.type === 'sports' && domain.enabled),
  };
}

/**
 * The domains a *past* day was lived under.
 *
 * Reads the snapshot rather than today's records, which is the whole point of
 * snapshots: a domain switched off last week still scored the weeks before.
 */
export function enabledDomainsIn(snapshot: AppConfigSnapshot): DomainType[] {
  return DOMAIN_TYPES.filter((type) =>
    snapshot.domains.some((domain) => domain.type === type && domain.enabled),
  );
}

/** True when the snapshot still carried RC2's generic Sport domain. */
export function legacySportEnabledIn(snapshot: AppConfigSnapshot): boolean {
  return snapshot.domains.some((domain) => domain.type === 'sports' && domain.enabled);
}

/**
 * Why a proposed activation cannot be saved.
 *
 * Switching everything off would leave a user with an app that scores
 * nothing and a Boss Rank with no contributors — not an empty state anyone
 * designed, just an undefined one. Wellbeing is not privileged here: any one
 * domain is enough.
 */
export type ActivationProblem = 'empty';

export function activationProblem(next: readonly DomainType[]): ActivationProblem | null {
  return next.length === 0 ? 'empty' : null;
}
