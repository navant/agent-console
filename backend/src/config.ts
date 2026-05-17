import os from 'os';
import path from 'path';

export const DATA_DIR = path.join(os.homedir(), '.agent-control-panel');

export const PATHS = {
  agents: path.join(DATA_DIR, 'agents'),
  workspaces: path.join(DATA_DIR, 'workspaces'),
  tasks: path.join(DATA_DIR, 'tasks'),
  sessions: path.join(DATA_DIR, 'sessions'),
};

export const CLAUDE_AGENTS_DIR = path.join(os.homedir(), '.claude', 'agents');
