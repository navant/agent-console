#!/usr/bin/env node
// Patches node-pty v1.x for Node.js v23 compatibility:
// 1. native.dir is undefined in the prebuild — fix helperPath to use prebuilds/
// 2. spawn-helper binary is missing execute permission

const fs = require('fs');
const path = require('path');

const terminalFile = path.join(__dirname, '../node_modules/node-pty/lib/unixTerminal.js');
const spawnHelper  = path.join(__dirname, '../node_modules/node-pty/prebuilds', process.platform + '-' + process.arch, 'spawn-helper');

if (!fs.existsSync(terminalFile)) {
  console.log('[patch-node-pty] unixTerminal.js not found, skipping');
  process.exit(0);
}

// Patch 1: fix native.dir being undefined
let src = fs.readFileSync(terminalFile, 'utf8');
const badLine   = "var helperPath = native.dir + '/spawn-helper';";
const fixedLine = `var helperPath = native.dir !== undefined\n  ? path.resolve(__dirname, native.dir + '/spawn-helper')\n  : path.join(__dirname, '..', 'prebuilds', process.platform + '-' + process.arch, 'spawn-helper');`;

if (src.includes(badLine)) {
  src = src.replace(badLine + '\nhelperPath = path.resolve(__dirname, helperPath);', fixedLine);
  fs.writeFileSync(terminalFile, src);
  console.log('[patch-node-pty] patched native.dir fix');
} else if (src.includes('native.dir !== undefined')) {
  console.log('[patch-node-pty] native.dir fix already applied');
} else {
  console.warn('[patch-node-pty] unexpected unixTerminal.js format, skipping patch 1');
}

// Patch 2: ensure spawn-helper is executable
if (fs.existsSync(spawnHelper)) {
  const stat = fs.statSync(spawnHelper);
  if (!(stat.mode & 0o111)) {
    fs.chmodSync(spawnHelper, stat.mode | 0o111);
    console.log('[patch-node-pty] chmod +x spawn-helper');
  } else {
    console.log('[patch-node-pty] spawn-helper already executable');
  }
} else {
  console.warn('[patch-node-pty] spawn-helper not found at', spawnHelper);
}
