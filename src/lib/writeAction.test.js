import { describe, expect, it, vi } from 'vitest';
import { writeActionProps } from './writeAction.js';

// adr/0034 criteria 11-12: a commit action is always rendered and goes inert
// until write access is confirmed.

describe('writeActionProps', () => {
  const label = 'New type';
  const offTip = 'Editing is off';

  it('passes the handler through when write access is confirmed', () => {
    const onClick = vi.fn();
    const props = writeActionProps('on', onClick, label, offTip);
    expect(props.onClick).toBe(onClick);
    expect(props['aria-disabled']).toBeUndefined();
    expect(props['data-tip']).toBe(label);
  });

  it.each(/** @type {const} */ (['off', 'pending']))('swallows the click when write is %s', (state) => {
    const onClick = vi.fn();
    const props = writeActionProps(state, onClick, label, offTip);
    const e = { preventDefault: vi.fn() };
    props.onClick(e);
    // `aria-disabled` is advisory — without swallowing it here the handler would
    // still fire on click and on Enter.
    expect(onClick).not.toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(props['aria-disabled']).toBe('true');
  });

  it('tips only once the answer is settled', () => {
    expect(writeActionProps('off', () => {}, label, offTip)['data-tip']).toBe(offTip);
    // In flight there is nothing true to say yet.
    expect(writeActionProps('pending', () => {}, label, offTip)['data-tip']).toBeUndefined();
  });

  it('drops the tooltip class along with the tip', () => {
    // `.tt` paints `attr(data-tip)` unconditionally, so keeping the class
    // without a tip renders an empty bubble on hover — visible during a slow
    // capability probe, which is exactly when nothing should appear.
    expect(writeActionProps('pending', () => {}, label, offTip).className).not.toMatch(/\btt\b/);
    expect(writeActionProps('off', () => {}, label, offTip).className).toMatch(/\btt\b/);
    expect(writeActionProps('on', () => {}, label, offTip).className).toMatch(/\btt\b/);
  });

  it('normalises the class list', () => {
    // Call sites compose these from template strings with conditional segments,
    // so an unselected modifier leaves a gap that would otherwise reach the DOM.
    expect(writeActionProps('on', () => {}, label, offTip, 'badge share-btn  ').className)
      .toBe('badge share-btn tt');
    expect(writeActionProps('pending', () => {}, label, offTip, '').className).toBe('');
  });

  it('keeps the control its own classes in every state', () => {
    for (const state of /** @type {const} */ (['on', 'off', 'pending'])) {
      expect(writeActionProps(state, () => {}, label, offTip, 'group-action').className)
        .toMatch(/\bgroup-action\b/);
    }
  });

  it('never sets the disabled attribute, which would suppress the tooltip', () => {
    for (const state of /** @type {const} */ (['on', 'off', 'pending'])) {
      expect(writeActionProps(state, () => {}, label, offTip).disabled).toBeUndefined();
    }
  });

  it('keeps the accessible name in every state', () => {
    for (const state of /** @type {const} */ (['on', 'off', 'pending'])) {
      expect(writeActionProps(state, () => {}, label, offTip)['aria-label']).toBe(label);
    }
  });
});
