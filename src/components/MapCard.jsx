import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { maps } from '../content.js';
import {
  parseMapCardLine,
  markerColor,
  placeText,
  buildMapCardLine,
  encodeMapToken,
  decodeMapToken,
} from '../lib/mdLinks.js';
import { parseInline } from '../lib/inlineText.js';

// Reads the ⟬…⟭ token payload (the original line, url-encoded) and parses it
// back into { marker, num, url, label, desc }.
function parseToken(token) {
  const line = decodeMapToken(token);
  return parseMapCardLine(line) || { marker: null, num: null, url: line, label: null, desc: '' };
}

// The description's inline emphasis (adr/0049-*.md AC 7). Rendered as spans
// rather than <strong>/<em> elements would be: the card is an <a>, and these are
// phrasing content, so they nest legally inside it.
function Inline({ text }) {
  return (
    <>
      {parseInline(text).map((tok, i) => {
        if (tok.type === 'strong') return <strong key={i}>{tok.value}</strong>;
        if (tok.type === 'em') return <em key={i}>{tok.value}</em>;
        if (tok.type === 'code') return <code key={i}>{tok.value}</code>;
        if (tok.type === 'strike') return <del key={i}>{tok.value}</del>;
        return <React.Fragment key={i}>{tok.value}</React.Fragment>;
      })}
    </>
  );
}

// Keyless OpenStreetMap embed, kept for a future "map mode" (a toolbar switch
// that shows ALL the map links of a note on one map). Not used in the body card.
export function osmSrc(lat, lng) {
  const d = 0.0035;
  const bbox = `${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

export function MapEmbed({ lat, lng, title }) {
  const { t } = useTranslation();
  return (
    <iframe
      className="mapcard-map"
      // NOT a tooltip: an `<iframe>`'s `title` is what names the frame to a
      // screen reader. Converting it to `.tt` would be a bug, not a migration.
      title={title || t('mapCard.mapFrame')}
      src={osmSrc(lat, lng)}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

// Marker: a red map pin (teardrop). In an ordered list it carries the item
// number (kept upright); otherwise a white dot. The inner span counter-rotates
// so the content is not skewed by the teardrop's rotation.
function Pin({ num, color }) {
  return (
    <span className="mapcard-pin" style={color ? { background: color } : undefined}>
      <span className="mapcard-pin-in">
        {num != null ? num : <span className="mapcard-pin-dot" />}
      </span>
    </span>
  );
}

// Floating editor: URL + Title + Description, the three fields the line can
// carry (adr/0049-*.md AC 5). An empty title means NO override — the card falls
// back to the resolved place name — so the field is seeded with the author's own
// link text, never with the name Maps resolved: pre-filling it with the latter
// would turn "no override" into an override the moment anything else was saved.
function EditPopover({ url, title, desc, onSave, onRemove, onOpen, onClose }) {
  const { t } = useTranslation();
  const [u, setU] = useState(url);
  const [ti, setTi] = useState(title);
  const [d, setD] = useState(desc);
  const stop = (e) => e.stopPropagation();
  // Keep keys away from the editor; Enter saves (unless a button is focused),
  // Esc cancels.
  const onKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      onSave(u, ti, d);
    }
  };
  return (
    <>
      <div className="mapcard-edit-backdrop" onMouseDown={onClose} />
      <div
        className="mapcard-edit"
        contentEditable={false}
        onMouseDown={stop}
        onPointerDown={stop}
        onKeyDown={onKeyDown}
      >
        <label className="mapcard-edit-row">
          <span>{t('mapCard.url')}</span>
          <input value={u} onChange={(e) => setU(e.target.value)} spellCheck={false} autoFocus />
        </label>
        <label className="mapcard-edit-row">
          <span>{t('mapCard.title')}</span>
          <input value={ti} onChange={(e) => setTi(e.target.value)} placeholder={t('mapCard.titlePlaceholder')} />
        </label>
        <label className="mapcard-edit-row">
          <span>{t('mapCard.description')}</span>
          <input value={d} onChange={(e) => setD(e.target.value)} placeholder={t('mapCard.descriptionPlaceholder')} />
        </label>
        <div className="mapcard-edit-actions">
          <button type="button" onClick={onOpen}>{t('common.open')}</button>
          <button type="button" className="danger" onClick={onRemove}>{t('mapCard.remove')}</button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="primary" onClick={() => onSave(u, ti, d)}>{t('common.save')}</button>
        </div>
      </div>
    </>
  );
}

// Compact place-preview card for a Google Maps link that starts its own line
// (paragraph or list item). Data (address, photo, rating, category) is resolved
// at build time from the Open Graph preview; no API key. The card's NAME and its
// description are the author's, per adr/0049-*.md: the link text titles the
// card, the text after it describes the place, and the resolved place name is
// the fallback for a link the author did not name. `editor`/`block` are passed
// by the BlockNote block spec and enable in-place editing.
export default function MapCard({ token, group = 0, editor, block }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const parsed = parseToken(token);
  const { marker, num, url, label } = parsed;
  const info = maps[url] || {};
  const { title, note } = placeText(parsed, info);
  const meta = [info.category, info.address].filter(Boolean).join(' · ') || null;
  const rating = info.ratingStars ? '★'.repeat(info.ratingStars) : null;
  const canEdit = !!(editor && block);

  const openLink = () => window.open(url, '_blank', 'noopener,noreferrer');

  // Normal click opens the in-place editor; Cmd/Ctrl+click opens the link.
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey) return; // let the anchor open in a new tab
    e.preventDefault();
    if (canEdit) setEditing(true);
  };

  const onSave = (newUrl, newTitle, newDesc) => {
    const line = buildMapCardLine({
      marker,
      num,
      url: newUrl.trim() || url,
      title: newTitle,
      desc: newDesc,
    });
    editor.updateBlock(block, { props: { token: encodeMapToken(line) } });
    setEditing(false);
  };
  const onRemove = () => {
    editor.removeBlocks([block]);
  };

  return (
    <span className="mapcard-wrap" contentEditable={false}>
      <a
        className="mapcard"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        // Native `title`: the card is full-width and stacked against the next
        // one, so a bubble anchored under it lands on that neighbour. The card
        // already shows its own title and address — the tip only names the
        // action, and is not worth covering the list for.
        title={t('mapCard.openTip')}
        onClick={onClick}
      >
        <Pin num={marker === 'ordered' ? num : null} color={markerColor(group)} />
        <span className="mapcard-body">
          <span className="mapcard-title">{title}</span>
          {meta && <span className="mapcard-sub">{meta}</span>}
          {note && <span className="mapcard-sub mapcard-note"><Inline text={note} /></span>}
          {rating && <span className="mapcard-rating">{rating}</span>}
        </span>
        {info.image && (
          <span className="mapcard-thumb">
            <img src={info.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </span>
        )}
      </a>
      {editing && (
        <EditPopover
          url={url}
          // The author's own two fields, exactly as written — NOT the rendered
          // title, which may have fallen back to the resolved place name.
          title={label || ''}
          desc={parsed.desc || ''}
          onSave={onSave}
          onRemove={onRemove}
          onOpen={openLink}
          onClose={() => setEditing(false)}
        />
      )}
    </span>
  );
}
