import { test, expect, type ConsoleMessage } from '@playwright/test';

/**
 * Dashboard smoke tests.
 *
 * These are not end-to-end functional tests. Each one asserts the minimum that
 * proves a route still renders for a human: it returns 200, is not silently
 * redirected somewhere else, paints visible content, and logs no unexpected
 * console errors.
 *
 * The point is fast failure on the classes of regression that are easy to ship
 * and hard to spot: a middleware or auth change bouncing every page, a render
 * throw blanking a panel, a bad import failing at runtime.
 */

/**
 * Console noise the dev server emits on every page load. Measured, not
 * guessed: React DevTools' install hint, the HMR websocket, Fast Refresh, and
 * the dashboard's own SSE connection notice are all logged at error level by
 * the browser but are not defects. Anything not matching these is treated as
 * a real error and fails the test.
 */
const CONSOLE_NOISE: RegExp[] = [
  /Download the React DevTools/i,
  /\[HMR\]/i,
  /Fast Refresh/i,
  /SSE connection/i,
  /webpack-hmr/i,
  /\[vite\]/i,
  // The browser reports any non-2xx subresource as a console error. In CI
  // there is no Postgres, so the dashboard's API calls legitimately 500 and
  // the page still renders. Route-level status is asserted separately, and
  // the API test covers the data routes, so the generic resource message
  // carries no signal here.
  /Failed to load resource/i,
  // `/api/tasks` reads an Obsidian vault from the filesystem. Without
  // OBSIDIAN_VAULT_PATH (unset in CI) it throws, and the page logs that error
  // before rendering its own error state. The failure is already visible to
  // the user in the UI, so the console echo is not additional signal.
  /OBSIDIAN_VAULT_PATH is not set/i,
  /Failed to fetch tasks/i,
];

/** True when a console message is dev-server noise rather than a defect. */
function isNoise(message: ConsoleMessage): boolean {
  const text = message.text();
  return CONSOLE_NOISE.some((pattern) => pattern.test(text));
}

const ROUTES = [
  { name: 'Home', path: '/' },
  { name: 'Agents', path: '/agents' },
  { name: 'Hermes', path: '/hermes' },
  { name: 'Tasks', path: '/tasks' },
  { name: 'Ideas', path: '/ideas' },
  { name: 'GitHub', path: '/github' },
  { name: 'Homelab', path: '/homelab' },
  { name: 'X', path: '/x' },
  { name: 'YouTube', path: '/youtube' },
  { name: 'Articles', path: '/articles' },
  { name: 'Longform', path: '/longform' },
  { name: 'Memory Wiki', path: '/memory-wiki' },
  { name: 'X Content', path: '/x-content' },
];

test.describe('dashboard routes', () => {
  for (const { name, path } of ROUTES) {
    test(`${name} renders`, async ({ page }) => {
      const realErrors: string[] = [];
      const onConsole = (message: ConsoleMessage) => {
        if (message.type() === 'error' && !isNoise(message)) {
          realErrors.push(message.text());
        }
      };
      page.on('console', onConsole);

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      expect(response, `${name} returned no response`).not.toBeNull();
      expect(response!.status(), `${name} HTTP status`).toBe(200);

      // A redirect here usually means an auth or middleware change quietly
      // bounced the user somewhere else.
      const redirectedFrom = response!.request().redirectedFrom();
      expect(
        redirectedFrom,
        `${name} redirected from ${redirectedFrom?.url() ?? ''}`,
      ).toBeFalsy();

      await expect(page.locator('body')).toBeVisible();

      // The dashboard polls several APIs on mount. Wait for first data paint,
      // but do not wait for network idle: SSE/WebSocket traffic never settles.
      await page.waitForTimeout(1_000);

      const bodyText = (await page.locator('body').innerText()).trim();
      expect(bodyText.length, `${name} rendered no text`).toBeGreaterThan(0);

      expect(realErrors, `${name} console errors`).toEqual([]);
    });
  }
});

test.describe('API health', () => {
  // The two routes the dashboard itself wraps in withCache. Asserting the
  // cache actually hits would have caught PR #120's root cause — a Redis
  // backend that silently never populated, so every poll recomputed.
  //
  // Skipped when no database is reachable (CI): both routes query Postgres, so
  // there they legitimately 500. Route rendering is still covered above.
  test('polled API routes respond', async ({ request }) => {
    test.skip(
      !!process.env.CI,
      'no database in CI; /api/home and /api/agents require Postgres',
    );

    for (const path of ['/api/home', '/api/agents']) {
      const response = await request.get(path);
      expect(response.status(), `${path} HTTP status`).toBe(200);
      const body = await response.json();
      expect(body, `${path} returned no JSON`).toBeTruthy();
    }
  });

  // The regression that motivated all of this: withCache was backed by Redis,
  // no REDIS_URL was set and nothing listened on :6379, so every call failed
  // inside a try/catch that returned null. Every request silently took the
  // miss path and re-ran the handler — /api/home went from ~7ms to ~450ms and
  // never once reported the failure. A status check cannot see this; only the
  // cache header can.
  test('polled routes are actually cached', async ({ request }) => {
    test.skip(
      !!process.env.CI,
      'no database in CI; /api/home and /api/agents require Postgres',
    );

    for (const path of ['/api/home', '/api/agents']) {
      // Prime, then assert the second request is served from cache. Fetch is
      // used directly rather than the request fixture so the X-Cache header
      // is readable on the warm response.
      await request.get(path);

      const warm = await request.get(path);
      expect(warm.status(), `${path} warm HTTP status`).toBe(200);
      expect(
        warm.headers()['x-cache'],
        `${path} was not served from cache — a cache that silently never populates is the regression this guards against`,
      ).toBe('HIT');
    }
  });
});
