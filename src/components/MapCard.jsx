import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { maps } from '../content.js';
import { parseMapCardLine, markerColor } from '../lib/mdLinks.js';

// Reads the ⟬…⟭ token payload (the original line, url-encoded) and parses it
// back into { marker, num, url, label, desc }.
function parseToken(token) {
  let line = token;
  try {
    line = decodeURIComponent(token);
  } catch {
    /* keep raw */
  }
  return parseMapCardLine(line) || { marker: null, num: null, url: line, label: null, desc: '' };
}

// Rebuild a map card markdown line from edited fields, preserving the list
// marker/number. The user's description is stored as the link label.
function buildLine(marker, num, url, desc) {
  const prefix = marker === 'ordered' ? `${num || 1}. ` : marker === 'unordered' ? '- ' : '';
  const d = (desc || '').trim();
  return prefix + (d ? `[${d}](${url})` : url);
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

// Floating editor: URL + Description (the user's note). Title comes from Maps
// (resolved at build time), so it is not editable here.
function EditPopover({ url, desc, onSave, onRemove, onOpen, onClose }) {
  const { t } = useTranslation();
  const [u, setU] = useState(url);
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
      onSave(u, d);
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
          <span>{t('mapCard.description')}</span>
          <input value={d} onChange={(e) => setD(e.target.value)} placeholder={t('mapCard.descriptionPlaceholder')} />
        </label>
        <div className="mapcard-edit-actions">
          <button type="button" onClick={onOpen}>{t('common.open')}</button>
          <button type="button" className="danger" onClick={onRemove}>{t('mapCard.remove')}</button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>{t('common.cancel')}</button>
          <button type="button" className="primary" onClick={() => onSave(u, d)}>{t('common.save')}</button>
        </div>
      </div>
    </>
  );
}

// Compact place-preview card for a Google Maps link that starts its own line
// (paragraph or list item). Data (name, address, photo, rating, category) is
// resolved at build time from the Open Graph preview; no API key. The title is
// ALWAYS the Maps place name; any text the user wrote in the link is shown as a
// description line below. `editor`/`block` are passed by the BlockNote block
// spec and enable in-place editing.
export default function MapCard({ token, group = 0, editor, block }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const { marker, num, url, label, desc } = parseToken(token);
  const info = maps[url] || {};
  const title = info.title || label || 'Google Maps';
  const meta = [info.category, info.address].filter(Boolean).join(' · ') || null;
  // The user's own text: trailing text, or the label (unless the label is
  // already used as the title because Maps didn't resolve a name).
  const note = desc || (info.title ? label : null);
  const rating = info.ratingStars ? '★'.repeat(info.ratingStars) : null;
  const canEdit = !!(editor && block);

  const openLink = () => window.open(url, '_blank', 'noopener,noreferrer');

  // Normal click opens the in-place editor; Cmd/Ctrl+click opens the link.
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey) return; // let the anchor open in a new tab
    e.preventDefault();
    if (canEdit) setEditing(true);
  };

  const onSave = (newUrl, newDesc) => {
    const line = buildLine(marker, num, newUrl.trim() || url, newDesc);
    editor.updateBlock(block, { props: { token: encodeURIComponent(line) } });
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
          {note && <span className="mapcard-sub mapcard-note">{note}</span>}
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
          desc={note || ''}
          onSave={onSave}
          onRemove={onRemove}
          onOpen={openLink}
          onClose={() => setEditing(false)}
        />
      )}
    </span>
  );
}
