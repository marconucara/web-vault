import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from './Icon.jsx';
import { maps } from '../content.js';
import { parseMapCardLine, createMapGrouper, createColorAssigner, markerColor } from '../lib/mdLinks.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Collect every map card point of a note body, in order of appearance, each
// tagged with the heading (markdown section) it sits under. Returns
// { points, missing }: points have resolved coordinates; missing are map links
// that didn't resolve to a location (shown as a small notice).
export function collectPoints(body) {
  const points = [];
  const missing = [];
  let inFence = false;
  let heading = null;
  const grouper = createMapGrouper();
  const colorOf = createColorAssigner();
  for (const line of (body || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      grouper(line); // keep grouping in sync with the body pre-processor
      continue;
    }
    if (inFence) continue;
    const rawGroup = grouper(line) || 0;
    const hm = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (hm) {
      heading = hm[1].trim();
      continue;
    }
    const parsed = parseMapCardLine(line);
    if (!parsed) continue;
    const color = markerColor(colorOf(rawGroup));
    const info = maps[parsed.url] || {};
    const note = parsed.desc || (info.title ? parsed.label : null);
    const title = info.title || parsed.label || 'Google Maps';
    if (Number.isFinite(info.lat) && Number.isFinite(info.lng)) {
      points.push({
        lat: info.lat,
        lng: info.lng,
        num: parsed.marker === 'ordered' ? parsed.num : null,
        color,
        title,
        address: info.address || null,
        image: info.image || null,
        note: note || null,
        url: parsed.url,
        heading: heading || null,
      });
    } else {
      missing.push(title);
    }
  }
  return { points, missing };
}

// Distinct headings that contain points, in order of first appearance, each with
// the distinct marker colors used under it (usually one). `label` stays null for
// points under no heading: the stand-in text is UI copy and belongs at render,
// not baked into the data here.
function headingsOf(points) {
  const byKey = new Map();
  const order = [];
  for (const p of points) {
    const key = p.heading || '';
    if (!byKey.has(key)) {
      byKey.set(key, { key, label: p.heading || null, colors: [] });
      order.push(key);
    }
    const h = byKey.get(key);
    if (p.color && !h.colors.includes(p.color)) h.colors.push(p.color);
  }
  return order.map((k) => byKey.get(k));
}

// Spread markers that share the exact same coordinates (a place linked more than
// once) by a tiny offset, so each one stays clickable instead of hiding behind
// the others.
function spread(points) {
  const seen = new Map();
  return points.map((p) => {
    const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (n === 0) return p;
    const angle = (n * 137.5 * Math.PI) / 180; // golden-angle spiral
    const r = 0.00007 * n;
    return { ...p, lat: p.lat + r * Math.cos(angle), lng: p.lng + r * Math.sin(angle) };
  });
}

function pinHtml(num, color) {
  const inner = num != null ? esc(num) : '<span class="mapcard-pin-dot"></span>';
  const style = color ? ` style="background:${esc(color)}"` : '';
  return `<span class="mapview-pin"${style}><span class="mapcard-pin-in">${inner}</span></span>`;
}

function popupHtml(p) {
  const img = p.image ? `<img class="mapview-popup-img" src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">` : '';
  const addr = p.address ? `<div class="mapview-popup-sub">${esc(p.address)}</div>` : '';
  const note = p.note ? `<div class="mapview-popup-note">${esc(p.note)}</div>` : '';
  return (
    `<a class="mapview-popup" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${img}` +
    `<div class="mapview-popup-body"><div class="mapview-popup-title">${esc(p.title)}</div>${addr}${note}</div></a>`
  );
}

// Fit the view to the shown points, reserving room on the right for the open
// sidebar so markers don't hide behind it.
function fit(map, latlngs, panelOpen) {
  const rightPad = panelOpen ? 240 : 48;
  if (latlngs.length > 1) {
    map.fitBounds(latlngs, { paddingTopLeft: [48, 48], paddingBottomRight: [rightPad, 48] });
  } else if (latlngs.length === 1) {
    map.setView(latlngs[0], 15);
    if (panelOpen) map.panBy([120, 0], { animate: false }); // shift the pin left of the sidebar
  } else {
    map.setView([41.9, 12.5], 5); // no points: rough Italy view
  }
}

// Fullscreen Leaflet map with all the note's points (keyless OSM tiles). A
// right-hand sidebar (toggled from inside the map) lists the note's headings; it
// is exclusive — clicking one shows only that section's markers and recenters
// the map, and "All markers" restores the full set.
export default function MapView({ body }) {
  const { t } = useTranslation();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [selected, setSelected] = useState(null); // heading key, or null = all
  const [panelOpen, setPanelOpen] = useState(false);

  const { points, missing } = collectPoints(body);
  const headings = headingsOf(points);

  // Create the map once per mount.
  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: true, scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // (Re)draw markers whenever the body or the selected heading changes, and
  // recenter on the shown subset.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const shown = selected == null ? points : points.filter((p) => (p.heading || '') === selected);
    const latlngs = [];
    for (const p of spread(shown)) {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'mapview-pin-icon',
          html: pinHtml(p.num, p.color),
          iconSize: [24, 24],
          iconAnchor: [12, 24],
          popupAnchor: [0, -24],
        }),
      });
      marker.bindPopup(popupHtml(p), { minWidth: 220, closeButton: true });
      marker.addTo(layer);
      latlngs.push([p.lat, p.lng]);
    }
    fit(map, latlngs, panelOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, selected, panelOpen]);

  const pick = (key) => {
    setSelected(key);
  };

  return (
    <div className="mapview">
      <div className="mapview-map" ref={elRef} />

      {headings.length > 0 && !panelOpen && (
        <button
          className="mapview-panel-toggle"
          onClick={() => setPanelOpen(true)}
          aria-label={t('mapView.sections')}
          title={t('mapView.sections')}
        >
          <Icon name="list" size={16} />
        </button>
      )}

      {panelOpen && (
        <div className="mapview-panel">
          <div className="mapview-panel-head">
            <button onClick={() => setPanelOpen(false)} aria-label={t('common.close')}>
              <Icon name="x" size={15} />
            </button>
          </div>
          <ul className="mapview-panel-list">
            <li>
              <button className={selected == null ? 'active' : ''} onClick={() => pick(null)}>
                {t('mapView.allMarkers')}
              </button>
            </li>
            {headings.map((h) => (
              <li key={h.key}>
                <button className={selected === h.key ? 'active' : ''} onClick={() => pick(h.key)}>
                  <span className="mapview-panel-dots">
                    {h.colors.map((c, i) => (
                      <span key={i} className="mapview-panel-dot" style={{ background: c }} />
                    ))}
                  </span>
                  {h.label ?? t('mapView.noHeading')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {points.length === 0 && <div className="mapview-empty">{t('mapView.empty')}</div>}
      {missing.length > 0 && (
        <div className="mapview-missing">
          {t('mapView.missing', { count: missing.length })}
        </div>
      )}
    </div>
  );
}
