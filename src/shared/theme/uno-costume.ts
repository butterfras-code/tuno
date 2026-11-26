const SVG_NS = 'http://www.w3.org/2000/svg';

function svgGroup(className: string, markup: string): SVGGElement {
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('class', className);
  group.innerHTML = markup;
  return group;
}

/**
 * Attach theme-scoped holiday SVG costume layers to articulated Uno.
 * Layers are hidden by default in CSS and revealed solely by html[data-theme='...'],
 * so switching themes never interrupts head nod, tail wag, or bone catch animations.
 */
export function attachUnoCostumes(parts: {
  frontHead: SVGGElement;
  leftHead: Element;
  sitBody: SVGGElement;
  restRoot: Element;
}) {
  // Fireside front head: Reindeer antlers + holly headband (300×300 sitting coordinate space).
  parts.frontHead.append(svgGroup('uno-costume uno-costume--fireside', `
    <path d="M122 46 C113 30 105 18 96 4 M109 25 C101 23 93 24 87 19 M114 19 C117 12 121 7 123 1" stroke="#7c4e2d" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M176 46 C185 30 193 18 202 4 M189 25 C197 23 205 24 211 19 M184 19 C181 12 177 7 175 1" stroke="#7c4e2d" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M102 54 C128 40 170 40 196 54" stroke="#8c2f39" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M149 45 C139 36 130 39 128 47 C135 50 143 49 149 45 Z" fill="#245e4b"/>
    <path d="M149 45 C159 36 168 39 170 47 C163 50 155 49 149 45 Z" fill="#245e4b"/>
    <circle cx="149" cy="45" r="4.5" fill="#d42b38"/>
    <circle cx="143.5" cy="48" r="3.5" fill="#a62632"/>
    <circle cx="154.5" cy="48" r="3.5" fill="#a62632"/>
  `));

  // Fireside left-looking head: Reindeer antlers + holly headband aligned to 160×146 left head pose.
  parts.leftHead.append(svgGroup('uno-costume uno-costume--fireside', `
    <path d="M68 14 C60 0 53 -10 45 -22 M57 -3 C50 -5 43 -4 38 -8 M61 -9 C64 -15 67 -19 69 -24" stroke="#7c4e2d" stroke-width="7.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M110 15 C119 1 126 -9 135 -21 M122 -2 C129 -4 136 -3 141 -7 M117 -8 C115 -14 112 -18 110 -23" stroke="#7c4e2d" stroke-width="7.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M49 23 C73 8 106 8 129 24" stroke="#8c2f39" stroke-width="8.2" stroke-linecap="round" fill="none"/>
    <path d="M89 13 C80 5 72 8 70 15 C76 18 83 17 89 13 Z" fill="#245e4b"/>
    <path d="M89 13 C98 5 106 8 108 15 C102 18 95 17 89 13 Z" fill="#245e4b"/>
    <circle cx="89" cy="13" r="4.2" fill="#d42b38"/>
    <circle cx="84" cy="15.8" r="3.2" fill="#a62632"/>
    <circle cx="94" cy="15.8" r="3.2" fill="#a62632"/>
  `));

  // Fireside sitting body: Pine-and-gold knitted scarf + gold jingle bell over Uno's collar.
  parts.sitBody.append(svgGroup('uno-costume uno-costume--fireside', `
    <path d="M167 160 L189 154 L196 204 L173 209 Z" fill="#245e4b"/>
    <path d="M170 174 H192 M172 190 H194" stroke="#c99a3b" stroke-width="4.5"/>
    <path d="M175 209 V216 M183 208 V215 M191 205 V213" stroke="#f5e3b9" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 144 C132 163 163 163 193 144 L197 161 C164 179 131 179 96 160 Z" fill="#245e4b"/>
    <path d="M107 154 C135 169 162 169 189 153" stroke="#8c2f39" stroke-width="5.5" stroke-dasharray="11 9" fill="none"/>
    <circle cx="147.2" cy="173" r="9.5" fill="#d9aa43" stroke="#8b6518" stroke-width="1.8"/>
    <path d="M141 174 Q147.2 178 153.4 174" stroke="#6f4d0e" stroke-width="2" stroke-linecap="round" fill="none"/>
    <circle cx="147.2" cy="175.5" r="2" fill="#6f4d0e"/>
  `));

  // Fireside resting pose (218×218): Snowy window flakes + mini wreath + resting reindeer antlers.
  parts.restRoot.append(svgGroup('uno-costume uno-costume--fireside', `
    <g fill="#ffffff" opacity="0.9">
      <circle cx="152" cy="38" r="2"/><circle cx="174" cy="48" r="1.8"/><circle cx="156" cy="58" r="1.6"/>
      <circle cx="177" cy="34" r="1.5"/><circle cx="149" cy="74" r="1.7"/><circle cx="170" cy="69" r="2"/>
    </g>
    <circle cx="164" cy="44" r="9" fill="none" stroke="#245e4b" stroke-width="4.5"/>
    <circle cx="164" cy="36" r="2.6" fill="#d42b38"/>
    <path d="M124 89 C119 77 114 69 109 61 M116 74 C111 73 106 74 102 70 M120 70 C122 65 125 62 126 58" stroke="#7c4e2d" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M145 87 C150 75 155 68 161 60 M153 73 C158 72 163 72 167 69 M149 69 C148 64 146 61 145 57" stroke="#7c4e2d" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M111 94 C126 83 144 82 159 93" stroke="#8c2f39" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M135 86 C129 80 123 82 122 87 C126 89 131 89 135 86 Z" fill="#245e4b"/>
    <path d="M135 86 C141 80 147 82 148 87 C144 89 139 89 135 86 Z" fill="#245e4b"/>
    <circle cx="135" cy="86" r="3" fill="#d42b38"/>
    <circle cx="131.5" cy="88" r="2.3" fill="#a62632"/>
    <circle cx="138.5" cy="88" r="2.3" fill="#a62632"/>
  `));
}
