import { useState } from 'react';
import { Switch } from '../../components';
import { useT } from '../../i18n/I18nProvider';
import { useMeasuring } from './BodyReadout';
import { setMeasuring } from './measure';
import './measure.css';

/**
 * The switch of the measuring display, in the settings (block 7B, D181).
 *
 * Everyday words: what it shows and where. It is stored in the browser's
 * local storage and nowhere in the app's data, so it survives the reload it
 * exists for and never enters a backup. Where the browser will not store
 * it, the switch falls back and says so — a display that would be gone
 * after the next start is not switched on.
 */
export function MeasureSetting() {
  const t = useT();
  const on = useMeasuring();
  const [blocked, setBlocked] = useState(false);

  return (
    <div className="measure-setting">
      <span className="measure-setting__text">
        <span className="measure-setting__name">{t('measure.setting')}</span>
        <span className="measure-setting__hint">{t('measure.settingHint')}</span>
        {blocked ? (
          <span className="measure-setting__hint" role="status">
            {t('measure.settingBlocked')}
          </span>
        ) : null}
      </span>
      <Switch
        checked={on}
        label={t('measure.setting')}
        onChange={(next) => setBlocked(next && !setMeasuring(next))}
      />
    </div>
  );
}
