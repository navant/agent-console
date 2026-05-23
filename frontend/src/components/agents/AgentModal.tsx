import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { createAgent } from '../../api/client';

interface AgentModalProps {
  open: boolean;
  onClose: () => void;
}

const MODELS = [
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5', sub: 'fast · cheap' },
  { value: 'claude-sonnet-4-5', label: 'Sonnet 4.5', sub: 'balanced' },
  { value: 'claude-opus-4-5', label: 'Opus 4.5', sub: 'smartest' },
];

const TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
const SWATCHES = ['#7aa7d4', '#c89f6a', '#8aa57a', '#b48ac4', '#d97757', '#8ab4a8', '#cf8a8a', '#a89a6c'];

const DEFAULT_SOUL = `You are a focused, pragmatic engineering assistant. You read the codebase before editing, prefer the smallest change that fixes the problem, and write commit messages in imperative mood.`;

export default function AgentModal({ open, onClose }: AgentModalProps) {
  const skills = useStore(s => s.skills);
  const addAgent = useStore(s => s.addAgent);

  const [name, setName] = useState('');
  const [tint, setTint] = useState(SWATCHES[0]);
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [soul, setSoul] = useState(DEFAULT_SOUL);
  const [tools, setTools] = useState(['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [source, setSource] = useState<'global' | 'workspace'>('global');
  const [memory, setMemory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const reset = () => {
    setName(''); setTint(SWATCHES[0]); setModel('claude-sonnet-4-5');
    setSoul(DEFAULT_SOUL); setTools(['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']);
    setSelectedSkills([]); setMemory(true); setSource('global');
  };

  useEffect(() => { if (open) reset(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleTool = (t: string) =>
    setTools(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);
  const toggleSkill = (s: string) =>
    setSelectedSkills(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);

  const submit = async () => {
    if (!slug || submitting) return;
    setSubmitting(true);
    try {
      const agent = await createAgent({
        id: slug, name: slug, tint, model, soul, tools,
        memory, source,
      });
      addAgent(agent);
      onClose();
    } catch (err) {
      console.error('Failed to create agent:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const skillNames = skills.map(s => s.name);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width: 620 }}
        onMouseDown={e => e.stopPropagation()}
        data-screen-label="modal-new-agent"
      >
        <header className="modal-hd">
          <div>
            <div className="modal-eyebrow">New agent</div>
            <h2 className="modal-title">Define a new agent</h2>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="modal-body">
          <div className="form-grid">
            {/* Name */}
            <div className="field">
              <label className="field-lbl">
                <span>Name</span>
                <span className="field-hint mono">{slug || 'lowercase, kebab-case'}</span>
              </label>
              <div className="input-wrap">
                <span
                  className="input-avatar"
                  style={{ background: tint + '33', color: tint }}
                >
                  {(slug || '··').slice(0, 2)}
                </span>
                <input
                  className="text"
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. backend-coder"
                />
              </div>
            </div>

            {/* Tint */}
            <div className="field">
              <label className="field-lbl"><span>Avatar tint</span></label>
              <div className="swatches">
                {SWATCHES.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={'swatch' + (tint === c ? ' is-on' : '')}
                    style={{ '--c': c } as React.CSSProperties}
                    onClick={() => setTint(c)}
                    aria-label={c}
                  >
                    <span className="swatch-dot" />
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="field">
              <label className="field-lbl">
                <span>Model</span>
                <span className="field-hint">passed as --model</span>
              </label>
              <div className="seg">
                {MODELS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    className={'seg-opt' + (model === m.value ? ' is-on' : '')}
                    onClick={() => setModel(m.value)}
                  >
                    <span>{m.label}</span>
                    <span className="seg-sub">{m.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Soul */}
            <div className="field">
              <label className="field-lbl">
                <span>Soul</span>
                <span className="field-hint">--append-system-prompt-file · soul.md</span>
              </label>
              <textarea
                className="text mono"
                rows={5}
                value={soul}
                onChange={e => setSoul(e.target.value)}
                placeholder="System prompt describing this agent's role and constraints…"
              />
            </div>

            {/* Tools */}
            <div className="field">
              <label className="field-lbl">
                <span>Allowed tools</span>
                <span className="field-hint">{tools.length}/{TOOLS.length} selected · --allowedTools</span>
              </label>
              <div className="chips">
                {TOOLS.map(t => {
                  const on = tools.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={'chip' + (on ? ' is-on' : '')}
                      onClick={() => toggleTool(t)}
                    >
                      <span className="chip-tick">{on ? '✓' : '+'}</span>
                      <span className="mono">{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Skills */}
            {skillNames.length > 0 && (
              <div className="field">
                <label className="field-lbl">
                  <span>Skills</span>
                  <span className="field-hint">injected after soul.md</span>
                </label>
                <div className="chips">
                  {skillNames.map(s => {
                    const on = selectedSkills.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        className={'chip' + (on ? ' is-on' : '')}
                        onClick={() => toggleSkill(s)}
                      >
                        <span className="chip-tick">{on ? '✓' : '+'}</span>
                        <span className="mono">{s}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Source */}
            <div className="field">
              <label className="field-lbl"><span>Location</span></label>
              <div className="seg">
                {(['global', 'workspace'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={'seg-opt' + (source === opt ? ' is-on' : '')}
                    onClick={() => setSource(opt)}
                  >
                    <span>{opt === 'global' ? 'Global (~/.claude)' : 'Workspace'}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Memory */}
            <div className="field">
              <label className="field-lbl">
                <span>Persistent memory</span>
                <span className="field-hint">reads &amp; updates memory.md</span>
              </label>
              <div className="seg">
                {[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={'seg-opt' + ((memory ? 'on' : 'off') === opt.value ? ' is-on' : '')}
                    onClick={() => setMemory(opt.value === 'on')}
                  >
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-ft">
          <div className="modal-ft-meta">
            Will write to{' '}
            <span className="mono">~/.claude/agents/{slug || '<name>'}.md</span>
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!slug || submitting}
            >
              <span className="btn-glyph">+</span>
              {submitting ? 'Creating…' : 'Create agent'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
