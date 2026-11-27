import { el } from '../ui/components.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Vintage C9 big-bulb Christmas lights scaled to ~55% of the prototype size (~16px bulbs).
 * Uses a seamless 200px repeating SVG pattern so bulbs stay crisp and 1:1 from 320px phones to 4K classrooms.
 * Glow is static so decorative lights never distract or read as a rhythm timing cue.
 */
export function createFiresideGarland(): HTMLElement {
  const host = el('div', 'theme-garland theme-garland--fireside');
  host.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '30');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = `
    <defs>
      <radialGradient id="c9-glow-red"><stop offset="0%" stop-color="#ff4d57" stop-opacity="0.72"/><stop offset="100%" stop-color="#ff4d57" stop-opacity="0"/></radialGradient>
      <radialGradient id="c9-glow-gold"><stop offset="0%" stop-color="#ffd24c" stop-opacity="0.78"/><stop offset="100%" stop-color="#ffd24c" stop-opacity="0"/></radialGradient>
      <radialGradient id="c9-glow-green"><stop offset="0%" stop-color="#35c473" stop-opacity="0.68"/><stop offset="100%" stop-color="#35c473" stop-opacity="0"/></radialGradient>
      <radialGradient id="c9-glow-blue"><stop offset="0%" stop-color="#4ba0f2" stop-opacity="0.68"/><stop offset="100%" stop-color="#4ba0f2" stop-opacity="0"/></radialGradient>
      <radialGradient id="c9-glow-orange"><stop offset="0%" stop-color="#ff9338" stop-opacity="0.72"/><stop offset="100%" stop-color="#ff9338" stop-opacity="0"/></radialGradient>
      <g id="c9-socket">
        <rect x="-2.5" y="-0.6" width="5" height="2.9" rx="0.7" fill="#1e3c2c"/>
        <rect x="-3.1" y="1.8" width="6.2" height="2.8" rx="0.9" fill="#27503a" stroke="#162e21" stroke-width="0.5"/>
      </g>
      <path id="c9-glass" d="M-2.7 4.6 C-4.4 6.7 -5 10.2 -3.4 13.7 C-2.2 16.1 -0.9 17.3 0 17.6 C0.9 17.3 2.2 16.1 3.4 13.7 C5 10.2 4.4 6.7 2.7 4.6 Z"/>
      <path id="c9-shine" d="M-2 6.6 C-3 8.4 -3.1 10.9 -2.1 13.3" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.58"/>
      <circle id="c9-dot" cx="1.5" cy="8.1" r="0.7" fill="#ffffff" opacity="0.48"/>
      <pattern id="c9-garland-tile" width="200" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 2 Q100 13 200 2" fill="none" stroke="#1f3b2c" stroke-width="2.1" stroke-linecap="round"/>
        <path d="M0 2.4 Q100 13.4 200 2.4" fill="none" stroke="#315a43" stroke-width="0.65" opacity="0.6"/>
        <g transform="translate(20 4.2) rotate(9)">
          <circle cx="0" cy="11.5" r="10" fill="url(#c9-glow-red)"/>
          <use href="#c9-glass" fill="#d42b38" stroke="#8a1822" stroke-width="0.6"/>
          <use href="#c9-shine"/><use href="#c9-dot"/><use href="#c9-socket"/>
        </g>
        <g transform="translate(60 6.8) rotate(3)">
          <circle cx="0" cy="11.5" r="10.5" fill="url(#c9-glow-gold)"/>
          <use href="#c9-glass" fill="#ebb02d" stroke="#9e6d0e" stroke-width="0.6"/>
          <use href="#c9-shine"/><use href="#c9-dot"/><use href="#c9-socket"/>
        </g>
        <g transform="translate(100 7.5) rotate(0)">
          <circle cx="0" cy="11.5" r="10" fill="url(#c9-glow-green)"/>
          <use href="#c9-glass" fill="#218c54" stroke="#115431" stroke-width="0.6"/>
          <use href="#c9-shine"/><use href="#c9-dot"/><use href="#c9-socket"/>
        </g>
        <g transform="translate(140 6.8) rotate(-3)">
          <circle cx="0" cy="11.5" r="10" fill="url(#c9-glow-blue)"/>
          <use href="#c9-glass" fill="#2d74b8" stroke="#1a4773" stroke-width="0.6"/>
          <use href="#c9-shine"/><use href="#c9-dot"/><use href="#c9-socket"/>
        </g>
        <g transform="translate(180 4.2) rotate(-9)">
          <circle cx="0" cy="11.5" r="10" fill="url(#c9-glow-orange)"/>
          <use href="#c9-glass" fill="#e56d29" stroke="#994010" stroke-width="0.6"/>
          <use href="#c9-shine"/><use href="#c9-dot"/><use href="#c9-socket"/>
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="30" fill="url(#c9-garland-tile)"/>
  `;
  host.append(svg);
  return host;
}

const GARLAND_ATTR = 'data-theme-garland';

/** Mount decorative theme garlands once on document.body; CSS toggles visibility by html[data-theme]. */
export function ensureThemeGarland() {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.body.querySelector(`[${GARLAND_ATTR}]`)) return;
  const garland = createFiresideGarland();
  garland.setAttribute(GARLAND_ATTR, 'fireside');
  document.body.prepend(garland);
}
