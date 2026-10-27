import { pianoKeyboard } from '../../../shared/input/piano-keyboard.ts';
import { el } from '../../../shared/ui/components.ts';
import { noteName } from '../../../music/pitch.ts';
import type { KeyboardAnswer } from '../domain/fingering.ts';
import type { PromptToken } from '../engine/practice.ts';

/** Written pitch class by default; no instrument transposition or audio generation. */
export function keyboardAnswers(accept: (answer: KeyboardAnswer, token: PromptToken) => void) {
  let octave = 4, token: PromptToken | undefined, locked = true, enabled = false;
  const node = el('div','keyboard-answers');
  const controls = el('div','control-row');
  const octaveSelect = el('select','control'); octaveSelect.setAttribute('aria-label','Keyboard octave');
  for (let i=0; i<=8; i++) { const o=el('option','',`Octave ${i}`); o.value=String(i); octaveSelect.append(o); }
  const down = el('button','control','−'); down.type='button'; down.setAttribute('aria-label','− Octave');
  const up = el('button','control','+'); up.type='button'; up.setAttribute('aria-label','+ Octave');
  const strict = el('input'); strict.type='checkbox';
  const strictLabel = el('label','control'); strictLabel.append(strict,document.createTextNode(' Match octave'));
  const piano = pianoKeyboard({
    label: 'Written-pitch keyboard', note: semitone => (octave+1)*12+semitone,
    enabled: () => enabled && !locked,
    press(note) { if (enabled && !locked && token) accept({kind:'keyboard',note,matchOctave:strict.checked},token); }, release() {},
  });
  function render() {
    octaveSelect.value=String(octave); down.disabled=octave===0; up.disabled=octave===8;
    piano.keys.forEach((key,i)=>{
      const note=(octave+1)*12+i;
      key.setAttribute('aria-label',`Answer ${noteName(note)}`);
      key.disabled=!enabled || locked || note>119;
    });
  }
  const setOctave = (value: number) => { piano.reset(); octave=value; render(); };
  down.addEventListener('click',()=>setOctave(octave-1)); up.addEventListener('click',()=>setOctave(octave+1));
  octaveSelect.addEventListener('change',()=>setOctave(Number(octaveSelect.value)));
  controls.append(down,octaveSelect,up,strictLabel);
  node.append(controls,piano.node,el('p','muted keyboard-help','Any octave by default. Tap a key, or use Space/Enter.'));
  return {node,reset:piano.reset,focus:()=>piano.keys.find(k=>!k.disabled)?.focus(),
    enable(value:boolean) { if (enabled && !value) piano.reset(); enabled=value; render(); },
    update(next:PromptToken,nextLocked:boolean,initialOctave:number) {
      if (token?.session!==next.session) { piano.reset(); octave=initialOctave; }
      token=next; locked=nextLocked; render();
    },
  };
}
