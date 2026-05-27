import { test, expect, Page } from '@playwright/test';

// ─── helpers ────────────────────────────────────────────────────────────────

async function waitForAppReady(page: Page) {
  await page.goto('/');
  await expect(page.locator('.tb-brand', { hasText: 'Agent Console' })).toBeVisible({ timeout: 10_000 });
}

async function ensureWorkspaceSelected(page: Page) {
  const picker = page.locator('.modal-overlay');
  if (await picker.isVisible().catch(() => false)) {
    const rows = page.locator('.folder-row');
    if ((await rows.count()) > 0) {
      await rows.first().click();
      await page.locator('.modal-foot .btn-primary').click();
      await expect(picker).not.toBeVisible({ timeout: 10_000 });
    }
  }
}

async function openHomeCapability(page: Page, title: string) {
  await waitForAppReady(page);
  await page.locator('.cap-card', { hasText: title }).click();
  await ensureWorkspaceSelected(page);
  await expect(page.locator('.tabbar')).toBeVisible({ timeout: 10_000 });
}

async function openSettingsSection(page: Page, section: string) {
  await openHomeCapability(page, 'Settings');
  await page.locator('.settings-nav-item', { hasText: section }).click();
}

async function hasActiveWorkspace(page: Page): Promise<boolean> {
  await waitForAppReady(page);
  const res = await page.request.get('/api/workspaces');
  if (!res.ok()) return false;
  const data = (await res.json()) as { activeWorkspace?: string | null };
  return Boolean(data.activeWorkspace);
}

// ─── 1. App shell ────────────────────────────────────────────────────────────

test.describe('App shell', () => {
  test('page title is Agent Console', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Agent Console');
  });

  test('studio home shows brand and capabilities', async ({ page }) => {
    await waitForAppReady(page);
    await expect(page.locator('.studio')).toBeVisible();
    await expect(page.locator('.cap-card', { hasText: 'Chat' })).toBeVisible();
    await expect(page.locator('.cap-card', { hasText: 'Tasks' })).toBeVisible();
    await expect(page.locator('.cap-card', { hasText: 'Setup workspace' })).toBeVisible();
    await expect(page.locator('.cap-card', { hasText: 'Settings' })).toBeVisible();
  });

  test('WebSocket status in titlebar', async ({ page }) => {
    await waitForAppReady(page);
    await expect(page.locator('.titlebar .status-pill')).toBeVisible();
  });
});

// ─── 2. Studio → Coder navigation ───────────────────────────────────────────

test.describe('Studio navigation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppReady(page);
  });

  const caps = ['Chat', 'Tasks', 'Setup workspace', 'Settings', 'Goals', 'Planning'];

  for (const title of caps) {
    test(`home card "${title}" opens coder workspace`, async ({ page }) => {
      await page.locator('.cap-card', { hasText: title }).click();
      await ensureWorkspaceSelected(page);
      await expect(page.locator('.tabbar')).toBeVisible({ timeout: 10_000 });
    });
  }

  test('clicking Tasks shows kanban', async ({ page }) => {
    await openHomeCapability(page, 'Tasks');
    await expect(page.locator('.kanban, .kanban-empty')).toBeVisible();
  });

  test('home button returns to studio', async ({ page }) => {
    await openHomeCapability(page, 'Tasks');
    await page.locator('.titlebar .tb-iconbtn[title="Home"]').click();
    await expect(page.locator('.studio')).toBeVisible();
  });
});

// ─── 3. Kanban board ─────────────────────────────────────────────────────────

test.describe('Kanban board', () => {
  test.beforeEach(async ({ page }) => {
    await openHomeCapability(page, 'Tasks');
  });

  test('kanban renders', async ({ page }) => {
    await expect(page.locator('.kanban, .kanban-empty')).toBeVisible();
  });

  test('if workspace active, kanban shows column headers', async ({ page }) => {
    const active = await hasActiveWorkspace(page);
    if (!active) {
      test.skip();
      return;
    }
    await openHomeCapability(page, 'Tasks');
    const colTitles = page.locator('.col-title');
    await expect(colTitles.first()).toBeVisible();
    expect(await colTitles.count()).toBeGreaterThanOrEqual(5);
  });

  test('if no workspace, shows add-workspace prompt', async ({ page }) => {
    const active = await hasActiveWorkspace(page);
    if (active) {
      test.skip();
      return;
    }
    await expect(page.locator('.kanban-empty')).toContainText(/workspace/i);
  });

  test('"New task" button when workspace active', async ({ page }) => {
    const active = await hasActiveWorkspace(page);
    if (!active) {
      test.skip();
      return;
    }
    await openHomeCapability(page, 'Tasks');
    await expect(page.locator('.kanban-hd .btn-primary', { hasText: /New task/ })).toBeVisible();
  });
});

// ─── 4. Create task modal ────────────────────────────────────────────────────

test.describe('Create task modal', () => {
  const createdTaskIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    const active = await hasActiveWorkspace(page);
    if (!active) {
      test.skip();
      return;
    }
    await openHomeCapability(page, 'Tasks');
  });

  test.afterEach(async () => {
    for (const id of createdTaskIds) {
      try {
        await fetch(`http://localhost:3001/api/tasks/${id}`, { method: 'DELETE' });
      } catch { /* ignore */ }
    }
    createdTaskIds.length = 0;
  });

  async function openCreateModal(page: Page) {
    await page.locator('.kanban-hd .btn-primary', { hasText: /New task/ }).click();
    await expect(page.locator('.modal-backdrop')).toBeVisible();
  }

  test('opens create task modal', async ({ page }) => {
    await openCreateModal(page);
    await expect(page.locator('.modal-title', { hasText: 'Create a task' })).toBeVisible();
  });

  test('closes modal with Escape', async ({ page }) => {
    await openCreateModal(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-backdrop')).not.toBeVisible();
  });
});

// ─── 5. Settings ─────────────────────────────────────────────────────────────

test.describe('Settings view', () => {
  test.beforeEach(async ({ page }) => {
    await openHomeCapability(page, 'Settings');
  });

  test('settings nav is visible', async ({ page }) => {
    await expect(page.locator('.settings-nav-head', { hasText: 'Settings' })).toBeVisible();
  });

  test('Paths section shows path fields', async ({ page }) => {
    await page.locator('.settings-nav-item', { hasText: 'Paths' }).click();
    const fields = page.locator('.settings-form .field');
    expect(await fields.count()).toBeGreaterThan(0);
  });

  test('Task types section', async ({ page }) => {
    await page.locator('.settings-nav-item', { hasText: 'Task types' }).click();
    await expect(page.locator('.settings-embed, .task-type-panel, .panel-view')).toBeVisible();
  });

  test('Memory section opens memory view', async ({ page }) => {
    await page.locator('.settings-nav-item', { hasText: 'Memory' }).click();
    await expect(page.locator('.panel-view, .memory-view')).toBeVisible();
  });
});

// ─── 6. Setup workspace ──────────────────────────────────────────────────────

test.describe('Setup workspace', () => {
  test('setup view shows workspace selector', async ({ page }) => {
    await openHomeCapability(page, 'Setup workspace');
    await expect(page.locator('.ws-select, .ws-selector')).toBeVisible();
    await expect(page.locator('button', { hasText: /Run setup/ })).toBeVisible();
  });
});

// ─── 7. Workspace management ─────────────────────────────────────────────────

test.describe('Workspace management', () => {
  test('add workspace from setup view', async ({ page }) => {
    await openHomeCapability(page, 'Setup workspace');
    await page.locator('button', { hasText: 'Add' }).first().click();
    await expect(page.locator('.modal-backdrop')).toBeVisible();
    await page.locator('.modal-x').click();
    await expect(page.locator('.modal-backdrop')).not.toBeVisible();
  });
});

// ─── 8. Workspace tabs ─────────────────────────────────────────────────────

test.describe('Workspace tabs', () => {
  test('tab bar shows tabs after opening capability', async ({ page }) => {
    await openHomeCapability(page, 'Tasks');
    await expect(page.locator('.tabbar .tab')).toBeVisible();
  });

  test('can add chat tab from tab bar', async ({ page }) => {
    await openHomeCapability(page, 'Tasks');
    await page.locator('.tab-add').click();
    await page.locator('.popover .item', { hasText: 'Chat' }).click();
    await expect(page.locator('.tabbar .tab', { hasText: 'Chat' })).toBeVisible();
  });
});

// ─── 9. Goals & Planning ─────────────────────────────────────────────────────

test.describe('Goals view', () => {
  test('goals tab content renders', async ({ page }) => {
    await openHomeCapability(page, 'Goals');
    await expect(page.locator('.tab-panel')).not.toBeEmpty();
  });
});

test.describe('Planning (PRD) view', () => {
  test('planning tab content renders', async ({ page }) => {
    await openHomeCapability(page, 'Planning');
    await expect(page.locator('.tab-panel')).not.toBeEmpty();
  });
});

// ─── 10. Theme toggle ────────────────────────────────────────────────────────

test.describe('Theme toggle', () => {
  test('theme toggle in titlebar', async ({ page }) => {
    await waitForAppReady(page);
    await expect(page.locator('.titlebar .tb-iconbtn[title="Toggle theme"]')).toBeVisible();
  });
});
