import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { defaultPreset, fingerprint, clefForPitch, normalizePreset, presets } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import type { AnswerSpelling } from '../domain/notation.ts';
import { spelling } from '../domain/notation.ts';
import { Challenge, describeRules } from '../engine/challenge.ts';
import type { ChallengeRules } from '../engine/challenge.ts';
import { canPair, displayNames, schedule, standings } from '../engine/multiplayer.ts';
import type { Format, PlayerEntry } from '../engine/multiplayer.ts';
import { PressGate } from '../engine/practice.ts';
import type { PromptToken } from '../engine/practice.ts';
import { NotesProgress } from '../engine/progress.ts';
import type { Context } from '../persistence/store.ts';
import { NotesStore } from '../persistence/store.ts';
import { answerControls } from './answers.ts';
import { activitySetup } from './activity-setup.ts';
import { challengeSetup } from './challenge-setup.ts';
import { button, presetSetup } from './setup.ts';
import { renderStaff } from './staff.ts';
import { segments } from './range-editor.ts';

interface Player extends PlayerEntry { preset: Preset; profileId?: string }
interface Lane {
  player: Player; session: Challenge; progress: NotesProgress;
  node: HTMLElement; heading: HTMLElement; status: HTMLElement; stats: HTMLElement; announcement: HTMLElement;
  staff: HTMLElement; feedback: HTMLElement; note: HTMLElement; intro: HTMLElement;
  cue: HTMLElement; dog: ReturnType<typeof animatedUno>; answers: ReturnType<typeof answerControls>;
  keyHelp: HTMLElement; recorded: boolean; prompt: string; phase: string; inputSince: number; tenSeconds: boolean;
}
const leftLetters = ['Q','W','E','R','T','Y','U'];
const rightLetters = ['Z','X','C','V','B','N','M'];
const letterNames = ['A','B','C','D','E','F','G'] as const;
const modifierCodes = [['Digit1','Digit2','Digit3'],['Digit8','Digit9','Digit0']];
const accuracy = (s: Challenge) => s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`;
const seconds = (ms: number) => (Math.floor(ms) / 1000).toFixed(2);

export function multiplayerView(store: NotesStore, home: () => void) {
  const node = el('section','multiplayer-view'); node.setAttribute('aria-label','Multi Player'); node.hidden = true;
  const setup = el('section','multiplayer-setup');
  const rosterSection = el('section','multiplayer-roster-section');
  const playersHeading = el('h3','multiplayer-players-heading');
  const roster = el('div','multiplayer-roster'); roster.setAttribute('role','group'); roster.setAttribute('aria-label','Players');
  const add = button('Add player',() => { if (players.length < 8 && commitEditor()) openPlayerEditor(newPlayer(players.length+1),true,add); });
  add.classList.add('multiplayer-add');
  rosterSection.append(playersHeading,roster);
  const editor = el('section','multiplayer-editor');
  const presetUI = presetSetup(store,'multi-');
  presetUI.setupPresentation(true);
  const setupDog = animatedUno(); setupDog.pose('rest'); presetUI.companion.append(setupDog.node);
  editor.append(presetUI.node);
  const rules = challengeSetup('Round rules'); rules.node.hidden = false;
  const format = segments<Format>('Play format',[['turns','Turns'],['pairs','Split Screen'],['head-to-head','Head to Head']],value => { selectedFormat = value; format.update([value]); showPairAdvice(); });
  let selectedFormat: Format = 'turns'; format.update([selectedFormat]);
  const formatGroup = el('div','setting'); formatGroup.append(el('span','setting-label','Play format'),format.node);
  const pairAdvice = el('p','muted'); pairAdvice.setAttribute('role','status');
  const roundSetup = el('section','multiplayer-round-setup');
  let adaptive = store.profile()?.adaptive ?? false;
  const adapt = button('Adapt Range',() => { adaptive = !adaptive; adapt.setAttribute('aria-pressed',String(adaptive)); updateSetupSummary(); });
  adapt.setAttribute('aria-pressed',String(adaptive));
  const adaptation = el('div','setting');
  adaptation.append(adapt,el('p','muted','Applies to all players. Each player’s notes expand independently as they improve.'));
  roundSetup.append(formatGroup,pairAdvice,rules.node,adaptation);
  const setupError = el('p','feedback'); setupError.setAttribute('role','alert');
  const setupFullscreen = button('Enter fullscreen',toggleFullscreen); setupFullscreen.classList.add('multiplayer-setup-fullscreen');
  const start = button('Start round',startRound); start.classList.add('control--primary');
  const setupUI = activitySetup(editor,roundSetup,'multiplayer');
  setupUI.settingsLabel('Multi Player Settings');
  setupUI.node.append(setupError,setupFullscreen); setupUI.action(start);
  setup.append(rosterSection,setupUI.node);

  const round = el('section','multiplayer-round'); round.hidden = true;
  const roundHeader = el('div','multiplayer-round-header');
  const roundTitle = el('h2'); roundTitle.tabIndex = -1;
  const roundSummary = el('p','muted multiplayer-round-summary');
  const roundActions = el('div','control-row');
  const ready = button('Ready',() => { const startAt = performance.now(); active.forEach(l => l.session.ready(startAt)); ready.hidden = true; resetInput(); renderRound(); }); ready.classList.add('control--primary');
  const pause = button('Pause',() => {
    if (active.some(l => l.session.state === 'paused')) {
      active.forEach(l => l.session.resume());
    } else active.forEach(l => l.session.pause());
    resetInput(); renderRound();
  });
  const end = button('End round',() => { finishRound(); });
  const fullscreen = button('Enter fullscreen',toggleFullscreen);
  const fullscreenHelp = el('p','muted multiplayer-fullscreen-help'); fullscreenHelp.setAttribute('role','status');
  roundActions.append(ready,pause,fullscreen,end);
  const fitWarning = el('div','multiplayer-fit-warning'); fitWarning.hidden = true;
  const fitWarningText = el('p','','This screen may work better with Turns. Switching starts a new round.');
  fitWarning.setAttribute('role','status');
  const restart = button('Switch to Turns',() => { finishActive(true); selectedFormat = 'turns'; format.update(['turns']); startRound(); });
  fitWarning.append(fitWarningText,restart);
  const panels = el('div','multiplayer-panels');
  roundHeader.append(roundTitle,roundSummary,roundActions,fullscreenHelp);
  round.append(roundHeader,panels);

  const result = el('section','multiplayer-result'); result.hidden = true;
  const resultTitle = el('h2','','Round results'); resultTitle.tabIndex = -1;
  const resultSummary = el('p','muted');
  const board = el('div','multiplayer-board');
  const resultActions = el('div','control-row');
  resultActions.append(button('Retry',startRound),button('Edit setup',showSetup),button('Home',() => { showSetup(); home(); }));
  result.append(resultTitle,resultSummary,board,resultActions);
  node.append(setup,fitWarning,round,result);

  let players: Player[] = [newPlayer(1)];
  let selectedId = players[0]!.id;
  let rulesValue: ChallengeRules | undefined;
  let heats: Player[][] = [];
  let heatIndex = 0;
  let active: Lane[] = [];
  let completed = new Map<string,Challenge>();
  const guestContexts = new Map<string,Context>();
  const gate = new PressGate();
  const held = [new Set<string>(),new Set<string>()];
  let requestedFullscreen = false;
  let disposed = false;

  function fullscreenSupported() { return document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function'; }
  function updateFullscreen() {
    fullscreen.hidden = !fullscreenSupported();
    setupFullscreen.hidden = fullscreen.hidden;
    fullscreen.textContent = document.fullscreenElement === document.documentElement ? 'Exit fullscreen' : 'Enter fullscreen';
    setupFullscreen.textContent = fullscreen.textContent;
    fullscreenHelp.textContent = !fullscreenSupported() && !matchMedia('(display-mode: standalone)').matches ? 'For a view without browser bars, open tuNotes from your Home Screen.' : '';
  }
  async function toggleFullscreen() {
    if (document.fullscreenElement === document.documentElement) { await document.exitFullscreen(); return; }
    try {
      await document.documentElement.requestFullscreen();
      requestedFullscreen = true;
    } catch { fullscreenHelp.textContent = 'Fullscreen is unavailable in this browser. You can open tuNotes from your Home Screen.'; }
  }
  function leaveFullscreen() {
    if (document.fullscreenElement === document.documentElement) void document.exitFullscreen();
  }
  function fullscreenChanged() {
    updateFullscreen();
    if (requestedFullscreen && document.fullscreenElement !== document.documentElement) {
      requestedFullscreen = false;
      if (!round.hidden && active.some(l => l.session.state !== 'finished')) {
        active.forEach(l => l.session.pause()); resetInput(); renderRound();
      }
    }
    resize();
  }

  function newPlayer(number: number): Player {
    const profile = number === 1 ? store.profile() : undefined;
    return { id: crypto.randomUUID(), name: profile?.name ?? `Player ${number}`, preset: profile ? profilePreset(profile.defaultPresetId) : defaultPreset, profileId: profile?.id };
  }
  function profilePreset(id: string): Preset { return presets.find(p => p.id === id) ?? normalizePreset(store.data.customPresets.find(p => p.id === id)!); }
  function pairFits() {
    const viewport = node.closest<HTMLElement>('.play-viewport');
    const visibleWidth = Math.min(window.innerWidth,window.visualViewport?.width ?? window.innerWidth,viewport?.clientWidth ?? Infinity);
    const visibleHeight = Math.min(window.innerHeight,window.visualViewport?.height ?? window.innerHeight,viewport?.clientHeight ?? Infinity);
    return canPair(visibleWidth,visibleHeight);
  }
  function showPairAdvice() {
    pairAdvice.textContent = selectedFormat === 'turns' ? 'Players take one turn each in roster order.' : selectedFormat === 'head-to-head' ? 'Lay the screen flat. Players face opposite short edges in either screen orientation. Small screens may work better with Turns. Larger groups play in heats.' : pairFits() ? 'Two players play side by side. Larger groups play in heats; an odd player takes a solo turn.' : 'This screen may work better with Turns.';
    if (!fullscreenSupported() && !matchMedia('(display-mode: standalone)').matches) pairAdvice.textContent += ' For a view without browser bars, open tuNotes from your Home Screen.';
    updateFullscreen(); updateSetupSummary();
  }
  function updateSetupSummary() {
    const player = players.find(p => p.id === selectedId) ?? players[0]!;
    setupUI.notesLabel(`${player.name.trim() || `Player ${players.indexOf(player)+1}`}'s Notes`);
    setupUI.summary(`${players.length} ${players.length === 1 ? 'player' : 'players'} · ${selectedFormat === 'turns' ? 'Turns' : selectedFormat === 'pairs' ? 'Split Screen' : 'Head to Head'} · ${rules.summary()}${adaptive ? ' · Adapt Range on' : ''}`);
  }
  rules.onChange(updateSetupSummary);
  function focusSelectedPlayer() { roster.querySelector<HTMLElement>('.multiplayer-player-tab[aria-pressed="true"]')?.focus(); }
  let playerDialog: HTMLDialogElement | undefined;
  function closePlayerEditor() { playerDialog?.close(); }
  function openPlayerEditor(player: Player,adding: boolean,anchor: HTMLElement) {
    closePlayerEditor();
    const index = adding ? players.length : players.indexOf(player);
    const dialog = document.createElement('dialog'); dialog.className = 'multiplayer-player-popover';
    dialog.setAttribute('aria-label',adding ? 'Add player' : `Edit Player ${index+1}`);
    const title = el('h3','',adding ? 'Add player' : 'Edit player');
    const form = document.createElement('form');
    const name = el('input','control'); name.value = player.name; name.maxLength = 40; name.required = true;
    name.setAttribute('aria-label',`Player ${index+1} name`);
    const nameLabel = el('label','setting','Name'); nameLabel.append(name);
    const profile = el('select','control'); profile.setAttribute('aria-label',`Player ${index+1} saved profile`);
    const guest = el('option','','Guest (this session)'); guest.value = ''; profile.append(guest);
    if (store.data.configuration.remember) store.data.profiles.forEach(saved => {
      const option = el('option','',saved.name); option.value = saved.id; profile.append(option);
    });
    profile.value = player.profileId ?? '';
    profile.addEventListener('change',() => {
      const saved = store.data.profiles.find(p => p.id === profile.value);
      if (saved) name.value = saved.name;
    });
    const profileLabel = el('label','setting','Saved profile'); profileLabel.append(profile);
    const actions = el('div','control-row');
    const cancel = button('Cancel',() => dialog.close()); cancel.type = 'button';
    const save = el('button','control control--primary','Save'); save.type = 'submit'; actions.append(cancel,save);
    form.append(nameLabel,profileLabel,actions); dialog.append(title,form); node.append(dialog); playerDialog = dialog;
    form.addEventListener('submit',event => {
      event.preventDefault();
      if (!name.value.trim()) { name.setCustomValidity('Enter a player name.'); name.reportValidity(); return; }
      const changedProfile = profile.value !== (player.profileId ?? '');
      player.name = name.value.trim(); player.profileId = profile.value || undefined;
      const saved = store.data.profiles.find(p => p.id === player.profileId);
      if (saved && (adding || changedProfile)) { player.preset = profilePreset(saved.defaultPresetId); }
      if (adding) { players.push(player); selectedId = player.id; setupUI.select('notes'); }
      dialog.close(); renderSetup(); focusSelectedPlayer();
    });
    name.addEventListener('input',() => name.setCustomValidity(''));
    dialog.addEventListener('close',() => { dialog.remove(); if (playerDialog === dialog) playerDialog = undefined; if (anchor.isConnected) anchor.focus(); });
    dialog.addEventListener('click',event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
    dialog.showModal();
    const rect = anchor.getBoundingClientRect(), width = dialog.offsetWidth, height = dialog.offsetHeight;
    dialog.style.left = `${Math.max(8,Math.min(rect.right+8,innerWidth-width-8))}px`;
    dialog.style.top = `${Math.max(8,Math.min(rect.top,innerHeight-height-8))}px`;
    name.focus(); name.select();
  }
  function rosterIcon(path: string) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    const mark = document.createElementNS(svg.namespaceURI,'path');
    mark.setAttribute('d',path); mark.setAttribute('fill','none'); mark.setAttribute('stroke','currentColor');
    mark.setAttribute('stroke-width','2'); mark.setAttribute('stroke-linecap','round'); mark.setAttribute('stroke-linejoin','round');
    svg.append(mark); return svg;
  }
  function renderSetup() {
    const current = players.find(p => p.id === selectedId) ?? players[0]!; selectedId = current.id;
    playersHeading.textContent = `Players (${players.length})`;
    updateSetupSummary();
    roster.replaceChildren();
    players.forEach((player,index) => {
      const slot = el('div','multiplayer-slot');
      const tab = button(player.name.trim() || `Player ${index+1}`,() => { if (player.id === selectedId || !commitEditor()) return; selectedId = player.id; setupUI.select('notes'); renderSetup(); focusSelectedPlayer(); });
      tab.classList.add('multiplayer-player-tab'); tab.setAttribute('aria-label',`Select Player ${index+1}`);
      tab.setAttribute('aria-pressed',String(player.id === selectedId)); tab.setAttribute('aria-controls',editor.id);
      if (player.id === selectedId) {
        slot.classList.add('selected');
        if (index > 0) {
          const left = button(matchMedia('(min-width: 761px)').matches ? '↑' : '←',() => move(index,-1)); left.classList.add('multiplayer-move'); left.setAttribute('aria-label',`Move Player ${index+1} ${matchMedia('(min-width: 761px)').matches ? 'up' : 'left'}`); slot.append(left);
        }
        slot.append(tab);
        if (index < players.length-1) {
          const right = button(matchMedia('(min-width: 761px)').matches ? '↓' : '→',() => move(index,1)); right.classList.add('multiplayer-move'); right.setAttribute('aria-label',`Move Player ${index+1} ${matchMedia('(min-width: 761px)').matches ? 'down' : 'right'}`); slot.append(right);
        }
      } else slot.append(tab);
      const edit = button('',() => { if (commitEditor()) openPlayerEditor(player,false,edit); });
      edit.append(rosterIcon('M4 16v4h4L20 8l-4-4Z M14 6l4 4'));
      edit.classList.add('multiplayer-edit'); edit.setAttribute('aria-label',`Edit Player ${index+1}`);
      edit.setAttribute('aria-haspopup','dialog'); slot.append(edit);
      const remove = button('',() => {
        if (players.length === 1 || !commitEditor()) return;
        players.splice(index,1);
        if (selectedId === player.id) selectedId = players[Math.min(index,players.length-1)]!.id;
        renderSetup(); focusSelectedPlayer();
      });
      remove.classList.add('multiplayer-delete'); remove.setAttribute('aria-label',`Remove Player ${index+1}`);
      remove.disabled = players.length === 1; remove.append(rosterIcon('M6 6l12 12 M18 6L6 18'));
      slot.append(remove); roster.append(slot);
    });
    add.hidden = players.length >= 8; roster.append(add);
    presetUI.selectPreset(current.preset.id);
    showPairAdvice();
  }
  function move(index: number,delta: number) { if (!commitEditor()) return; const [player] = players.splice(index,1); players.splice(index+delta,0,player!); renderSetup(); focusSelectedPlayer(); }
  presetUI.onChange(() => { const player = players.find(p => p.id === selectedId); const chosen = presetUI.selected(); if (player && chosen) { player.preset = chosen; updateSetupSummary(); } });
  function commitEditor() {
    if (!presetUI.selected()) return false;
    if (!presets.some(p => p.id === presetUI.selected()!.id)) return Boolean(presetUI.saveForRoster());
    return true;
  }

  function startRound() {
    setupError.textContent = '';
    if (!commitEditor()) { setupError.textContent = 'Fix the selected preset before starting.'; return; }
    const names = players.map(p => p.name.trim());
    if (names.some(n => !n)) { setupUI.select('notes'); setupError.textContent = 'Give each player a name.'; return; }
    const profiles = players.map(p => p.profileId).filter(Boolean);
    if (new Set(profiles).size !== profiles.length) { setupError.textContent = 'Use each saved profile for one player in a round.'; return; }
    const nextRules = rules.read(() => setupUI.select('settings')); if (!nextRules) return;
    finishActive(true); active.forEach(l => l.dog.dispose()); active = [];
    rulesValue = nextRules; completed = new Map(); heatIndex = 0;
    players.forEach((p,i) => { p.name = names[i]!; });
    heats = schedule(players.map(p => ({...p,preset:structuredClone(p.preset)})), selectedFormat);
    round.classList.toggle('multiplayer-round--head-to-head',selectedFormat === 'head-to-head');
    updateFullscreen();
    setup.hidden = true; result.hidden = true; round.hidden = false;
    prepareHeat();
  }
  function makeLane(player: Player): Lane {
    const contextKey = fingerprint(player.preset,adaptive,'challenge');
    const context = player.profileId ? store.data.profiles.find(p => p.id === player.profileId)?.contexts.find(c => c.fingerprint === contextKey) : guestContexts.get(`${player.id}:${contextKey}`);
    const session = new Challenge(player.preset,rulesValue!,() => performance.now(),Math.random,{ adaptive, notes: context?.notes, learning: context?.learning });
    const progress = new NotesProgress(player.profileId ? store.challengeBenchmarkFor(player.profileId,player.preset,adaptive,rulesValue!) : 10);
    const displayName = displayNames(players).get(player.id)!;
    const panel = el('section','multiplayer-panel'); panel.setAttribute('aria-label',`${displayName} note area`);
    const heading = el('h3','',displayName); const status = el('p','multiplayer-status'); status.setAttribute('role','timer'); status.setAttribute('aria-live','off');
    const announcement = el('p','multiplayer-announcement'); announcement.setAttribute('role','status'); announcement.setAttribute('aria-live','polite');
    const stats = el('p','muted'); const staff = el('div','staff-panel');
    const feedback = el('p','feedback'); feedback.setAttribute('role','status');
    const note = el('div','multiplayer-note'); note.append(staff);
    const cue = el('strong','multiplayer-cue');
    const intro = el('div','multiplayer-intro');
    const blankStaff = renderStaff(session.pitch,clefForPitch(session.preset,session.pitch),session.preset.key,session.preset.keyless);
    blankStaff.querySelectorAll('.notehead,.note-accidental,.ledger').forEach(n=>n.remove()); blankStaff.removeAttribute('aria-label'); blankStaff.setAttribute('aria-hidden','true');
    intro.append(blankStaff,cue,el('p','muted',player.preset.name));
    const dog = animatedUno(); dog.pose('wag');
    const lane = { player, session, progress, node: panel, heading, status, stats, announcement, staff, feedback, note, intro, cue, dog, answers: undefined as unknown as ReturnType<typeof answerControls>, keyHelp: el('p','muted keyboard-help'), recorded: false, prompt: '', phase: '', inputSince: 0, tenSeconds: false };
    lane.answers = answerControls((answer,token) => submit(lane,answer,token),true);
    panel.append(heading,status,stats,announcement,note,intro,dog.node,feedback,lane.answers.node,lane.keyHelp);
    return lane;
  }
  function prepareHeat() {
    active.forEach(l => l.dog.dispose());
    active = heats[heatIndex]!.map(makeLane);
    updateKeyHelp();
    panels.replaceChildren(...active.map(l => { const seat = el('div','multiplayer-seat'); seat.append(l.node); return seat; }));
    resetInput();
    roundTitle.textContent = selectedFormat !== 'turns' ? `Heat ${heatIndex+1} of ${heats.length}` : `Turn ${heatIndex+1} of ${heats.length}`;
    roundSummary.textContent = describeRules(rulesValue!);
    ready.hidden = false; pause.hidden = true; fitWarning.hidden = true;
    renderRound(); roundTitle.focus({preventScroll:true});
  }
  function record(lane: Lane) {
    if (lane.recorded || lane.session.state !== 'finished') return;
    lane.recorded = true; completed.set(lane.player.id,lane.session);
    store.record(lane.player.profileId,lane.session); store.flush();
  }
  function finishActive(partial = false) {
    for (const lane of active) {
      if (partial && lane.session.state !== 'finished') lane.session.finish();
      record(lane);
    }
  }
  function finishRound() {
    finishActive(true); resetInput();
    fitWarning.hidden = true;
    leaveFullscreen();
    round.hidden = true; setup.hidden = true; result.hidden = false;
    renderResults(); resultTitle.focus({preventScroll:true});
  }
  function renderResults() {
    board.replaceChildren();
    const named = displayNames(players);
    const entries = players.filter(p => completed.has(p.id)).map(p => ({ player:p, session:completed.get(p.id)! }));
    const rows = standings(entries,rulesValue!);
    resultSummary.textContent = `${rulesValue!.goal === 'timed' ? 'Higher points rank first.' : 'Lower qualifying time ranks first.'} Differentiated practice across presets.`;
    for (const row of rows) {
      const item = el('section','multiplayer-result-row');
      const heading = el('h3','',`${row.rank ? `#${row.rank} · ` : ''}${named.get(row.player.id)}`);
      const main = el('strong','multiplayer-result-value',rulesValue!.goal === 'timed' ? `${row.session.score.toFixed(2)} points` : `${seconds(row.session.activeMs)} seconds`);
      const detail = el('p','',`${row.session.correct}/${row.session.attempts} correct · ${accuracy(row.session)} accuracy · best streak ${row.session.bestStreak}`);
      const status = el('p','muted',row.session.qualified ? 'Qualified' : row.session.end === 'timeout' ? `Nice practice — try another round. ${row.session.correct}/${row.session.rules.goal === 'target' ? row.session.rules.target : 0} target · time out · unranked` : row.session.interrupted ? 'Interrupted · unranked' : row.session.end !== 'completed' ? 'Incomplete · unranked' : !row.session.attempts ? 'No attempts · unranked' : 'Nice run! Improve your accuracy to make finals. Unranked');
      item.append(heading,main,detail,status); board.append(item);
    }
    for (const player of players.filter(p => !completed.has(p.id))) {
      const item = el('section','multiplayer-result-row');
      item.append(el('h3','',named.get(player.id)!),el('p','muted','Not played · unranked'));
      board.append(item);
    }
  }
  function showSetup() {
    leaveFullscreen();
    fitWarning.hidden = true;
    finishActive(true); resetInput(); active.forEach(l => l.dog.dispose()); active = []; panels.replaceChildren();
    setup.hidden = false; round.hidden = true; result.hidden = true; renderSetup();
  }
  function renderRound() {
    if (round.hidden) return;
    const paused = active.some(l => l.session.state === 'paused');
    pause.hidden = active.every(l => l.session.phase === 'ready' || l.session.state === 'finished');
    pause.textContent = paused ? 'Resume' : 'Pause';
    fitWarning.hidden = selectedFormat !== 'pairs' || pairFits();
    ready.hidden = !active.every(l => l.session.phase === 'ready' && l.session.state === 'running');
    for (const lane of active) {
      const s = lane.session;
      const phase = s.state === 'finished' ? 'finished' : s.state === 'paused' ? 'paused' : s.phase;
      lane.node.dataset.phase = phase;
      lane.status.textContent = phase === 'ready' ? 'Ready' : phase === 'countdown' ? `Starting in ${s.countdown}` : phase === 'paused' ? 'Paused' : phase === 'finished' ? 'Finished' : `${(s.remainingMs/1000).toFixed(1)} s remaining`;
      lane.stats.textContent = `${s.correct}${s.rules.goal === 'target' ? ` / ${s.rules.target}` : ''} correct · ${s.attempts} attempts`;
      lane.cue.textContent = phase === 'ready' ? 'Ready?' : phase === 'countdown' ? String(s.countdown) : phase === 'paused' ? 'Paused' : 'Finished';
      lane.intro.hidden = phase === 'playing';
      lane.note.hidden = phase !== 'playing';
      lane.answers.node.hidden = phase !== 'playing'; lane.keyHelp.hidden = phase !== 'playing';
      lane.feedback.hidden = phase !== 'playing';
      if (phase !== lane.phase) {
        lane.phase = phase; lane.inputSince = performance.now();
        lane.announcement.textContent = phase === 'playing' ? `${displayNames(players).get(lane.player.id)}: Go!` : phase === 'paused' ? 'Paused. Resume when ready.' : phase === 'finished' ? 'Finished.' : phase === 'ready' ? 'Ready when you are.' : '';
        lane.dog.pose(phase === 'playing' ? lane.progress.pose : phase === 'finished' ? 'happy' : phase === 'paused' ? 'rest' : 'wag');
        lane.dog.tail(0,phase === 'ready' || phase === 'countdown');
        lane.answers.reset();
      }
      if (phase === 'playing') {
        if (!lane.tenSeconds && s.remainingMs <= 10000) { lane.tenSeconds = true; lane.announcement.textContent = '10 seconds left.'; }
        const identity = `${s.session}:${s.prompt}`;
        if (lane.prompt !== identity) { lane.prompt = identity; lane.inputSince = performance.now(); lane.staff.replaceChildren(renderStaff(s.pitch,clefForPitch(s.preset,s.pitch),s.preset.key,s.preset.keyless)); }
      }
      lane.feedback.textContent = phase === 'playing' && s.state === 'feedback' ? s.last!.correct ? `Correct — ${spelling(s.pitch)}.` : `That note is ${spelling(s.pitch)}.` : '';
      lane.answers.update(s.activePreset,s.token,phase !== 'playing' || s.state !== 'running');
      showModifier(lane);
      if (phase === 'finished') { lane.intro.querySelector('p')!.textContent = `${s.correct}/${s.attempts} correct · ${accuracy(s)} accuracy. Waiting for the other player.`; record(lane); }
    }
    if (active.every(l => l.session.state === 'finished')) {
      if (heatIndex+1 < heats.length) { heatIndex++; prepareHeat(); }
      else finishRound();
    }
  }
  function submit(lane: Lane,answer: AnswerSpelling,token: PromptToken) {
    if (!active.includes(lane) || round.hidden || !lane.session.answer(token,answer)) return;
    const s = lane.session;
    store.observe(lane.player.profileId,s.preset,s.last!,s.adaptive,s.savedLearning);
    if (!lane.player.profileId) {
      const key = `${lane.player.id}:${fingerprint(s.preset,s.adaptive,'challenge')}`;
      guestContexts.set(key,{ fingerprint:fingerprint(s.preset,s.adaptive,'challenge'), version:1, updated:Date.now(), notes:structuredClone(s.learning.notes) as Context['notes'], ...(s.adaptive ? {learning:s.savedLearning} : {}) });
    }
    const reward = lane.progress.update(s.correct,s.streak,s.attempts);
    lane.dog.pose(reward.treat ? 'catch' : reward.pose);
    lane.dog.look(reward.look,-8); if (reward.nod) lane.dog.nod();
    renderRound();
  }
  function resetInput() { gate.reset(); held.forEach(set => set.clear()); active.forEach(l => { l.answers.reset(); l.answers.modifier(); }); }
  function updateKeyHelp() {
    const portrait = selectedFormat === 'head-to-head' && window.innerWidth < window.innerHeight;
    const seats = portrait ? ['Top','Bottom'] : ['Left','Right'];
    const keys = ['Q–U = A–G · hold 1/2/3','Z–M = A–G · hold 8/9/0'];
    active.forEach((lane,index) => {
      lane.keyHelp.textContent = `${seats[index]}: ${keys[index]} for ♭/♮/♯.`;
    });
  }
  function showModifier(lane: Lane) {
    const index = active.indexOf(lane); const set = held[index];
    const codes = modifierCodes[index] ?? modifierCodes[0]!;
    const heldCodes = codes.filter(code => set?.has(code));
    lane.answers.modifier(lane.session.phase === 'playing' && lane.session.state === 'running' && heldCodes.length === 1 ? heldCodes[0] === codes[0] ? -1 : heldCodes[0] === codes[2] ? 1 : 0 : undefined);
  }
  const keydown = (event: KeyboardEvent) => {
    if (node.hidden || round.hidden || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLElement && event.target.closest('input,select,textarea,[contenteditable="true"]')) return;
    const code = event.code; const panelIndex = active.findIndex((_,i) => modifierCodes[i]?.includes(code) || (i === 0 ? leftLetters : rightLetters).some(letter => code === `Key${letter}`));
    if (panelIndex < 0) return;
    const lane = active[panelIndex]!; const set = held[panelIndex]!;
    event.preventDefault();
    if (!gate.down(code,event.repeat)) return;
    if (modifierCodes[panelIndex]!.includes(code)) { set.add(code); showModifier(lane); return; }
    if (lane.session.phase !== 'playing' || lane.session.state !== 'running' || event.timeStamp < lane.inputSince) return;
    const letters = panelIndex === 0 ? leftLetters : rightLetters;
    const letter = letterNames[letters.indexOf(code.slice(3))];
    const codes = modifierCodes[panelIndex]!; const pressed = codes.filter(v => set.has(v));
    if (letter && pressed.length < 2) lane.answers.letter(letter,pressed[0] === codes[0] ? -1 : pressed[0] === codes[2] ? 1 : 0);
  };
  const keyup = (event: KeyboardEvent) => { gate.up(event.code); held.forEach(set => set.delete(event.code)); active.forEach(showModifier); };
  const visibility = () => { if (document.hidden) { active.forEach(l => l.session.pause()); resetInput(); store.flush(); renderRound(); } };
  const resize = () => {
    roster.querySelectorAll<HTMLButtonElement>('.multiplayer-move').forEach(control => {
      const vertical = matchMedia('(min-width: 761px)').matches;
      const previous = / (up|left)$/.test(control.getAttribute('aria-label') ?? '');
      control.textContent = vertical ? previous ? '↑' : '↓' : previous ? '←' : '→';
      control.setAttribute('aria-label',(control.getAttribute('aria-label') ?? '').replace(/ (up|down|left|right)$/,` ${vertical ? previous ? 'up' : 'down' : previous ? 'left' : 'right'}`));
    });
    showPairAdvice();
    updateKeyHelp();
    if (!round.hidden) fitWarning.hidden = selectedFormat !== 'pairs' || pairFits();
  };
  const timer = setInterval(() => {
    if (round.hidden || disposed) return;
    let changed = false;
    for (const lane of active) {
      const s = lane.session;
      if (s.state === 'paused' || s.state === 'finished') continue;
      const before = s.state, phase = s.phase, prompt = s.prompt;
      s.tick(); if (s.phase === 'playing') s.advance(s.token);
      if (before !== s.state || phase !== s.phase || prompt !== s.prompt || s.phase === 'playing' || s.phase === 'countdown') changed = true;
    }
    if (changed) renderRound();
  },25);
  document.addEventListener('keydown',keydown); document.addEventListener('keyup',keyup);
  document.addEventListener('visibilitychange',visibility); document.addEventListener('fullscreenchange',fullscreenChanged);
  window.addEventListener('blur',resetInput); window.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize); screen.orientation?.addEventListener('change',resize);
  window.addEventListener('orientationchange',resize);
  const surfaceResize = new ResizeObserver(resize); surfaceResize.observe(node);
  renderSetup();
  return { node, enter: () => { node.hidden = false; renderSetup(); renderRound(); }, leave: (pauseOnly = false) => {
    closePlayerEditor(); leaveFullscreen(); resetInput(); if (pauseOnly) { active.forEach(l => l.session.pause()); renderRound(); } else if (!round.hidden) finishRound(); store.flush(); node.hidden = true;
  }, dispose: () => {
    if (disposed) return; disposed = true; surfaceResize.disconnect(); closePlayerEditor(); setupDog.dispose(); leaveFullscreen(); clearInterval(timer); active.forEach(l => l.dog.dispose());
    document.removeEventListener('keydown',keydown); document.removeEventListener('keyup',keyup);
    document.removeEventListener('visibilitychange',visibility); document.removeEventListener('fullscreenchange',fullscreenChanged);
    window.removeEventListener('blur',resetInput); window.removeEventListener('resize',resize);
    window.visualViewport?.removeEventListener('resize',resize); screen.orientation?.removeEventListener('change',resize);
    window.removeEventListener('orientationchange',resize);
  } };
}
