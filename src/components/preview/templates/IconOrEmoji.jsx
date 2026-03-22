// SVG icon paths (16x16 viewBox)
const SVG_ICONS = {
  'icon:check': 'M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z',
  'icon:shield': 'M8 1l6 2.5v4c0 3.5-2.5 6.5-6 7.5-3.5-1-6-4-6-7.5v-4L8 1z',
  'icon:star': 'M8 1.5l2 4.5 4.5.5-3.25 3 1 4.5L8 11.5 3.75 14l1-4.5L1.5 6.5 6 6z',
  'icon:clock': 'M8 14A6 6 0 108 2a6 6 0 000 12zm0-1A5 5 0 118 3a5 5 0 010 10zM8 4.5v4l2.5 1.5',
  'icon:phone': 'M5.5 1.5c-.3 0-.6.2-.7.4L3.5 4.5c-.1.3 0 .6.2.8l2 2-2.5 2.5 2 2c.2.2.5.3.8.2l2.6-1.3c.2-.1.4-.4.4-.7v-1.5l3 3v2c0 .6-.4 1-1 1C5.5 14.5 1.5 10.5 1.5 5c0-.6.4-1 1-1h2l3 3H6z',
  'icon:location': 'M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z',
  'icon:heart': 'M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5c1 0 2 .5 2.5 1.5.5-1 1.5-1.5 2.5-1.5C12 2.5 13.5 4 13.5 6.5 13.5 10.5 8 14 8 14z',
  'icon:bolt': 'M7 1l-5 8h5l-1 6 5-8H6l1-6z',
  'icon:car': 'M3 10.5v1a1 1 0 001 1h1a1 1 0 001-1v-1m4 0v1a1 1 0 001 1h1a1 1 0 001-1v-1M3.5 7l1-3.5h7L12.5 7m-9 0h9m-9 0a1.5 1.5 0 00-1.5 1.5v2h12v-2A1.5 1.5 0 0012.5 7',
  'icon:wrench': 'M10.5 2A3.5 3.5 0 007.3 6L2.5 10.8a1.5 1.5 0 002.1 2.1L9.4 8.1A3.5 3.5 0 0010.5 2z',
  'icon:cog': 'M8 10a2 2 0 100-4 2 2 0 000 4zm5.7-1.3l-1-.6a4.8 4.8 0 000-1.2l1-.6c.2-.1.3-.3.2-.5l-1-1.7c-.1-.2-.3-.3-.5-.2l-1 .6a4.8 4.8 0 00-1-.6l-.2-1.2c0-.2-.2-.3-.4-.3H7.2c-.2 0-.4.1-.4.3L6.6 4a4.8 4.8 0 00-1 .6l-1-.6c-.2-.1-.4 0-.5.2l-1 1.7c-.1.2 0 .4.2.5l1 .6a4.8 4.8 0 000 1.2l-1 .6c-.2.1-.3.3-.2.5l1 1.7c.1.2.3.3.5.2l1-.6a4.8 4.8 0 001 .6l.2 1.2c0 .2.2.3.4.3h1.6c.2 0 .4-.1.4-.3l.2-1.2a4.8 4.8 0 001-.6l1 .6c.2.1.4 0 .5-.2l1-1.7c.1-.2 0-.4-.2-.5z',
  'icon:truck': 'M1 3h9v7H1V3zm9 3h3l2 3v4h-2m-3 0H6m-3 0H1m12 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-9 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  'icon:dollar': 'M8 1v14m3-10.5c0-1.4-1.3-2.5-3-2.5S5 3.1 5 4.5 6.3 7 8 7s3 1.1 3 2.5S9.7 12 8 12s-3-1.1-3-2.5',
  'icon:award': 'M8 10a4 4 0 100-8 4 4 0 000 8zm-2.5 1L4 15l4-2 4 2-1.5-4',
  'icon:globe': 'M8 14A6 6 0 108 2a6 6 0 000 12zM2 8h12M8 2c2 2 2.5 4 2.5 6S10 12 8 14M8 2C6 4 5.5 6 5.5 8S6 12 8 14',
  'icon:home': 'M2 8l6-6 6 6m-1 0v5a1 1 0 01-1 1H9V10H7v4H4a1 1 0 01-1-1V8',
  'icon:mail': 'M2 3h12a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V4a1 1 0 011-1zm0 1l6 4 6-4',
  'icon:calendar': 'M3 4h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1zm2-2v3m6-3v3M2 7h12',
};

export default function IconOrEmoji({ value, size = 16, color = 'currentColor' }) {
  if (!value) return null;
  const path = value.startsWith?.('icon:') && SVG_ICONS[value];
  if (path) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d={path} stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span style={{ fontSize: size }}>{value}</span>;
}
