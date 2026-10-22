/** Run against the current typed-score/counting workspace. */
window.uilScenarios = async function (w = window) {
  const d=w.document;let assertions=0;
  const assert=(value,message)=>{if(!value)throw Error(message);assertions++;};
  const choose=(node,value)=>{node.value=value;node.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const generation=()=>JSON.parse(w.localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation;
  const picker=d.querySelector('[data-setting="teaching-preset"]');
  assert(picker.options.length===9,'Only Uno1–4 and UIL I–IV plus Custom');
  assert(!d.querySelector('select[data-setting="meter-changes"]'),'No meter-change control');
  assert(!d.querySelector('[data-meter="2/2"]'),'No cut-time control');
  for(const level of [1,2,3,4])for(const scope of ['general','percussion'])for(const length of [1,2,3,4]){
    const before=d.querySelector('.notation'),slot=d.querySelector('.count-slot');
    choose(picker,`uil-${level}`);
    choose(d.querySelector('[data-setting="instrument-scope"]'),scope);
    const lengthInput=d.querySelector(`[data-setting="exercise-length"] input[value="${length}"]`);lengthInput.click();
    assert(d.querySelector('.notation')===before,'Pending changes retain score');
    assert(d.contains(slot),'Pending changes retain answer input');
    assert(generation().teachingPreset.scope===scope,'Scope stored');
    assert(generation().teachingPreset.version===3&&!generation().teachingPreset.customized,'Exact v3 identity');
    d.querySelector('.setup-actions button').click();
    assert(d.querySelectorAll('.passage > .measure').length===length || d.querySelectorAll('.passage .notation').length===length,'Length applied');
    const score=d.querySelector('.notation'),first=d.querySelector('.count-slot');first.focus();first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'1',bubbles:true,cancelable:true}));
    for(const mode of ['tap','both','write']){
      choose(d.querySelector('select[aria-label="Mode"]'),mode);
      assert(d.querySelector('.notation')===score,'Mode retains typed score rendering');
      assert(first.textContent==='1','Mode retains answer');
    }
  }
  return {assertions};
};
