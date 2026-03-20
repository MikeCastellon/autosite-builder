import React, { useRef, useState } from 'react';
import { useImageEdit } from '../ImageEditContext.jsx';

function CameraIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

function useImageSlot(imageKey) {
  const ctx = useImageEdit();
  const inputRef = useRef(null);
  const handleClick = (e) => {
    e.stopPropagation();
    inputRef.current?.click();
  };
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !ctx) return;
    const url = URL.createObjectURL(file);
    ctx.onImageChange(imageKey, url);
    e.target.value = '';
  };
  return { inputRef, handleClick, handleChange, editable: !!ctx };
}

function EditOverlay({ src, label }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <CameraIcon size={28} color="white" />
        <p style={{ fontSize: '13px', marginTop: '8px', fontWeight: 600, margin: '8px 0 0' }}>
          {src ? 'Click to change photo' : label}
        </p>
      </div>
    </div>
  );
}

/* ── Hero background image with dark overlay ─────────────────────── */
export function HeroImage({ src, overlay = 'rgba(0,0,0,0.55)' }) {
  const { inputRef, handleClick, handleChange, editable } = useImageSlot('hero');
  const [hovered, setHovered] = useState(false);

  if (!src && !editable) return null;

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 0, cursor: editable ? 'pointer' : 'default' }}
      onClick={editable ? handleClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {src ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: overlay }} />
        </div>
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(30,30,30,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
            <CameraIcon size={36} color="rgba(255,255,255,0.7)" />
            <p style={{ fontSize: '14px', marginTop: '10px', fontWeight: 500 }}>Click to add hero photo</p>
          </div>
        </div>
      )}
      {editable && hovered && <EditOverlay src={src} label="Click to add hero photo" />}
      {editable && (
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
      )}
    </div>
  );
}

/* ── About section image ─────────────────────────────────────────── */
export function AboutImage({ src, accent = '#888' }) {
  const { inputRef, handleClick, handleChange, editable } = useImageSlot('about');
  const [hovered, setHovered] = useState(false);

  if (!src && !editable) return null;

  return (
    <div
      style={{
        borderRadius: '8px', overflow: 'hidden',
        border: `2px solid ${accent}22`,
        position: 'relative',
        cursor: editable ? 'pointer' : 'default',
      }}
      onClick={editable ? handleClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {src ? (
        <img src={src} alt="About us" style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{
          width: '100%', height: '240px',
          background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: accent, opacity: 0.6 }}>
            <CameraIcon size={32} color={accent} />
            <p style={{ fontSize: '13px', marginTop: '8px' }}>Click to add photo</p>
          </div>
        </div>
      )}
      {editable && hovered && <EditOverlay src={src} label="Click to add photo" />}
      {editable && (
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
      )}
    </div>
  );
}

/* ── Single gallery slot ─────────────────────────────────────────── */
function GallerySlot({ src, imageKey, colors }) {
  const { inputRef, handleClick, handleChange, editable } = useImageSlot(imageKey);
  const [hovered, setHovered] = useState(false);

  if (!src && !editable) return null;

  return (
    <div
      style={{
        borderRadius: '8px', overflow: 'hidden', position: 'relative',
        cursor: editable ? 'pointer' : 'default',
      }}
      onClick={editable ? handleClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {src ? (
        <img src={src} alt="" style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{
          width: '100%', height: '280px',
          background: colors.secondary || '#f0f0f0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px dashed rgba(0,0,0,0.12)',
        }}>
          <div style={{ textAlign: 'center', color: colors.text || '#888', opacity: 0.45 }}>
            <CameraIcon size={28} color={colors.text || '#888'} />
            <p style={{ fontSize: '12px', marginTop: '6px' }}>Add photo</p>
          </div>
        </div>
      )}
      {editable && hovered && <EditOverlay src={src} label="Add photo" />}
      {editable && (
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
      )}
    </div>
  );
}

/* ── Gallery section (renders 3 slots) ───────────────────────────── */
export function GallerySection({ images = {}, colors = {}, font, bodyFont }) {
  const ctx = useImageEdit();
  const slots = ['gallery0', 'gallery1', 'gallery2'];
  const hasAny = slots.some(k => images[k]);

  if (!ctx && !hasAny) return null;

  return (
    <section style={{
      padding: 'clamp(3rem, 7vw, 6rem) clamp(1.5rem, 7vw, 5rem)',
      background: colors.secondary || colors.bg,
    }}>
      <div style={{
        fontFamily: bodyFont, fontSize: '0.7rem', letterSpacing: '0.25em',
        textTransform: 'uppercase', color: colors.accent, marginBottom: '0.75rem',
      }}>
        Our Work
      </div>
      <h2 style={{
        fontFamily: font, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)',
        color: colors.text, marginBottom: '2rem', fontWeight: 700,
      }}>
        Gallery
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
      }}>
        {slots.map(key => (
          <GallerySlot key={key} src={images[key]} imageKey={key} colors={colors} />
        ))}
      </div>
    </section>
  );
}
