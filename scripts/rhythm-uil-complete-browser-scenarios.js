/** Run in the native T3 preview with ?testing=1. Accepts an isolated built-app frame.
 * Synthetic keyboard evidence and optional focus/visibility stubs are automation only. */
window.runUilCompleteScenarios = async function(w=window) {
  const d=w.document, checks=[];
  const assert=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  const choose=(node,value)=>{node.value=value;node.dispatchEvent(new w.Event('change'));};
  const button=name=>[...d.querySelectorAll('button')].find(b=>b.textContent===name);
  const settings=()=>JSON.parse(w.localStorage.getItem('tuno.rhythm-walk.preferences.v1'));
  const picker=d.querySelector('[data-setting=teaching-preset]'),scope=d.querySelector('[data-setting=instrument-scope]');
  const mode=d.querySelector('.response-controls select');
  for(let level=1;level<=6;level++)for(const instrument of ['general','percussion']) {
    const before=d.querySelector('.passage').dataset.exerciseId;
    choose(picker,'uil-'+level);choose(scope,instrument);
    assert(d.querySelector('.passage').dataset.exerciseId===before,'pending level retains passage '+level+'/'+instrument);
    assert(settings().generation.teachingPreset.scope===instrument,'scope persisted '+level+'/'+instrument);
    for(const length of [1,2,3,4]) {
      d.querySelector(`[data-setting=exercise-length] input[value="${length}"]`).click();
      button('New exercise').click();
      const identity=d.querySelector('.passage').dataset.exerciseId;
      assert(d.querySelectorAll('.notation').length===length,'generated length '+level+'/'+instrument+'/'+length);
      assert(!d.querySelector('.notation [data-kind=rest],.notation [data-tie-next=true]'),'verified note-only '+level+'/'+instrument+'/'+length);
      for(const response of ['write','tap','both']) {choose(mode,response);assert(d.querySelector('.passage').dataset.exerciseId===identity,'mode identity '+response);}
    }
  }
  for(const fixture of ['uil-percussion','uil-figures','uil-cut','uil-mixed']) {
    choose(d.querySelector('[data-preset]'),fixture);
    assert(d.querySelectorAll('.notation').length>0,'fixture renders '+fixture);
    const identity=d.querySelector('.passage').dataset.exerciseId;
    for(const system of ['numbers','syllables']) {
      choose(d.querySelector('[data-setting=count-system]'),system);
      choose(mode,'both');
      const slot=d.querySelector('.count-slot:not([hidden])');slot.focus();slot.dispatchEvent(new w.KeyboardEvent('keydown',{key:'1',bubbles:true}));
      assert(slot.textContent==='1','keyboard entry '+fixture+'/'+system);
      if(fixture==='uil-cut') {
        d.querySelector('.count-slot:not([hidden])').click();
        d.querySelector('.count-slot:not([hidden])').focus();
        const keys=system==='numbers'?['1','&','2','e','&','a']:['1','t','e','2','t','a','t','e','t','a'];
        for(const key of keys)d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
        const actual=[...d.querySelectorAll('.count-slot:not([hidden])')].map(n=>n.textContent);
        const expected=system==='numbers'?['1','&','2','e','&','a']:['1','te','2','ta','te','ta'];
        assert(JSON.stringify(actual)===JSON.stringify(expected),'all scaled cut-time keyboard syllables '+system);
      }

      for(const response of ['write','tap','both']){choose(mode,response);assert(slot.textContent==='1'&&d.querySelector('.passage').dataset.exerciseId===identity,'responses retained '+fixture+'/'+system+'/'+response);}
    }
    if(fixture==='uil-cut'){
      assert(d.querySelector('.score-tempo').textContent.includes('half-note'),'half-note tempo label');
      assert(d.querySelector('.notation').getAttribute('aria-label').startsWith('2/2'),'real cut-time signature');
      assert([...d.querySelectorAll('.count-slot')].some(n=>n.getAttribute('aria-label')?.includes('beat 2')),'cut-time beat 2');
    }
    if(fixture==='uil-mixed')assert([...d.querySelectorAll('.notation')].every(n=>n.querySelectorAll('text').length>=2),'changed signatures engraved in every changed bar');
  }
  choose(picker,'uil-6');choose(d.querySelector('select[data-setting=meter-changes]'),'3');
  assert(settings().generation.meterChanges===3,'optional changes persisted');
  d.querySelector('[data-setting=ties]').click();
  assert(settings().generation.teachingPreset.customized&&!settings().generation.figureProfile,'musical customization clears verified generator, retains attribution');
  assert(d.documentElement.scrollWidth<=d.documentElement.clientWidth+1,'no page overflow');
  assert(!(w.__errors??[]).length,'no runtime errors');
  return {width:d.documentElement.clientWidth,assertions:checks.length};
};
window.runUilPerformanceScenario = async function(w=window, style='tap') {
  const d=w.document,choose=(n,v)=>{n.value=v;n.dispatchEvent(new w.Event('change'));};
  const button=name=>[...d.querySelectorAll('button')].find(b=>b.textContent===name);
  const sleep=ms=>new Promise(r=>w.setTimeout(r,ms));
  const wait=async fn=>{const end=Date.now()+20000;while(!fn()){if(Date.now()>end)throw Error('Performance timed out');await sleep(20);}};
  const assert=(v,m)=>{if(!v)throw Error(m);};
  choose(d.querySelector('.response-controls select'),'tap');choose(d.querySelector('[data-preset]'),'uil-mixed');
  choose(d.querySelector('.score-tempo input'),'180');choose(d.querySelector('[data-setting=how-to-play]'),style);
  button('Reset timing').click();d.querySelector('.calibration input[type=checkbox]').checked=false;
  const pad=d.querySelector('.pad'),original=w.AudioContext.prototype.createOscillator;
  let context, scheduled=[],evidence;
  w.AudioContext.prototype.createOscillator=function(){context=this;const n=original.call(this),start=n.start.bind(n);n.start=t=>{scheduled.push(t);start(t);};return n;};
  // Explicitly scoped synthetic focus/visibility emulation for a background preview.
  const oldFocus=d.hasFocus,hidden=Object.getOwnPropertyDescriptor(d,'hidden');d.hasFocus=()=>true;Object.defineProperty(d,'hidden',{configurable:true,get:()=>false});
  const oldURL=w.URL.createObjectURL;w.URL.createObjectURL=blob=>{evidence=blob.text().then(JSON.parse);return oldURL(blob);};
  const prevent=e=>{if(e.target.download)e.preventDefault();};d.addEventListener('click',prevent,true);
  try {
    pad.click();await wait(()=>scheduled.length&&d.querySelector('.tap-response .status').textContent.startsWith('Count-in'));
    const start=scheduled[0]+4/3;
    await wait(()=>context.currentTime>=start+.005);
    const anchor=w.performance.now()-context.currentTime*1000;
    // Independent fixture times in local performance pulses: 2/2, 6/8, 3/4, 4/4.
    const starts=[0,.5,1,1.25,1.5,1.75,2,3,10/3,11/3,4,13/3,14/3,5,7];
    const ends=[.5,1,1.25,1.5,1.75,2,3,10/3,11/3,4,13/3,14/3,5,7,11];
    for(let i=0;i<starts.length;i++)for(const edge of ['down','up']) {
      const t=(edge==='down'?starts[i]:ends[i]-.01)/3;
      const e=new w.KeyboardEvent(edge==='down'?'keydown':'keyup',{key:' ',code:'Space',bubbles:true,cancelable:true});Object.defineProperty(e,'timeStamp',{value:anchor+(start+t+.01)*1000});pad.dispatchEvent(e);
    }
    await wait(()=>d.querySelector('.performance-surface').hidden);
    button('Download timing evidence').click();const record=await evidence;
    assert(record.status==='completed','completed performance');assert(record.assessment.rhythm>=99,'mixed pulse rhythm accepted');assert(record.assessment.extra===0,'no extra attacks');
    const text=d.querySelector('.feedback-snapshot').textContent;assert(text.includes('bones'),'Treat Bag feedback');
    for(const mode of ['write','tap','both']){choose(d.querySelector('.response-controls select'),mode);assert(d.querySelector('.feedback-snapshot').textContent===text,'completed feedback retained');}
    return {style,status:record.status,rhythm:record.assessment.rhythm,hold:record.assessment.hold,notes:record.plan.notes.length};
  } finally {w.AudioContext.prototype.createOscillator=original;w.URL.createObjectURL=oldURL;d.hasFocus=oldFocus;if(hidden)Object.defineProperty(d,'hidden',hidden);else delete d.hidden;d.removeEventListener('click',prevent,true);}
};
