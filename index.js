const express = require('express');
const cors = require('cors');
const jobsHandler = require('./api/jobs');
const jobsDetailedHandler = require('./api/jobs-detailed');
const jobsComprehensiveHandler = require('./api/jobs-comprehensive');
const jobsSmartHandler = require('./api/jobs-smart');
const jobsAdvancedHandler = require('./api/jobs-working');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Puppeteer Job Scraper API - Advanced Cloudflare Bypass',
    endpoints: {
      'jobs (basic)': {
        url: '/api/jobs',
        description: 'Get basic job listings (fast)',
        speed: 'Fast (~5 seconds)'
      },
      'jobs-advanced (NEW!)': {
        url: '/api/jobs-advanced',
        description: 'Advanced stealth scraper with Cloudflare bypass',
        speed: 'Medium (~30 seconds)',
        params: '?limit=3 (default: 3 jobs)',
        note: 'Uses stealth techniques to extract full job details like salary, contact, requirements'
      },
      'jobs-smart': {
        url: '/api/jobs-smart',
        description: 'Smart scraping from listing pages',
        speed: 'Medium (~20 seconds)',
        params: '?limit=15 (default: 15 jobs)'
      },
      'jobs-detailed': {
        url: '/api/jobs-detailed', 
        description: 'Get full job details from individual job pages',
        speed: 'Medium (~30 seconds)',
        params: '?limit=10 (default: 10 jobs)'
      },
      'jobs-comprehensive': {
        url: '/api/jobs-comprehensive',
        description: 'Comprehensive scraping from multiple cities',
        speed: 'Slow (~60+ seconds)',
        params: '?limit=10 (default: 10 jobs)'
      }
    },
    status: 'running',
    recommendation: 'Use /api/jobs-advanced for full job details with Cloudflare bypass'
  });
});

app.get('/api/jobs', jobsHandler);
app.get('/api/jobs-advanced', jobsAdvancedHandler);
app.get('/api/jobs-smart', jobsSmartHandler);
app.get('/api/jobs-detailed', jobsDetailedHandler);
app.get('/api/jobs-comprehensive', jobsComprehensiveHandler);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🔍 Jobs endpoint: http://localhost:${PORT}/api/jobs`);
  console.log(`🔍 Detailed Jobs endpoint: http://localhost:${PORT}/api/jobs-detailed`);
});

module.exports = app;
