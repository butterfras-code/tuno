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
    id: 'counting', title: 'Count Writing', source: '12',
    description: 'Counting conventions and how students enter and mark their answers.',
    settings: [
      choice('count-system', 'Counting system', ['Numbers with &', 'Numbers with +', 'Other counting systems — to define'], 'Numbers with &', 'The current exercises use numbers and &. Additional counting systems need their own rules.'),
      choice('count-assistance', 'Symbol assistance', ['Open entry', 'Guided / scaffolded'], 'Open entry', 'Guided entry will filter symbols, including keyboard input. It will not constrain lines or parentheses.'),
      choice('count-positions', 'Required count positions', ['Note onsets and internal beats', 'Additional subdivisions — to define'], 'Note onsets and internal beats', 'Valid extra subdivisions remain subject to teacher review.'),
      choice('count-input', 'Answer input', ['Keyboard and touch keypad'], 'Keyboard and touch keypad', 'Both already work; there is no input restriction setting yet.'),
      undecided('line-endpoints', 'Duration-line endings and snapping', 'Choose how endings relate to the last entered count or the note boundary. Current endings remain provisional.'),
      choice('rest-grouping', 'Rest parentheses', ['Individual count positions', 'Grouped expressions — to define'], 'Individual count positions'),
      undecided('count-hints', 'Hints and answer visibility', 'Decide when hints, answer reveal and optional input positions are shown, and how corrections are recorded.'),
    ],
  },
  {
    id: 'activity', title: 'Activity & exercises', source: '1, 3, 6, 7',
    description: 'Choose an activity, a session format and the source of its exercises.',
    settings: [
      choice('activity-mode', 'Activity', ['Count Writing', 'Rhythm Walk'], 'Count Writing', 'Rhythm Walk performance is a later activity.'),
      choice('session-format', 'Rhythm Walk session format', ['Short challenges', 'Continuous performance', 'Progressive journey'], undefined, 'All three formats are planned. No default format has been selected.'),
      number('passage-length', 'Passage length (measures)', 'Short and longer passages will be configurable. Suggested lengths in the handoff were examples, not defaults.'),
      choice('exercise-source', 'Exercise source', ['Four review exercises', 'Generated rhythms', 'Curated passages'], 'Four review exercises', 'Generation and authored content are not connected yet.'),
      choice('preset', 'Starting preset', ['Beginning Band Midyear', 'Beginning Band End of Year', 'Non-Varsity', 'Varsity', 'UIL I', 'UIL II', 'UIL III', 'UIL IV', 'UIL V', 'UIL VI'], undefined, 'Presets will be editable. Their contents need review; UIL presets will not lock meter choices.'),
      { id: 'save-preset', label: 'Save a custom preset', kind: 'action', availability: 'decision', hint: 'Named presets, editing, sharing and import/export behavior are still to be decided.' },
      undecided('quick-start', 'Quick-start defaults and instructions', 'Choose a starting preset and how first-visit instructions are presented.'),
    ],
  },
  {
    id: 'vocabulary', title: 'Rhythm vocabulary', source: '4, 6, 7',
    description: 'Two ordinary checklists: the starting vocabulary and an optional progression goal. Exercise generation is not available yet, so these lists have no selections.',
    settings: [
      { id: 'starting-vocabulary', label: 'Starting vocabulary', kind: 'checklist', options: vocabulary },
      { id: 'goal-enabled', label: 'Enable a progression goal', kind: 'check', checked: false, hint: 'A goal is an upper bound. It must include every starting item and does not promise an unlock order.' },
      { id: 'goal-vocabulary', label: 'Progression goal vocabulary', kind: 'checklist', options: vocabulary },
      { id: 'pattern-exclusions', label: 'Advanced pattern restrictions', kind: 'checklist', availability: 'decision', options: ['Syncopated combinations', 'Dotted-eighth–sixteenth figures', 'Ties across beats', 'Ties across barlines', 'Rest placement restrictions'], hint: 'The exact allowed/excluded pattern rules still need definition. Selecting a note value will not automatically allow every combination.' },
      { id: 'vocabulary-extensions', label: 'Additional vocabulary', kind: 'checklist', availability: 'decision', options: ['Sixteenth rests', 'Double-dotted values', 'Compound-meter duplets'], hint: 'These require reviewed counting, notation and content rules before they can be offered.' },
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
    id: 'performance', title: 'Rhythm Walk input & timing', source: '3, 4, 5, 15',
    description: 'Performance controls are not active in Count Writing. A performance will continue through mistakes.',
    settings: [
      choice('performance-input', 'Performance input mode', ['Tap note onsets', 'Press and hold durations'], 'Tap note onsets'),
      number('target-tempo', 'Target tempo (BPM)', 'Range, step and starting tempo are not selected yet.'),
      undecided('tempo-bounds', 'Tempo limits and adjustment', 'Minimum/maximum tempo, manual steps and adaptive increments need review.'),
      number('count-in', 'Count-in length (beats)', 'Simple meter, compound meter and pickup behavior must be defined before choosing a default.'),
      { id: 'calibrate', label: 'Calibrate input timing', kind: 'action', availability: 'decision', hint: 'Optional versus required calibration, calibration quality and device changes need review.' },
      number('calibration-offset', 'Timing offset (ms)', 'Input/output device handling, offset bounds and storage lifetime are undecided.'),
      undecided('timing-tolerance', 'Timing and release tolerances', 'Early/late windows, hold releases and difficulty scaling have no approved numerical policy.'),
      undecided('performance-scoring', 'Scoring and completion', 'Rhythm pattern, pulse stability and target tempo will be separate. Weights, recovery evidence, pass criteria and any overall score remain open; these may be teaching policies rather than student controls.'),
      undecided('interruption', 'Pause, interruption and abandoned attempts', 'Decide restart/count-in behavior, handling a held note, partial results and whether unfinished attempts affect progress.'),
      { id: 'other-inputs', label: 'Additional performance inputs', kind: 'checklist', availability: 'deferred', options: ['Microphone / clapping', 'MIDI', 'Gamepad'], hint: 'Outside the current release scope.' },
    ],
  },
  {
    id: 'sound', title: 'Metronome & sound', source: '3, 4, 7, 15',
    description: 'Audible pulse support will be configurable and can adapt as the student gains independence.',
    settings: [
      choice('metronome-policy', 'Metronome assistance', ['Adaptive', 'Manually controlled'], undefined, 'The assistance schedule has not been selected.'),
      { id: 'metronome-audible', label: 'Audible metronome', kind: 'check', checked: true, hint: 'The handoff starts practice with audible support; it is not playing in this prototype.' },
      choice('metronome-pulse', 'Metronome pulse', ['Counting beat', 'Subdivisions'], undefined, 'Beat units and subdivision choices need review for each meter.'),
      undecided('click-sound', 'Click sound and accents', 'Choose the click sound and how the beginning of a measure is distinguished.'),
      number('click-volume', 'Click volume (%)'),
      { id: 'tap-feedback', label: 'Sound on student taps', kind: 'check', availability: 'decision', hint: 'Whether tap feedback is offered, and its default state, remain undecided.' },
      undecided('tap-sound', 'Tap sound and volume', 'Sound choice and volume need review alongside output latency.'),
    ],
  },
  {
    id: 'guidance', title: 'Guidance, review & appearance', source: '2, 4, 7, 15',
    description: 'Live guidance and review afterward are independent. Quiet performance is the default direction.',
    settings: [
      choice('performance-guidance', 'Performance guidance', ['Stationary score', 'Guided cursor / highlight'], 'Stationary score'),
      { id: 'live-feedback', label: 'Live correctness feedback', kind: 'check', checked: false },
      { id: 'guided-review', label: 'Guided review after performance', kind: 'check', checked: true },
      { id: 'focused-replay', label: 'Offer focused measure replay', kind: 'check', checked: true, hint: 'Replay is optional and never forced.' },
      undecided('score-pagination', 'Score layout and page turns', 'Decide visible measures, scrolling/page turns and which timing cues are allowed in stationary mode.'),
      undecided('uno-motion', 'Uno and motion', 'Character feedback and reduced-motion behavior need review. Decorative motion must not become an unlabelled timing cue.'),
      undecided('accessible-notation', 'Accessible notation alternatives', 'Text/audio descriptions and keyboard shortcuts need review without revealing answers unintentionally.'),
    ],
  },
  {
    id: 'storage', title: 'Saved preferences & progress', source: '6, 8, 15',
    description: 'Current changes last in this open tab only. Reloading resets settings and answers; there are no accounts or saved results.',
    settings: [
      { id: 'remember-settings', label: 'Remember settings on this device', kind: 'check', availability: 'decision' },
      { id: 'save-progress', label: 'Save practice progress', kind: 'check', availability: 'decision' },
      undecided('history', 'Attempt history and retention', 'Decide which completed or partial attempts, unlocks and calibration details are retained, and for how long.'),
      undecided('profiles', 'Teacher / student profiles', 'Profile separation, permissions and teacher locks need definition. Accounts and classroom dashboards are not in scope.'),
      { id: 'reset-preferences', label: 'Reset saved preferences', kind: 'action', availability: 'decision' },
      { id: 'delete-progress', label: 'Delete saved progress', kind: 'action', availability: 'decision', hint: 'No rhythm data is currently stored.' },
      undecided('offline', 'Offline availability', 'This prototype has no dedicated installation or offline download. Rhythm distribution needs its own acceptance checks.'),
    ],
  },
];
