import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { getSkills, getSkillFile, saveSkillFile, createSkill } from '../../api/client';
import { SkillConfig } from '../../types';
import MarkdownEditor from '../common/MarkdownEditor';
import { DEFAULT_PATH_SETTINGS } from '../../constants/paths';

type SkillKey = `${SkillConfig['source']}:${string}`;

function skillKey(skill: Pick<SkillConfig, 'id' | 'source'>): SkillKey {
  return `${skill.source}:${skill.id}`;
}

export default function SkillsView() {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const pathSettings = useStore(s => s.pathSettings);
  const selectedSkills = useStore(s => s.selectedSkills);
  const toggleSkillSelection = useStore(s => s.toggleSkillSelection);
  const loadWorkspaceData = useStore(s => s.loadWorkspaceData);

  const [skills, setSkills] = useState<SkillConfig[]>([]);
  const [selected, setSelected] = useState<SkillKey | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const loadList = () => {
    if (!activeWorkspaceId) return;
    getSkills().then(setSkills).catch(() => setSkills([]));
  };

  useEffect(() => {
    loadList();
  }, [activeWorkspaceId]);

  const openSkill = async (skill: SkillConfig) => {
    const key = skillKey(skill);
    setSelected(key);
    setLoading(true);
    try {
      const res = await getSkillFile(skill.id, skill.source);
      setContent(res.content);
    } catch {
      setContent(skill.content || '');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected || selected.startsWith('global:')) return;
    const id = selected.split(':')[1];
    setSaving(true);
    try {
      await saveSkillFile(id, content);
      loadList();
      await loadWorkspaceData();
    } finally {
      setSaving(false);
    }
  };

  const newSkill = async () => {
    const name = window.prompt('Skill folder name (e.g. code-review)');
    if (!name) return;
    const result = await createSkill(name);
    loadList();
    await loadWorkspaceData();
    openSkill({ id: result.id, name: result.id, content: result.content, source: 'workspace' });
  };

  const filtered = skills.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  const active = selected ? skills.find(s => skillKey(s) === selected) : null;
  const readOnly = active?.source === 'global';

  if (!activeWorkspaceId) {
    return <div className="panel-view panel-view--empty"><p>Add a workspace first.</p></div>;
  }

  return (
    <div className="prd-view">
      <header className="panel-view-hd">
        <div>
          <h2>Skills</h2>
          <p className="muted">
            <span className="mono">{pathSettings?.skills ?? DEFAULT_PATH_SETTINGS.skills}</span>
            {' · '}
            global <span className="mono">{pathSettings?.globalSkills ?? DEFAULT_PATH_SETTINGS.globalSkills}</span>
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={newSkill}>+ New skill</button>
      </header>

      <div className="prd-view-body">
        <aside className="memory-tree">
          <div className="search memory-tree-search">
            <span className="search-glyph">⌕</span>
            <input placeholder="Search skills…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filtered.map(skill => (
            <div key={skillKey(skill)} className="side-skill-row file-tree-row">
              <input
                type="checkbox"
                checked={selectedSkills.includes(skill.id)}
                onChange={() => toggleSkillSelection(skill.id)}
                title="Select for next task"
                onClick={e => e.stopPropagation()}
              />
              <button
                type="button"
                className={'memory-tree-item file-tree-item' + (selected === skillKey(skill) ? ' is-active' : '')}
                onClick={() => openSkill(skill)}
              >
                <span className="memory-tree-icon">◇</span>
                <span className="memory-tree-name">{skill.name}</span>
                <span className="source-chip">{skill.source === 'global' ? 'G' : 'W'}</span>
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="field-hint" style={{ padding: 8 }}>
              No skills — add folders with SKILL.md under the skills path.
            </p>
          )}
        </aside>

        <div className="prd-editor-pane">
          {selected && active ? (
            <>
              {readOnly && (
                <p className="field-hint prd-editor-actions">Global skill — read-only. Copy to workspace skills to edit.</p>
              )}
              <MarkdownEditor
                path={`${active.id}/SKILL.md`}
                content={content}
                onChange={setContent}
                onSave={save}
                saving={saving}
                loading={loading}
                readOnly={readOnly}
              />
            </>
          ) : (
            <div className="memory-editor-empty">
              <p>Select a skill</p>
              <p className="muted">Each skill is a folder with SKILL.md on disk.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
