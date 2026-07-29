import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Icon from './Icon.jsx';

// Body rendering like Tolaria: standard markdown, with media links rendered as
// players/images and file links as downloadable cards. Wikilinks are already
// transformed into hash links (#/n/...) before reaching here.
const VIDEO = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac']);
const FILE = new Set([
  'pdf', 'log', 'txt', 'zip', 'rar', '7z', 'gz', 'doc', 'docx', 'xls', 'xlsx',
  'ppt', 'pptx', 'csv', 'json', 'yml', 'yaml',
]);

function extOf(href) {
  const clean = String(href).split(/[?#]/)[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

function MdLink({ href = '', children, ...props }) {
  // Internal links (notes/anchors) and mailto: left unchanged.
  if (!href || href.startsWith('#') || href.startsWith('mailto:')) {
    return <a href={href} {...props}>{children}</a>;
  }
  const ext = extOf(href);
  if (VIDEO.has(ext)) {
    return <video className="md-video" src={href} controls preload="metadata" />;
  }
  if (AUDIO.has(ext)) {
    return <audio className="md-audio" src={href} controls preload="metadata" />;
  }
  if (FILE.has(ext)) {
    return (
      <a className="file-card" href={href} target="_blank" rel="noopener noreferrer">
        <Icon name="file-text" size={16} />
        <span className="file-card-name">{children}</span>
      </a>
    );
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
}

function MdImg({ src = '', alt = '', ...props }) {
  return <img src={src} alt={alt} loading="lazy" {...props} />;
}

const COMPONENTS = { a: MdLink, img: MdImg };

export default function Markdown({ children }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
}
