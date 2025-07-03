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
const { getJobsFromCSV, getAvailableCSVFiles, getCSVStats } = require('./api/jobs-csv-data');
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
      'auto-scraping (INTERACTIVE!)': {
        url: '/api/auto-scraping/*',
        description: 'Interactive auto-scraping - prompts on startup whether to enable',
        commands: {
          'start': '/api/auto-scraping/start - Start automatic scraping (if not enabled at startup)',
          'stop': '/api/auto-scraping/stop - Stop automatic scraping',
          'status': '/api/auto-scraping/status - Check scraping status'
        },
        note: 'Server prompts for auto-start preference! Enhanced: 20 jobs/run, 3 pages, smart CSV management'
      },
      'latest-jobs (NEW!)': {
        url: '/api/latest-jobs',
        description: 'Get scraped job data from CSV files as JSON',
        speed: 'Fast (~1-2 seconds)',
        params: '?date=YYYY-MM-DD (specific date), ?limit=N, ?search=keyword, ?location=city, ?salary_min=amount',
        note: 'Read and filter CSV data with powerful search capabilities'
      },
      'csv-files (NEW!)': {
        url: '/api/csv-files',
        description: 'List all available CSV files with metadata',
        speed: 'Instant',
        note: 'Get file sizes, dates, and modification times'
      },
      'csv-stats (NEW!)': {
        url: '/api/csv-stats',
        description: 'Detailed statistics and analysis of CSV data',
        speed: 'Fast (~2-3 seconds)',
        params: '?date=YYYY-MM-DD (specific date)',
        note: 'Salary analysis, location distribution, contact method stats'
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
      'For automation': 'Server will prompt if you want auto-scraping enabled on startup',
      'For CSV data': 'Use /api/latest-jobs with filters to search scraped jobs as JSON',
      'For data analysis': 'Use /api/csv-stats for salary, location, and contact statistics'
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

// CSV Data endpoints
app.get('/api/latest-jobs', getJobsFromCSV);
app.get('/api/csv-files', getAvailableCSVFiles);
app.get('/api/csv-stats', getCSVStats);

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

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}`);
  console.log(`🔍 Jobs endpoint: http://localhost:${PORT}/api/jobs`);
  console.log(`🔍 Detailed Jobs endpoint: http://localhost:${PORT}/api/jobs-detailed`);
  
  // Check if running in interactive mode
  const isInteractive = process.stdin.isTTY && process.env.NODE_ENV !== 'production';
  
  if (isInteractive) {
    // Interactive prompt for auto-scraping
    const readline = require('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(`\n🤖 Auto-Scraping Configuration:`);
    console.log(`   📊 Enhanced mode: 20 jobs per run, 3 pages, smart duplicate detection`);
    console.log(`   ⏰ Frequency: Every 5 minutes automatically`);
    
    rl.question('\n❓ Do you want to start auto-scraping now? (y/n): ', (answer) => {
      const startAutoScraping = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      
      if (startAutoScraping) {
        console.log(`\n✅ Starting auto-scraping scheduler...`);
        try {
          autoScraper.start();
          console.log(`🎉 Auto-scraping enabled! Will run every 5 minutes automatically`);
          console.log(`📊 Enhanced mode: 20 jobs per run, smart duplicate detection`);
          console.log(`🛑 To stop: curl "http://localhost:${PORT}/api/auto-scraping/stop"`);
          console.log(`📈 To check status: curl "http://localhost:${PORT}/api/auto-scraping/status"`);
        } catch (error) {
          console.log(`❌ Failed to start auto-scraping: ${error.message}`);
        }
      } else {
        console.log(`\n⏸️ Auto-scraping disabled by user choice`);
        console.log(`🚀 To start manually later: curl "http://localhost:${PORT}/api/auto-scraping/start"`);
        console.log(`🌐 Or visit: http://localhost:${PORT}/api/auto-scraping/start`);
      }
      
      console.log(`\n🎯 Server ready! Press Ctrl+C to stop`);
      rl.close();
    });
  } else {
    // Non-interactive mode (production, etc.)
    const autoStartEnabled = process.env.AUTO_START !== 'false';
    
    if (autoStartEnabled) {
      console.log(`\n🤖 Non-interactive mode: Starting auto-scraping automatically...`);
      try {
        autoScraper.start();
        console.log(`✅ Auto-scraping enabled! Will run every 5 minutes automatically`);
        console.log(`📊 Enhanced mode: 20 jobs per run, smart duplicate detection`);
        console.log(`🛑 To stop: curl "http://localhost:${PORT}/api/auto-scraping/stop"`);
      } catch (error) {
        console.log(`❌ Failed to start auto-scraping: ${error.message}`);
      }
    } else {
      console.log(`\n⏸️ Auto-scraping disabled (AUTO_START=false)`);
      console.log(`🚀 To start manually: curl "http://localhost:${PORT}/api/auto-scraping/start"`);
    }
  }
});

module.exports = app;
