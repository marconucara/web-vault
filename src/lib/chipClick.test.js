import { describe, expect, it } from 'vitest';
import { chipClickIntent, isChipAuxClick } from './chipClick.js';

// A left click with no modifier, as a plain MouseEvent carries it.
const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false };

describe('chipClickIntent', () => {
  it('navigates in-app on a plain left click', () => {
    expect(chipClickIntent(plain)).toBe('navigate');
  });

  // A tap arrives as a left click with no modifier — the whole point of the
  // change, since a touch device has no Cmd/Ctrl to offer.
  it('navigates on a tap, which has no modifier to give', () => {
    expect(chipClickIntent({ button: 0 })).toBe('navigate');
  });

  for (const mod of ['metaKey', 'ctrlKey', 'shiftKey']) {
    it(`opens a new tab on ${mod}+left click`, () => {
      expect(chipClickIntent({ ...plain, [mod]: true })).toBe('new-tab');
    });
  }

  it('opens a new tab on middle click', () => {
    expect(chipClickIntent({ ...plain, button: 1 })).toBe('new-tab');
  });

  it('ignores a right click, leaving the browser context menu alone', () => {
    expect(chipClickIntent({ ...plain, button: 2 })).toBe('ignore');
  });

  // A chip listens on click AND auxclick, so a gesture claimed by both handlers
  // would act twice — two tabs from one middle click. The two must partition the
  // buttons between them, whatever the browser chooses to deliver.
  it('routes each button to exactly one of the two handlers', () => {
    for (const button of [0, 1, 2]) {
      const e = { ...plain, button };
      const claimedByAux = isChipAuxClick(e);
      const claimedByClick = !claimedByAux;
      expect(claimedByAux && claimedByClick).toBe(false);
      expect(claimedByAux || claimedByClick).toBe(true);
    }
  });

  it('gives the middle button to auxclick and no other button', () => {
    expect(isChipAuxClick({ ...plain, button: 1 })).toBe(true);
    expect(isChipAuxClick({ ...plain, button: 0 })).toBe(false);
    expect(isChipAuxClick({ ...plain, button: 2 })).toBe(false);
  });

  it('ignores every gesture on an unresolved target', () => {
    const gestures = [
      plain,
      { ...plain, metaKey: true },
      { ...plain, ctrlKey: true },
      { ...plain, shiftKey: true },
      { ...plain, button: 1 },
      { ...plain, button: 2 },
    ];
    for (const g of gestures) expect(chipClickIntent(g, false)).toBe('ignore');
  });
});
