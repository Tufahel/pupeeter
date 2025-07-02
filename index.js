const express = require('express');
const cors = require('cors');
const jobsHandler = require('./api/jobs');
const jobsDetailedHandler = require('./api/jobs-detailed');
const jobsComprehensiveHandler = require('./api/jobs-comprehensive');
const jobsSmartHandler = require('./api/jobs-smart');
const jobsAdvancedHandler = require('./api/jobs-working');
const jobsAllHandler = require('./api/jobs-all-simple');
const jobsStepHandler = require('./api/jobs-step');
const jobsRegularHandler = require('./api/jobs-regular');
const jobsAnalysisHandler = require('./api/jobs-analysis');
const AutoScrapingScheduler = require('./utils/AutoScrapingScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize auto-scraping scheduler
const autoScraper = new AutoScrapingScheduler(PORT);

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
      },
      'jobs-all (FETCH ALL!)': {
        url: '/api/jobs-all',
        description: 'Fetch ALL available jobs from expatriates.com',
        speed: 'Very Slow (10+ minutes)',
        params: '?maxJobs=999999 (default: all), ?quick=true (test mode)',
        note: 'Automatically saves to CSV. Use ?quick=true for testing with 20 jobs'
      },
      'jobs-step (STEP-BY-STEP)': {
        url: '/api/jobs-step',
        description: 'Step-by-step scraping with pagination control',
        speed: 'Variable',
        params: '?action=init|scrape|status, ?batchSize=20',
        note: 'Perfect for large scraping jobs. Initialize first, then scrape in batches'
      },
      'jobs-regular (NO SPONSORED!)': {
        url: '/api/jobs-regular',
        description: 'Fetch ONLY regular jobs, skipping all sponsored listings',
        speed: 'Medium (~15-30 minutes)',
        params: '?quick=true (test mode), ?maxJobs=100',
        note: 'Automatically detects and skips sponsored jobs, saves to CSV'
      },
      'jobs-analysis (STATISTICS!)': {
        url: '/api/jobs-analysis',
        description: 'Analyze sponsored vs regular job distribution and detection accuracy',
        speed: 'Fast (~10 seconds)',
        params: '?pages=5 (default: 3), ?detailed=true',
        note: 'Provides detailed statistics on job classification and pattern analysis'
      },
      'auto-scraping (NEW!)': {
        url: '/api/auto-scraping/*',
        description: 'Automatic scraping every 5 minutes with smart duplicate detection',
        commands: {
          'start': '/api/auto-scraping/start - Start automatic scraping',
          'stop': '/api/auto-scraping/stop - Stop automatic scraping',
          'status': '/api/auto-scraping/status - Check scraping status'
        },
        note: 'Runs jobs-regular?quick=true&auto=true every 5 minutes automatically'
      }
    },
    status: 'running',
    auto_scraping: {
      enabled: autoScraper.getStatus().is_running,
      status: autoScraper.getStatus()
    },
    recommendations: {
      'For few jobs': 'Use /api/jobs-advanced?limit=10 for detailed extraction',
      'For ALL jobs': 'Use /api/jobs-all?quick=true (test) or /api/jobs-all (full)',
      'For large jobs': 'Use /api/jobs-step for controlled batch scraping',
      'For regular jobs only': 'Use /api/jobs-regular to skip sponsored listings',
      'For analysis': 'Use /api/jobs-analysis to understand job distribution patterns',
      'For automation': 'Use /api/auto-scraping/start for continuous background scraping'
    }
  });
});

app.get('/api/jobs', jobsHandler);
app.get('/api/jobs-advanced', jobsAdvancedHandler);
app.get('/api/jobs-smart', jobsSmartHandler);
app.get('/api/jobs-detailed', jobsDetailedHandler);
app.get('/api/jobs-comprehensive', jobsComprehensiveHandler);
app.get('/api/jobs-all', jobsAllHandler);
app.get('/api/jobs-step', jobsStepHandler);
app.get('/api/jobs-regular', jobsRegularHandler);
app.get('/api/jobs-analysis', jobsAnalysisHandler);

// Auto-scraping control endpoints
app.get('/api/auto-scraping/start', (req, res) => {
  try {
    autoScraper.start();
    res.json({
      success: true,
      message: 'Auto-scraping started successfully',
      status: autoScraper.getStatus(),
      note: 'Will scrape new jobs every 5 minutes using /api/jobs-regular?quick=true&auto=true'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/auto-scraping/stop', (req, res) => {
  try {
    autoScraper.stop();
    res.json({
      success: true,
      message: 'Auto-scraping stopped successfully',
      status: autoScraper.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/auto-scraping/status', (req, res) => {
  res.json({
    success: true,
    status: autoScraper.getStatus(),
    uptime: process.uptime()
  });
});

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
