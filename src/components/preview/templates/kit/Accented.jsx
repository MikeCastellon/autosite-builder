import { splitAccent } from './content.js';

// Heading text with its accent phrase (copy.sectionTitles[id].accent, or the
// design's default) wrapped in an element the theme colors: <span
// className="rl-em">, <em>, ... The phrase must match whole words of the
// title (splitAccent); otherwise the title renders as plain text, so a stale
// accent never breaks a heading. Pure markup, no hooks.
//   <Accented title="Choose Your Package" accent="Your Package" className="ds-em" />
//   <Accented title={t} accent={a} as="em" />
export function Accented({ title, accent, className, as: Tag = 'span' }) {
  const parts = splitAccent(title, accent);
  if (!parts) return title;
  return (
    <>
      {parts.before}
      <Tag className={className}>{parts.match}</Tag>
      {parts.after}
    </>
  );
}

export default Accented;
