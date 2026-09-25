module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:8888/'],
      numberOfRuns: 1,
      settings: {
        headless: true,
        preset: 'desktop',
        chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['error', { minScore: 0.8 }],
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