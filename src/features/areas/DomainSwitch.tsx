import type { DomainTerminal } from '../../app/route';
import { useRadioKeys } from '../../domains/mental/AnswerControls';
import { useT } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n';
import { DOMAIN_NAME_KEYS } from '../../i18n/domainNames';
import './domainTerminal.css';

/**
 * The area selector at the top of the domain terminal: Mind · Gym.
 *
 * A segmented control in the iOS shape the app already uses, exposed as a
 * radio group: the assistive-technology reading is "which of these areas is
 * selected", which is exactly what the control is. One tab stop, arrow keys
 * move the selection, and the selected segment is announced as checked
 * rather than merely styled.
 *
 * It is an area selector, not a navigation bar — compact, one line, always
 * the same two, because the terminal is also where an area is switched on.
 */

const LABELS: Record<DomainTerminal, TranslationKey> = {
  mental: DOMAIN_NAME_KEYS.mental,
  gym: DOMAIN_NAME_KEYS.gym,
};

export function DomainSwitch({
  domains,
  active,
  onSelect,
}: {
  /** The areas on offer, in order. */
  domains: readonly DomainTerminal[];
  active: DomainTerminal;
  onSelect(domain: DomainTerminal): void;
}) {
  const t = useT();
  const onKeyDown = useRadioKeys(domains.length, (index) => onSelect(domains[index]!));
  const activeIndex = domains.indexOf(active);

  return (
    <div className="segmented domain-switch" role="radiogroup" aria-label={t('areas.terminalSwitch')}>
      {domains.map((domain, index) => (
        <button
          key={domain}
          type="button"
          role="radio"
          className="segmented__option domain-switch__option"
          aria-checked={domain === active}
          tabIndex={index === activeIndex || (activeIndex === -1 && index === 0) ? 0 : -1}
          onClick={() => onSelect(domain)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {t(LABELS[domain])}
        </button>
      ))}
    </div>
  );
}
