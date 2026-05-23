import { Router, Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { expandHome } from '../config';

const router = Router();

function toDisplayPath(absPath: string): string {
  const home = os.homedir();
  if (absPath === home) return '~';
  if (absPath.startsWith(home + path.sep)) {
    return '~' + absPath.slice(home.length);
  }
  return absPath;
}

router.get('/', (req: Request, res: Response) => {
  try {
    const rawPath = (req.query.path as string) || '~';
    const resolved = path.resolve(expandHome(rawPath));

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    const parentResolved = path.dirname(resolved);
    const parent = parentResolved === resolved ? resolved : parentResolved;

    let entries: { name: string; path: string }[] = [];
    try {
      entries = fs
        .readdirSync(resolved, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => ({
          name: d.name,
          path: toDisplayPath(path.join(resolved, d.name)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      entries = [];
    }

    res.json({
      path: toDisplayPath(resolved),
      parent: toDisplayPath(parent),
      entries,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
