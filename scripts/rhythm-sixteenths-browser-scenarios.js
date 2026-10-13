// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Run through native T3 preview_evaluate. Synthetic keyboard/pointer events;
 * actual hit-testing and 320px CSS layout, not physical-device timing. */
window.__sixteenthCheck = (async () => {
  const checks = [], assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  const pause = () => new Promise(resolve => setTimeout(resolve, 80));
  const field = (doc, name) => [...doc.querySelectorAll('label')].find(n => n.querySelector('.field-label')?.textContent === name)?.querySelector('select');
  const choose = (doc, name, value) => { const f = field(doc, name); f.value = value; f.dispatchEvent(new doc.defaultView.Event('change')); };
  const key = (node, value) => node.dispatchEvent(new node.ownerDocument.defaultView.KeyboardEvent('keydown', { key:value, bubbles:true, cancelable:true }));
  const button = (doc, name) => [...doc.querySelectorAll('button')].find(n => n.textContent === name);
  const slots = doc => [...doc.querySelectorAll('.count-slot')];
  const run = async doc => {
    const w = doc.defaultView;
    choose(doc,'Mode','write'); choose(doc,'Testing fixture','eighth-two-sixteenths'); choose(doc,'Testing fixture','four-sixteenths'); choose(doc,'Counting system','numbers');
    const s=slots(doc), score=doc.querySelector('.notation'), id=doc.querySelector('.passage').dataset.exerciseId;
    s[0].focus(); key(s[0],'1'); key(s[1],'e'); key(s[2],'+'); key(s[3],'a');
    key(s[4],'2'); key(s[8],'3'); key(s[12],'4');
    const initialAnchors=[...doc.querySelectorAll('.duration-anchor')]; initialAnchors[8].click(); initialAnchors[12].click();
    const duration=doc.querySelector('.duration-line'),savedDuration=[duration.style.left,duration.style.width];
    button(doc,'Check').click(); assert(doc.querySelector('.dimension').classList.contains('correct'),'number-system count check');
    choose(doc,'Counting system','syllables');
    assert(s[1].textContent==='ta' && s[2].textContent==='te' && s[3].textContent==='ta','atomic mapped syllables');
    assert(doc.querySelector('.notation')===score && doc.querySelector('.passage').dataset.exerciseId===id,'system preserves exact score identity');
    assert(!doc.querySelector('.dimension'),'system invalidates stale feedback');
    assert(doc.querySelector('.measure-editor').parentElement.querySelector('[role="status"]').textContent.includes('Check again'),'system change remains announced after refresh');
    assert(JSON.stringify([duration.style.left,duration.style.width])===JSON.stringify(savedDuration),'system preserves duration endpoints including hidden subdivisions');
    button(doc,'Check').click(); assert(doc.querySelector('.dimension').classList.contains('correct'),'syllable-system count check');
    s[1].focus(); key(s[1],'Delete'); key(s[1],'t');
    assert(s[1].textContent==='·' && doc.activeElement===s[1],'first t never commits or advances');
    key(s[1],'e'); assert(s[1].textContent==='te' && doc.activeElement===s[2],'te commits once and advances');
    key(s[2],'t'); key(s[2],'Backspace'); assert(s[2].textContent==='te','backspace cancels incomplete syllable only');
    key(s[2],'t'); key(s[2],'ArrowRight'); key(s[3],'a'); assert(s[3].textContent==='a','navigation cancels incomplete syllable');
    s[1].focus(); key(s[1],'t'); s[2].focus(); key(s[2],'e'); assert(s[2].textContent==='e','blur cancels incomplete syllable');
    s[1].focus(); key(s[1],'t'); key(s[1],'Escape'); key(s[1],'a'); assert(s[1].textContent==='a','Escape cancels incomplete syllable');
    choose(doc,'Counting system','numbers'); assert(s[1].textContent==='·' && s[2].textContent==='·','unsupported answer tokens clear without guessing');
    s[3].focus(); key(s[3],'e'); choose(doc,'Counting system','syllables');
    assert(s[3].textContent==='·' && doc.querySelector('.practice-status').textContent.includes('ambiguous'),'incorrect e at fourth subdivision cannot turn correct');
    s[3].click(); const popup=doc.querySelector('#count-popover-1');
    assert(!popup.querySelector('[data-symbol="ta"]').hidden && popup.querySelector('[data-symbol="e"]').hidden,'touch menu offers selected-system tokens without slot filtering');
    popup.querySelector('[data-symbol="ta"]').click(); assert(s[3].textContent==='ta','touch atomic ta choice');
    s[1].scrollIntoView({block:'center'}); const oldCapture=s[1].setPointerCapture;s[1].setPointerCapture=()=>{};
    const tb=s[1].getBoundingClientRect();s[1].dispatchEvent(new w.PointerEvent('pointerdown',{pointerId:71,pointerType:'touch',button:0,clientX:tb.x+tb.width/2,clientY:tb.y+tb.height/2,bubbles:true,cancelable:true}));
    const ta=popup.querySelector('[data-symbol="ta"]'),choiceBox=ta.getBoundingClientRect();
    doc.dispatchEvent(new w.PointerEvent('pointermove',{pointerId:71,pointerType:'touch',clientX:choiceBox.x+choiceBox.width/2,clientY:choiceBox.y+choiceBox.height/2,bubbles:true,cancelable:true}));
    doc.dispatchEvent(new w.PointerEvent('pointerup',{pointerId:71,pointerType:'touch',bubbles:true,cancelable:true}));s[1].setPointerCapture=oldCapture;
    assert(s[1].textContent==='ta','synthetic touch slide commits atomic syllable');
    const answer=s.map(n=>n.textContent).join();
    for(const mode of ['tap','both','write']) { choose(doc,'Mode',mode); assert(doc.querySelector('.notation')===score && s.map(n=>n.textContent).join()===answer,'mode preserves shared notation and responses'); }
    choose(doc,'Offbeat symbol · 1 e & a','+'); choose(doc,'Counting system','numbers');
    assert(field(doc,'Offbeat symbol · 1 e & a').value==='+','syllables retain separate offbeat preference');
    choose(doc,'Testing fixture','six-eighths');
    assert(field(doc,'Counting system').disabled && field(doc,'Offbeat symbol · 1 e & a').disabled,'6/8 disables simple-meter controls');
    assert(slots(doc).length===6,'6/8 six-number grid unchanged');
    choose(doc,'Testing fixture','dense-sixteenths'); await pause();
    assert(doc.documentElement.scrollWidth<=w.innerWidth+1,'dense page has no horizontal overflow');
    assert([...doc.querySelectorAll('.passage-scroll')].every(n=>n.scrollWidth<=n.clientWidth+1),'dense score has no horizontal overflow');
    for(const card of doc.querySelectorAll('.passage-measure')) {
      const notationTargets=[...card.querySelectorAll('[data-count-hit]')].map(n=>n.getBoundingClientRect());
      assert(notationTargets.every((a,i)=>notationTargets.every((b,j)=>j<=i || a.right<=b.left+.5 || b.right<=a.left+.5)),'beamed notation entry targets do not overlap neighboring onsets');
      const targets=[...card.querySelectorAll('.count-slot:not([hidden]),.duration-anchor:not([hidden])')];
      const boxes=targets.map(n=>n.getBoundingClientRect());
      assert(boxes.every(r=>r.width>=43 && r.height>=43),'dense count and duration targets keep touch size');
      assert(boxes.every((a,i)=>boxes.every((b,j)=>j<=i || a.right<=b.left+.5 || b.right<=a.left+.5 || a.bottom<=b.top+.5 || b.bottom<=a.top+.5)),'dense primary editing targets do not overlap');
    }
    const dense=slots(doc); dense[15].scrollIntoView({block:'center'}); await pause();
    const bounds=dense[15].getBoundingClientRect();
    assert(doc.elementFromPoint(bounds.x+bounds.width/2,bounds.y+bounds.height/2)===dense[15],'last subdivision is actually hittable');
    dense[15].click(); doc.querySelector('#count-popover-1 [data-symbol="a"]').click(); assert(dense[15].textContent==='a','dense final subdivision entry works');
    choose(doc,'Testing fixture','sixteenth-rests');
    for(const i of [0,5,10,15]) { const slot=slots(doc)[i]; slot.focus(); key(slot,'('); key(slot,')'); }
    assert(doc.querySelectorAll('.rest-group').length===4,'one rest pair per written sixteenth rest');
    const pairs=[...doc.querySelectorAll('.rest-group')].map(n=>[n.dataset.start,n.dataset.end]); choose(doc,'Counting system','syllables');
    assert(JSON.stringify([...doc.querySelectorAll('.rest-group')].map(n=>[n.dataset.start,n.dataset.end]))===JSON.stringify(pairs),'system preserves each saved rest range'); choose(doc,'Counting system','numbers');
    choose(doc,'Testing fixture','sixteenth-all-rests');
    for(const slot of slots(doc)) { slot.click(); const menu=doc.querySelector('#count-popover-1'); [...menu.querySelectorAll('button')].find(n=>n.textContent==='Start rest pair').click(); slot.click(); [...menu.querySelectorAll('button')].find(n=>n.textContent==='Close rest pair').click(); }
    assert(doc.querySelectorAll('.rest-group').length===16,'adjacent sixteenth rests can be marked through touch menu');
    const restSlot=slots(doc)[5]; restSlot.scrollIntoView({block:'center'}); await pause();
    const rb=restSlot.getBoundingClientRect(); assert(doc.elementFromPoint(rb.x+rb.width/2,rb.y+rb.height/2)===restSlot,'rest parentheses keep count center hittable');
    restSlot.click(); doc.querySelector('#count-popover-1 [data-symbol="e"]').click(); assert(restSlot.textContent==='e','count entry remains usable inside completed rest pair');
    choose(doc,'Testing fixture','sixteenth-bar-tie'); await pause();
    assert(doc.querySelectorAll('[data-tie]').length===2,'barline tie retains both wrapped hooks');
    const anchors=[...doc.querySelectorAll('.duration-anchor')]; anchors[7].click(); anchors[8].click();
    assert(doc.querySelectorAll('.passage-duration').length===2,'one logical tie duration renders both bar pieces');
    choose(doc,'Testing fixture','dotted-eighth-sixteenth');
    assert(doc.querySelector('[data-dots="1"] circle') && doc.querySelector('[data-beam="partial"]'),'dotted eighth dot and partial secondary beam');
    const currentScore=doc.querySelector('.notation'),currentId=doc.querySelector('.passage').dataset.exerciseId;
    const ingredient=doc.querySelector('[data-ingredient="sixteenth"]');ingredient.checked=true;ingredient.dispatchEvent(new w.Event('change'));
    const restIngredient=doc.querySelector('[data-ingredient="sixteenth-rest"]');restIngredient.checked=true;restIngredient.dispatchEvent(new w.Event('change'));
    const dottedIngredient=doc.querySelector('[data-ingredient="dotted-eighth"]');dottedIngredient.checked=true;dottedIngredient.dispatchEvent(new w.Event('change'));
    assert(doc.querySelector('.notation')===currentScore&&doc.querySelector('.passage').dataset.exerciseId===currentId,'new ingredient preferences stay pending without replacing passage');
    for(const mode of ['tap','both','write']) {choose(doc,'Mode',mode);assert(doc.querySelector('.notation')===currentScore,'pending new vocabulary does not regenerate on mode switch');}
    button(doc,'New exercise').click();assert(doc.querySelector('.passage').dataset.exerciseId!==currentId,'new vocabulary applies through shared Next lifecycle');
  };
  await run(document);
  const frame=document.createElement('iframe'); frame.style.cssText='width:320px;height:800px;border:0'; document.body.append(frame);
  frame.srcdoc=window.__unoHTML; await new Promise(resolve=>frame.onload=resolve); await pause();
  await run(frame.contentDocument); frame.remove();
  // Loading a fresh document exercises persistence separately from retaining an
  // in-memory answer across response modes. Run on an origin with localStorage.
  const preferenceKey='tuno.rhythm-walk.preferences.v1', saved=localStorage.getItem(preferenceKey);
  const legacy={...JSON.parse(saved),offbeat:'+',bpm:123,mode:'both',preset:'four-sixteenths'};
  legacy.generation={...legacy.generation,measures:4,ingredients:['quarter','sixteenth','sixteenth-rest','dotted-eighth']};
  delete legacy.countingSystem;
  const restored=document.createElement('iframe'); restored.style.cssText='width:320px;height:800px;border:0';
  try {
    localStorage.setItem(preferenceKey,JSON.stringify(legacy));document.body.append(restored);restored.srcdoc=window.__unoHTML;
    await new Promise(resolve=>restored.onload=resolve);
    const doc=restored.contentDocument, persisted=JSON.parse(localStorage.getItem(preferenceKey));
    assert(field(doc,'Counting system').value==='numbers','legacy storage migrates counting system on fresh load');
    assert(field(doc,'Offbeat symbol · 1 e & a').value==='+','legacy storage keeps independent offbeat preference');
    assert(doc.querySelector('.score-tempo input').value==='123'&&field(doc,'Mode').value==='both','migration preserves tempo and response mode');
    assert(persisted.generation.measures===4&&JSON.stringify(persisted.generation.ingredients)===JSON.stringify(legacy.generation.ingredients),'migration preserves exercise settings and ingredient selections');
    choose(doc,'Counting system','syllables');
    assert(JSON.parse(localStorage.getItem(preferenceKey)).countingSystem==='syllables','selected counting system persists independently');
  } finally {restored.remove();if(saved===null)localStorage.removeItem(preferenceKey);else localStorage.setItem(preferenceKey,saved);}
  return {passed:checks.length,checks};
})();
