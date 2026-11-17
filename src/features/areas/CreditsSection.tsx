import { useState } from 'react';
import { Card, Row, Section, Sheet } from '../../components';
import { ChevronRightIcon } from '../../components/Icons';
import { useT } from '../../i18n/I18nProvider';

const MODEL_URL = 'https://static.makehumancommunity.org/mpfb.html';
const LICENCE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';

/**
 * Credits, in Settings.
 *
 * The body is built from MakeHuman's base mesh and shape data, which are
 * released under CC0 1.0: no credit is owed (D165). Momentum names the
 * source all the same, and says what it did with it. That belongs on a page
 * somebody can open, not under the body itself: a permanent legal block
 * beneath a picture of your muscles respects neither the source nor the
 * screen. Until block 7A the body was another model, under CC BY 4.0; what is
 * left of it in the repository is credited in `THIRD-PARTY-NOTICES.md`.
 */
export function CreditsSection() {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <Section label={t('areas.credits')}>
      <Card>
        <Row
          title={t('areas.credits.body')}
          subtitle={t('areas.credits.bodySubtitle')}
          trailing={<ChevronRightIcon size={18} />}
          onClick={() => setOpen(true)}
        />
      </Card>

      <Sheet open={open} title={t('areas.credits')} onClose={() => setOpen(false)}>
        <div className="metric-sheet__body">
          <p>{t('gym.body.credit')}</p>
          <p className="credits__links">
            <a href={MODEL_URL} target="_blank" rel="noopener noreferrer">
              {t('gym.body.credit.model')}
            </a>
            <a href={LICENCE_URL} target="_blank" rel="noopener noreferrer">
              {t('gym.body.credit.license')}
            </a>
          </p>
          <p className="metric-sheet__note">{t('areas.credits.modified')}</p>
        </div>
      </Sheet>
    </Section>
  );
}
