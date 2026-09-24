module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:8888/', 'http://localhost:8888/hermes', 'http://localhost:8888/freellm', 'http://localhost:8888/omniroute'],
      numberOfRuns: 3,
      startServerCommand: 'PORT=8888 npm run start',
      settings: {
        headless: true,
        preset: 'desktop',
        staticDistDir: './.next/server',
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