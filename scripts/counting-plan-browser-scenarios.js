/** Run in the native T3 preview (or against a freshly loaded local bundle).
 * Pass the application window. No production data or preferences are required.
 */
async function countingPlanScenarios(w = window) {
  const d = w.document, results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const q = selector => d.querySelector(selector);
  const all = selector => [...d.querySelectorAll(selector)];
  const click = text => { const b = all('button').find(b => b.textContent === text && !b.closest('[hidden]')); if (!b) throw new Error(`Missing button ${text}`); b.click(); };
  const choose = (selector, value) => { const s = q(selector); s.value = value; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const fixture = id => { choose('[data-preset]', id); };
  const counts = () => all('[data-count-id]');
  const key = value => d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const setting = (name, value) => { const input = q(`[data-counting-preference="${name}"]`); if (input.type === 'checkbox') input.checked = value; else input.value = value; input.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const unit = control => q(`[data-unit-control="${control}"]`);
  const activate = i => counts()[i].click();
  const defaults = () => { for (const [k,v] of Object.entries({ longNotes:true,dotted:false,includeRests:true,showDurationLine:true,linePlacement:'beside',internalAppearance:'raised',restAppearance:'parentheses',vocabulary:'numbers',offbeat:'&' })) setting(k,v); };
  defaults(); fixture('half');
  activate(0); key('1'); activate(0);
  const clearCount = all('button').find(b => b.textContent === 'Clear count');
  clearCount.focus(); clearCount.click();
  assert(d.activeElement === counts()[0] && counts()[0].textContent === '·', 'Clearing from palette restores count focus');
  unit('restMarked').focus(); key('r');
  assert(d.activeElement === counts()[0], 'Rest shortcut from palette restores count focus');
  key('r');
  unit('durationIndicated').focus(); key('d');
  assert(d.activeElement === counts()[0], 'Duration shortcut from palette restores count focus');
  key('ArrowRight');
  assert(d.activeElement === counts()[1], 'Keyboard navigation works after palette replacement');
  activate(counts().length - 1);
  const tokenButton = q('.plan-token-palette button');
  tokenButton.focus(); tokenButton.click();
  assert(d.activeElement === counts().at(-1), 'Last palette token retains focus when there is no next count');
  defaults(); fixture('half');
  assert(counts().length === 5, 'One-bar editor renders only plan counts');
  assert(!q('.line-handle, .endpoint-prompt, .rest-target'), 'No endpoint controls remain');
  activate(1); key('d');
  assert(counts()[1].classList.contains('sustained') && !counts()[0].classList.contains('sustained'), 'Internal-count toggle preserves full-size attack');
  assert(q('.inferred-duration'), 'Duration indication projects line');
  activate(0); key('r');
  assert(q('.inferred-rest'), 'Wrong sounded rest marking stays visible');
  for (const [i,token] of ['1','2','3','4','+'].entries()) { activate(i); key(token); }
  click('Check');
  assert(q('.passage-feedback').textContent.includes('Rest identification: Needs correction'), 'Rest feedback is independent');
  assert(q('.passage-feedback').textContent.includes('Count symbols: Correct'), 'Canonical plus alias grades correctly');
  const before = counts().map(c => c.textContent).join('|'), feedback = q('.passage-feedback').textContent;
  setting('vocabulary','syllables'); setting('offbeat','+'); setting('dotted',true); setting('internalAppearance','lowered');
  assert(counts().map(c => c.textContent).join('|') === before, 'Pending settings preserve tokens');
  assert(q('.passage-feedback').textContent === feedback, 'Pending settings preserve results');
  assert(q('.exercise-summary').textContent.includes('Pending settings'), 'Pending state is explained');
  for (const mode of ['both','tap','write']) choose('select[aria-label="Mode"]',mode);
  assert(q('.passage-feedback').textContent === feedback && counts().map(c => c.textContent).join('|') === before, 'Mode changes retain writing and results');
  click('Retry'); assert(counts().map(c => c.textContent).join('|') === before && !q('.passage-feedback').textContent, 'Retry retains evidence and clears feedback');
  click('New exercise');
  assert(counts().every(c => c.textContent === '·'), 'New exercise starts blank');
  assert(q('.answer-area').dataset.appearance === 'lowered', 'New exercise applies pending appearance');
  defaults(); setting('vocabulary','syllables'); fixture('half'); activate(0); key('t'); key('a');
  assert(counts()[0].textContent === 'ta', 'Syllable composition enters atomic token');
  activate(0); key('l'); assert(counts()[0].textContent === 'la', 'Triplet alias remains atomic');
  defaults(); fixture('tie-wrap');
  const tied = counts().find(c => c.dataset.countId === 'count:0:3/4'), continuation = counts().find(c => c.dataset.countId === 'count:1:0/1');
  tied.click(); key('d'); key('r');
  assert(continuation.classList.contains('sustained'), 'Cross-bar continuation shares duration state');
  assert(all('.inferred-duration').filter(p => p.dataset.unitId === tied.dataset.unitId).length === 2, 'Wrapped unit renders two pieces from one state');
  assert(all('.inferred-rest').filter(p => p.dataset.unitId === tied.dataset.unitId).length === 2, 'Wrong-rest marking projects across wrap');
  tied.click(); key('ArrowRight'); assert(d.activeElement === continuation, 'Arrow navigation crosses measures by count ID');
  key('r'); assert(!all('.inferred-rest').some(p => p.dataset.unitId === tied.dataset.unitId), 'Continuation toggles full cross-bar rest state');
  key('d'); assert(!continuation.classList.contains('sustained'), 'Continuation toggles full duration state');
  defaults(); setting('restAppearance','slashes'); setting('showDurationLine',false); fixture('half-rest');
  activate(1); unit('restMarked').click(); unit('durationIndicated').click();
  assert(counts().slice(0,2).every(c => c.classList.contains('rest-slashed')), 'Rest slashes inherit across whole unit');
  assert(!q('.inferred-duration') && counts()[1].classList.contains('sustained'), 'Hidden line retains internal duration feedback');
  setting('internalAppearance','unchanged'); fixture('half-rest'); activate(0);
  assert(!unit('durationIndicated'), 'Hidden unchanged presentation suppresses duration control');
  click('Check'); assert(q('.passage-feedback').textContent.includes('Duration indication: Not applicable'), 'Suppressed duration is excluded from assessment');
  defaults(); fixture('two-rests'); activate(0); key('r'); activate(1); key('r');
  assert(all('.inferred-rest').length === 2, 'Adjacent written rests stay separate');
  function checkParentheses(label) {
    const localCounts = counts();
    for (const rest of all('.inferred-rest')) {
      const members = localCounts.filter(c => c.dataset.unitId === rest.dataset.unitId);
      if (!members.length) continue;
      const open = rest.firstElementChild.getBoundingClientRect(), close = rest.lastElementChild.getBoundingClientRect();
      const first = members[0].getBoundingClientRect(), last = members.at(-1).getBoundingClientRect();
      assert(open.right <= first.left + 1 && close.left >= last.right - 1, label + ': parentheses enclose their counts');
      const next = localCounts[localCounts.indexOf(members.at(-1)) + 1];
      if (next && next.closest('.plan-measure') === rest.closest('.plan-measure')) {
        assert(close.right <= next.getBoundingClientRect().left, label + ': closing parenthesis clears next input');
      }
    }
  }
  checkParentheses('Adjacent rests');
  defaults(); fixture('half-rest'); activate(0); key('r');
  checkParentheses('Subdivided rest');
  key('d'); checkParentheses('Subdivided rest with duration');

  defaults(); setting('includeRests',false); fixture('all-rests');
  assert(counts().length === 0, 'All-rest exercise permits zero inputs');
  assert(!unit('restMarked') && !unit('durationIndicated'), 'Empty exercise has no stale unit controls');
  click('Check'); assert(q('.practice-status').textContent.includes('All applicable'), 'Zero-input Check excludes inapplicable dimensions');
  click('Retry'); click('Clear'); assert(counts().length === 0, 'Zero-input Retry and Clear are safe');
  fixture('half'); activate(0); assert(!unit('restMarked'), 'Rest omission suppresses rest control on sounded units too');
  defaults(); fixture('six-dotted-half');
  assert(counts().length === 2 && q('g[data-value="H"][data-dots="1"]'), 'Dotted-half engraving and two count inputs');
  setting('dotted',true); fixture('six-dotted-half'); assert(counts().length === 2, 'Dotted rule adds nothing to compound dotted half');
  fixture('six-dotted-tie'); assert(counts().length === 6 && new Set(counts().map(c=>c.dataset.unitId)).size === 1, 'Written tied dotted quarters expose six counts in one unit');
  fixture('six-dotted'); assert(counts().length === 6 && new Set(counts().map(c=>c.dataset.unitId)).size === 2, 'Untied dotted quarters retain two units');
  setting('longNotes',false); fixture('six-dotted-half'); assert(counts().length === 1, 'Compound dotted half has one count without long rule');
  for (const placement of ['above','below','beside']) {
    defaults(); setting('linePlacement',placement); fixture('half'); activate(0); key('d');
    assert(q('.answer-area').dataset.placement === placement && q('.inferred-duration'), `Line placement ${placement} projects entered state`);
  }
  defaults(); fixture('dense-sixteenths');
  assert(counts().length === 64, 'Four-bar dense exercise renders exact count IDs');
  const rectangles=counts().slice(0,16).map(c=>c.getBoundingClientRect());
  assert(rectangles.every((r,i)=>i===0||r.left>=rectangles[i-1].right), 'Dense count touch targets do not overlap');
  assert(all('.measure-editor').every(m=>m.scrollWidth<=m.clientWidth+1 && w.getComputedStyle(m).overflowX==='visible'), 'Dense measures fit their contents without independent scroll containers');
  const strip = q('.passage-strip'), wasWrapped = strip.classList.contains('wrapped');
  strip.classList.add('wrapped');
  const bars = all('.plan-measure').map(m=>m.getBoundingClientRect());
  assert(bars.every((r,i)=>i===0||r.top>=bars[i-1].bottom), 'Wrapped measures occupy separate rows');
  assert(all('.measure-editor').every(m=>m.scrollWidth<=m.clientWidth+1), 'Wrapped measures retain full input width');
  assert(d.documentElement.scrollWidth<=w.innerWidth+1, 'Wide wrapped measures overflow only inside the passage');
  strip.classList.toggle('wrapped', wasWrapped);
  activate(0); key('r'); activate(1); key('r'); checkParentheses('Dense counts');
  activate(15); key('ArrowRight'); assert(d.activeElement===counts()[16], 'Dense navigation crosses measures');
  choose('select[aria-label="Mode"]','tap');
  assert(all('.measure-editor').every(m=>m.scrollWidth<=m.clientWidth+1), 'Hidden-count performance retains compact notation');
  choose('select[aria-label="Mode"]','write');
  defaults(); fixture('half-rest'); activate(0);
  const restButton = unit('restMarked');
  restButton.dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:12}));
  restButton.dispatchEvent(new w.PointerEvent('pointerup',{bubbles:true,pointerType:'touch',pointerId:12})); restButton.click();
  assert(q('.inferred-rest'), 'Touch pointer/click route toggles unit');
  assert(counts().every(c => c.getBoundingClientRect().width >= 43 && c.getBoundingClientRect().height >= 43), 'Count touch targets are at least 44 CSS pixels within rounding');
  assert(d.documentElement.scrollWidth <= w.innerWidth + 1, 'No page-level horizontal overflow');
  assert(!all('button').some(b => /Start rest pair|Start duration line|endpoint/.test(b.textContent)), 'No obsolete range actions exposed');
  return { assertions: results.length, width:w.innerWidth, results };
}

/** Fresh-document test supplied with a loader using isolated persisted storage. */
async function countingReloadScenarios(load, storage, key = 'tuno.rhythm-walk.preferences.v1') {
  storage.setItem(key, JSON.stringify({version:1,countingSystem:'syllables',offbeat:'+',presentation:{linePlacement:'above',sustainAppearance:'lowered'},convention:'required',bpm:123,metronome:false,mode:'both'}));
  let w = await load('?fixture=half');
  const saved = JSON.parse(storage.getItem(key));
  if (saved.counting.vocabulary !== 'syllables' || saved.counting.offbeat !== '+' || saved.counting.linePlacement !== 'above' || saved.counting.internalAppearance !== 'lowered' || !saved.counting.longNotes || saved.counting.dotted || saved.bpm !== 123 || saved.metronome !== false) throw new Error('Old preferences did not migrate');
  if (!w.document.querySelector('.exercise-summary').textContent.includes('Counting updated')) throw new Error('Missing migration notice');
  w.document.querySelector('[data-count-id]').click();
  w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', {key:'1', bubbles:true}));
  w = await load('?fixture=half');
  if ([...w.document.querySelectorAll('[data-count-id]')].some(c => c.textContent !== '·')) throw new Error('Responses survived reload');
  if (w.document.querySelector('.exercise-summary').textContent.includes('Counting updated')) throw new Error('Repeated migration notice');
  return { assertions: 4 };
}
