/* global React */
const { useState, useEffect, useRef } = React;

// ─── Modal shell ────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, eyebrow, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        style={{ width }}
        onMouseDown={(e) => e.stopPropagation()}
        data-screen-label={`modal-${eyebrow || title || ""}`}
      >
        <header className="modal-hd">
          <div>
            {eyebrow && <div className="modal-eyebrow">{eyebrow}</div>}
            <h2 className="modal-title">{title}</h2>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-ft">{footer}</footer>}
      </div>
    </div>
  );
}

function Field({ label, hint, children, mono }) {
  return (
    <div className="field">
      <label className="field-lbl">
        <span>{label}</span>
        {hint && <span className={"field-hint" + (mono ? " mono" : "")}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const sub = typeof o === "object" ? o.sub : null;
        return (
          <button
            key={v}
            type="button"
            className={"seg-opt" + (value === v ? " is-on" : "")}
            onClick={() => onChange(v)}
          >
            <span>{l}</span>
            {sub && <span className="seg-sub">{sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Chips({ value, options, onToggle }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={"chip" + (on ? " is-on" : "")}
            onClick={() => onToggle(o)}
          >
            <span className="chip-tick">{on ? "✓" : "+"}</span>
            <span className="mono">{o}</span>
          </button>
        );
      })}
    </div>
  );
}

function SwatchRow({ value, options, onChange }) {
  return (
    <div className="swatches">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          className={"swatch" + (value === c ? " is-on" : "")}
          style={{ "--c": c }}
          onClick={() => onChange(c)}
          aria-label={c}
        >
          <span className="swatch-dot" />
        </button>
      ))}
    </div>
  );
}

// ─── Create Agent ───────────────────────────────────────────────────────────

const MODELS = [
  { value: "claude-haiku-4-5", label: "Haiku 4.5", sub: "fast · cheap" },
  { value: "claude-sonnet-4-5", label: "Sonnet 4.5", sub: "balanced" },
  { value: "claude-opus-4-5", label: "Opus 4.5", sub: "smartest" },
];

const TOOLS = ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch"];
const SWATCHES = ["#7aa7d4", "#c89f6a", "#8aa57a", "#b48ac4", "#d97757", "#8ab4a8", "#cf8a8a", "#a89a6c"];
const SKILL_NAMES = ["code-review", "test-writer", "doc-gen", "refactor"];

const DEFAULT_SOUL = `You are a focused, pragmatic engineering assistant. You read the codebase before editing, prefer the smallest change that fixes the problem, and write commit messages in imperative mood.`;

function CreateAgentModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [tint, setTint] = useState(SWATCHES[0]);
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [soul, setSoul] = useState(DEFAULT_SOUL);
  const [tools, setTools] = useState(["Bash", "Read", "Write", "Edit", "Glob", "Grep"]);
  const [skills, setSkills] = useState([]);
  const [memory, setMemory] = useState(true);

  const reset = () => {
    setName(""); setTint(SWATCHES[0]); setModel("claude-sonnet-4-5");
    setSoul(DEFAULT_SOUL); setTools(["Bash", "Read", "Write", "Edit", "Glob", "Grep"]);
    setSkills([]); setMemory(true);
  };

  useEffect(() => { if (open) reset(); }, [open]);

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const toggleTool = (t) => setTools((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);
  const toggleSkill = (s) => setSkills((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  const submit = () => {
    if (!slug) return;
    onCreate({ id: slug, name: slug, tint, model, soul, tools, skills, memory });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="New agent"
      title="Define a new agent"
      width={620}
      footer={
        <>
          <div className="modal-ft-meta">
            Will write to <span className="mono">~/.agent-control-panel/agents/{slug || "<name>"}/</span>
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!slug}>
              <span className="btn-glyph">+</span>
              Create agent
            </button>
          </div>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" hint={slug ? slug : "lowercase, kebab-case"} mono>
          <div className="input-wrap">
            <span
              className="input-avatar"
              style={{ background: tint + "33", color: tint }}
            >
              {(slug || "··").slice(0, 2)}
            </span>
            <input
              className="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. backend-coder"
            />
          </div>
        </Field>

        <Field label="Avatar tint">
          <SwatchRow value={tint} options={SWATCHES} onChange={setTint} />
        </Field>

        <Field label="Model" hint="passed as --model">
          <Seg value={model} options={MODELS} onChange={setModel} />
        </Field>

        <Field label="Soul" hint="--append-system-prompt-file · soul.md">
          <textarea
            className="text mono"
            rows={5}
            value={soul}
            onChange={(e) => setSoul(e.target.value)}
            placeholder="System prompt describing this agent's role and constraints…"
          />
        </Field>

        <Field label="Allowed tools" hint={`${tools.length}/${TOOLS.length} selected · --allowedTools`}>
          <Chips value={tools} options={TOOLS} onToggle={toggleTool} />
        </Field>

        <Field label="Skills" hint="injected after soul.md">
          <Chips value={skills} options={SKILL_NAMES} onToggle={toggleSkill} />
        </Field>

        <Field label="Persistent memory" hint="reads & updates memory.md">
          <Seg
            value={memory ? "on" : "off"}
            options={[{ value: "on", label: "On" }, { value: "off", label: "Off" }]}
            onChange={(v) => setMemory(v === "on")}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ─── Create Workspace ───────────────────────────────────────────────────────

function CreateWorkspaceModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("~/code/");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) { setName(""); setPath("~/code/"); setDescription(""); }
  }, [open]);

  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const valid = slug && path.trim().length > 2;

  const submit = () => {
    if (!valid) return;
    onCreate({ id: slug, name: slug, path: path.trim(), description: description.trim() });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="New workspace"
      title="Add a workspace"
      width={520}
      footer={
        <>
          <div className="modal-ft-meta">
            <span className="muted">claude --add-dir</span>
            <span className="mono">{path || "<path>"}</span>
          </div>
          <div className="modal-ft-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!valid}>
              <span className="btn-glyph">+</span>
              Add workspace
            </button>
          </div>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" hint={slug ? slug : "lowercase, kebab-case"} mono>
          <div className="input-wrap">
            <span className="input-glyph">▸</span>
            <input
              className="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. my-app"
            />
          </div>
        </Field>

        <Field label="Path" hint="absolute or ~ home">
          <div className="input-wrap">
            <span className="input-glyph mono">$</span>
            <input
              className="text mono"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="~/code/my-app"
            />
            <button type="button" className="input-action">Browse…</button>
          </div>
          <div className="path-preview">
            <span className="path-crumb mono">~</span>
            {path.replace(/^~\/?/, "").split("/").filter(Boolean).map((seg, i, arr) => (
              <React.Fragment key={i}>
                <span className="path-sep">/</span>
                <span className={"path-crumb mono" + (i === arr.length - 1 ? " is-last" : "")}>{seg}</span>
              </React.Fragment>
            ))}
          </div>
        </Field>

        <Field label="Description" hint="optional">
          <textarea
            className="text"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What lives here?"
          />
        </Field>
      </div>
    </Modal>
  );
}

Object.assign(window, { Modal, CreateAgentModal, CreateWorkspaceModal });
