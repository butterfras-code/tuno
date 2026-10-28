// CSS viewport pixels, not hardware resolution. See docs/responsive-design.md.
const profile = (id, width, height, hasTouch = false, provisional = false) =>
  Object.freeze({ id, viewport: Object.freeze({ width, height }), hasTouch, provisional });

export const primaryViewports = Object.freeze([
  profile('classroom', 1920, 1080),
  profile('chromebook', 1366, 650),
  profile('phone', 390, 844, true),
  profile('fold8-cover', 400, 650, true, true),
]);
export const secondaryViewports = Object.freeze([
  profile('classroom-small', 1280, 720),
  profile('chromebook-short', 1280, 600),
  profile('phone-small', 360, 640, true),
  profile('fold8-cover-short', 400, 550, true, true),
  profile('narrow', 320, 568, true),
  profile('phone-landscape', 844, 390, true),
  profile('tablet', 768, 1024, true),
  profile('fold8-inner', 768, 800, true, true),
]);
export const viewportProfiles = Object.freeze([...primaryViewports, ...secondaryViewports]);
