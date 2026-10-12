/** Run in native T3 preview_evaluate. __assessmentScenario: keyboard, pointer,
 * slower, compound, accepted, or cancellation. Synthetic timestamps test lifecycle and
 * interpretation; they do not validate physical device latency or audio output. */
window.__assessmentCheck = (async () => {
  const scenario = window.__assessmentScenario ?? 'keyboard';
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async condition => { const end = performance.now()+15000; while(!condition()) { if(performance.now()>end) throw new Error('Timed out: '+scenario); await sleep(10); } };
  const choose = (node, value) => { node.value=value; node.dispatchEvent(new Event('change')); };
  const button = name => [...document.querySelectorAll('button')].find(n=>n.textContent===name);
  const pad=document.querySelector('.tap-response .pad'), surface=document.querySelector('.performance-surface');
  const mode=document.querySelector('.shared-controls select'), preset=document.querySelector('[data-preset]'), tempo=document.querySelector('.score-tempo input'), style=document.querySelector('[data-setting=how-to-play]');
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
  const pointer=scenario==='pointer'||scenario==='compound'||scenario==='accepted';
  const stamp=(action,time,start)=>{
    const event=pointer?new PointerEvent(action==='down'?'pointerdown':'pointerup',{pointerId:71,pointerType:'touch',button:0,bubbles:true,cancelable:true}):new KeyboardEvent(action==='down'?'keydown':'keyup',{code:'Space',key:' ',bubbles:true,cancelable:true});
    Object.defineProperty(event,'timeStamp',{value:stampAnchor+(start+time+.015)*1000});pad.dispatchEvent(event);
  };
  try {
    choose(mode,'both');choose(preset,'half');choose(preset,scenario==='compound'?'six-eighths':'quarters');choose(tempo,scenario==='accepted'?'120':'180');choose(style,pointer?'hold':'tap');
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
    await wait(()=>context.currentTime>=start+.01);
    stampAnchor=performance.now()-context.currentTime*1000;
    const scale=scenario==='slower'?1.4:1, count=scenario==='compound'?6:8, spacing=scenario==='compound'?1/9:scenario==='accepted'?1/2:1/3;
    for(let i=0;i<count;i++) {const shift=scenario==='accepted'?.08:0;stamp('down',i*spacing*scale+shift,start);if(scenario==='accepted')stamp('up',i*spacing+shift+spacing*(i===count-1?.8:.7),start);else if(i<count-1)stamp('up',pointer?(i+1)*spacing*scale-.005:i*spacing*scale+.01,start);}
    // Except in the accepted-sustain case, complete with the last input down.
    // Its late release goes to the
    // hidden pad or focused noninteractive heading, never to a result button.
    await wait(()=>surface.hidden);await sleep(40);
    assert(document.activeElement.id==='performance-results-heading','completion moves focus to results heading');
    const panel=document.querySelector('.performance-results'),text=panel.textContent;
    stamp('up',count*spacing*scale,start);pad.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}));
    document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));
    assert(surface.hidden && panel.isConnected,'finishing release and synthesized click cannot retry');
    assert(text.includes(`Rhythm accuracy at ${scenario==='compound'?'target':'performed'} tempo:`) && Number(text.match(/tempo: (\d+)%/)[1])>=95,'pattern score and tempo basis are explicit (synthetic clock tolerance)');
    assert(panel.querySelector('.result-summary') && !/BPM|%|ms/.test(panel.querySelector('.result-summary').textContent),'concise musical summary without technical metrics');
    assert(!panel.querySelector('details').open && panel.querySelector('details .result-metrics'),'numbers remain available in collapsed Details');
    assert(text.includes('Hold accuracy')===pointer,'hold metric follows attempt style');
    assert(document.querySelectorAll('.timing-timeline').length>0 && document.querySelectorAll('.notation').length>0,'score and target timelines remain');
    assert(id()===exercise && written()===answer,'Both retains independent writing');
    const record=await download();assert(record.assessmentPolicy.version===2 && record.holdPolicy.version===3 && record.assessment.matches.length===count,'download includes snapshot, estimates and counts');
    if(scenario==='accepted') {assert(record.assessment.rhythm===100 && record.assessment.hold===100,'late start and elapsed 70/80 percent sustain accepted');assert(!document.querySelector('.timeline-sustain.attention, .timeline-hit.unmatched, [data-feedback=overlap]'),'accepted assessment has no contradictory timeline or score warnings');assert(!document.querySelector('.timeline-lift-window'),'target-time lift-credit promise removed');}
    if(scenario==='slower') assert(Math.abs(record.assessment.tempo.bpm-180/1.4)<2 && record.assessment.extra===0,'drift beyond old window retains slow tempo association');
    if(scenario==='compound') assert(record.plan.pulseSeconds===1/3 && record.assessment.tempo===null,'short compound fixture has explicit tempo evidence limit');
    choose(tempo,'160');choose(style,pointer?'tap':'hold');
    for(const response of ['write','tap','both']) {choose(mode,response);assert(panel.textContent===text && id()===exercise,'mode/preferences retain completed interpretation');}
    location.hash='#settings';await sleep(40);location.hash='#practice';await sleep(40);assert(panel.textContent===text,'settings navigation retains results');
    const meters=[...document.querySelectorAll('[data-meter]')];for(const meter of meters){meter.checked=false;meter.dispatchEvent(new Event('change'));}
    assert(panel.querySelectorAll('button')[1].disabled,'invalid configuration disables results Next');
    meters.find(n=>n.dataset.meter==='4/4').checked=true;meters.find(n=>n.dataset.meter==='4/4').dispatchEvent(new Event('change'));
    assert(!panel.querySelectorAll('button')[1].disabled && panel.textContent.includes('Rhythm accuracy'),'valid configuration restores Next without clearing score');
    const retryStart=await begin(true);assert(!surface.hidden && !document.querySelector('.performance-results') && id()===exercise && written()===answer,'Try again restores pad and retains exact exercise/answer');
    button('Stop').click();const retryRecord=await download();assert(retryRecord.bpm===160 && retryRecord.playStyle!==record.playStyle && retryRecord.status==='interrupted','retry snapshots current preferences');
    document.querySelector('.performance-results button:last-of-type').click();
    assert(id()!==exercise && !document.querySelector('.performance-results') && !surface.hidden && document.querySelector('.pad-action').textContent==='Start','Next shared lifecycle replaces exercise and restores ready pad');
    assert(!document.querySelector('[aria-label="Attempt review"]').textContent && !document.querySelectorAll('.timing-timeline').length,'Next clears review/timelines');
    assert(![...document.querySelectorAll('.count-slot')].some(n=>/^\d/.test(n.textContent)),'Next clears writing');
    assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
    return {scenario,width:innerWidth,passed:['results replace pad, focus/release safety, target evidence preserved, Both independence, downloads, retention, invalid settings, retry/count-in/current preferences, Next clears both, responsive layout']};
  } finally {document.hasFocus=originalFocus;AudioContext.prototype.createOscillator=originalOsc;pad.setPointerCapture=originalCapture;URL.createObjectURL=originalURL;document.removeEventListener('click',prevent,true);}
})();
window.__assessmentCheck
