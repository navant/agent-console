import React from 'react';
import { useStore } from '../../store/useStore';
import Icon from '../common/Icon';

const ACCENTS = ['#7aa7d4', '#c89f6a', '#8aa57a', '#b07ad4', '#d47a9a'];

export default function AppearanceSettings() {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const accent = useStore(s => s.accent);
  const setAccent = useStore(s => s.setAccent);
  const density = useStore(s => s.density);
  const setDensity = useStore(s => s.setDensity);
  const ascend = useStore(s => s.ascend);
  const setAscend = useStore(s => s.setAscend);

  return (
    <div className="settings-embed">
      <div className="field">
        <label className="field-lbl">Theme</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTheme('dark')}
          >
            <Icon name="moon" size={14} /> Dark
          </button>
          <button
            type="button"
            className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTheme('light')}
          >
            <Icon name="sun" size={14} /> Light
          </button>
        </div>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label className="field-lbl">Accent</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENTS.map(c => (
            <button
              key={c}
              type="button"
              className="btn btn-ghost"
              style={{
                borderColor: accent === c ? c : 'var(--border)',
                boxShadow: accent === c ? `0 0 0 2px ${c}` : undefined,
              }}
              onClick={() => setAccent(c)}
              aria-label={`Accent ${c}`}
            >
              <span style={{ width: 14, height: 14, borderRadius: 4, background: c, display: 'inline-block' }} />
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label className="field-lbl">Density</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['compact', 'regular', 'comfy'] as const).map(d => (
            <button
              key={d}
              type="button"
              className={`btn ${density === d ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDensity(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label className="field-lbl">Ascend</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${ascend ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setAscend(!ascend)}
            aria-pressed={ascend}
          >
            <Icon name={ascend ? 'star' : 'moon'} size={14} />
            {ascend ? 'On' : 'Off'}
          </button>
          <span className="muted" style={{ fontSize: 12 }}>
            Elevated gradients and glow effects
          </span>
        </div>
      </div>
    </div>
  );
}
