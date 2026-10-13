// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Execute with native T3 preview_evaluate against this worktree's build.
 * Synthetic entry and 320px CSS hit testing do not establish physical-device acceptance. */
window.__tripletCheck = (async () => {
  const checks=[], assert=(v,label)=>{if(!v)throw new Error(label);checks.push(label);};
  const pause=()=>new Promise(r=>setTimeout(r,80));
  const field=(doc,name)=>[...doc.querySelectorAll('label')].find(n=>n.querySelector('.field-label')?.textContent===name)?.querySelector('select');
  const choose=(doc,name,value)=>{const f=field(doc,name);f.value=value;f.dispatchEvent(new doc.defaultView.Event('change'));};
  const key=(n,k)=>n.dispatchEvent(new n.ownerDocument.defaultView.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
  const button=(doc,name)=>[...doc.querySelectorAll('button')].find(n=>n.textContent===name);
  const slots=doc=>[...doc.querySelectorAll('.count-slot')];
  async function run(doc) {
    const w=doc.defaultView;
    choose(doc,'Mode','write');choose(doc,'Testing fixture','half');choose(doc,'Testing fixture','triplet-mixed');choose(doc,'Counting system','numbers');
    const s=slots(doc), score=doc.querySelector('.notation'),id=doc.querySelector('.passage').dataset.exerciseId;
    const positions=[0,4,8,12,18,24,28,32,36,39,42,45],tokens=['1','la','li','2','&','3','la','li','4','e','&','a'];
    assert(s.length===48 && s.filter(n=>!n.hidden).length===12,'exact mixed lattice with only local inputs');
    positions.forEach((p,i)=>{s[p].focus();key(s[p],tokens[i]==='la'?'l':tokens[i]==='li'?'i':tokens[i]);});
    button(doc,'Check').click();assert(doc.querySelector('.dimension').classList.contains('correct'),'independent mixed numeric answer');
    choose(doc,'Counting system','syllables');
    assert(!doc.querySelector('.dimension') && s[4].textContent==='la' && s[8].textContent==='li','triplets retained and feedback invalidated');
    assert(s[18].textContent==='te' && s[39].textContent==='ta' && s[45].textContent==='ta','binary neighbors use selected system');
    button(doc,'Check').click();assert(doc.querySelector('.dimension').classList.contains('correct'),'independent mixed syllable answer');
    for(const system of ['numbers','syllables']) {
      choose(doc,'Counting system',system);s[4].focus();key(s[4],'l');assert(s[4].textContent==='la' && doc.activeElement===s[8],'single-key la commits and advances once');
      s[4].focus();key(s[4],'i');assert(s[4].textContent==='li' && doc.activeElement===s[8],'single-key li commits and advances once');
      choose(doc,'Counting system',system==='numbers'?'syllables':'numbers');assert(s[4].textContent==='li','incorrect triplet token survives switching');
    }
    s[4].click();const popup=doc.querySelector('#count-popover-1');
    assert(!popup.querySelector('[data-symbol="la"]').hidden && !popup.querySelector('[data-symbol="li"]').hidden,'touch choices expose both triplet tokens');
    popup.querySelector('[data-symbol="la"]').click();assert(s[4].textContent==='la','touch choice stores atomic la');
    const saved=s.map(n=>n.textContent).join();
    for(const mode of ['tap','both','write']) {choose(doc,'Mode',mode);assert(doc.querySelector('.notation')===score && doc.querySelector('.passage').dataset.exerciseId===id && s.map(n=>n.textContent).join()===saved,'mode retains canonical score and answers');}
    for(const [preset,bars,groups] of [['triplet-isolated',1,1],['triplet-consecutive',1,2],['triplet-beat-two',1,1],['triplet-mixed',1,2],['triplet-mixed-2',2,4],['triplet-mixed-3',3,6],['triplet-mixed-4',4,8]]) {
      choose(doc,'Testing fixture',preset);await pause();
      assert(doc.querySelectorAll('.notation').length===bars && doc.querySelectorAll('[data-tuplet]').length===groups,'shared review length and triplet group labels '+preset);
      assert(doc.documentElement.scrollWidth<=w.innerWidth+1 && [...doc.querySelectorAll('.passage-scroll')].every(n=>n.scrollWidth<=n.clientWidth+1),'no page/score overflow '+preset);
      for(const card of doc.querySelectorAll('.passage-measure')) {
        const targets=[...card.querySelectorAll('.count-slot:not([hidden]),.duration-anchor:not([hidden])')],boxes=targets.map(n=>n.getBoundingClientRect());
        assert(boxes.every(r=>r.width>=43 && r.height>=43),'usable count/duration targets '+preset);
        assert(boxes.every((a,i)=>boxes.every((b,j)=>j<=i || a.right<=b.left+.5 || b.right<=a.left+.5 || a.bottom<=b.top+.5 || b.bottom<=a.top+.5)),'separate target geometry '+preset);
        for(const label of card.querySelectorAll('[data-tuplet]')) {const group=label.dataset.tuplet;const members=[...card.querySelectorAll(`g[data-tuplet-group="${group}"]`)];assert(members.length===3,'canonical group contains three events');assert(members.reduce((n,e)=>n+e.querySelectorAll('[data-beam="true"]').length,0)===2,'triplet has two primary beam joins');assert(members.every(e=>e.getAttribute('aria-label').includes('triplet')),'accessible descriptions identify triplet');assert(label.getBBox().y+label.getBBox().height<38,'triplet label clears primary beam');}
      }
    }
    const dense=slots(doc).filter(n=>!n.hidden).at(-1);dense.scrollIntoView({block:'center'});await pause();const rect=dense.getBoundingClientRect();assert(doc.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===dense,'dense final count hittable');
    choose(doc,'Testing fixture','triplet-isolated');const anchors=[...doc.querySelectorAll('.duration-anchor')];anchors[24].click();anchors[36].click();
    const line=doc.querySelector('.duration-line');assert(line.querySelector('.start').getAttribute('aria-valuenow')==='24' && line.querySelector('.end').getAttribute('aria-valuenow')==='47','sustain includes trailing hidden twelfths');
    choose(doc,'Testing fixture','triplet-rest-tie');await pause();const t=slots(doc);t[12].focus();key(t[12],'(');key(t[12],')');assert(doc.querySelectorAll('.rest-group').length===1,'ordinary rest parentheses beside triplets');assert(doc.querySelectorAll('[data-tie]').length===1,'ordinary tie engraving beside triplets');
    choose(doc,'Testing fixture','six-eighths');assert(slots(doc).length===6 && doc.querySelectorAll('[data-tuplet]').length===0 && field(doc,'Counting system').disabled,'unchanged 6/8 vocabulary and controls');
    // Exercise settings configure the same generator in every response mode.
    for (const meter of ['2/4','3/4','4/4']) {
      const meterControl=doc.querySelector(`[data-meter="${meter}"]`);meterControl.checked=true;meterControl.dispatchEvent(new w.Event('change'));
      for(const control of doc.querySelectorAll('[data-meter]')) if(control!==meterControl){control.checked=false;control.dispatchEvent(new w.Event('change'));}
      for(const control of doc.querySelectorAll('[data-ingredient]')) {control.checked=control.dataset.ingredient==='triplet-eighth';control.dispatchEvent(new w.Event('change'));}
      for(const length of [1,2,3,4]) {
        const control=doc.querySelector('[data-setting="exercise-length"]');control.value=String(length);control.dispatchEvent(new w.Event('change'));button(doc,'New exercise').click();
        assert(doc.querySelector('[data-preset]').value==='' && doc.querySelectorAll('.notation').length===length,'shared generated length '+meter+' '+length);
        assert(doc.querySelectorAll('[data-tuplet]').length===Number(meter[0])*length,'selected triplet-only generation '+meter+' '+length);
        const generatedScore=doc.querySelector('.notation'),generatedId=doc.querySelector('.passage').dataset.exerciseId;
        for(const mode of ['tap','both','write']) {choose(doc,'Mode',mode);assert(doc.querySelector('.notation')===generatedScore && doc.querySelector('.passage').dataset.exerciseId===generatedId,'generated score shared in '+mode);}
      }
    }
    choose(doc,'Testing fixture','triplet-mixed');button(doc,'New exercise').click();assert(!doc.querySelector('[data-preset]').value.startsWith('triplet-'),'Next replaces fixture with shared generated exercise');
  }
  await run(document);
  const frame=document.createElement('iframe');frame.style.cssText='width:320px;height:900px;border:0;display:block';frame.srcdoc=window.__tripletHtml;document.body.append(frame);
  await new Promise(r=>frame.onload=r);await pause();await run(frame.contentDocument);
  return {passed:checks.length,checks};
})();
