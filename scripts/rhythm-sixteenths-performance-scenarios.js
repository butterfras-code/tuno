// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Native T3 preview. Controlled synthetic timestamps, real audio-clock lifecycle.
 * Click Start once through the native browser to unlock audio before running. */
window.__sixteenthPerformance = (async () => {
  const checks=[], assert=(v,label)=>{if(!v)throw new Error(label);checks.push(label);};
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const wait=async f=>{const deadline=performance.now()+12000;while(!f()){if(performance.now()>deadline)throw new Error('timeout');await sleep(5);}};
  const choose=(control,value)=>{control.value=value;control.dispatchEvent(new Event('change'));};
  const button=name=>[...document.querySelectorAll('button')].find(n=>n.textContent===name);
  const pad=document.querySelector('.pad'), status=()=>document.querySelector('.tap-response .status').textContent;
  const mode=document.querySelector('select[aria-label="Mode"]'), preset=document.querySelector('[data-preset]'), tempo=document.querySelector('.score-tempo input'), play=document.querySelector('[data-setting="how-to-play"]');
  const oldOsc=AudioContext.prototype.createOscillator, oldURL=URL.createObjectURL, oldPointer=pad.setPointerCapture;
  let context,scheduled=[],evidence;
  AudioContext.prototype.createOscillator=function(){context=this;const node=oldOsc.call(this),start=node.start.bind(node);node.start=t=>{scheduled.push(t);start(t);};return node;};
  URL.createObjectURL=blob=>{evidence=blob.text().then(JSON.parse);return oldURL(blob);};
  const prevent=e=>{if(e.target instanceof HTMLAnchorElement&&e.target.download)e.preventDefault();};document.addEventListener('click',prevent,true);
  const raw=async()=>{button('Download timing evidence').click();return evidence;};
  try {
    button('Stop')?.click();choose(mode,'both');choose(tempo,'180');button('Reset timing').click();
    document.querySelector('.calibration input[type=checkbox]').checked=false;
    for(const [style,fixture,intervals] of [
      ['tap','dotted-eighth-sixteenth',[[0,.25],[.25,1/3],[1/3,2/3],[2/3,1]]],
      ['hold','sixteenth-bar-tie',[[0,1/3],[1/3,.5],[.5,7/12],[7/12,.75],[.75,5/6],[5/6,1],[1,4/3]]],
    ]) {
      choose(preset,'half');choose(preset,fixture);choose(play,style);
      const score=[...document.querySelectorAll('.notation')],id=document.querySelector('.passage').dataset.exerciseId;
      scheduled=[];pad.click();await wait(()=>status().startsWith('Count-in'));
      const start=scheduled[0]+document.querySelectorAll('.count-in-dot').length/3;
      await wait(()=>context.currentTime>=start+.015);
      pad.setPointerCapture=()=>{};
      for(const [down,up] of intervals) for(const [action,time] of [['down',down],['up',up]]) {
        const event=style==='hold'?new PointerEvent(action==='down'?'pointerdown':'pointerup',{pointerId:97,pointerType:'touch',button:0,bubbles:true,cancelable:true}):new KeyboardEvent(action==='down'?'keydown':'keyup',{key:' ',code:'Space',bubbles:true,cancelable:true});
        Object.defineProperty(event,'timeStamp',{value:performance.now()+(start+time+(action==='down'?.025:.020)-context.currentTime)*1000});pad.dispatchEvent(event);
      }
      await wait(()=>status()==='Reviewing');const record=await raw();
      assert(record.status==='completed'&&record.playStyle===style,'completed shared capture in '+style);
      assert(record.plan.notes.length===intervals.length,'canonical attacks including tied chain');
      assert(record.plan.notes.every((n,i)=>Math.abs(n.start-intervals[i][0])<1e-9&&Math.abs(n.end-intervals[i][1])<1e-9),'exact sixteenth/dotted-eighth target timing');
      assert(record.events.length===2*intervals.length,'raw edges retained');
      const results=document.querySelector('.performance-results'),text=results.innerText;
      const system=document.querySelector('[data-setting="count-system"]');choose(system,'syllables');choose(system,'numbers');
      assert(document.querySelector('.performance-results')===results&&results.innerText===text&&JSON.stringify(await raw())===JSON.stringify(record),'system changes never alter completed performance evidence or results');
      for(const response of ['tap','write','both']){choose(mode,response);assert(document.querySelector('.passage').dataset.exerciseId===id&&score.every((n,i)=>document.querySelectorAll('.notation')[i]===n),'completed modes preserve exercise and shared score');}
      const timelines=[...document.querySelectorAll('.timing-timeline')];
      assert(timelines.length===score.length,'timeline follows shared systems');
      assert(timelines.every((n,i)=>Math.abs(n.getBoundingClientRect().width-score[i].getBoundingClientRect().width)<.1),'timeline aligned with notation width');
      assert(timelines.reduce((s,n)=>s+n.querySelectorAll('.timeline-hit').length,0)===2*intervals.length,'one expected and received marker per sounding attack');
      assert(timelines.some(n=>n.querySelector('.timeline-sustain'))===(style==='hold'),'actual sustain bars only in Hold');
    }
    return {passed:checks.length,checks};
  } finally {AudioContext.prototype.createOscillator=oldOsc;URL.createObjectURL=oldURL;pad.setPointerCapture=oldPointer;document.removeEventListener('click',prevent,true);}
})();
