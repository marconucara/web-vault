import React from 'react';

// The WebVault mark. Same geometry as brand/mark.svg — the committed SVG is the
// authoritative form; this is that drawing inlined so it can take currentColor
// (see adr/0042-brand-identity-and-logo.md).
//
// One drawing for both themes, no per-theme variant: the brackets and the round
// node carry the brand accent, while the connector and the square node inherit
// the surrounding text colour, so the mark re-inks itself wherever it is placed.
// It is not part of the Icon.jsx set: those are uniform 24px monochrome line
// icons, this is a two-weight, two-colour mark on a 32-unit grid.
export default function BrandMark({ size = 20, title = 'WebVault' }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label={title}
    >
      <g
        stroke="var(--wv-brand)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4.65 16.65V4.55H7.65" />
        <path d="M25.15 4.55H28.35V8.9" />
        <path d="M28.35 12.6V27.45H25.3" />
      </g>
      <circle cx="5.1" cy="22.4" r="2.7" fill="var(--wv-brand)" />
      <path
        d="M8.05 19.4L12.67 13.46H21.9V21.25H23.35"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="10.62" y="11.41" width="4.1" height="4.1" rx="0.9" fill="currentColor" />
    </svg>
  );
}
