/** Run in the native T3 preview (or against a freshly loaded local bundle).
 * Pass the application window. No production data or preferences are required.
 */
async function countingPlanScenarios(w = window) {
  const desktop = w.innerWidth >= 1000;
  const settle = () => new Promise(resolve => w.setTimeout(resolve, 60));
  const d = w.document, results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); results.push(message); };
  const q = selector => d.querySelector(selector);
  const all = selector => [...d.querySelectorAll(selector)];
  const click = text => { const b = all('button').find(b => b.textContent === text && !b.closest('[hidden]')); if (!b) throw new Error(`Missing button ${text}`); b.click(); };
  const choose = (selector, value) => { const s = q(selector); s.value = value; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const fixture = async id => { choose('[data-preset]', id); await settle(); for (let i=0;i<40 && !q('.plan-measure').style.getPropertyValue('--count-target-width');i++) await settle(); };
  const counts = () => all('[data-count-id]');
  const key = value => d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  const setting = (name, value) => { const input = q(`[data-counting-preference="${name}"]`); if (input.type === 'checkbox') input.checked = value; else input.value = value; input.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const unit = control => q(`[data-unit-control="${control}"]`);
  const activate = i => counts()[i].click();
  const defaults = () => { for (const [k,v] of Object.entries({ longNotes:true,dotted:false,includeRests:true,showDurationLine:true,linePlacement:'beside',internalAppearance:'raised',restAppearance:'parentheses',vocabulary:'numbers',offbeat:'&' })) setting(k,v); };
  all('button').find(b => b.textContent === 'Counts').click();
  defaults();
  assert(['longNotes','showDurationLine','linePlacement','internalAppearance'].every(key => q(`[data-counting-preference="${key}"]`).closest('fieldset').querySelector('legend').textContent === 'Long Notes'), 'Long Notes groups subdivision and connection appearance');
  // Mixed-density bars exposed independently scaled notation and escaping actions.
  for (const id of ['tie-across-bar', 'six-wrap', 'dense-sixteenths', 'triplet-mixed-3']) {
    await fixture(id);
    const bars = all('.plan-measure');
    const rects = bars.map(bar => bar.getBoundingClientRect());
    const notation = all('.plan-measure .notation').map(svg => svg.getBoundingClientRect());
    assert(rects.every(r => Math.abs(r.top - rects[0].top) < 1), id + ': writing measures stay on one row');
    assert(rects.every(r => Math.abs(r.width - rects[0].width) < 1), id + ': equal measure widths');
    assert(notation.every(r => Math.abs(r.height - notation[0].height) < 1), id + ': consistent notation scale');
    assert(bars.every(bar => {
      const editor = bar.querySelector('.measure-editor');
      return editor.scrollWidth <= editor.clientWidth + 1;
    }), id + ': no measure-local overflow');
    assert(all('.write-actions:not(:empty)').every(row => {
      const r = row.getBoundingClientRect(), bar = q('.interaction-body').getBoundingClientRect();
      return r.left >= bar.left - 1 && r.right <= bar.right + 1 && w.getComputedStyle(row).position === 'static';
    }), id + ': actions stay beside the input palette');
    assert(w.getComputedStyle(q('.passage-scroll')).overflowX === 'auto', id + ': passage contains horizontal scrolling');
    assert(d.documentElement.scrollWidth <= w.innerWidth + 1, id + ': no document overflow');
    assert(!q('.rhythm-overview').hidden === (q('.passage-scroll').scrollWidth > q('.passage-scroll').clientWidth + 1), id + ': overview appears only for overflow');
  }
  defaults(); await fixture('half');
  activate(0); key('1'); activate(2); key('3');
  const identity = q('.passage').dataset.exerciseId;
  click('Perform'); click('Counts');
  assert(d.activeElement === counts()[1], 'Counts selects the first empty box, skipping entered counts');
  assert(q('.plan-token-palette button') && !q('.count-palette-host').hidden, 'Counts immediately exposes entry buttons');
  assert(q('.passage').dataset.exerciseId === identity && counts()[0].textContent === '1' && counts()[2].textContent === '3', 'Selecting Counts preserves the exercise and entered counts');
  activate(3); click('Counts');
  assert(d.activeElement === counts()[1], 'Clicking the current Counts panel also selects its first empty box');
  for (let i = 0; i < counts().length; i++) { activate(i); key('1'); }
  click('Perform'); click('Counts');
  assert(d.activeElement === counts()[0] && q('.plan-token-palette button'), 'Completed entry keeps the palette available with the first count selected');
  for (const [vocabulary, offbeat, expected] of [['numbers','&','e & a'], ['numbers','+','e + a'], ['syllables','+','ta te']]) {
    setting('vocabulary', vocabulary); setting('offbeat', offbeat); await fixture('four-sixteenths');
    click('Perform'); click('Counts');
    assert(all('.plan-token-palette button').slice(4).map(b => b.textContent).join(' ') === expected, 'Sixteenth entry order: ' + expected);
  }
  defaults(); await fixture('half');
  activate(0); key('1'); activate(1); key('2'); activate(0);
  const clearCount = all('button').find(b => b.textContent === 'Erase');
  assert(clearCount.parentElement === all('button').find(b => b.textContent === 'Erase All').parentElement && clearCount.closest('.write-actions'), 'Erase and Erase All share the action row');
  clearCount.focus(); clearCount.click();
  assert(d.activeElement === counts()[0] && counts()[0].textContent === '·', 'Erase restores selected count focus');
  assert(counts()[1].textContent === '2', 'Erase preserves other entered counts');
  click('Erase All');
  assert(counts().every(c => c.textContent === '·') && d.activeElement === counts()[0], 'Erase All resets counts and selects the first input');
  unit('restMarked').focus(); key('r');
  assert(d.activeElement === counts()[0], 'Rest shortcut from palette restores count focus');
  key('r');
  key('d'); assert(!q('.inferred-duration'), 'D no longer toggles Connect');
  assert(unit('durationIndicated').getAttribute('aria-keyshortcuts') === 'c' && counts()[0].getAttribute('aria-keyshortcuts') === 'r c', 'Connect shortcut is exposed accessibly');
  unit('durationIndicated').focus(); key('C');
  assert(d.activeElement === counts()[0], 'Connect shortcut from palette restores count focus');
  key('ArrowRight');
  assert(d.activeElement === counts()[1], 'Keyboard navigation works after palette replacement');
  activate(counts().length - 1);
  const tokenButton = q('.plan-token-palette button');
  tokenButton.focus(); tokenButton.click();
  assert(d.activeElement === counts().at(-1), 'Last palette token retains focus when there is no next count');
  defaults(); await fixture('half');
  assert(counts().length === 5, 'One-bar editor renders only plan counts');
  assert(!q('.line-handle, .endpoint-prompt, .rest-target'), 'No endpoint controls remain');
  activate(1); key('c');
  assert(counts()[1].classList.contains('sustained') && !counts()[0].classList.contains('sustained'), 'Internal-count toggle preserves full-size attack');
  assert(q('.inferred-duration'), 'Duration indication projects line');
  activate(0); key('r');
  assert(q('.inferred-rest'), 'Wrong sounded rest marking stays visible');
  for (const [i,token] of ['1','2','3','4','+'].entries()) { activate(i); key(token); }
  click('Check');
  assert(q('[data-rests="incorrect"]'), 'Rest feedback is independent');
  assert(!q('[data-tokens]'), 'Canonical plus alias grades correctly');
  const before = counts().map(c => c.textContent).join('|'), feedback = q('.counting-totals').textContent;
  setting('vocabulary','syllables'); setting('offbeat','+'); setting('dotted',true); setting('internalAppearance','lowered');
  assert(counts().map(c => c.textContent).join('|') === before, 'Pending settings preserve tokens');
  assert(q('.counting-totals').textContent === feedback, 'Pending settings preserve results');
  assert(q('.exercise-summary').textContent.includes('Pending settings'), 'Pending state is explained');
  for (const panel of ['Perform','Counts']) all('button').find(b => b.textContent === panel).click();
  assert(q('.counting-totals').textContent === feedback && counts().map(c => c.textContent).join('|') === before, 'Mode changes retain writing and results');
  click('Check Again'); assert(counts().map(c => c.textContent).join('|') === before && q('.counting-totals').textContent === feedback, 'Reassessment retains evidence and confirmed results');
  click('Next Exercise');
  assert(counts().every(c => c.textContent === '·'), 'New exercise starts blank');
  assert(q('.answer-area').dataset.appearance === 'lowered', 'New exercise applies pending appearance');
  defaults(); setting('vocabulary','syllables'); await fixture('half'); activate(0); key('t'); key('a');
  assert(counts()[0].textContent === 'ta', 'Syllable composition enters atomic token');
  activate(0); key('l'); assert(counts()[0].textContent === 'la', 'Triplet alias remains atomic');
  defaults(); await fixture('tie-wrap');
  const tied = counts().find(c => c.dataset.countId === 'count:0:3/4'), continuation = counts().find(c => c.dataset.countId === 'count:1:0/1');
  tied.click(); key('c'); key('r');
  assert(continuation.classList.contains('sustained'), 'Cross-bar continuation shares duration state');
  assert(all('.inferred-duration').filter(p => p.dataset.unitId === tied.dataset.unitId).length === 2, 'Wrapped unit renders two pieces from one state');
  assert(all('.inferred-rest').filter(p => p.dataset.unitId === tied.dataset.unitId).length === 2, 'Wrong-rest marking projects across wrap');
  tied.click(); key('ArrowRight'); assert(d.activeElement === continuation, 'Arrow navigation crosses measures by count ID');
  key('r'); assert(!all('.inferred-rest').some(p => p.dataset.unitId === tied.dataset.unitId), 'Continuation toggles full cross-bar rest state');
  key('c'); assert(!continuation.classList.contains('sustained'), 'Continuation toggles full duration state');
  defaults(); setting('restAppearance','slashes'); setting('showDurationLine',false); await fixture('half-rest');
  activate(1); unit('restMarked').click(); unit('durationIndicated').click();
  assert(counts().slice(0,2).every(c => c.classList.contains('rest-slashed')), 'Rest slashes inherit across whole unit');
  assert(!q('.inferred-duration') && counts()[1].classList.contains('sustained'), 'Hidden line retains internal duration feedback');
  setting('internalAppearance','unchanged'); await fixture('half-rest'); activate(0);
  assert(!unit('durationIndicated'), 'Hidden unchanged presentation suppresses duration control');
  click('Check'); assert(!q('.count-slot[data-duration]'), 'Suppressed duration is excluded from assessment');
  defaults(); await fixture('two-rests'); activate(0); key('r'); activate(1); key('r');
  assert(all('.inferred-rest').length === 2, 'Adjacent written rests stay separate');
  function checkParentheses(label) {
    const localCounts = counts();
    for (const rest of all('.inferred-rest')) {
      const members = localCounts.filter(c => c.dataset.unitId === rest.dataset.unitId);
      if (!members.length) continue;
      const open = rest.firstElementChild.getBoundingClientRect(), close = rest.lastElementChild.getBoundingClientRect();
      const rect = button => { const range = d.createRange(); range.selectNodeContents(button); return range.getBoundingClientRect(); };
      const first = rect(members[0]), last = rect(members.at(-1));
      assert(open.right <= first.left + 1 && close.left >= last.right - 1, label + ': parentheses enclose their counts');
      const next = localCounts[localCounts.indexOf(members.at(-1)) + 1];
      if (next && next.closest('.plan-measure') === rest.closest('.plan-measure')) {
        assert(close.right <= next.getBoundingClientRect().left, label + ': closing parenthesis clears next input');
      }
    }
  }
  checkParentheses('Adjacent rests');
  defaults(); await fixture('half-rest'); activate(0); key('r');
  checkParentheses('Subdivided rest');
  key('c'); checkParentheses('Subdivided rest with duration');

  defaults(); setting('includeRests',false); await fixture('all-rests');
  assert(counts().length === 0, 'All-rest exercise permits zero inputs');
  assert(!unit('restMarked') && !unit('durationIndicated'), 'Empty exercise has no stale unit controls');
  click('Check'); assert(q('.counting-confirmation').textContent.includes('All applicable'), 'Zero-input Check excludes inapplicable dimensions');
  click('Check Again'); click('Erase All'); assert(counts().length === 0, 'Zero-input Retry and Clear are safe');
  await fixture('half'); activate(0); assert(!unit('restMarked'), 'Rest omission suppresses rest control on sounded units too');
  defaults(); await fixture('six-dotted-half');
  assert(counts().length === 2 && q('g[data-value="half"][data-dots="1"]'), 'Dotted-half engraving and two count inputs');
  setting('dotted',true); await fixture('six-dotted-half'); assert(counts().length === 2, 'Dotted rule adds nothing to compound dotted half');
  await fixture('six-dotted-tie'); assert(counts().length === 6 && new Set(counts().map(c=>c.dataset.unitId)).size === 1, 'Written tied dotted quarters expose six counts in one unit');
  await fixture('six-dotted'); assert(counts().length === 6 && new Set(counts().map(c=>c.dataset.unitId)).size === 2, 'Untied dotted quarters retain two units');
  setting('longNotes',false); await fixture('six-dotted-half'); assert(counts().length === 1, 'Compound dotted half has one count without long rule');
  for (const placement of ['above','below','beside']) {
    defaults(); setting('linePlacement',placement); await fixture('half'); activate(0); key('c');
    assert(q('.answer-area').dataset.placement === placement && q('.inferred-duration'), `Line placement ${placement} projects entered state`);
  }
  defaults(); await fixture('dense-sixteenths');
  assert(counts().length === 64, 'Four-bar dense exercise renders exact count IDs');
  const rectangles=counts().slice(0,16).map(c=>c.getBoundingClientRect());
  assert(rectangles.every((r,i)=>i===0||r.left>=rectangles[i-1].right), 'Dense count touch targets do not overlap');
  assert(all('.measure-editor').every(m=>m.scrollWidth<=m.clientWidth+1 && w.getComputedStyle(m).overflowX==='visible'), 'Dense measures fit their contents without independent scroll containers');
  const strip = q('.passage-strip'), wasWrapped = strip.classList.contains('wrapped');
  strip.classList.add('wrapped'); await settle();
  const bars = all('.plan-measure').map(m=>m.getBoundingClientRect());
  assert(bars.every((r,i)=>i===0||Math.abs(r.top-bars[0].top)<1), 'Writing keeps one system even for historical wrapped fixtures');
  assert(all('.measure-editor').every(m=>m.scrollWidth<=m.clientWidth+1), 'Wrapped measures retain full input width');
  assert(d.documentElement.scrollWidth<=w.innerWidth+1, 'Wide wrapped measures overflow only inside the passage');
  strip.classList.toggle('wrapped', wasWrapped); await settle();
  activate(0); key('r'); activate(1); key('r'); checkParentheses('Dense counts');
  activate(15); key('ArrowRight'); assert(d.activeElement===counts()[16], 'Dense navigation crosses measures');
  all('button').find(b => b.textContent === 'Perform').click(); await settle();
  assert(all('.measure-editor').every(m=>m.scrollWidth<=m.clientWidth+1), 'Hidden-count performance retains compact notation');
  if (desktop) assert(all('.plan-measure').every(m=>Math.abs(m.getBoundingClientRect().top-q('.plan-measure').getBoundingClientRect().top)<1), 'Tap mode keeps all four dense bars on one row');
  all('button').find(b => b.textContent === 'Counts').click(); await settle();
  defaults(); await fixture('half-rest'); activate(0);
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
