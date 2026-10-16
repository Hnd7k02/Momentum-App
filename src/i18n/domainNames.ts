import type { OfferedDomainType } from '../core/domains';
import type { TranslationKey } from './index';

/**
 * The one name each area goes by, in every language (WP3 Stage 4, D143).
 *
 * The wellbeing area is **Mind** wherever it is named — the switch, the
 * Heute heading, the Areas card, Verlauf, Rang, the Boss weights and the
 * onboarding picker — while its stored id stays `mental` (D66). It used to
 * carry three names from three local maps ("Mental", "Mental Wellbeing",
 * "Wellbeing"); one map is what keeps it at one.
 *
 * Only the offered domains have a name. Food left the product (D139): its
 * days still replay, but nothing shows it, so nothing here can label it.
 */
export const DOMAIN_NAME_KEYS: Record<OfferedDomainType, TranslationKey> = {
  mental: 'domain.mental',
  gym: 'domain.gym',
  running: 'domain.running',
};
