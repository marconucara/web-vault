import { useState } from "react";

/* ------------------------------------------------------------------
 * WebVault brand mark (ADR 0042 r3)
 *
 * Geometry reconstructed by measuring the brand reference sheet:
 * bracket stroke and path stroke are two different weights (roughly
 * 3:2), the framing is a tall short-armed corner on the left and a
 * split bracket on the right, and the connector floats free of the
 * terminal node rather than touching it.
 *
 * Brackets and terminal node carry the accent; the connector and the
 * square node inherit currentColor, so one asset covers both themes.
 * ------------------------------------------------------------------ */

export const BRAND = "#3B82F6";

export const WEIGHTS = {
  reference: { brand: 2.15, ink: 1.4 }, // matches the reference sheet
  bold: { brand: 2.5, ink: 1.8 }, // holds up better at 16 px
};

export const GEOMETRY = {
  viewBox: "0 0 32 32",
  bracketL: "M4.65 16.65V4.55H7.65",
  bracketRTop: "M25.15 4.55H28.35V8.9",
  bracketRBottom: "M28.35 12.6V27.45H25.3",
  bracketRSolid: "M25.15 4.55H28.35V27.45H25.3",
  connector: "M8.05 19.4L12.67 13.46H21.9V21.25H23.35",
  node: { cx: 5.1, cy: 22.4, r: 2.7 },
  square: { x: 10.62, y: 11.41, w: 4.1, h: 4.1, rx: 0.9 },
};

export function WebVaultMark({
  size = 64,
  accent = "var(--wv-brand, #3B82F6)",
  ink = "currentColor",
  weight = "reference",
  split = true,
  title = "WebVault",
  ...rest
}) {
  const g = GEOMETRY;
  const w = WEIGHTS[weight] ?? WEIGHTS.reference;
  return (
    <svg
      width={size}
      height={size}
      viewBox={g.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      {...rest}
    >
      <g
        stroke={accent}
        strokeWidth={w.brand}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={g.bracketL} />
        {split ? (
          <>
            <path d={g.bracketRTop} />
            <path d={g.bracketRBottom} />
          </>
        ) : (
          <path d={g.bracketRSolid} />
        )}
      </g>
      <circle cx={g.node.cx} cy={g.node.cy} r={g.node.r} fill={accent} />
      <path
        d={g.connector}
        stroke={ink}
        strokeWidth={w.ink}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x={g.square.x}
        y={g.square.y}
        width={g.square.w}
        height={g.square.h}
        rx={g.square.rx}
        fill={ink}
      />
    </svg>
  );
}

/* Single colour cut: masks, Safari pinned tab, stencil contexts. */
export function WebVaultMarkMono({ size = 64, ...rest }) {
  return <WebVaultMark size={size} accent="currentColor" {...rest} />;
}

export function WebVaultLockup({ size = 40, className = "", ...rest }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <WebVaultMark size={size} {...rest} />
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: size * 0.62 }}
      >
        WebVault
      </span>
    </span>
  );
}

/* ---------------------------- favicon ---------------------------- */
/* Emitted from the constants above, so the tab icon cannot drift from
   the in-app mark. */

const g = GEOMETRY;

export const faviconSource = ({ weight = "reference", split = true } = {}) => {
  const w = WEIGHTS[weight] ?? WEIGHTS.reference;
  const right = split
    ? `<path d="${g.bracketRTop}"/><path d="${g.bracketRBottom}"/>`
    : `<path d="${g.bracketRSolid}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${g.viewBox}" fill="none">
  <style>
    :root { --wv-brand: ${BRAND}; --wv-ink: #171717; }
    @media (prefers-color-scheme: dark) { :root { --wv-ink: #E5E7EB; } }
  </style>
  <g stroke="var(--wv-brand)" stroke-width="${w.brand}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${g.bracketL}"/>${right}
  </g>
  <circle cx="${g.node.cx}" cy="${g.node.cy}" r="${g.node.r}" fill="var(--wv-brand)"/>
  <path d="${g.connector}" stroke="var(--wv-ink)" stroke-width="${w.ink}" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="${g.square.x}" y="${g.square.y}" width="${g.square.w}" height="${g.square.h}" rx="${g.square.rx}" fill="var(--wv-ink)"/>
</svg>`;
};

/* ------------------------- preview sheet ------------------------- */

function Panel({ dark, children, label }) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        dark
          ? "border-neutral-800 bg-neutral-950 text-neutral-200"
          : "border-neutral-200 bg-white text-neutral-900"
      }`}
    >
      <div
        className={`mb-6 text-[11px] font-medium uppercase tracking-widest ${
          dark ? "text-neutral-500" : "text-neutral-400"
        }`}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, options, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-neutral-500">{label}</span>
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          className={`rounded-md border px-3 py-1 text-xs ${
            value === o.v
              ? "border-blue-500 bg-blue-50 text-blue-600"
              : "border-neutral-200 bg-white text-neutral-500"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Sizes({ dark, ...cfg }) {
  return (
    <div className="flex items-end gap-6">
      {[96, 64, 32, 16].map((s) => (
        <div key={s} className="flex flex-col items-center gap-2">
          <div className="flex h-24 items-center">
            <WebVaultMark size={s} {...cfg} />
          </div>
          <span
            className={`text-[10px] tabular-nums ${
              dark ? "text-neutral-500" : "text-neutral-400"
            }`}
          >
            {s}px
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BrandSheet() {
  const [weight, setWeight] = useState("reference");
  const [split, setSplit] = useState(true);
  const [copied, setCopied] = useState(false);
  const cfg = { weight, split };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(faviconSource(cfg));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-neutral-100 p-6 text-neutral-900"
      style={{ "--wv-brand": BRAND }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-4 px-1">
          <WebVaultLockup size={36} {...cfg} />
          <div className="flex flex-wrap items-center gap-4">
            <Toggle
              label="weight"
              value={weight}
              onChange={setWeight}
              options={[
                { v: "reference", l: "reference" },
                { v: "bold", l: "bold" },
              ]}
            />
            <Toggle
              label="right bracket"
              value={split}
              onChange={setSplit}
              options={[
                { v: true, l: "split" },
                { v: false, l: "solid" },
              ]}
            />
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel label="Logo / light">
            <div className="flex items-center gap-5">
              <WebVaultMark size={96} {...cfg} />
              <span className="text-4xl font-semibold tracking-tight">
                WebVault
              </span>
            </div>
          </Panel>

          <Panel dark label="Logo / dark">
            <div className="flex items-center gap-5 text-neutral-200">
              <WebVaultMark size={96} {...cfg} />
              <span className="text-4xl font-semibold tracking-tight">
                WebVault
              </span>
            </div>
          </Panel>

          <Panel label="One geometry / every size">
            <Sizes {...cfg} />
          </Panel>

          <Panel dark label="One geometry / every size">
            <Sizes dark {...cfg} />
          </Panel>

          <Panel label="App icon">
            <div className="flex items-center gap-6">
              <div className="flex h-24 w-24 items-center justify-center rounded-[22px] bg-white shadow-sm ring-1 ring-neutral-200">
                <WebVaultMark size={68} {...cfg} />
              </div>
              <div className="flex h-24 w-24 items-center justify-center rounded-[22px] bg-neutral-900 text-neutral-200">
                <WebVaultMark size={68} {...cfg} />
              </div>
              <div className="flex h-24 w-24 items-center justify-center rounded-[22px] bg-blue-500 text-white">
                <WebVaultMark size={68} accent="#FFFFFF" {...cfg} />
              </div>
            </div>
          </Panel>

          <Panel label="Mono cut">
            <div className="flex items-center gap-8">
              <WebVaultMarkMono size={60} {...cfg} />
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-neutral-900 text-neutral-100">
                <WebVaultMarkMono size={46} {...cfg} />
              </div>
              <p className="max-w-xs text-xs leading-relaxed text-neutral-500">
                Same drawing, single value. Safari pinned tabs, stencils, and
                anywhere the accent cannot survive.
              </p>
            </div>
          </Panel>

          <Panel label="Browser tab">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex w-64 items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm">
                <WebVaultMark size={16} {...cfg} />
                <span className="text-sm text-neutral-700">WebVault</span>
                <span className="ml-auto text-neutral-400">&times;</span>
              </div>
            </div>
          </Panel>

          <Panel label="Sidebar mark">
            <div className="w-56 rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
                <WebVaultMark size={24} {...cfg} />
                <span className="text-sm font-semibold tracking-tight">
                  WebVault
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                {["Inbox", "Projects", "Areas", "Archive"].map((n, i) => (
                  <li
                    key={n}
                    className={`rounded px-2 py-1 ${
                      i === 1 ? "bg-neutral-100 text-neutral-900" : ""
                    }`}
                  >
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-widest text-neutral-400">
              favicon.svg
            </span>
            <button
              onClick={copy}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50"
            >
              {copied ? "Copied" : "Copy source"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-4 text-[11px] leading-relaxed text-neutral-700">
            {faviconSource(cfg)}
          </pre>
        </div>
      </div>
    </div>
  );
}
