import './styles.css';
import { identifyPitch, noteName } from './music/pitch.ts';

const form = document.querySelector<HTMLFormElement>('#pitch-form')!;
const result = document.querySelector<HTMLParagraphElement>('#pitch-result')!;

function updatePitch(): void {
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  try {
    const pitch = identifyPitch(
      Number(data.get('frequency')),
      Number(data.get('calibration')),
      Number(data.get('transposition')),
    );
    const direction = Math.abs(pitch.cents) < 0.05
      ? 'In tune'
      : `${Math.abs(pitch.cents).toFixed(1)} cents ${pitch.cents > 0 ? 'sharp' : 'flat'}`;
    result.textContent = `Concert ${noteName(pitch.concertNote)} · Written ${noteName(pitch.writtenNote)} · ${direction}`;
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : 'Unable to calculate pitch.';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  updatePitch();
});
updatePitch();
