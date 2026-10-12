/** Native T3 preview_evaluate expression. Set __liftInput to keyboard or pointer.
 * Synthetic timestamps, invented pointer capture and background-focus stub verify
 * UI/policy only; physical keyboard/touch latency and audio remain unverified. */
window.__liftCheck = (async () => {
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const wait=async predicate=>{const end=performance.now()+14000;while(!predicate()){if(performance.now()>end)throw new Error('Lift scenario timed out');await new Promise(r=>setTimeout(r,10));}};
  const choose=(node,value)=>{node.value=value;node.dispatchEvent(new Event('change'));};
  const button=name=>[...document.querySelectorAll('button')].find(n=>n.textContent===name);
  const mode=document.querySelector('.shared-controls select'),preset=document.querySelector('[data-preset]'),style=document.querySelector('[data-setting=how-to-play]'),pad=document.querySelector('.tap-response .pad');
  const originalFocus=document.hasFocus,originalOsc=AudioContext.prototype.createOscillator,originalCapture=pad.setPointerCapture,originalURL=URL.createObjectURL;
  let context,scheduled=[],evidence;
  document.hasFocus=()=>true;pad.setPointerCapture=()=>{};
  AudioContext.prototype.createOscillator=function(){context=this;const node=originalOsc.call(this),start=node.start.bind(node);node.start=time=>{scheduled.push(time);start(time);};return node;};
  URL.createObjectURL=blob=>{evidence=blob.text().then(JSON.parse);return originalURL(blob);};
  const prevent=e=>{if(e.target instanceof HTMLAnchorElement && e.target.download)e.preventDefault();};document.addEventListener('click',prevent,true);
  try {
    choose(mode,'both');choose(preset,'half');choose(preset,'quarters');choose(style,'hold');choose(document.querySelector('.score-tempo input'),'80');
    button('Reset timing').click();document.querySelector('.calibration input[type=checkbox]').checked=false;
    pad.click();await wait(()=>scheduled.length && document.querySelector('.tap-response .status').textContent.startsWith('Count-in'));
    const start=scheduled[0]+3;await wait(()=>context.currentTime>=start+.02);
    const anchor=performance.now()-context.currentTime*1000;
    const pointer=window.__liftInput==='pointer';
    const stamp=(action,time)=>{const event=pointer?new PointerEvent(action==='down'?'pointerdown':'pointerup',{pointerId:93,pointerType:'touch',button:0,bubbles:true,cancelable:true}):new KeyboardEvent(action==='down'?'keydown':'keyup',{code:'Space',key:' ',bubbles:true,cancelable:true});Object.defineProperty(event,'timeStamp',{value:anchor+(start+time+.015)*1000});pad.dispatchEvent(event);};
    for(let i=0;i<8;i++){stamp('down',i*.75);stamp('up',(i+1)*.75-(i===7?0:.14));}
    await wait(()=>document.querySelector('.performance-results'));
    assert(document.querySelector('.performance-results').textContent.includes('Hold accuracy: 100% across 8 played notes'),'practical separate-note lifts receive full credit');
    assert(document.querySelectorAll('.timeline-lift-window').length===7,'seven adjacent-note lift bands, including barline');
    assert(document.querySelectorAll('.timeline-lift-window').length===document.querySelectorAll('.timeline-lift-window title').length,'each band has an accessible timing title');
    assert(document.querySelector('[aria-label="Attempt review"]').textContent.includes('dashed sections allow a brief lift'),'visible lift legend');
    assert([...document.querySelectorAll('.timing-timeline')].every(n=>n.getAttribute('aria-label').includes('Internal ties require uninterrupted holding')),'accessible explanation distinguishes ties');
    button('Download timing evidence').click();const record=await evidence;
    assert(record.evaluationPolicy.version===2 && record.evaluationPolicy.articulationCeiling===.18,'new policy snapshot in evidence');
    const interpretation=document.querySelector('.performance-results').textContent;choose(style,'tap');assert(document.querySelector('.performance-results').textContent===interpretation && document.querySelectorAll('.timeline-lift-window').length===7,'mode preference cannot reinterpret saved hold attempt');
    choose(preset,'tie');choose(style,'hold');scheduled=[];pad.click();await wait(()=>scheduled.length);button('Stop').click();
    assert(document.querySelector('.performance-results').textContent.includes('not graded'),'cancellation remains ungraded');
    assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
    return {input:pointer?'synthetic pointer':'keyboard',width:innerWidth,passed:['full-credit lifts, target-time bands, barline gap, accessible titles/legend, saved policy retention, cancellation, layout']};
  } finally {document.hasFocus=originalFocus;AudioContext.prototype.createOscillator=originalOsc;pad.setPointerCapture=originalCapture;URL.createObjectURL=originalURL;document.removeEventListener('click',prevent,true);}
})();
window.__liftCheck
