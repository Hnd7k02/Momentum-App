import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GYM, RANKS } from '../../core/config/constants';
import { Button, Figure, SelectionMark } from '../../components';
import {
  ChevronLeftIcon,
  GymIcon,
  LockIcon,
  MindIcon,
  PlusIcon,
  SparkIcon,
} from '../../components/Icons';
import { QuestionSheet, type QuestionSheetSubmit } from '../../domains/mental/QuestionSheet';
import { questionTypeLabelKey } from '../../domains/mental/questionLabels';
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
import bodyStill from '../gym/assets/body-preview.webp';
import { RankBadge } from '../ranking/RankBadge';
import { OnboardingHero, Segments, WorldTile } from './OnboardingHero';
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
 *
 * **How it looks is the onboarding's own** (block 7E, D190; contract
 * «Onboarding-Ausnahmen»): a flat ground, white cards, and at most
 * one dark surface a screen — always Gym or the rank. The first slide's
 * picture is the one place with example values and coloured data marks
 * (`OnboardingHero`). What the flow asks, in which order, and what it hands
 * to storage did not change with the look — but for one thing the owner
 * decided at STOP 7E-a2 (D191): Mind opens with three questions chosen,
 * and its «Weiter» waits while none is. At STOP 7E-b (D192) two more: an
 * opening page before the first slide, and no area chosen until the user
 * chooses one.
 */

type Step = 'momentum' | 'worlds' | 'rank' | 'domains' | 'questions' | 'sport' | 'summary';

/** The two worlds on offer. A chosen one takes a filled mark in the accent,
    like any selection (D154): an area has no colour of its own. */
const CHOICES: {
  key: 'mental' | 'sport';
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  {
    key: 'mental',
    title: DOMAIN_NAME_KEYS.mental,
    body: 'domain.mental.description',
  },
  {
    // The key stays 'sport' (nothing stores it); on screen it is Gym, with
    // Laufen named in its description.
    key: 'sport',
    title: DOMAIN_NAME_KEYS.gym,
    body: 'onboarding.domains.gym',
  },
];

const CONCEPTS: { key: Step; title: TranslationKey; body: TranslationKey }[] = [
  { key: 'momentum', title: 'onboarding.concept.momentum.title', body: 'onboarding.concept.momentum.body' },
  { key: 'worlds', title: 'onboarding.concept.worlds.title', body: 'onboarding.concept.worlds.body' },
  { key: 'rank', title: 'onboarding.concept.rank.title', body: 'onboarding.concept.rank.body' },
];

/** The ladder as the rank slide tells it: where one starts, the next rank,
    and how many lie beyond it. The numbers are the ladder's own. */
const RANK_START = RANKS[0];
const RANK_NEXT = RANKS[1];
const RANKS_BEYOND = RANKS.slice(2);
const RANK_TOP = RANKS[RANKS.length - 1]!;

/**
 * The questions a new user starts with (the owner at STOP 7E-a2, D191):
 * one from each category, so the day's value weighs the three alike — it
 * is the mean within a category before the mean across them (D17). They
 * are chosen, not fixed: any of them can be taken off, and «Weiter» waits
 * until at least one question is chosen, or Mind is taken off.
 */
export const STARTER_QUESTIONS = ['routine', 'sleep', 'mood'] as const;

/** The question the worlds slide shows: a real one, from the library. */
const SAMPLE_QUESTION = 'mood';
const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/**
 * The flat ground reaches what lies beyond the flow, too: an overscroll
 * shows `<body>`. The document carries the mark while the flow is mounted,
 * as it carries the world.
 */
function useOnboardingGround(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-onboarding', '');
    return () => root.removeAttribute('data-onboarding');
  }, []);
}

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
  useOnboardingGround();

  // Nothing is chosen until the user chooses (the owner at STOP 7E-b, D192):
  // «Weiter» on the areas waits for a world.
  const [chosen, setChosen] = useState<Set<'mental' | 'sport'>>(new Set());
  // The opening page before the first slide (D192): no step of its own, so
  // it counts nowhere in the marks.
  const [opened, setOpened] = useState(false);
  // A tap anywhere on the opening page goes on (D193): the page takes the
  // click, wherever it lands — the line, the hint, the empty ground — and
  // the hint is a real button for a keyboard and a screen reader, whose
  // click reaches the page the same way. The button goes when the first
  // slide comes, so where it held the focus the focus goes on to the first
  // slide's button instead of falling back to the page; a tap that gave it
  // no focus moves none.
  const footer = useRef<HTMLDivElement>(null);
  const tap = useRef<HTMLButtonElement>(null);
  const focusOnOpen = useRef(false);
  const openFlow = () => {
    focusOnOpen.current = tap.current !== null && document.activeElement === tap.current;
    setOpened(true);
  };
  useLayoutEffect(() => {
    if (!opened || !focusOnOpen.current) return;
    focusOnOpen.current = false;
    footer.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [opened]);
  const [selectedIds, setSelectedIds] = useState<string[]>([...STARTER_QUESTIONS]);
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
  const sampleQuestion =
    allSuggestions.find((suggestion) => suggestion.id === SAMPLE_QUESTION) ??
    allSuggestions.find((suggestion) => suggestion.type === 'scale');

  /** A question row: the whole row is the control, its mark says it again. */
  const questionRow = (key: string, text: string, type: QuestionDraft['type'], selected: boolean, onToggle: () => void) => (
    <li key={key}>
      <button type="button" className="question-pick" aria-pressed={selected} onClick={onToggle}>
        <span className="question-pick__body">
          <span className="question-pick__text">{text}</span>
          <span className="badge">{t(questionTypeLabelKey(type))}</span>
        </span>
        <SelectionMark selected={selected} />
      </button>
    </li>
  );

  /** The two worlds as the slide shows them: what each one asks for. */
  const worlds = (
    <div className="onboarding__stack">
      <section className="onboarding-card" data-card>
        <div className="onboarding-card__head">
          <span className="onboarding-card__title">{t(DOMAIN_NAME_KEYS.mental)}</span>
          <span className="onboarding-card__meta">{t('question.daily')}</span>
        </div>
        {sampleQuestion ? <p className="onboarding-worlds__question">{sampleQuestion.text}</p> : null}
        <div className="onboarding-worlds__scale" role="img" aria-label={t('onboarding.worlds.scale')}>
          {SCALE.map((value) => (
            <span key={value} aria-hidden="true">
              {value}
            </span>
          ))}
        </div>
      </section>

      <section className="onboarding-card onboarding-card--gym onboarding-worlds__gym" data-card data-world="gym">
        <div className="onboarding-worlds__goals">
          <div className="onboarding-card__head">
            <span className="onboarding-card__title">{t(DOMAIN_NAME_KEYS.gym)}</span>
            <span className="onboarding-card__meta">{t('sports.thisWeek')}</span>
          </div>
          {/* Nothing is done yet, and a number stands only where the flow
              holds one: Gym opens on its default target, Laufen on none
              (the setup step leaves it unchosen), so Laufen says that it
              can have one rather than borrowing an example (contract §16 d). */}
          <div className="onboarding-worlds__goal">
            <p className="world-tile__figure">
              <Figure
                text={t('gym.attendance.value', { sessions: 0, target: gymTarget ?? GYM.DEFAULT_TARGET_PER_WEEK })}
                figure={0}
              />
            </p>
            <Segments done={0} of={gymTarget ?? GYM.DEFAULT_TARGET_PER_WEEK} />
          </div>
          <div className="onboarding-worlds__goal">
            {runningTarget === null ? (
              <>
                <p className="onboarding-worlds__goalName">{t('onboarding.worlds.runs')}</p>
                <p className="onboarding-card__meta">{t('onboarding.worlds.runsOptional')}</p>
              </>
            ) : (
              <>
                <p className="world-tile__figure">
                  <Figure text={t('running.attendance.value', { sessions: 0, target: runningTarget })} figure={0} />
                </p>
                <Segments done={0} of={runningTarget} />
              </>
            )}
          </div>
        </div>
        {/* The body's still, as the Gym hub shows it: small, and it does
            nothing. The 3D body is not loaded here. */}
        <img className="onboarding-worlds__body" src={bodyStill} alt="" width={240} height={574} decoding="async" />
      </section>
    </div>
  );

  /** The rank's stage: the start, the way to the next rank, and no more. */
  const rank = (
    <div className="onboarding__stack">
      <section className="rank-stage" data-card>
        <RankBadge rankId={RANK_START.id} size={112} />
        <p className="rank-stage__name">{RANK_START.name}</p>
        <p className="rank-stage__start">{t('onboarding.rank.start')}</p>
        <div className="rank-stage__path" role="img" aria-label={t('onboarding.rank.path', { points: RANK_NEXT.min })}>
          <span className="rank-stage__track" aria-hidden="true">
            <i />
          </span>
          <span className="rank-stage__ends" aria-hidden="true">
            <span>{RANK_START.min}</span>
            <span>{RANK_NEXT.min}</span>
          </span>
        </div>
        <div className="rank-stage__next">
          <span className="rank-stage__nextBody">
            <span className="rank-stage__kicker">{t('onboarding.rank.next')}</span>
            <span className="rank-stage__nextName">{RANK_NEXT.name}</span>
          </span>
          <span className="rank-stage__from">{t('rank.ladder.from', { points: RANK_NEXT.min })}</span>
        </div>
      </section>
      <p className="rank-beyond">
        <span className="rank-beyond__badges" aria-hidden="true">
          {RANKS_BEYOND.map((entry) => (
            <RankBadge key={entry.id} rankId={entry.id} size={20} mystery />
          ))}
        </span>
        {t('onboarding.rank.more', { count: RANKS_BEYOND.length, rank: RANK_TOP.name })}
      </p>
    </div>
  );

  let body: ReactNode = null;
  let note: ReactNode = null;
  let action: ReactNode = null;

  if (concept) {
    body = (
      <div className="onboarding__body onboarding__body--slide">
        {step === 'momentum' ? <OnboardingHero /> : step === 'worlds' ? worlds : rank}
        <div className="onboarding__intro">
          <h1 className="onboarding__title onboarding__title--slide">{t(concept.title)}</h1>
          <p className="onboarding__lead">{t(concept.body)}</p>
        </div>
      </div>
    );
    note =
      step === 'momentum' ? (
        <p className="onboarding__note">
          <LockIcon size={14} />
          {t('onboarding.welcome.privacy')}
        </p>
      ) : step === 'worlds' ? (
        <p className="onboarding__note">{t('onboarding.worlds.note')}</p>
      ) : null;
    action = (
      <Button variant="primary" block onClick={() => go(1)}>
        {stepIndex === 0 ? t('onboarding.welcome.start') : t('common.continue')}
      </Button>
    );
  }

  if (step === 'domains') {
    body = (
      <div className="onboarding__body">
        <div className="onboarding__intro">
          <h1 className="onboarding__title">{t('onboarding.domains.title')}</h1>
          <p className="onboarding__lead">{t('onboarding.domains.body')}</p>
        </div>

        <div className="onboarding__tiles">
          {CHOICES.map((choice) => {
            const selected = chosen.has(choice.key);
            return (
              <button
                key={choice.key}
                type="button"
                className="question-pick world-tile world-tile--choice"
                data-world={choice.key === 'sport' ? 'gym' : undefined}
                aria-pressed={selected}
                onClick={() => toggleChoice(choice.key)}
              >
                <span className="world-tile__head">
                  <span className="world-tile__icon" aria-hidden="true">
                    {choice.key === 'sport' ? <GymIcon size={18} /> : <MindIcon size={18} />}
                  </span>
                  <SelectionMark selected={selected} />
                </span>
                <span className="question-pick__text world-tile__name">{t(choice.title)}</span>
                <span className="onboarding__hint">{t(choice.body)}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
    note = (
      <p className="onboarding__note" aria-live="polite">
        {chosen.size === 0 ? t('onboarding.domains.needOne') : t('onboarding.domains.hint')}
      </p>
    );
    action = (
      <Button variant="primary" block disabled={chosen.size === 0} onClick={() => go(1)}>
        {t('common.continue')}
      </Button>
    );
  }

  if (step === 'questions') {
    body = (
      <div className="onboarding__body">
        <div className="onboarding__intro">
          <h1 className="onboarding__title">{t('onboarding.questions.title')}</h1>
          <p className="onboarding__lead">{t('onboarding.questions.byCategory')}</p>
        </div>

        {categories.map((group) => (
          <section key={group.category} className="onboarding-card category-group" data-card>
            <h2 className="category-group__title">{t(CATEGORY_LABEL_KEYS[group.category])}</h2>
            <p className="category-group__body">{t(CATEGORY_DESCRIPTION_KEYS[group.category])}</p>
            <ul className="question-list">
              {group.questions.map((suggestion) =>
                questionRow(
                  suggestion.id,
                  suggestion.text,
                  suggestion.type,
                  selectedIds.includes(suggestion.id),
                  () => toggleSuggestion(suggestion.id),
                ),
              )}
            </ul>
          </section>
        ))}

        <section className="onboarding-card category-group" data-card>
          <h2 className="category-group__title">{t(CATEGORY_LABEL_KEYS.eigene)}</h2>
          <p className="category-group__body">{t(CATEGORY_DESCRIPTION_KEYS.eigene)}</p>
          <ul className="question-list">
            {customQuestions.map((question, index) =>
              questionRow(`custom-${index}`, question.text, question.type, true, () =>
                setCustomQuestions((current) => current.filter((_, i) => i !== index)),
              ),
            )}
            <li>
              <button type="button" className="question-pick question-pick--custom" onClick={() => setSheetOpen(true)}>
                <PlusIcon size={18} />
                {t('onboarding.questions.custom')}
              </button>
            </li>
          </ul>
        </section>

        <QuestionSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onSubmit={(draft: QuestionSheetSubmit) => {
            setCustomQuestions((current) => [...current, draft]);
            setSheetOpen(false);
          }}
        />
      </div>
    );
    note = (
      <p className="onboarding__note" aria-live="polite">
        {chosenQuestions.length > 0
          ? t('onboarding.questions.selected', { count: chosenQuestions.length })
          : t('onboarding.questions.needOne')}
      </p>
    );
    action = (
      <Button variant="primary" block disabled={chosenQuestions.length === 0} onClick={() => go(1)}>
        {t('common.continue')}
      </Button>
    );
  }

  if (step === 'sport') {
    body = (
      <div className="onboarding__body">
        <div className="onboarding__intro">
          <h1 className="onboarding__title">{t('onboarding.sport.title')}</h1>
          <p className="onboarding__lead">{t('onboarding.sport.body')}</p>
        </div>

        {/* One card for the Gym world, and in it two targets that stay two. */}
        <section className="onboarding-card onboarding-card--gym week-goals" data-card data-world="gym">
          <div className="week-goals__goal">
            <span className="week-goals__label">{t('onboarding.sport.gym')}</span>
            <TargetPicker domain="gym" value={gymTarget} onChange={setGymTarget} />
          </div>
          <div className="week-goals__goal">
            <span className="week-goals__label">{t('onboarding.sport.running')}</span>
            <TargetPicker domain="running" value={runningTarget} onChange={setRunningTarget} />
          </div>
        </section>
      </div>
    );
    note = <p className="onboarding__note">{t('onboarding.domains.hint')}</p>;
    action = (
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
    );
  }

  if (step === 'summary') {
    const questionCount = chosenQuestions.length;
    body = (
      <div className="onboarding__body">
        <div className="onboarding__intro">
          <h1 className="onboarding__title">
            {chosen.size === 0 ? t('onboarding.summary.empty') : t('onboarding.summary.title')}
          </h1>
          <p className="onboarding__lead">
            {chosen.size === 0 ? t('onboarding.summary.emptyBody') : t('onboarding.summary.body')}
          </p>
        </div>

        {/* What was chosen, and nothing else: no example stands here. */}
        <div className="onboarding__tiles summary__list">
          {/* Mind is switched on by its questions: chosen without one, it
              stays off (`applyOnboarding`), and the summary does not say
              otherwise. */}
          {chosen.has('mental') && questionCount > 0 ? (
            <WorldTile world="mind" name={t(DOMAIN_NAME_KEYS.mental)}>
              <p className="world-tile__figure summary__item">
                <Figure
                  text={
                    questionCount === 1
                      ? t('onboarding.summary.questionsOne')
                      : t('onboarding.summary.questions', { count: questionCount })
                  }
                  figure={questionCount}
                />
              </p>
            </WorldTile>
          ) : null}
          {chosen.has('sport') ? (
            <WorldTile world="gym" name={t(DOMAIN_NAME_KEYS.gym)}>
              {gymTarget !== null ? (
                <p className="world-tile__figure summary__item">
                  <Figure text={t('onboarding.summary.gym', { count: gymTarget })} figure={gymTarget} />
                </p>
              ) : null}
              {runningTarget !== null ? (
                <p className="world-tile__figure summary__item">
                  <Figure text={t('onboarding.summary.running', { count: runningTarget })} figure={runningTarget} />
                </p>
              ) : null}
            </WorldTile>
          ) : null}
        </div>

        <div className="onboarding-card summary__rank" data-card>
          <RankBadge rankId={RANK_START.id} size={38} />
          <span className="summary__rankBody">
            <span className="summary__rankName">{RANK_START.name}</span>
            <span className="summary__rankNote">{t('onboarding.rank.start')}</span>
          </span>
          <span className="summary__rankNext">
            {t('rank.toNext', { points: RANK_NEXT.min, rank: RANK_NEXT.name })}
          </span>
        </div>
      </div>
    );
    // Saying nothing left a new user tapping a button that silently did
    // nothing. Tapping it again is the retry.
    note = failed ? (
      <p className="onboarding__failure" role="alert">
        {t('error.action')}
      </p>
    ) : null;
    action = (
      <Button variant="primary" block onClick={finish}>
        {t('onboarding.summary.start')}
      </Button>
    );
  }

  if (!opened) {
    // The opening page (the owner at STOP 7E-b, D192; his adjustment, D193):
    // very empty — one line in the middle and, where the button stands on
    // every step, a faint hint. There is no button to find: a tap anywhere
    // goes on (the page's own click, below), and the hint names it. It is
    // not a slide, carries no marks and has no way back; the first slide
    // follows as it was. The line is the owner's English in both
    // languages, and says so to a screen reader.
    body = (
      <div className="onboarding__opening">
        <h1 className="onboarding__openingTitle" lang="en">
          {t('onboarding.opening.title')}
        </h1>
      </div>
    );
    note = null;
    action = (
      // No handler of its own: its click is the page's (`openFlow`).
      <button type="button" className="onboarding__tap" ref={tap}>
        {t('onboarding.opening.tap')}
      </button>
    );
  }

  return (
    <div
      className={opened ? 'onboarding' : 'onboarding onboarding--opening'}
      data-step={opened ? step : 'opening'}
      onClick={opened ? undefined : openFlow}
    >
      {opened ? (
        <header className="onboarding__header">
          {stepIndex === 0 ? (
            <span className="onboarding__brand">
              <span className="onboarding__logo" aria-hidden="true">
                <SparkIcon size={16} />
              </span>
              {t('app.name')}
            </span>
          ) : (
            <button type="button" className="onboarding__back" onClick={() => go(-1)} aria-label={t('common.back')}>
              <ChevronLeftIcon />
            </button>
          )}
          <div
            className="onboarding__steps"
            role="img"
            aria-label={t('onboarding.step', { current: stepIndex + 1, total: steps.length })}
          >
            {steps.map((value, index) => (
              <span
                key={value}
                className={`onboarding__dot ${index === stepIndex ? 'onboarding__dot--active' : ''}`.trim()}
              />
            ))}
          </div>
        </header>
      ) : null}

      {body}

      <div className="onboarding__footer" ref={footer}>
        {note}
        {action}
      </div>
    </div>
  );
}
