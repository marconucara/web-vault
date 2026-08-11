// Props for a control that commits (adr/0034-*.md, criteria 11-12).
//
// The control is ALWAYS rendered. Withholding it until the capability endpoint
// answers made it arrive late, which reflowed everything below it — the Types
// heading grew and pushed the type rows down, the note list header did the same.
// Presence is unconditional so the answer landing changes state and nothing else.
//
// Inert is `aria-disabled`, never the `disabled` attribute: `disabled`
// suppresses the hover and focus events the tooltip renders on, leaving the
// control mute exactly when it is asked to explain itself. The click is stopped
// here instead.
//
// `writeState` is one of:
//   'on'      — write access confirmed; the control is live.
//   'off'     — confirmed unavailable; inert, and tipped, since there is now
//               something true to say.
//   'pending' — the probe is in flight; inert and untipped. It lasts a moment
//               and naming it would claim a settled answer we do not have.

/**
 * @param {'on' | 'off' | 'pending'} writeState
 * @param {(...args: any[]) => void} onClick
 * @param {string} label - the control's own name, used when it is live
 * @param {string} offTip - what to say once write access is known to be absent
 * @param {string} [className] - the control's own classes, without `tt`
 * @returns {Record<string, any>}
 */
export function writeActionProps(writeState, onClick, label, offTip, className = '') {
  // `.tt` renders `attr(data-tip)` unconditionally, so the class and the tip are
  // one decision: carrying `tt` without a `data-tip` paints an empty bubble on
  // hover. The helper owns the class for that reason — leaving it to each call
  // site is what produced exactly that bug in the `pending` state.
  const tip = writeState === 'on' ? label : writeState === 'off' ? offTip : null;
  // Normalised: call sites build these from template strings with conditional
  // segments, so the raw join carries doubled and trailing spaces into the DOM.
  const cls = [className, tip ? 'tt' : ''].join(' ').trim().replace(/\s+/g, ' ');

  if (writeState === 'on') {
    return { onClick, 'data-tip': tip, 'aria-label': label, className: cls };
  }
  return {
    // Swallowed rather than omitted: `aria-disabled` is advisory, so without
    // this the handler would still fire on click and on Enter.
    onClick: (/** @type {any} */ e) => e.preventDefault(),
    'aria-disabled': 'true',
    // The name stays the control's own — the tip explains the state, and
    // overwriting the accessible name with it would leave the control unnamed.
    'aria-label': label,
    className: cls,
    ...(tip ? { 'data-tip': tip } : {}),
  };
}
