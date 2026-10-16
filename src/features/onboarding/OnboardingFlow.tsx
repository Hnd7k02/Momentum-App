import { useMemo, useState } from 'react';
import { GYM } from '../../core/config/constants';
import { Button, Card, SelectionMark } from '../../components';
import {
  ActivityIcon,
  ChevronLeftIcon,
  PlusIcon,
  SparkIcon,
} from '../../components/Icons';
import { QuestionSheet, type QuestionSheetSubmit } from '../../domains/mental/QuestionSheet';
import { questionTypeBadgeKey } from '../../domains/mental/questionLabels';
import {
  CATEGORY_DESCRIPTION_KEYS,
  CATEGORY_LABEL_KEYS,
  suggestionsByCategory,
} from '../../domains/mental/questionLibrary';
import { TargetPicker } from '../../domains/sports/TargetPicker';
import { useI18n, useT } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n';
import { DOMAIN_NAME_KEYS } from '../../i18n/domainNames';
import type { OnboardingSelection, QuestionDraft } from '../../storage/services/configurationService';
import './onboarding.css';

/**
 * Short, and about the product rather than about the interface.
 *
 * Three concept screens, one choice screen, and setup only for what the user
 * actually switched on. There is no tutorial: nothing here explains where a
 * button is, because a screen that has to be explained is the thing that
 * needs fixing.
 *
 * Two worlds, Mind and Gym (WP3 Stage 4, P1–P3). Gym is presented as **one
 * world, Laufen included** — that is how people think about it — while the
 * configuration underneath stays two independent targets, because three gym
 * sessions and two runs is a week rather than five of something. Gym detail
 * is deliberately absent: it happens when the user first opens the area, not
 * before they have seen the app. Food is not offered: it left the product
 * (D139), and nothing here can switch it on.
 */

type Step = 'momentum' | 'worlds' | 'rank' | 'domains' | 'questions' | 'sport' | 'summary';

/** The two worlds on offer, and what each looks like on the picker. */
const CHOICES: {
  key: 'mental' | 'sport';
  title: TranslationKey;
  body: TranslationKey;
  accent: string;
}[] = [
  {
    key: 'mental',
    title: DOMAIN_NAME_KEYS.mental,
    body: 'domain.mental.description',
    accent: 'var(--domain-mental-mid)',
  },
  {
    // The key stays 'sport' (nothing stores it); on screen it is Gym, with
    // Laufen named in its description.
    key: 'sport',
    title: DOMAIN_NAME_KEYS.gym,
    body: 'onboarding.domains.gym',
    accent: 'var(--domain-gym-mid)',
  },
];

const CONCEPTS: { key: Step; title: TranslationKey; body: TranslationKey }[] = [
  { key: 'momentum', title: 'onboarding.concept.momentum.title', body: 'onboarding.concept.momentum.body' },
  { key: 'worlds', title: 'onboarding.concept.worlds.title', body: 'onboarding.concept.worlds.body' },
  { key: 'rank', title: 'onboarding.concept.rank.title', body: 'onboarding.concept.rank.body' },
];

export function OnboardingFlow({
  onFinish,
  failed = false,
}: {
  onFinish(selection: OnboardingSelection): void;
  /** The last attempt to save the setup did not get through. */
  failed?: boolean;
}) {
  const t = useT();
  const { language } = useI18n();
  const categories = useMemo(() => suggestionsByCategory(language), [language]);

  const [chosen, setChosen] = useState<Set<'mental' | 'sport'>>(new Set(['mental']));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customQuestions, setCustomQuestions] = useState<QuestionDraft[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gymTarget, setGymTarget] = useState<number | null>(GYM.DEFAULT_TARGET_PER_WEEK);
  const [runningTarget, setRunningTarget] = useState<number | null>(null);

  /**
   * Only the steps that were actually chosen. Walking a user through a
   * question picker they will never use is the tutorial this flow refuses to
   * be.
   */
  const steps = useMemo((): Step[] => {
    const result: Step[] = ['momentum', 'worlds', 'rank', 'domains'];
    if (chosen.has('mental')) result.push('questions');
    if (chosen.has('sport')) result.push('sport');
    result.push('summary');
    return result;
  }, [chosen]);

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[Math.min(stepIndex, steps.length - 1)]!;
  const go = (delta: number) =>
    setStepIndex((index) => Math.min(steps.length - 1, Math.max(0, index + delta)));

  const allSuggestions = categories.flatMap((group) => group.questions);
  const chosenQuestions: QuestionDraft[] = [
    ...allSuggestions
      .filter((suggestion) => selectedIds.includes(suggestion.id))
      .map((suggestion) => ({
        text: suggestion.text,
        type: suggestion.type,
        category: suggestion.category,
      })),
    ...customQuestions,
  ];

  const toggleSuggestion = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const toggleChoice = (key: 'mental' | 'sport') =>
    setChosen((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const finish = () =>
    onFinish({
      questions: chosen.has('mental') ? chosenQuestions : [],
      // A weekly target only exists for a domain the user switched on, and
      // `null` is how "not switched on" reaches storage — there is no way
      // from here to create the retired generic Sport domain.
      gymTargetPerWeek: chosen.has('sport') ? gymTarget : null,
      runningTargetPerWeek: chosen.has('sport') ? runningTarget : null,
    });

  const concept = CONCEPTS.find((entry) => entry.key === step);

  return (
    <div className="onboarding">
      {stepIndex === 0 ? null : (
        <div
          className="onboarding__progress"
          role="group"
          aria-label={t('onboarding.step', { current: stepIndex + 1, total: steps.length })}
        >
          <button
            type="button"
            className="button button--quiet"
            onClick={() => go(-1)}
            aria-label={t('common.back')}
            style={{ marginLeft: -12, paddingLeft: 12, paddingRight: 12 }}
          >
            <ChevronLeftIcon />
          </button>
          {steps.map((value, index) => (
            <span
              key={value}
              className={`onboarding__dot ${index === stepIndex ? 'onboarding__dot--active' : ''}`.trim()}
            />
          ))}
        </div>
      )}

      {concept ? (
        <>
          <div className="welcome">
            <span className="welcome__mark" aria-hidden="true">
              <SparkIcon size={42} />
            </span>
            <h1 className="welcome__tagline">{t(concept.title)}</h1>
            <p className="onboarding__lead">{t(concept.body)}</p>
          </div>
          <div className="onboarding__footer">
            <Button variant="primary" block onClick={() => go(1)}>
              {stepIndex === 0 ? t('onboarding.welcome.start') : t('common.continue')}
            </Button>
          </div>
        </>
      ) : null}

      {step === 'domains' ? (
        <>
          <div className="onboarding__body">
            <div>
              <h1 className="onboarding__title">{t('onboarding.domains.title')}</h1>
              <p className="onboarding__lead" style={{ marginTop: 8 }}>
                {t('onboarding.domains.body')}
              </p>
            </div>

            <div className="question-list">
              {CHOICES.map((choice) => {
                const selected = chosen.has(choice.key);
                return (
                  <button
                    key={choice.key}
                    type="button"
                    className="question-pick"
                    aria-pressed={selected}
                    onClick={() => toggleChoice(choice.key)}
                    style={{ ['--selection-accent' as string]: choice.accent }}
                  >
                    <span className="question-pick__body">
                      <span className="question-pick__text">{t(choice.title)}</span>
                      <span className="onboarding__hint">{t(choice.body)}</span>
                    </span>
                    <SelectionMark selected={selected} />
                  </button>
                );
              })}
            </div>

            <p className="question-pick__count" aria-live="polite">
              {chosen.size === 0 ? t('onboarding.domains.needOne') : t('onboarding.domains.hint')}
            </p>
          </div>

          <div className="onboarding__footer">
            <Button variant="primary" block disabled={chosen.size === 0} onClick={() => go(1)}>
              {t('common.continue')}
            </Button>
          </div>
        </>
      ) : null}

      {step === 'questions' ? (
        <>
          <div className="onboarding__body">
            <div>
              <h1 className="onboarding__title">{t('onboarding.questions.title')}</h1>
              <p className="onboarding__lead" style={{ marginTop: 8 }}>
                {t('onboarding.questions.byCategory')}
              </p>
            </div>

            {categories.map((group) => (
              <section key={group.category} className="category-group">
                <h2 className="category-group__title">{t(CATEGORY_LABEL_KEYS[group.category])}</h2>
                <p className="category-group__body">
                  {t(CATEGORY_DESCRIPTION_KEYS[group.category])}
                </p>
                <div className="question-list">
                  {group.questions.map((suggestion) => {
                    const selected = selectedIds.includes(suggestion.id);
                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        className="question-pick"
                        aria-pressed={selected}
                        onClick={() => toggleSuggestion(suggestion.id)}
                        style={{ ['--selection-accent' as string]: 'var(--lilac-mid)' }}
                      >
                        <span className="question-pick__body">
                          <span className="question-pick__text">{suggestion.text}</span>
                          <span
                            className={`badge badge--${suggestion.type}`}
                            style={{ alignSelf: 'flex-start' }}
                          >
                            {t(questionTypeBadgeKey(suggestion.type))}
                          </span>
                        </span>
                        <SelectionMark selected={selected} />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            <section className="category-group">
              <h2 className="category-group__title">{t(CATEGORY_LABEL_KEYS.eigene)}</h2>
              <p className="category-group__body">{t(CATEGORY_DESCRIPTION_KEYS.eigene)}</p>
              <div className="question-list">
                {customQuestions.map((question, index) => (
                  <button
                    key={`custom-${index}`}
                    type="button"
                    className="question-pick"
                    aria-pressed="true"
                    onClick={() =>
                      setCustomQuestions((current) => current.filter((_, i) => i !== index))
                    }
                    style={{ ['--selection-accent' as string]: 'var(--lilac-mid)' }}
                  >
                    <span className="question-pick__body">
                      <span className="question-pick__text">{question.text}</span>
                      <span
                        className={`badge badge--${question.type}`}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        {t(questionTypeBadgeKey(question.type))}
                      </span>
                    </span>
                    <SelectionMark selected />
                  </button>
                ))}

                <button
                  type="button"
                  className="question-pick question-pick--custom"
                  onClick={() => setSheetOpen(true)}
                >
                  <PlusIcon size={18} />
                  {t('onboarding.questions.custom')}
                </button>
              </div>
            </section>

            <p className="question-pick__count" aria-live="polite">
              {chosenQuestions.length > 0
                ? t('onboarding.questions.selected', { count: chosenQuestions.length })
                : t('onboarding.questions.recommendation')}
            </p>
          </div>

          <div className="onboarding__footer">
            <Button variant="primary" block onClick={() => go(1)}>
              {t('common.continue')}
            </Button>
          </div>

          <QuestionSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onSubmit={(draft: QuestionSheetSubmit) => {
              setCustomQuestions((current) => [...current, draft]);
              setSheetOpen(false);
            }}
          />
        </>
      ) : null}

      {step === 'sport' ? (
        <>
          <div className="onboarding__body">
            <div>
              <h1 className="onboarding__title">{t('onboarding.sport.title')}</h1>
              <p className="onboarding__lead" style={{ marginTop: 8 }}>
                {t('onboarding.sport.body')}
              </p>
            </div>

            <Card>
              <span className="field-label">{t('onboarding.sport.gym')}</span>
              <TargetPicker domain="gym" value={gymTarget} onChange={setGymTarget} />
            </Card>

            <Card>
              <span className="field-label">{t('onboarding.sport.running')}</span>
              <TargetPicker domain="running" value={runningTarget} onChange={setRunningTarget} />
            </Card>

            <p className="question-pick__count">{t('onboarding.domains.hint')}</p>
          </div>

          <div className="onboarding__footer">
            <Button
              variant="primary"
              block
              onClick={() => {
                // Choosing neither is a real answer: the user wants the Gym
                // world but has not decided a number yet. Gym takes its
                // default so the area is usable; Running stays off until it
                // is asked for.
                if (gymTarget === null && runningTarget === null) {
                  setGymTarget(GYM.DEFAULT_TARGET_PER_WEEK);
                }
                go(1);
              }}
            >
              {t('common.continue')}
            </Button>
          </div>
        </>
      ) : null}

      {step === 'summary' ? (
        <>
          <div className="onboarding__body">
            <div>
              <h1 className="onboarding__title">
                {chosen.size === 0 ? t('onboarding.summary.empty') : t('onboarding.summary.title')}
              </h1>
              <p className="onboarding__lead" style={{ marginTop: 8 }}>
                {chosen.size === 0
                  ? t('onboarding.summary.emptyBody')
                  : t('onboarding.summary.body')}
              </p>
            </div>

            <div className="summary__list">
              {chosen.has('mental') && chosenQuestions.length > 0 ? (
                <div className="summary__item">
                  <span className="summary__mark summary__mark--mental" aria-hidden="true">
                    <SparkIcon size={20} />
                  </span>
                  {chosenQuestions.length === 1
                    ? t('onboarding.summary.questionsOne')
                    : t('onboarding.summary.questions', { count: chosenQuestions.length })}
                </div>
              ) : null}
              {chosen.has('sport') && gymTarget !== null ? (
                <div className="summary__item">
                  <span className="summary__mark summary__mark--sports" aria-hidden="true">
                    <ActivityIcon size={20} />
                  </span>
                  {t('onboarding.summary.gym', { count: gymTarget })}
                </div>
              ) : null}
              {chosen.has('sport') && runningTarget !== null ? (
                <div className="summary__item">
                  <span className="summary__mark summary__mark--running" aria-hidden="true">
                    <ActivityIcon size={20} />
                  </span>
                  {t('onboarding.summary.running', { count: runningTarget })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="onboarding__footer">
            {/* Saying nothing left a new user tapping a button that silently
                did nothing. Tapping it again is the retry. */}
            {failed ? (
              <p className="onboarding__failure" role="alert">
                {t('error.action')}
              </p>
            ) : null}
            <Button variant="primary" block onClick={finish}>
              {t('onboarding.summary.start')}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
