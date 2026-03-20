import React, { useRef, useState } from 'react';
import { useImageEdit } from '../ImageEditContext.jsx';

function CameraIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

/* Small floating pill button for editing images */
function EditPill({ onClick, label, top = 12, right = 12 }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute', top, right, zIndex: 20,
        background: 'rgba(0,0,0,0.6)', color: '#fff',
        border: 'none', borderRadius: 20, padding: '5px 10px 5px 8px',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        backdropFilter: 'blur(6px)', letterSpacing: '0.02em',
        whiteSpace: 'nowrap', transition: 'background 0.15s',
        pointerEvents: 'auto',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.85)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
    >
      <CameraIcon size={12} />
      {label}
    </button>
  );
}

/* ── Hero background image with dark overlay ─────────────────────── */
export function HeroImage({ src, overlay = 'rgba(0,0,0,0.55)' }) {
  const { inputRef, handleClick, handleChange, editable } = useImageSlot('hero');

  if (!src && !editable) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      {src ? (
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: overlay }} />
        </div>
      ) : null}

      {editable && (
        <>
          <EditPill onClick={handleClick} label={src ? 'Change photo' : 'Add hero photo'} top={12} right={12} />
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
        </>
      )}
    </div>
  );
}

/* ── About section image ─────────────────────────────────────────── */
export function AboutImage({ src, accent = '#888' }) {
  const { inputRef, handleClick, handleChange, editable } = useImageSlot('about');

  if (!src && !editable) return null;

  if (!src && editable) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={handleClick}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 14px', border: `1.5px dashed ${accent}55`,
            borderRadius: 8, background: `${accent}0d`, color: accent,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: 0.75, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.75'}
        >
          <CameraIcon size={13} />
          Add photo
        </button>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
      </div>
    );
  }

  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden', border: `2px solid ${accent}22`, position: 'relative' }}>
      <img src={src} alt="About us" style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} />
      {editable && (
        <>
          <EditPill onClick={handleClick} label="Change photo" top={8} right={8} />
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
        </>
      )}
    </div>
  );
}

/* ── Single gallery slot ─────────────────────────────────────────── */
function GallerySlot({ src, imageKey, colors }) {
  const { inputRef, handleClick, handleChange, editable } = useImageSlot(imageKey);

  if (!src && !editable) return null;

  if (!src && editable) {
    return (
      <div
        style={{
          borderRadius: '8px', height: '280px',
          border: '2px dashed rgba(0,0,0,0.12)',
          background: colors.secondary || '#f5f5f5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
        }}
        onClick={handleClick}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.25)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)'; }}
      >
        <div style={{ textAlign: 'center', color: colors.text || '#888', opacity: 0.5, pointerEvents: 'none' }}>
          <CameraIcon size={24} />
          <p style={{ fontSize: 12, marginTop: 6, fontWeight: 500 }}>Add photo</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
      </div>
    );
  }

  return (
    <div style={{ borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
      <img src={src} alt="" style={{ width: '100%', height: '280px', objectFit: 'cover', display: 'block' }} />
      {editable && (
        <>
          <EditPill onClick={handleClick} label="Change" top={8} right={8} />
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleChange} />
        </>
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
