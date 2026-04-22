import { Fragment } from 'react';

// Order matters: bold before italic (both use asterisks).
const TOKEN_REGEX = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderSegment(segment, key) {
  if (segment.startsWith('**') && segment.endsWith('**')) {
    return <strong key={key}>{segment.slice(2, -2)}</strong>;
  }
  if (segment.startsWith('*') && segment.endsWith('*')) {
    return <em key={key}>{segment.slice(1, -1)}</em>;
  }
  if (segment.startsWith('`') && segment.endsWith('`')) {
    return <code key={key}>{segment.slice(1, -1)}</code>;
  }
  return <Fragment key={key}>{segment}</Fragment>;
}

function renderParagraph(text, keyPrefix) {
  const parts = text.split(TOKEN_REGEX).filter(Boolean);
  return parts.map((part, i) => renderSegment(part, `${keyPrefix}-${i}`));
}

export function formatInline(str) {
  if (!str) return [];
  const paragraphs = str.split('\n\n');
  if (paragraphs.length === 1) {
    return renderParagraph(paragraphs[0], '0');
  }
  return paragraphs.map((p, i) => <p key={`p-${i}`}>{renderParagraph(p, `p${i}`)}</p>);
}
