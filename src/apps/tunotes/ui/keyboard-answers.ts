import { pianoKeyboard } from '../../../shared/input/piano-keyboard.ts';
import { el } from '../../../shared/ui/components.ts';
import { noteName } from '../../../music/pitch.ts';
import type { KeyboardAnswer } from '../domain/fingering.ts';
import type { PromptToken } from '../engine/practice.ts';

/** Written pitch class by default; no instrument transposition or audio generation. */
export function keyboardAnswers(accept: (answer: KeyboardAnswer, token: PromptToken) => void) {
  let octave = 4, token: PromptToken | undefined, locked = true, enabled = false;
  const node = el('div','keyboard-answers');
  const piano = pianoKeyboard({
    label: 'Written-pitch keyboard', note: semitone => (octave+1)*12+semitone,
    enabled: () => enabled && !locked,
    press(note) { if (enabled && !locked && token) accept({kind:'keyboard',note,matchOctave:false},token); }, release() {},
  });
  function render() {
    piano.keys.forEach((key,i)=>{
      const note=(octave+1)*12+i;
      key.setAttribute('aria-label',`Answer ${noteName(note)}`);
      key.disabled=!enabled || locked || note>119;
    });
  }
  node.append(piano.node);
  return {node,reset:piano.reset,focus:()=>piano.keys.find(k=>!k.disabled)?.focus(),
    enable(value:boolean) { if (enabled && !value) piano.reset(); enabled=value; render(); },
    update(next:PromptToken,nextLocked:boolean,initialOctave:number) {
      if (token?.session!==next.session) { piano.reset(); octave=initialOctave; }
      token=next; locked=nextLocked; render();
    },
  };
}
