import { GYM, RUNNING } from '../../core/config/constants';
import { BubbleRow } from '../../components';
import { useT } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n';

type TargetDomain = 'gym' | 'running';

const LIMITS = {
  gym: GYM,
  running: RUNNING,
} as const;

const LABELS: Record<TargetDomain, TranslationKey> = {
  gym: 'onboarding.sport.gym',
  running: 'onboarding.sport.running',
};

/**
 * Sessions per week, as bubbles.
 *
 * A quota, not a schedule: the number says how often, never on which days.
 * Seven bubbles stand in one row at every width (STOP 6b; `ui.css`), and
 * seven is also the point where a weekly quota stops saying anything a daily
 * question would not.
 *
 * Gym and Running each get their own picker, because they are two
 * independent targets rather than one shared one — three gym sessions and two
 * runs is a week, not five of something.
 */
export function TargetPicker({
  domain,
  value,
  onChange,
}: {
  domain: TargetDomain;
  value: number | null;
  onChange(next: number): void;
}) {
  const t = useT();
  const limits = LIMITS[domain];
  const values = Array.from(
    { length: limits.MAX_TARGET_PER_WEEK - limits.MIN_TARGET_PER_WEEK + 1 },
    (_, index) => limits.MIN_TARGET_PER_WEEK + index,
  );

  return (
    <BubbleRow
      values={values}
      selected={value}
      onSelect={onChange}
      label={t(LABELS[domain])}
      describe={(count) => t('onboarding.sports.perWeek', { count })}
    />
  );
}
