import { useEffect, useId, useMemo, useState } from 'react';
import type {
  DomainRecord,
  DomainType,
  Language,
  QuestionCategory,
  QuestionRecord,
} from '../../core/model';
import { QUESTION_CATEGORIES } from '../../core/model';
import { useRadioKeys } from '../../domains/mental/AnswerControls';
import { LEGACY_SPORT_CHOICES, type LegacySportChoice } from '../../core/migration/legacySport';
import {
  Button,
  Card,
  EmptyState,
  Row,
  Section,
  Segmented,
  SelectionMark,
  Switch,
} from '../../components';
import {
  ActivityIcon,
  ArchiveIcon,
  ChevronRightIcon,
  PlusIcon,
  SparkIcon,
} from '../../components/Icons';
import { QuestionSheet, type QuestionSheetSubmit } from '../../domains/mental/QuestionSheet';
import {
  questionStatusBadgeKey,
  questionTypeBadgeKey,
} from '../../domains/mental/questionLabels';
import { CATEGORY_LABEL_KEYS } from '../../domains/mental/questionLibrary';
import { TargetPicker } from '../../domains/sports/TargetPicker';
import { BackupSection } from '../backup/BackupSection';
import { useI18n, useT } from '../../i18n/I18nProvider';
import { LANGUAGES, type TranslationKey } from '../../i18n';
import {
  foodFocusOf,
  weeklyTargetOfDomain,
  FOOD_FOCUS_MAX_LENGTH,
  type AppConfiguration,
} from '../../storage/services/configurationService';
import { PauseSection } from '../pause/PauseSection';
import { MetricBoard } from '../../components/metrics';
import { TERMINALS, type DomainTerminal, type GymSection } from '../../app/route';
import { GymMusclesScreen } from '../gym/GymMusclesScreen';
import { DomainStandingTile } from './DomainStandingTile';
import { DomainSwitch } from './DomainSwitch';
import { GymTerminal } from './GymTerminal';
import { RunningTerminal } from './RunningTerminal';
import { CreditsSection } from './CreditsSection';
import '../food/food.css';
import '../progress/progress.css';
import './areas.css';
import './domainTerminal.css';
import { WEIGHT_UNITS, weightUnitOf, type WeightUnit } from '../../core/gym/weight';

/**
 * Asking a migrated user, once, what their RC2 Sport sessions were.
 *
 * It lives inside the card that already explains the retired domain, because
 * that card is where somebody goes to ask "where did my old training go?" —
 * and the answer to that question and the question itself belong together.
 *
 * **It is offered, never imposed.** There is no blocking step and no timeout
 * that picks a branch: a user who scrolls past this loses nothing, keeps a
 * fully working app, and is asked again next time. That is the whole of
 * `core/migration/legacySport.ts`'s "no branch runs by itself", carried into
 * the interface rather than only asserted in a test.
 *
 * The choice is confirmed rather than saved on tap. Every other selection in
 * this app is one calendar day and reversible inside the edit window; this
 * one writes a year of sessions into a different log, retires a domain and is
 * asked only once, so it gets a deliberate second action.
 */
const LEGACY_CHOICE_COPY: Record<
  LegacySportChoice,
  { title: TranslationKey; body: TranslationKey }
> = {
  gym: { title: 'legacySport.choice.gym', body: 'legacySport.choice.gym.body' },
  running: { title: 'legacySport.choice.running', body: 'legacySport.choice.running.body' },
  kept: { title: 'legacySport.choice.kept', body: 'legacySport.choice.kept.body' },
};

function LegacySportChoiceForm({
  sessions,
  onChoose,
}: {
  sessions: number;
  onChoose(choice: LegacySportChoice): void;
}) {
  const t = useT();
  const [picked, setPicked] = useState<LegacySportChoice | null>(null);
  const onKeyDown = useRadioKeys(LEGACY_SPORT_CHOICES.length, (index) =>
    setPicked(LEGACY_SPORT_CHOICES[index] ?? null),
  );

  return (
    <div className="legacy-choice">
      <p className="legacy-choice__lead">
        {sessions === 1
          ? t('legacySport.ask.leadOne')
          : t('legacySport.ask.lead', { count: sessions })}
      </p>

      <div className="legacy-choice__options" role="radiogroup" aria-label={t('legacySport.ask.title')}>
        {LEGACY_SPORT_CHOICES.map((choice, index) => {
          const copy = LEGACY_CHOICE_COPY[choice];
          const selected = picked === choice;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={selected}
              // One tab stop for the group, like every other single choice here.
              tabIndex={selected || (picked === null && index === 0) ? 0 : -1}
              className={`legacy-choice__option ${
                selected ? 'legacy-choice__option--on' : ''
              }`.trim()}
              onClick={() => setPicked(choice)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="legacy-choice__body">
                <span className="legacy-choice__title">{t(copy.title)}</span>
                <span className="legacy-choice__hint">{t(copy.body)}</span>
              </span>
              <SelectionMark selected={selected} />
            </button>
          );
        })}
      </div>

      {/* True in all three branches, and the thing a user is most likely to
          be afraid of. Verified by the migration suite, not merely claimed. */}
      <p className="legacy-choice__note">{t('legacySport.ask.safe')}</p>
      <p className="legacy-choice__note">{t('legacySport.ask.once')}</p>

      <Button
        variant="primary"
        block
        disabled={picked === null}
        onClick={() => {
          if (picked) onChoose(picked);
        }}
      >
        {t('legacySport.ask.confirm')}
      </Button>
    </div>
  );
}

/**
 * Food's setup, in full.
 *
 * One sentence, in the user's words, saying what they are trying to eat
 * like. There is deliberately no calorie target, no macro split and no
 * body-composition model here: what those should be is a product decision
 * that has not been made, and inventing one to fill the screen would be
 * indistinguishable afterwards from having decided it.
 *
 * The field is optional. Food scores exactly the same with it empty — the
 * daily rating is the user's own judgement either way — so leaving it blank
 * costs nothing but a reminder.
 */
function FoodFocusEditor({
  value,
  onSave,
}: {
  value: string;
  onSave(focus: string): void;
}) {
  const t = useT();
  const fieldId = useId();
  const [draft, setDraft] = useState(value);

  // The saved value wins whenever it changes underneath — a restore, or a
  // save landing — without stranding what the user is currently typing.
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="food-focus">
      <label className="food-focus__label" htmlFor={fieldId}>
        {t('food.focus.label')}
      </label>
      <textarea
        id={fieldId}
        className="food-focus__input"
        rows={2}
        maxLength={FOOD_FOCUS_MAX_LENGTH}
        placeholder={t('food.focus.placeholder')}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <p className="food-focus__hint">{t('food.focus.hint')}</p>
      <Button
        variant="secondary"
        disabled={draft.trim() === value.trim()}
        onClick={() => onSave(draft)}
      >
        {t('food.focus.save')}
      </Button>
    </div>
  );
}

export interface AreasActions {
  /** Reloads everything after a restore replaced the profile. */
  reload(): void;
  enableDomain(type: DomainType): void;
  disableDomain(type: DomainType): void;
  setWeeklyTarget(type: DomainType, target: number): void;
  /** Only ever switches the retired domain off — never on. */
  disableLegacySport(): void;
  /** Answers, once, what RC2's generic Sport sessions actually were. */
  chooseLegacySport(choice: LegacySportChoice): void;
  addQuestion(draft: QuestionSheetSubmit): void;
  updateQuestion(id: string, draft: QuestionSheetSubmit): void;
  pauseQuestion(id: string): void;
  resumeQuestion(id: string): void;
  archiveQuestion(id: string): void;
  /** Food's whole setup: the user's own sentence, or '' to clear it. */
  setFoodFocus(focus: string): void;
  setLanguage(language: Language): void;
  setWeightUnit(unit: WeightUnit): void;
}

const DOMAIN_COPY: Record<DomainType, { name: TranslationKey; description: TranslationKey; off: TranslationKey }> = {
  mental: {
    name: 'domain.wellbeing',
    description: 'domain.wellbeing.description',
    off: 'areas.wellbeing.offTitle',
  },
  gym: { name: 'domain.gym', description: 'domain.gym.description', off: 'areas.gym.offTitle' },
  running: {
    name: 'domain.running',
    description: 'domain.running.description',
    off: 'areas.running.offTitle',
  },
  food: { name: 'domain.food', description: 'domain.food.description', off: 'areas.food.offTitle' },
};

const TARGET_VALUE_KEYS: Partial<Record<DomainType, TranslationKey>> = {
  gym: 'areas.gym.targetValue',
  running: 'areas.running.targetValue',
};

/**
 * Bereiche: the domain terminal.
 *
 * One switch — Mental · Gym · Ernährung — and beneath it one area's whole
 * workspace: what the area shows about itself, and the card that switches
 * it on and configures it. Exactly one area is rendered at a time; when Gym
 * is open nothing of Mental or Ernährung is on the page. The active area is
 * part of the route (`#/areas/<area>`), so the switch derives from it and
 * writes to it, and Back walks the areas visited.
 *
 * Today answers "how am I doing today and overall", Verlauf "how has the
 * whole record developed"; this screen answers "show me this area in
 * detail". Each domain card still reads as a life area rather than a
 * settings panel: enabling Gym and choosing its target are one gesture in
 * one place.
 *
 * Below the area, unchanged by the switch, sits what is not one of the three:
 * Laufen — a full domain whose place in this terminal is an open product
 * decision, so it keeps its card and its board on Verlauf until that is
 * made — the pause, RC2's retired Sport (shown only where a migrated device
 * still carries it, with a switch that only turns it **off**), the backup
 * and the language.
 */
export function AreasScreen({
  configuration,
  actions,
  terminal,
  section,
  onSelectTerminal,
  onOpenSection,
}: {
  configuration: AppConfiguration;
  actions: AreasActions;
  terminal: DomainTerminal;
  /** A destination inside the Gym area, or nothing for the area itself. */
  section?: GymSection | undefined;
  onSelectTerminal(terminal: DomainTerminal): void;
  onOpenSection(section: GymSection | undefined): void;
}) {
  const t = useT();
  const { language } = useI18n();
  const [editing, setEditing] = useState<QuestionRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  const { domains, legacySport, questions } = configuration;

  const { live, archived } = useMemo(
    () => ({
      live: questions.filter((question) => question.status !== 'archived'),
      archived: questions.filter((question) => question.status === 'archived'),
    }),
    [questions],
  );

  /**
   * Questions grouped the way the score groups them.
   *
   * A user looking at six questions under Alltag and one under Mental can
   * see, without being told, why the day reads the way it does. A flat list
   * hides exactly that.
   */
  const byCategory = useMemo(() => {
    const groups = new Map<QuestionCategory, QuestionRecord[]>();
    for (const question of live) {
      const list = groups.get(question.category) ?? [];
      list.push(question);
      groups.set(question.category, list);
    }
    return QUESTION_CATEGORIES.filter((category) => (groups.get(category)?.length ?? 0) > 0).map(
      (category) => ({ category, questions: groups.get(category)! }),
    );
  }, [live]);

  const questionRow = (question: QuestionRecord) => {
    const statusKey = questionStatusBadgeKey(question.status);
    return (
      <Row
        key={question.id}
        title={question.text}
        muted={question.status === 'paused'}
        onClick={() => setEditing(question)}
        trailing={
          <>
            {statusKey ? <span className="badge badge--paused">{t(statusKey)}</span> : null}
            <span className={`badge badge--${question.type}`}>
              {t(questionTypeBadgeKey(question.type))}
            </span>
            <ChevronRightIcon size={18} />
          </>
        }
      />
    );
  };

  const domainCard = (type: DomainType, domain: DomainRecord | null) => {
    const on = Boolean(domain?.enabled);
    const copy = DOMAIN_COPY[type];
    const target = weeklyTargetOfDomain(domain);
    const targetKey = TARGET_VALUE_KEYS[type];

    return (
      <Section key={type}>
        <Card rows>
          <div className="areas__domainHeader">
            <span className={`areas__domainMark areas__domainMark--${type}`} aria-hidden="true">
              {type === 'mental' || type === 'food' ? (
                <SparkIcon size={22} />
              ) : (
                <ActivityIcon size={22} />
              )}
            </span>
            <span className="row__body">
              <span className="areas__domainName">{t(copy.name)}</span>
              <span className="areas__domainDescription">{t(copy.description)}</span>
            </span>
            <Switch
              checked={on}
              label={t(copy.name)}
              accent={`var(--domain-${type}-mid)`}
              onChange={(next) =>
                next ? actions.enableDomain(type) : actions.disableDomain(type)
              }
            />
          </div>

          <div className="areas__domainBody">
            {!on ? (
              <EmptyState
                title={t(copy.off)}
                body={type === 'mental' ? t('areas.mental.offBody') : t('areas.training.offBody')}
              />
            ) : type === 'mental' ? (
              live.length === 0 ? (
                <EmptyState
                  title={t('areas.mental.emptyTitle')}
                  body={t('areas.mental.emptyBody')}
                  action={
                    <Button variant="secondary" onClick={() => setCreating(true)}>
                      <PlusIcon size={18} />
                      {t('areas.mental.add')}
                    </Button>
                  }
                />
              ) : (
                <>
                  {byCategory.map((group) => (
                    <div key={group.category}>
                      <div className="areas__subhead">
                        <span>{t(CATEGORY_LABEL_KEYS[group.category])}</span>
                        <span className="areas__subheadCount">
                          {group.questions.length === 1
                            ? t('areas.category.countOne')
                            : t('areas.category.count', { count: group.questions.length })}
                        </span>
                      </div>
                      {group.questions.map(questionRow)}
                    </div>
                  ))}
                  <div className="areas__addRow">
                    <Row
                      title={t('areas.mental.add')}
                      onClick={() => setCreating(true)}
                      leading={<PlusIcon size={20} />}
                    />
                  </div>
                </>
              )
            ) : targetKey ? (
              <div className="areas__targetBlock">
                <div className="areas__targetHeader">
                  <span className="areas__targetLabel">{t('areas.training.target')}</span>
                  <span className="areas__targetValue">{t(targetKey, { count: target ?? 0 })}</span>
                </div>
                <TargetPicker
                  domain={type === 'gym' ? 'gym' : 'running'}
                  value={target}
                  onChange={(next) => actions.setWeeklyTarget(type, next)}
                />
              </div>
            ) : type === 'food' ? (
              <FoodFocusEditor
                value={foodFocusOf(configuration) ?? ''}
                onSave={actions.setFoodFocus}
              />
            ) : (
              <p className="areas__note">{t('areas.food.on')}</p>
            )}

            {type === 'mental' && on && archived.length > 0 ? (
              <>
                <button
                  type="button"
                  className="areas__archiveToggle"
                  onClick={() => setShowArchive((value) => !value)}
                  aria-expanded={showArchive}
                >
                  <ArchiveIcon size={16} />
                  {showArchive
                    ? t('areas.archiveHide')
                    : t('areas.archiveShow', { count: archived.length })}
                </button>
                {showArchive ? archived.map(questionRow) : null}
              </>
            ) : null}
          </div>
        </Card>
      </Section>
    );
  };

  // Muskelgruppen is its own destination inside the Gym area (WP2-2): the
  // one screen that renders the 3D body, reached from the hub and by link.
  if (terminal === 'gym' && section === 'muscles') {
    return <GymMusclesScreen onBack={() => onOpenSection(undefined)} />;
  }

  return (
    <div className="screen">
      <header className="screen__header screen__header--terminal">
        <h1 className="screen__title">{t('nav.areas')}</h1>
        <p className="screen__subtitle">{t('areas.subtitle')}</p>
        <DomainSwitch domains={TERMINALS} active={terminal} onSelect={onSelectTerminal} />
      </header>

      <div className="areas__scroll" data-terminal={terminal}>
        {/* One area at a time: its standing or board, then its own card. */}
        {terminal === 'mental' ? (
          <>
            <MetricBoard>
              <DomainStandingTile domain="mental" id="mental-standing" />
            </MetricBoard>
            {domainCard('mental', domains.mental)}
          </>
        ) : null}
        {terminal === 'gym' ? (
          <>
            <GymTerminal onOpenMuscles={() => onOpenSection('muscles')} />
            {domainCard('gym', domains.gym)}

            {/*
              Laufen lives inside this workspace rather than beside it: it is
              training, it is where the user comes to look at training, and it
              has no terminal of its own. Its own quota, rating and history are
              untouched — only where they are shown has moved.
            */}
            <div className="areas__running">
              <h2 className="section__label">{t('domain.running')}</h2>
              <RunningTerminal />
              {domainCard('running', domains.running)}
            </div>
          </>
        ) : null}
        {terminal === 'food' ? (
          <>
            <MetricBoard>
              <DomainStandingTile domain="food" id="food-standing" />
            </MetricBoard>
            {domainCard('food', domains.food)}
          </>
        ) : null}

        <div className="areas__general">
          <h2 className="section__label">{t('areas.general')}</h2>

          {/*
            Pause sits below the areas rather than inside one: it is about a
            stretch of time across everything the user tracks, not a setting
            belonging to any single domain.
          */}
          <PauseSection />

        {/*
          The retired domain. It is shown only where it exists, only so a user
          can see where their old sessions went, and its switch is one-way:
          off is possible, on is not offered anywhere in the product.
        */}
        {legacySport ? (
          <Section>
            <Card rows>
              <div className="areas__domainHeader">
                <span className="areas__domainMark areas__domainMark--sports" aria-hidden="true">
                  <ActivityIcon size={22} />
                </span>
                <span className="row__body">
                  <span className="areas__domainName">{t('domain.legacySport')}</span>
                  <span className="areas__domainDescription">
                    {t('domain.legacySport.description')}
                  </span>
                </span>
                {legacySport.enabled ? (
                  <Switch
                    checked
                    label={t('domain.legacySport')}
                    accent="var(--domain-sports-mid)"
                    onChange={() => actions.disableLegacySport()}
                  />
                ) : null}
              </div>
              <div className="areas__domainBody">
                <p className="areas__note">{t('areas.legacySport.note')}</p>
                {configuration.legacySportChoice.needed ? (
                  <LegacySportChoiceForm
                    sessions={configuration.legacySportChoice.sessions}
                    onChoose={actions.chooseLegacySport}
                  />
                ) : null}
              </div>
            </Card>
          </Section>
        ) : null}

          <BackupSection onRestored={actions.reload} />

          <CreditsSection />

          {/* Settings -------------------------------------------------- */}
          <Section label={t('common.settings')}>
            <Card>
              <span className="field-label">{t('common.language')}</span>
              <Segmented<Language>
                label={t('common.language')}
                value={language}
                onChange={actions.setLanguage}
                options={LANGUAGES.map((option) => ({
                  value: option,
                  label: option === 'de' ? 'Deutsch' : 'English',
                }))}
              />
              {/* How weights are shown and typed (WP3, P4). Sets are stored
                  in grams whatever this says. */}
              <span className="field-label areas__settingLabel">{t('settings.weightUnit')}</span>
              <Segmented<WeightUnit>
                label={t('settings.weightUnit')}
                value={weightUnitOf(configuration.settings.weightUnit)}
                onChange={actions.setWeightUnit}
                options={WEIGHT_UNITS.map((option) => ({ value: option, label: t(`unit.${option}`) }))}
              />
            </Card>
          </Section>
        </div>
      </div>

      <QuestionSheet
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(draft) => {
          actions.addQuestion(draft);
          setCreating(false);
        }}
      />

      <QuestionSheet
        open={editing !== null}
        question={editing}
        onClose={() => setEditing(null)}
        onSubmit={(draft) => {
          if (editing) actions.updateQuestion(editing.id, draft);
          setEditing(null);
        }}
        onPause={() => {
          if (editing) actions.pauseQuestion(editing.id);
          setEditing(null);
        }}
        onResume={() => {
          if (editing) actions.resumeQuestion(editing.id);
          setEditing(null);
        }}
        onArchive={() => {
          if (editing) actions.archiveQuestion(editing.id);
          setEditing(null);
        }}
      />
    </div>
  );
}
