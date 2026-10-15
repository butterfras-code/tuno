// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Run in native T3 preview_evaluate. __assessmentScenario: keyboard, pointer,
 * slower, compound, accepted, short, tied, tap-rest, no-input, rest-silence, or cancellation. Synthetic timestamps test lifecycle and
 * interpretation; they do not validate physical device latency or audio output. */
window.__assessmentCheck = (async () => {
  const scenario = window.__assessmentScenario ?? 'keyboard';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async condition => { const end = performance.now()+15000; while(!condition()) { if(performance.now()>end) throw new Error('Timed out: '+scenario); await sleep(10); } };
  const choose = (node, value) => { node.value=value; node.dispatchEvent(new Event('change')); };
  const button = name => [...document.querySelectorAll('button')].find(n=>n.textContent===name);
  const pad=document.querySelector('.tap-response .pad'), surface=document.querySelector('.performance-surface');
  const mode=document.querySelector('.response-controls select'), preset=document.querySelector('[data-preset]'), tempo=document.querySelector('.score-tempo input'), style=document.querySelector('[data-setting=how-to-play]');
  const id=()=>document.querySelector('.passage').dataset.exerciseId;
  const written=()=>[...document.querySelectorAll('.count-slot')].map(n=>n.textContent).join();
  // Background native preview has no OS focus; scope a focus predicate stub to
  // synthetic automation only. Blur/mode cancellation still uses real handlers.
  const originalFocus = document.hasFocus; document.hasFocus = () => true;
  const originalOsc=AudioContext.prototype.createOscillator, originalCapture=pad.setPointerCapture, originalURL=URL.createObjectURL;
  let context, scheduled=[], stopped=0, evidence;
  AudioContext.prototype.createOscillator=function(){context=this;const node=originalOsc.call(this), start=node.start.bind(node),stop=node.stop.bind(node);node.start=time=>{scheduled.push(time);start(time);};node.stop=time=>{if(time===undefined)stopped++;stop(time);};return node;};
  pad.setPointerCapture=()=>{}; // Only invented synthetic pointer IDs.
  URL.createObjectURL=blob=>{evidence=blob.text().then(JSON.parse);return originalURL(blob);};
  const prevent=e=>{if(e.target instanceof HTMLAnchorElement && e.target.download)e.preventDefault();};document.addEventListener('click',prevent,true);
  const download=async()=>{button('Download timing evidence').click();return evidence;};
  const begin=async(retry=false)=>{scheduled=[];(retry?button('Try again'):pad).click();await wait(()=>scheduled.length && document.querySelector('.tap-response .status').textContent.startsWith('Count-in'));return scheduled[0]+document.querySelectorAll('.count-in-dot').length*60/Number(tempo.value);};
  let stampAnchor;
  const holdStyle = ['pointer','compound','accepted','short','tied'].includes(scenario);
  const pointer=scenario==='pointer'||scenario==='compound'||scenario==='accepted';
  const stamp=(action,time,start)=>{
    const event=pointer?new PointerEvent(action==='down'?'pointerdown':'pointerup',{pointerId:71,pointerType:'touch',button:0,bubbles:true,cancelable:true}):new KeyboardEvent(action==='down'?'keydown':'keyup',{code:'Space',key:' ',bubbles:true,cancelable:true});
    Object.defineProperty(event,'timeStamp',{value:stampAnchor+(start+time+.015)*1000});pad.dispatchEvent(event);
    if(pointer && action==='down') {
      const pressed=pad.getAttribute('aria-pressed');
      const touch=new Event('touchstart',{bubbles:true,cancelable:true});
      pad.querySelector('.pad-action').dispatchEvent(touch);
      assert(touch.defaultPrevented && pad.getAttribute('aria-pressed')===pressed,'touch default canceled without changing pointer hold');
      const menu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});
      pad.querySelector('.pad-action').dispatchEvent(menu);
      assert(menu.defaultPrevented && pad.getAttribute('aria-pressed')===pressed,'held-pad context menu is canceled without releasing input');
    }
  };
  try {
    assert(getComputedStyle(pad).touchAction==='none' && getComputedStyle(pad.querySelector('.pad-action')).userSelect==='none','pad and child labels prevent touch gestures and selection');
    const outsideMenu=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});document.querySelector('.rhythm-nav').dispatchEvent(outsideMenu);
    assert(!outsideMenu.defaultPrevented,'context menus elsewhere remain available');
    const outsideTouch=new Event('touchstart',{bubbles:true,cancelable:true});document.querySelector('.rhythm-nav').dispatchEvent(outsideTouch);
    assert(!outsideTouch.defaultPrevented,'touch gestures elsewhere remain available');
    choose(mode,'both');choose(preset,'half');choose(preset,scenario==='rest-silence'?'sixteenth-all-rests':scenario==='tap-rest'?'rest':scenario==='compound'?'six-eighths':scenario==='tied'?'tie-dotted':'quarters');choose(tempo,scenario==='accepted'||scenario==='tied'||scenario==='tap-rest'?'120':'180');choose(style,holdStyle?'hold':'tap');
    button('Reset timing').click();
    document.querySelector('.calibration input[type=checkbox]').checked=false;
    const slot=document.querySelector('.count-slot');slot.focus();slot.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
    const exercise=id(),answer=written();
    const start=await begin();
    if(scenario==='cancellation') {
      const before=stopped;choose(mode,'write');choose(mode,'both');
      const record=await download();assert(record.status==='interrupted' && record.assessment.rhythm===null,'interrupted attempt ungraded');assert(stopped>before,'audio stopped before interruption results');
      assert(document.querySelector('.performance-results').textContent.includes('not graded'),'retry interruption explanation');assert(id()===exercise && written()===answer,'cancel retains exercise and writing');
      await begin(true);button('Stop').click();assert((await download()).status==='interrupted','retry then Stop cancels safely');
      return {scenario,passed:['count-in cancellation, audio cleanup, ungraded evidence, retry, written response retained']};
    }
    if (scenario === 'no-input' || scenario === 'rest-silence') {
      await wait(() => surface.hidden);
      const bag = document.querySelector('.feedback-snapshot');
      assert(!bag.querySelector('.bone-slots'), 'silence never fabricates bone ratings');
      assert(bag.textContent.includes(scenario === 'rest-silence' ? 'You left the rests silent.' : 'We didn’t hear the written notes clearly.'), 'truthful silence/no-input feedback');
      assert(button('Try again') && button('Next exercise'), 'completed actions available');
      return { scenario, width: innerWidth, passed: ['no fabricated rewards, truthful feedback, result actions'] };
    }
    await wait(()=>context.currentTime>=start+.01);
    stampAnchor=performance.now()-context.currentTime*1000;
    const scale=scenario==='slower'?1.1:1, count=scenario==='tap-rest'?4:scenario==='tied'?3:scenario==='compound'?6:8, spacing=scenario==='compound'?1/9:scenario==='accepted'?1/2:1/3;
    if(scenario==='tap-rest') { for(const [down,up] of [[0,.95],[1,1.1],[1.25,1.35],[1.5,1.9]]) { stamp('down',down,start);stamp('up',up,start); } }
    else if(scenario==='tied') { for(const [down,up] of [[0,.5],[.75,.79],[1,1.8]]) { stamp('down',down,start);stamp('up',up,start); } }
    else for(let i=0;i<count;i++) {const shift=scenario==='accepted'?.08:0;stamp('down',i*spacing*scale+shift,start);if(scenario==='accepted')stamp('up',i*spacing+shift+spacing*(i===count-1?.8:.7),start);else if(i<count-1||scenario==='short')stamp('up',pointer?(i+1)*spacing*scale-.005:i*spacing*scale+.01,start);}
    // Except in the accepted-sustain case, complete with the last input down.
    // Its late release goes to the
    // hidden pad or focused noninteractive heading, never to a result button.
    await wait(()=>surface.hidden);await sleep(40);
    assert(document.activeElement.id==='performance-results-heading','completion moves focus to results heading');
    const panel=document.querySelector('.performance-results'),text=panel.textContent;
    stamp('up',count*spacing*scale,start);pad.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));
    document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));
    assert(surface.hidden && panel.isConnected,'finishing release and synthesized click cannot retry');
    assert(text.includes(`Rhythm accuracy at ${scenario==='compound'||scenario==='tied'?'target':'performed'} tempo:`) && Number(text.match(/tempo: (\d+)%/)[1])>=95,'pattern score and tempo basis are explicit (synthetic clock tolerance)');
    assert(document.querySelector('.feedback-snapshot .result-summary') && !/BPM|%|ms/.test(document.querySelector('.feedback-snapshot .result-summary').textContent),'concise musical summary without technical metrics');
    assert(!panel.querySelector('details').open && panel.querySelector('details .result-metrics'),'numbers remain available in collapsed Details');
    assert(text.includes('Hold accuracy')===holdStyle,'hold metric follows attempt style');
    assert(document.querySelectorAll('.timing-timeline').length>0 && document.querySelectorAll('.notation').length>0,'score and target timelines remain');
    assert(id()===exercise && written()===answer,'Both retains independent writing');
    const record=await download();assert(record.assessmentPolicy.version===2 && record.holdPolicy.version===4 && record.assessment.matches.length===count,'download includes snapshot, estimates and counts');
    if(scenario==='tap-rest') { assert(record.assessment.rhythm===100 && record.assessment.restIntrusions.length>0,'perfect Tap rhythm retains raw rest overlap');assert(!document.querySelector('.feedback-snapshot .result-suggestion'),'Tap receives no held-overlap criticism'); }
    if(scenario==='short') { assert(record.assessment.hold===null && record.assessment.matches.every(m=>m.holdCredit===null),'short sounds excluded, no fabricated hold credit');assert(text.includes('Hold not assessed—short notes only.'),'short-note explanation visible in Details');assert(!document.querySelector('.feedback-snapshot .result-suggestion') && !document.querySelector('.timeline-sustain.attention, [data-feedback=overlap]'),'short taps have no sustain warnings'); }
    if(scenario==='tied') { assert(record.assessment.hold===100 && record.assessment.matches[0].duration.waivedFinalDuration===.25,'short tied tail optional');assert(text.includes('across 2 assessed notes') && text.includes('final tied member optional (250 ms)'),'eligible denominator and optional tail explained');assert(!document.querySelector('.timeline-sustain.attention, [data-feedback=overlap]'),'waived tail has no contradictory warnings'); }
    if(scenario==='accepted') {assert(record.assessment.rhythm===100 && record.assessment.hold===100,'late start and elapsed 70/80 percent sustain accepted');assert(!document.querySelector('.timeline-sustain.attention, .timeline-hit.unmatched, [data-feedback=overlap]'),'accepted assessment has no contradictory timeline or score warnings');assert(!document.querySelector('.timeline-lift-window'),'target-time lift-credit promise removed');}
    if(scenario==='slower') assert(Math.abs(record.assessment.tempo.bpm-180/1.1)<2 && record.assessment.extra===0,'drift beyond old window retains slow tempo association');
    if(scenario==='compound') assert(record.plan.pulseSeconds===1/3 && record.assessment.tempo===null,'short compound fixture has explicit tempo evidence limit');
    const bag = document.querySelector('.feedback-snapshot'), bagText = bag.textContent;
    assert(bag.querySelectorAll('.bone-slots').length >= 1, 'Treat Bag has rated categories');
    assert([...bag.querySelectorAll('.bone-slots')].every(slots => slots.children.length === 5 && slots.getAttribute('aria-hidden') === 'true'), 'five decorative slots per rating');
    assert(bag.querySelector('.sr-only').textContent.includes('out of 5 bones'), 'accessible text rating');
    assert(document.querySelectorAll('.result-summary').length === 1 && !panel.querySelector('.result-summary'), 'Treat Bag owns the only feedback summary');
    assert(bag.textContent.includes('Holding notes') === holdStyle, 'captured style controls hold reward');
    if (scenario === 'short') assert(bag.textContent.includes('No long notes to check'), 'short sounds stay unrated');
    if (scenario === 'slower') assert(bag.textContent.includes('Steady beat: 5 out of 5 bones'), 'steady pace rewarded independently of tempo');
    choose(tempo,'160');choose(style,holdStyle?'tap':'hold');
    for(const response of ['write','tap','both']) {choose(mode,response);assert(panel.textContent===text && bag.textContent===bagText && id()===exercise,'mode/preferences retain completed interpretation and rewards');}
    location.hash='#settings';await sleep(40);location.hash='#practice';await sleep(40);assert(panel.textContent===text,'settings navigation retains results');
    const meters=[...document.querySelectorAll('[data-meter]')];for(const meter of meters){meter.checked=false;meter.dispatchEvent(new Event('change'));}
    assert(panel.querySelectorAll('button')[1].disabled,'invalid configuration disables results Next');
    meters.find(n=>n.dataset.meter==='4/4').checked=true;meters.find(n=>n.dataset.meter==='4/4').dispatchEvent(new Event('change'));
    assert(!panel.querySelectorAll('button')[1].disabled && panel.textContent.includes('Rhythm accuracy'),'valid configuration restores Next without clearing score');
    const retryStart=await begin(true);assert(!surface.hidden && !document.querySelector('.performance-results') && id()===exercise && written()===answer,'Try again restores pad and retains exact exercise/answer');
    assert(bag.textContent.includes('Previous completed attempt'), 'retry labels previous feedback');
    button('Stop').click(); assert(bag.textContent.includes('Previous completed attempt') && bag.querySelector('.bone-slots'), 'interruption retains earned feedback'); const retryRecord=await download();assert(retryRecord.bpm===160 && retryRecord.playStyle!==record.playStyle && retryRecord.status==='interrupted','retry snapshots current preferences');
    document.querySelector('.performance-results button:last-of-type').click();
    assert(!bag.querySelector('.bone-slots') && bag.textContent.includes('Play the rhythm'), 'Next clears Treat Bag');
    assert(id()!==exercise && !document.querySelector('.performance-results') && !surface.hidden && document.querySelector('.pad-action').textContent==='Start','Next shared lifecycle replaces exercise and restores ready pad');
    assert(!document.querySelector('[aria-label="Attempt review"]').textContent && !document.querySelectorAll('.timing-timeline').length,'Next clears review/timelines');
    assert(![...document.querySelectorAll('.count-slot')].some(n=>/^\d/.test(n.textContent)),'Next clears writing');
    assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
    return {scenario,width:innerWidth,passed:['results replace pad, focus/release safety, target evidence preserved, Both independence, downloads, retention, invalid settings, retry/count-in/current preferences, Next clears both, responsive layout']};
  } finally {document.hasFocus=originalFocus;AudioContext.prototype.createOscillator=originalOsc;pad.setPointerCapture=originalCapture;URL.createObjectURL=originalURL;document.removeEventListener('click',prevent,true);}
})();
window.__assessmentCheck
