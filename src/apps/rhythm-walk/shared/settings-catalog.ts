/** Review inventory from the rhythm handoff. These are UI placeholders, not engine settings. */
export type Availability = 'planned' | 'decision' | 'deferred';
export interface Setting {
  id: string;
  label: string;
  kind: 'select' | 'check' | 'checklist' | 'number' | 'action' | 'info';
  availability?: Availability;
  options?: readonly string[];
  value?: string;
  checked?: boolean;
  hint?: string;
}
export interface SettingsGroup {
  id: string;
  title: string;
  description: string;
  /** Sections of docs/rhythm/reference/RHYTHM_GAME_HANDOFF.md. */
  source: string;
  settings: readonly Setting[];
}
const choice = (id: string, label: string, options: string[], value?: string, hint?: string): Setting => ({ id, label, kind: 'select', options, value, hint });
const undecided = (id: string, label: string, hint: string): Setting => ({ id, label, kind: 'info', availability: 'decision', hint });
const number = (id: string, label: string, hint?: string): Setting => ({ id, label, kind: 'number', availability: 'decision', hint });
export const vocabulary = ['Whole notes', 'Half notes', 'Quarter notes', 'Single eighth notes', 'Paired eighth notes', 'Triplet eighth notes', 'Sixteenth notes', 'Dotted half notes', 'Dotted quarter notes', 'Whole rests', 'Half rests', 'Quarter rests', 'Eighth rests', 'Ties'];
export const settingsGroups: readonly SettingsGroup[] = [
  {
    id: 'counting', title: 'Write Counts', source: '12',
    description: 'Counting conventions and how students enter and mark their answers.',
    settings: [
      choice('count-system', 'Counting system', ['1 e & a', '1 ta-te-ta'], '1 e & a', 'Simple-meter syllables and the independent &/+ display preference are available above. 6/8 retains six numbered counts.'),
      undecided('count-assistance', 'Guided symbol entry', 'Open entry with keyboard and touch already works. Guided entry would filter symbols, including keyboard input, without constraining lines or parentheses.'),
      undecided('count-positions', 'Additional count subdivisions', 'Note onsets and required internal beats already work. Rules for accepting additional subdivisions remain subject to teacher review.'),
      undecided('line-endpoints', 'Duration-line endpoint rules', 'Duration-line editing and snapping already work. The teaching rule for endings at the last covered count or note boundary remains provisional.'),
      undecided('count-hints', 'Hints and answer reveal', 'Both already offers Show written counts during performance. Hint timing, answer reveal, optional input positions and recording corrections remain open.'),
    ],
  },
  {
    id: 'activity', title: 'Activity & exercises', source: '1, 3, 6, 7',
    description: 'Choose an activity, a session format and the source of its exercises.',
    settings: [
      choice('activity-mode', 'Activity', ['Write Counts', 'Tap Rhythms', 'Both'], 'Write Counts', 'Choose a response mode above the shared score.'),
      choice('session-format', 'Uno234 session format', ['Short challenges', 'Rhythm Walk (continuous gameplay)', 'Progressive journey'], undefined, 'Rhythm Walk is reserved for an eventual continuous gameplay mode. All three formats are planned. No default format has been selected.'),
      number('passage-length', 'Passage length (measures)', 'Short and longer passages will be configurable. Suggested lengths in the handoff were examples, not defaults.'),
      choice('exercise-source', 'Exercise source', ['Curated passages', 'External authored content'], undefined, 'The Level selector configures generated practice; built-in fixtures require explicit developer/testing access. A curated/imported-content workflow remains future work.'),
      choice('preset', 'Developmental starting preset', ['Beginning Band Midyear', 'Beginning Band End of Year', 'Non-Varsity', 'Varsity'], undefined, 'Developmental preset contents need review. Inspect UIL teaching presets in the available exercise settings above.'),
      { id: 'save-preset', label: 'Save a custom preset', kind: 'action', availability: 'decision', hint: 'Named presets, editing, sharing and import/export behavior are still to be decided.' },
      undecided('quick-start', 'Quick-start defaults and instructions', 'Choose a starting preset and how first-visit instructions are presented.'),
    ],
  },
  {
    id: 'vocabulary', title: 'Rhythm vocabulary', source: '4, 6, 7',
    description: 'Two ordinary checklists: the starting vocabulary and an optional progression goal. Generated practice uses the active ingredients above. These broader progression lists remain unavailable and have no selections.',
    settings: [
      { id: 'starting-vocabulary', label: 'Broader starting vocabulary', kind: 'checklist', options: vocabulary, hint: 'Allowed rhythm ingredients already configure generated practice. This broader list needs support for additional values and progression.' },
      { id: 'goal-enabled', label: 'Enable a progression goal', kind: 'check', checked: false, hint: 'A goal is an upper bound. It must include every starting item and does not promise an unlock order.' },
      { id: 'goal-vocabulary', label: 'Progression goal vocabulary', kind: 'checklist', options: vocabulary },
      { id: 'pattern-exclusions', label: 'Advanced pattern restrictions', kind: 'checklist', availability: 'decision', options: ['Finer syncopation restrictions', 'Separate tie restrictions across beats', 'Separate tie restrictions across barlines', 'Finer rest placement restrictions'], hint: 'The active controls above permit bounded ties and off-pulse sustained attacks in the supported meters. Separate finer-grained exclusions across beats/bars remain future work.' },
      { id: 'vocabulary-extensions', label: 'Additional vocabulary', kind: 'checklist', availability: 'decision', options: ['Double-dotted values', 'Compound-meter duplets'], hint: 'These require reviewed counting, notation and content rules before they can be offered.' },
      undecided('advanced-music', 'Other musical options', 'Accents, articulation, swing, pickups and multiple parts need separate scope decisions. Thirty-second notes and quintuplets are outside the current scope.'),
    ],
  },
  {
    id: 'meter', title: 'Meter & beat grouping', source: '4, 6, 15',
    description: 'Meter choice is independent of preset level. Choosing several meters does not enable changes inside a passage.',
    settings: [
      { id: 'meter-pool', label: 'Allowed meters', kind: 'checklist', options: ['2/4', '3/4', '4/4', '6/8'], value: '4/4', hint: 'The prototype is fixed to 4/4. The complete meter list is still open.' },
      choice('beat-grouping', 'Beat grouping / counting beat', ['Quarter-note beats', 'Dotted-quarter beats', 'Eighth-note beats', 'Custom grouping — to define'], 'Quarter-note beats', 'For example, 6/8 can be counted in two or six. Irregular meters need explicit grouping.'),
      { id: 'meter-changes', label: 'Allow meter changes within an exercise', kind: 'check', checked: false },
      number('meter-change-limit', 'Maximum meter changes'),
      undecided('meter-change-rules', 'Meter-change rules', 'Change placement, denominator changes, adaptive limits and count-ins at changes need review.'),
    ],
  },
  {
    id: 'progression', title: 'Adaptation & progression', source: '6, 8, 15',
    description: 'Keep practice within the starting vocabulary unless a progression goal is enabled. Assisted work and independent work will remain distinguishable.',
    settings: [
      choice('practice-boundary', 'Vocabulary boundary', ['Starting vocabulary only', 'Progress toward the goal'], 'Starting vocabulary only'),
      { id: 'adaptation-axes', label: 'What may adapt', kind: 'checklist', availability: 'decision', options: ['Tempo', 'Rhythmic density', 'Phrase length', 'Rest placement', 'Assistance'], hint: 'Adaptation ranges, pace and interactions are not settled.' },
      choice('unlock-approval', 'New-skill approval', ['Automatic', 'Ask the student', 'Teacher approval'], undefined, 'No approval policy is selected yet.'),
      undecided('mastery', 'Readiness and mastery', 'Set success thresholds, evidence minimums, consecutive successes and the role of assistance before enabling unlocks.'),
      { id: 'assistance-lock', label: 'Lock assistance to teacher settings', kind: 'check' },
      undecided('assistance-reduction', 'Reducing assistance', 'Define when support fades and how teachers can override it. Changes should be predictable between exercises.'),
      { id: 'skill-override', label: 'Adjust or roll back unlocked skills', kind: 'action', availability: 'decision' },
      undecided('journey-rewards', 'Journey and rewards', 'Task grouping, length increases, Uno scenes, rewards and replay suggestions remain open.'),
    ],
  },
  {
    id: 'performance', title: 'Tap Rhythms input & timing', source: '3, 4, 5, 15',
    description: 'Performance controls belong to Tap Rhythms and Both. A performance will continue through mistakes.',
    settings: [
      undecided('performance-input', 'Selectable performance input mode', 'Keyboard and touch/mouse press-and-hold already capture attacks and releases. Choosing onset-only or duration performance remains planned.'),
      undecided('tempo-bounds', 'Adaptive tempo adjustment', 'Manual tempo already runs from 40–180 BPM in steps of 1, starting at 80 BPM. Adaptive ranges and increments remain open.'),
      number('count-in', 'Custom count-in length (beats)', 'Count-in already uses whole bars with at least four audible and visual performance pulses. Custom lengths and pickup behavior remain open.'),
      number('calibration-offset', 'Manual timing offset (ms)', 'Calibrate already measures or estimates an offset, shows it in milliseconds and saves it for the session and selected input method. Manual offset entry and device-change automation remain open.'),
      undecided('timing-tolerance', 'Timing and release tolerances', 'Early/late windows, hold releases and difficulty scaling have no approved numerical policy.'),
      undecided('performance-scoring', 'Scoring and completion', 'Rhythm pattern, pulse stability and target tempo will be separate. Weights, recovery evidence, pass criteria and any overall score remain open; these may be teaching policies rather than student controls.'),
      undecided('interruption', 'Pause/resume and progress policy', 'Stop/Cancel and focus/audio interruption already retain ungraded partial evidence; Retry starts a fresh count-in. Pause/resume and the effect of unfinished attempts on future saved progress remain open.'),
      { id: 'other-inputs', label: 'Additional performance inputs', kind: 'checklist', availability: 'deferred', options: ['Microphone / clapping', 'MIDI', 'Gamepad'], hint: 'Outside the current release scope.' },
    ],
  },
  {
    id: 'sound', title: 'Metronome & sound', source: '3, 4, 7, 15',
    description: 'Metronome during exercise already controls audible pulse support. Adaptive assistance and additional sound choices remain planned.',
    settings: [
      undecided('metronome-policy', 'Adaptive metronome assistance', 'Manual on/off control already works. The adaptive assistance schedule remains open.'),
      undecided('metronome-pulse', 'Subdivision metronome choices', 'The metronome already uses quarter-note pulses in simple meters and dotted-quarter pulses in 6/8. Selectable subdivision clicks remain planned.'),
      undecided('click-sound', 'Selectable click sound and accents', 'Wood clicks and downbeat accents already play with fixed settings. Sound and accent choices remain planned.'),
      number('click-volume', 'Adjustable click volume (%)', 'Clicks currently use a fixed volume. A volume control remains planned.'),
      { id: 'tap-feedback', label: 'Sound on student taps', kind: 'check', availability: 'decision', hint: 'Whether tap feedback is offered, and its default state, remain undecided.' },
      undecided('tap-sound', 'Tap sound and volume', 'Sound choice and volume need review alongside output latency.'),
    ],
  },
  {
    id: 'guidance', title: 'Guidance, review & appearance', source: '2, 4, 7, 15',
    description: 'Live guidance and review afterward are independent. Quiet performance is the default direction.',
    settings: [
      undecided('performance-guidance', 'Guided cursor / highlight', 'The score already stays stationary during performance. A guided cursor or highlight remains planned.'),
      { id: 'live-feedback', label: 'Live correctness feedback', kind: 'check', checked: false },
      { id: 'guided-review', label: 'Optional guided review', kind: 'check', hint: 'Completed attempts already show attack, release and rest evidence on the score and in review. A preference to control this review remains planned.' },
      { id: 'focused-replay', label: 'Offer focused measure replay', kind: 'check', checked: true, hint: 'Retry same exercise already repeats the whole passage. Focused measure replay remains planned and would be optional.' },
      undecided('score-pagination', 'Score pagination and page turns', 'Responsive measure layout, horizontal scrolling and Wrap notation into systems already work. Pagination, page turns and permitted timing cues remain open.'),
      undecided('uno-motion', 'Uno and motion', 'Character feedback and reduced-motion behavior need review. Decorative motion must not become an unlabelled timing cue.'),
      undecided('accessible-notation', 'Accessible notation alternatives', 'Text/audio descriptions and keyboard shortcuts need review without revealing answers unintentionally.'),
    ],
  },
  {
    id: 'storage', title: 'Saved preferences & progress', source: '6, 8, 15',
    description: 'Preferences are saved automatically in this browser across reloads. Calibration is saved for the session. Answers and results reset on reload; saved progress and accounts remain unavailable.',
    settings: [
      { id: 'save-progress', label: 'Save practice progress', kind: 'check', availability: 'decision' },
      undecided('history', 'Attempt history and retention', 'Decide which completed or partial attempts, unlocks and calibration details are retained, and for how long.'),
      undecided('profiles', 'Teacher / student profiles', 'Profile separation, permissions and teacher locks need definition. Accounts and classroom dashboards are not in scope.'),
      { id: 'reset-preferences', label: 'Reset saved preferences', kind: 'action', availability: 'decision' },
      { id: 'delete-progress', label: 'Delete saved progress', kind: 'action', availability: 'decision', hint: 'Practice progress is not currently saved. Preferences and session calibration are stored separately; deleting future progress needs its own policy.' },
      undecided('offline', 'Offline availability', 'This prototype has no dedicated installation or offline download. Rhythm distribution needs its own acceptance checks.'),
    ],
  },
];
