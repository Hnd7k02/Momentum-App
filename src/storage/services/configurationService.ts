import { GYM, RUNNING } from '../../core/config/constants';
import {
  DOMAIN_DEFINITIONS,
  DOMAIN_TYPES,
  activationOf,
  type DomainActivation,
  type OfferedDomainType,
} from '../../core/domains';
import type {
  DomainRecord,
  DomainType,
  QuestionCategory,
  QuestionRecord,
  QuestionStatus,
  QuestionType,
  SettingsRecord,
} from '../../core/model';
import { normaliseWeights, type BossWeights } from '../../core/boss';
import { ensureCurrentSnapshot, ensureFoodRetired, ensureSessionWindowEra } from '../configService';
import { ensurePromotionConfirmation } from './promotionConfirmationService';
import { legacySportPrompt, type LegacySportPrompt } from './legacySportService';
import {
  domainsRepository,
  questionsRepository,
  settingsRepository,
} from '../repositories';

/**
 * Everything the configuration surfaces read and write.
 *
 * Three invariants live here rather than in the UI:
 *
 * 1. A domain record is created the first time it is enabled, never before.
 *    A user who skips Running has no running domain at all, and scoring
 *    therefore excludes it rather than scoring it as zero.
 * 2. Every scoring-relevant change appends a configuration revision, so a
 *    past day is always read back through the configuration it was lived
 *    under. Changing the language does not, because it changes nothing that
 *    is scored.
 * 3. **Nothing here can create the generic `sports` domain.** There is no
 *    parameter for it and no branch that reaches it. It survives as a stored
 *    discriminator so a device carrying RC2 history can still replay it, and
 *    that is the whole of its remaining role.
 * 4. **Nothing here switches Food on** (D139, D140): `enableDomain` takes the
 *    offered domains only and refuses Food at run time too, onboarding has no
 *    field for it, and `loadConfiguration` switches off whatever is left on.
 */

export interface AppConfiguration {
  settings: SettingsRecord;
  /** One entry per live domain; `null` where the user has never enabled it. */
  domains: Record<DomainType, DomainRecord | null>;
  /** RC2's generic Sport domain, where a migrated device still carries one. */
  legacySport: DomainRecord | null;
  /**
   * Whether the migrated user still has to be asked what their RC2 Sport
   * sessions were, and what the answer would apply to.
   *
   * Carried here so there is one configuration load rather than a second
   * parallel one. It costs nothing on a profile that has no legacy data:
   * `legacySportPrompt` returns without reading the session log unless the
   * question is genuinely outstanding.
   */
  legacySportChoice: LegacySportPrompt;
  activation: DomainActivation;
  /** Every question, including paused and archived ones. */
  questions: QuestionRecord[];
}

export async function loadConfiguration(): Promise<AppConfiguration> {
  // Activates the promotion-confirmation era once, prospectively (D126).
  await ensurePromotionConfirmation();
  // The one-day window begins on this load, effective today (D132).
  await ensureSessionWindowEra();
  // Food is switched off from today wherever it is still on (D139). Before
  // the reads below, so this very load already shows Rang without it.
  await ensureFoodRetired();
  const [settings, domains, questions, legacySportChoice] = await Promise.all([
    settingsRepository.getOrCreate(),
    domainsRepository.list(),
    questionsRepository.list(),
    legacySportPrompt(),
  ]);

  const byType = Object.fromEntries(
    DOMAIN_TYPES.map((type) => [type, domains.find((domain) => domain.type === type) ?? null]),
  ) as Record<DomainType, DomainRecord | null>;

  return {
    settings,
    domains: byType,
    legacySport: domains.find((domain) => domain.type === 'sports') ?? null,
    legacySportChoice,
    activation: activationOf(domains),
    questions,
  };
}

/** The weekly quota a domain is set to, or `null` when it has none or is off. */
export function weeklyTargetOfDomain(domain: DomainRecord | null): number | null {
  if (!domain || !domain.enabled) return null;
  const settings = domain.settings as { targetPerWeek?: unknown };
  return typeof settings.targetPerWeek === 'number' ? settings.targetPerWeek : null;
}

const LIMITS: Partial<Record<DomainType, { min: number; max: number; fallback: number }>> = {
  gym: {
    min: GYM.MIN_TARGET_PER_WEEK,
    max: GYM.MAX_TARGET_PER_WEEK,
    fallback: GYM.DEFAULT_TARGET_PER_WEEK,
  },
  running: {
    min: RUNNING.MIN_TARGET_PER_WEEK,
    max: RUNNING.MAX_TARGET_PER_WEEK,
    fallback: RUNNING.DEFAULT_TARGET_PER_WEEK,
  },
};

export function clampWeeklyTarget(type: DomainType, target: number): number {
  const limits = LIMITS[type];
  if (!limits) return target;
  const rounded = Math.round(target);
  if (!Number.isFinite(rounded)) return limits.fallback;
  return Math.min(limits.max, Math.max(limits.min, rounded));
}

/**
 * Enables a domain, creating its record the first time.
 *
 * Re-enabling one keeps whatever settings it already had unless new ones are
 * given, so switching Gym off for a month and back on does not silently
 * reset the target the user chose.
 */
export async function enableDomain(
  type: OfferedDomainType,
  targetPerWeek?: number,
): Promise<DomainRecord> {
  // Food left the product (D139); the type keeps it out, and so does this.
  if ((type as DomainType) === 'food') throw new Error('Food cannot be switched on (D139)');
  const definition = DOMAIN_DEFINITIONS[type];
  const existing = await domainsRepository.findByType(type);

  const settings =
    definition.hasWeeklyTarget && targetPerWeek !== undefined
      ? { targetPerWeek: clampWeeklyTarget(type, targetPerWeek) }
      : undefined;

  let domain: DomainRecord;
  if (!existing) {
    domain = await domainsRepository.ensure(
      type,
      definition.order,
      (settings ?? definition.defaultSettings) as never,
    );
  } else {
    const enabled = (await domainsRepository.setEnabled(existing.id, true)) ?? existing;
    domain = settings
      ? ((await domainsRepository.updateSettings(enabled.id, settings as never)) ?? enabled)
      : enabled;
  }
  await ensureCurrentSnapshot();
  return domain;
}

/**
 * Disabling a domain stops it counting from today onwards. It never deletes
 * anything: the history stays, and the revisions record when it stopped.
 */
export async function disableDomain(id: string): Promise<void> {
  await domainsRepository.setEnabled(id, false);
  await ensureCurrentSnapshot();
}

export async function disableDomainType(type: DomainType): Promise<void> {
  const domain = await domainsRepository.findByType(type);
  if (domain) await disableDomain(domain.id);
}

export async function setWeeklyTarget(
  type: OfferedDomainType,
  targetPerWeek: number,
): Promise<DomainRecord> {
  return enableDomain(type, targetPerWeek);
}

/**
 * The relative parts the user has set for each domain, and the shares they
 * work out to.
 *
 * The user sets *importance*, not a budget: being asked to make four numbers
 * total exactly 100 is a spreadsheet. The parts are what they touch; the
 * percentages are arithmetic, shown live so nothing is normalised behind
 * their back.
 */
export interface BossWeighting {
  domain: DomainType;
  /** What the user set. Higher means more. */
  parts: number;
  /** The share of the Boss it works out to, 0 to 1. */
  share: number;
}

export function bossWeightingOf(configuration: AppConfiguration): BossWeighting[] {
  const enabled = configuration.activation.enabled;
  const raw = configuration.settings.bossWeights ?? {};
  const shares = normaliseWeights(raw, enabled);
  return enabled.map((domain) => ({
    domain,
    parts: raw[domain] ?? 1,
    share: shares[domain] ?? 0,
  }));
}

/**
 * Writes the weighting and appends a snapshot, which is what makes the change
 * apply from today forward and never to a day already lived.
 */
export async function setBossWeights(weights: BossWeights): Promise<void> {
  await settingsRepository.update({ bossWeights: weights });
  await ensureCurrentSnapshot();
}

/** Enables Wellbeing, which is where questions live. */
export async function enableMental(): Promise<DomainRecord> {
  return enableDomain('mental');
}

export interface QuestionDraft {
  text: string;
  type: QuestionType;
  /** Which part of life the question belongs to (D17). */
  category: QuestionCategory;
}

export async function addQuestion(draft: QuestionDraft): Promise<QuestionRecord> {
  const domain = await enableMental();
  const question = await questionsRepository.create({
    domainId: domain.id,
    text: draft.text,
    type: draft.type,
    category: draft.category,
  });
  await ensureCurrentSnapshot();
  return question;
}

/**
 * Editing a question never rewrites the past. The change takes effect from
 * today's revision onwards; days already scored keep the wording and type
 * they were answered under.
 */
export async function updateQuestion(
  id: string,
  patch: Partial<QuestionDraft>,
): Promise<QuestionRecord | undefined> {
  const updated = await questionsRepository.update(id, {
    ...(patch.text === undefined ? {} : { text: patch.text.trim() }),
    ...(patch.type === undefined ? {} : { type: patch.type }),
    ...(patch.category === undefined ? {} : { category: patch.category }),
  });
  await ensureCurrentSnapshot();
  return updated;
}

export async function setQuestionStatus(
  id: string,
  status: QuestionStatus,
): Promise<QuestionRecord | undefined> {
  const updated = await questionsRepository.setStatus(id, status);
  await ensureCurrentSnapshot();
  return updated;
}

export const pauseQuestion = (id: string) => setQuestionStatus(id, 'paused');
export const resumeQuestion = (id: string) => setQuestionStatus(id, 'active');
/** Archiving hides a question. Its answers stay, and old days keep counting. */
export const archiveQuestion = (id: string) => setQuestionStatus(id, 'archived');

/**
 * What onboarding chose.
 *
 * A weekly target of `null` — or an omitted field — means the domain was not
 * switched on. Omission defaults to *off* rather than on, so a caller that
 * forgets a field can only ever fail to enable something, never enable
 * something the user did not ask for.
 *
 * There is deliberately no field for the legacy Sport domain, and none for
 * Food (D139). That is how "no path in the new product creates one" is
 * enforced rather than merely intended: the parameter does not exist to be
 * passed.
 */
export interface OnboardingSelection {
  questions: QuestionDraft[];
  gymTargetPerWeek?: number | null;
  runningTargetPerWeek?: number | null;
}

/**
 * Writes the choices made during onboarding and marks it complete.
 *
 * Every domain is optional: an empty selection is valid and leaves the user
 * on an app with nothing configured but everything reachable.
 */
export async function applyOnboarding(selection: OnboardingSelection): Promise<AppConfiguration> {
  if (selection.questions.length > 0) {
    const domain = await enableMental();
    let order = 0;
    for (const draft of selection.questions) {
      await questionsRepository.create({
        domainId: domain.id,
        text: draft.text,
        type: draft.type,
        category: draft.category,
        order: order++,
      });
    }
  }

  const gym = selection.gymTargetPerWeek ?? null;
  const running = selection.runningTargetPerWeek ?? null;
  if (gym !== null) await enableDomain('gym', gym);
  if (running !== null) await enableDomain('running', running);

  await ensureCurrentSnapshot();
  await settingsRepository.completeOnboarding();
  return loadConfiguration();
}

/** Lets the user run onboarding again from Areas without losing history. */
export async function resetOnboardingFlag(): Promise<void> {
  await settingsRepository.update({ onboardingCompletedAt: null });
}
