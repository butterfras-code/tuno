import { el } from '../../../shared/ui/components.ts';
import { animatedUno } from '../../../shared/ui/uno.ts';
import { defaultPreset, fingerprint, clefForPitch, presets } from '../domain/presets.ts';
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
import { challengeSetup } from './challenge-setup.ts';
import { button, presetSetup } from './setup.ts';
import { renderStaff } from './staff.ts';
import { segments } from './range-editor.ts';

interface Player extends PlayerEntry { preset: Preset; adaptive: boolean; profileId?: string }
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
  setup.append(el('h2','','Multi Player'));
  const roster = el('div','multiplayer-roster');
  const add = button('Add player',() => { if (players.length < 8 && commitEditor()) { players.push(newPlayer(players.length+1)); selectedId = players.at(-1)!.id; renderSetup(); } });
  const rosterControls = el('div','control-row'); rosterControls.append(add);
  const editor = el('section','multiplayer-editor');
  const editorHeading = el('h3');
  const presetUI = presetSetup(store,'multi-');
  const presetHelp = el('p','muted','Each player can choose a different preset.');
  editor.append(editorHeading,presetUI.node,presetHelp);
  const rules = challengeSetup('Round rules'); rules.node.hidden = false;
  const format = segments<Format>('Play format',[['turns','Turns'],['pairs','Pairs']],value => { selectedFormat = value; format.update([value]); showPairAdvice(); });
  let selectedFormat: Format = 'turns'; format.update([selectedFormat]);
  const formatGroup = el('div','setting'); formatGroup.append(el('span','setting-label','Play format'),format.node);
  const pairAdvice = el('p','muted'); pairAdvice.setAttribute('role','status');
  const setupError = el('p','feedback'); setupError.setAttribute('role','alert');
  const start = button('Start round',startRound); start.classList.add('control--primary');
  setup.append(roster,rosterControls,editor,rules.node,formatGroup,pairAdvice,setupError,start);

  const round = el('section','multiplayer-round'); round.hidden = true;
  const roundTitle = el('h2'); roundTitle.tabIndex = -1;
  const roundSummary = el('p','muted');
  const roundActions = el('div','control-row');
  const ready = button('Ready',() => { const startAt = performance.now(); active.forEach(l => l.session.ready(startAt)); ready.hidden = true; resetInput(); renderRound(); }); ready.classList.add('control--primary');
  const pause = button('Pause',() => {
    if (active.some(l => l.session.state === 'paused')) {
      if (resizeRecovery || selectedFormat === 'pairs' && !pairFits()) return;
      active.forEach(l => l.session.resume());
    } else active.forEach(l => l.session.pause());
    resetInput(); renderRound();
  });
  const end = button('End round',() => { finishRound(); });
  roundActions.append(ready,pause,end);
  const recovery = el('div','multiplayer-recovery'); recovery.hidden = true;
  const recoveryText = el('p','feedback','This screen is too small for pairs. Restore the larger view to resume, or restart as turns.');
  const restore = button('Resume pairs',() => { if (!pairFits()) return; resizeRecovery = false; active.forEach(l => l.session.resume()); resetInput(); renderRound(); });
  const restart = button('Restart as turns',() => { finishActive(true); selectedFormat = 'turns'; format.update(['turns']); resizeRecovery = false; startRound(); });
  recovery.append(recoveryText,restore,restart);
  const panels = el('div','multiplayer-panels');
  round.append(roundTitle,roundSummary,roundActions,recovery,panels);

  const result = el('section','multiplayer-result'); result.hidden = true;
  const resultTitle = el('h2','','Round results'); resultTitle.tabIndex = -1;
  const resultSummary = el('p','muted');
  const board = el('div','multiplayer-board');
  const resultActions = el('div','control-row');
  resultActions.append(button('Retry',startRound),button('Edit setup',showSetup),button('Home',() => { showSetup(); home(); }));
  result.append(resultTitle,resultSummary,board,resultActions);
  node.append(setup,round,result);

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
  let resizeRecovery = false;
  let disposed = false;

  function newPlayer(number: number): Player {
    const profile = number === 1 ? store.profile() : undefined;
    return { id: crypto.randomUUID(), name: profile?.name ?? `Player ${number}`, preset: defaultPreset, adaptive: profile?.adaptive ?? false, profileId: profile?.id };
  }
  function pairFits() {
    const width = Math.min(window.innerWidth,node.getBoundingClientRect().width || window.innerWidth);
    return canPair(width,window.innerHeight);
  }
  function showPairAdvice() {
    pairAdvice.textContent = selectedFormat === 'pairs' ? pairFits() ? 'Two players share the screen. An odd final player takes a solo turn.' : 'Pairs need a larger screen (at least 960 × 600). Choose Turns here.' : 'Players take one turn each in roster order.';
    start.disabled = selectedFormat === 'pairs' && !pairFits();
  }
  function renderSetup() {
    const current = players.find(p => p.id === selectedId) ?? players[0]!; selectedId = current.id;
    roster.replaceChildren();
    players.forEach((player,index) => {
      const card = el('div','multiplayer-player');
      const name = el('input','control'); name.value = player.name; name.maxLength = 40; name.setAttribute('aria-label',`Player ${index+1} name`);
      name.addEventListener('input',() => { player.name = name.value; });
      const profile = el('select','control'); profile.setAttribute('aria-label',`Player ${index+1} saved profile`);
      const guest = el('option','','Guest (this session)'); guest.value = ''; profile.append(guest);
      if (store.data.configuration.remember) store.data.profiles.forEach(p => { const option = el('option','',p.name); option.value = p.id; profile.append(option); });
      profile.value = player.profileId ?? ''; if (!profile.value) player.profileId = undefined;
      profile.addEventListener('change',() => { player.profileId = profile.value || undefined; });
      const adapt = button('Adapt Range',() => { player.adaptive = !player.adaptive; adapt.setAttribute('aria-pressed',String(player.adaptive)); });
      adapt.setAttribute('aria-pressed',String(player.adaptive)); adapt.setAttribute('aria-label',`Adapt Range for Player ${index+1}`);
      const edit = button('Edit preset',() => { commitEditor(); selectedId = player.id; renderSetup(); presetUI.picker.focus(); });
      const up = button('↑',() => move(index,-1)); up.disabled = index === 0; up.setAttribute('aria-label',`Move Player ${index+1} up`);
      const down = button('↓',() => move(index,1)); down.disabled = index === players.length-1; down.setAttribute('aria-label',`Move Player ${index+1} down`);
      const remove = button('Remove',() => { if (players.length === 1 || !commitEditor()) return; players.splice(index,1); renderSetup(); }); remove.disabled = players.length === 1;
      const controls = el('div','control-row'); controls.append(edit,up,down,remove);
      const meta = el('p','muted',player.preset.name);
      card.append(el('span','player-index',String(index+1)),name,profile,adapt,meta,controls);
      card.classList.toggle('selected',player.id === selectedId); roster.append(card);
    });
    add.disabled = players.length >= 8;
    editorHeading.textContent = `Preset for ${current.name.trim() || `Player ${players.indexOf(current)+1}`}`;
    presetUI.selectPreset(current.preset.id);
    showPairAdvice();
  }
  function move(index: number,delta: number) { if (!commitEditor()) return; const [player] = players.splice(index,1); players.splice(index+delta,0,player!); renderSetup(); }
  presetUI.onChange(() => { const player = players.find(p => p.id === selectedId); const chosen = presetUI.selected(); if (player && chosen) { player.preset = chosen; const card = roster.querySelector('.multiplayer-player.selected .muted'); if (card) card.textContent = chosen.name; } });
  function commitEditor() {
    if (!presetUI.selected()) return false;
    if (!presets.some(p => p.id === presetUI.selected()!.id)) return Boolean(presetUI.saveForRoster());
    return true;
  }

  function startRound() {
    setupError.textContent = '';
    if (!commitEditor()) { setupError.textContent = 'Fix the selected preset before starting.'; return; }
    const names = players.map(p => p.name.trim());
    if (names.some(n => !n)) { setupError.textContent = 'Give each player a name.'; return; }
    if (selectedFormat === 'pairs' && !pairFits()) { setupError.textContent = 'Choose Turns or use a larger screen for pairs.'; showPairAdvice(); return; }
    const profiles = players.map(p => p.profileId).filter(Boolean);
    if (new Set(profiles).size !== profiles.length) { setupError.textContent = 'Use each saved profile for one player in a round.'; return; }
    const nextRules = rules.read(); if (!nextRules) return;
    finishActive(true); active.forEach(l => l.dog.dispose()); active = [];
    rulesValue = nextRules; completed = new Map(); heatIndex = 0;
    players.forEach((p,i) => { p.name = names[i]!; });
    heats = schedule(players.map(p => ({...p,preset:structuredClone(p.preset)})), selectedFormat);
    setup.hidden = true; result.hidden = true; round.hidden = false;
    prepareHeat();
  }
  function makeLane(player: Player, laneIndex: number): Lane {
    const contextKey = fingerprint(player.preset,player.adaptive,'challenge');
    const context = player.profileId ? store.data.profiles.find(p => p.id === player.profileId)?.contexts.find(c => c.fingerprint === contextKey) : guestContexts.get(`${player.id}:${contextKey}`);
    const session = new Challenge(player.preset,rulesValue!,() => performance.now(),Math.random,{ adaptive: player.adaptive, notes: context?.notes, learning: context?.learning });
    const progress = new NotesProgress(player.profileId ? store.challengeBenchmarkFor(player.profileId,player.preset,player.adaptive,rulesValue!) : 10);
    const displayName = displayNames(players).get(player.id)!;
    const panel = el('section','multiplayer-panel'); panel.setAttribute('aria-label',`${displayName} note area`);
    const heading = el('h3','',displayName); const status = el('p','multiplayer-status'); status.setAttribute('role','timer'); status.setAttribute('aria-live','off');
    const announcement = el('p','multiplayer-announcement'); announcement.setAttribute('role','status'); announcement.setAttribute('aria-live','polite');
    const stats = el('p','muted'); const staff = el('div','staff-panel');
    const feedback = el('p','feedback'); feedback.setAttribute('role','status');
    const note = el('div','multiplayer-note'); note.append(staff);
    const cue = el('strong','multiplayer-cue');
    const intro = el('div','multiplayer-intro');
    const blankStaff = renderStaff(session.pitch,clefForPitch(session.preset,session.pitch),session.preset.key);
    blankStaff.querySelectorAll('.notehead,.note-accidental,.ledger').forEach(n=>n.remove()); blankStaff.removeAttribute('aria-label'); blankStaff.setAttribute('aria-hidden','true');
    intro.append(blankStaff,cue,el('p','muted',player.preset.name));
    const dog = animatedUno(); dog.pose('wag');
    const lane = { player, session, progress, node: panel, heading, status, stats, announcement, staff, feedback, note, intro, cue, dog, answers: undefined as unknown as ReturnType<typeof answerControls>, keyHelp: el('p','muted keyboard-help'), recorded: false, prompt: '', phase: '', inputSince: 0, tenSeconds: false };
    lane.answers = answerControls((answer,token) => submit(lane,answer,token),true);
    lane.keyHelp.textContent = laneIndex === 1 ? 'Right: Z–M = A–G · hold 8/9/0 for ♭/♮/♯.' : 'Left: Q–U = A–G · hold 1/2/3 for ♭/♮/♯.';
    panel.append(heading,status,stats,announcement,note,intro,dog.node,feedback,lane.answers.node,lane.keyHelp);
    return lane;
  }
  function prepareHeat() {
    active.forEach(l => l.dog.dispose());
    active = heats[heatIndex]!.map(makeLane);
    panels.replaceChildren(...active.map(l => l.node));
    resizeRecovery = false; resetInput();
    roundTitle.textContent = selectedFormat === 'pairs' ? `Heat ${heatIndex+1} of ${heats.length}` : `Turn ${heatIndex+1} of ${heats.length}`;
    roundSummary.textContent = describeRules(rulesValue!);
    ready.hidden = false; pause.hidden = true; recovery.hidden = true;
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
    finishActive(true); resetInput(); active.forEach(l => l.dog.dispose()); active = []; panels.replaceChildren();
    setup.hidden = false; round.hidden = true; result.hidden = true; renderSetup();
  }
  function renderRound() {
    if (round.hidden) return;
    const paused = active.some(l => l.session.state === 'paused');
    pause.hidden = active.every(l => l.session.phase === 'ready' || l.session.state === 'finished');
    pause.textContent = paused ? 'Resume' : 'Pause';
    recovery.hidden = !resizeRecovery; restore.disabled = !pairFits();
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
        if (lane.prompt !== identity) { lane.prompt = identity; lane.inputSince = performance.now(); lane.staff.replaceChildren(renderStaff(s.pitch,clefForPitch(s.preset,s.pitch),s.preset.key)); }
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
    showPairAdvice();
    if (!round.hidden && selectedFormat === 'pairs' && active.length === 2 && active.some(l => l.session.state !== 'finished') && !pairFits()) {
      active.forEach(l => l.session.pause()); resizeRecovery = true; resetInput(); renderRound();
    } else if (resizeRecovery) renderRound();
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
  document.addEventListener('visibilitychange',visibility); window.addEventListener('blur',resetInput); window.addEventListener('resize',resize);
  renderSetup();
  return { node, enter: () => { node.hidden = false; renderSetup(); renderRound(); }, leave: (pauseOnly = false) => {
    resetInput(); if (pauseOnly) { active.forEach(l => l.session.pause()); renderRound(); } else if (!round.hidden) finishRound(); store.flush(); node.hidden = true;
  }, dispose: () => {
    if (disposed) return; disposed = true; clearInterval(timer); active.forEach(l => l.dog.dispose());
    document.removeEventListener('keydown',keydown); document.removeEventListener('keyup',keyup);
    document.removeEventListener('visibilitychange',visibility); window.removeEventListener('blur',resetInput); window.removeEventListener('resize',resize);
  } };
}
