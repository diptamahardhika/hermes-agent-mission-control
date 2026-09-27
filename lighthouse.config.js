module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:8888/'],
      // 3 runs, averaged. The performance score sits at 0.54 against a 0.5
      // assertion — 4 points of margin. A single run on a slower, noisier CI
      // runner flakes there often enough that people learn to ignore red CI.
      // Averaging is what makes a tight threshold safe to actually enforce.
      numberOfRuns: 3,
      settings: {
        headless: true,
        preset: 'desktop',
        chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    assert: {
      assertions: {
        // performance stays 0.5 deliberately: measured 0.54 on a local dev
        // server. This is an honest floor, not a target — the real fix for a
        // slow dashboard is the bundle, not a tighter assertion.
        'categories:performance': ['error', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        // measured 1.00 each — tighten to where the app actually is
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.15 }],
        'interactive': ['warn', { maxNumericValue: 9000 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './.lighthouse-ci',
    },
  },
};