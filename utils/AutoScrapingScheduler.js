const cron = require('node-cron');
const axios = require('axios');

class AutoScrapingScheduler {
  constructor(port = 3000) {
    this.port = port;
    this.baseURL = `http://localhost:${port}`;
    this.isRunning = false;
    this.lastRun = null;
    this.stats = {
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      last_error: null
    };
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Auto-scraping scheduler is already running');
      return;
    }

    console.log('🚀 Starting auto-scraping scheduler (every 5 minutes)...');
    
    // Run every 5 minutes
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.runScraping();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;
    
    // Run immediately on start
    setTimeout(() => this.runScraping(), 5000);

    console.log('✅ Auto-scraping scheduler started successfully');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      console.log('🛑 Auto-scraping scheduler stopped');
    }
  }

  async runScraping() {
    if (!this.isRunning) return;
    
    const startTime = new Date();
    console.log(`\n🤖 [AUTO-SCRAPE] Starting scheduled scraping at ${startTime.toISOString()}`);
    
    this.stats.total_runs++;

    try {
      const response = await axios.get(`${this.baseURL}/api/jobs-regular?quick=true&auto=true`, {
        timeout: 120000 // 2 minutes timeout
      });

      this.stats.successful_runs++;
      this.lastRun = {
        time: startTime.toISOString(),
        status: 'success',
        duration_ms: Date.now() - startTime.getTime(),
        jobs_found: response.data.stats?.regularJobsExtracted || 0,
        new_jobs: response.data.stats?.newJobsFound || 0,
        skipped_jobs: response.data.stats?.alreadyScrapedSkipped || 0
      };

      console.log(`✅ [AUTO-SCRAPE] Completed successfully in ${this.lastRun.duration_ms}ms`);
      console.log(`   📊 Jobs: ${this.lastRun.new_jobs} new, ${this.lastRun.skipped_jobs} skipped`);

    } catch (error) {
      this.stats.failed_runs++;
      this.stats.last_error = error.message;
      this.lastRun = {
        time: startTime.toISOString(),
        status: 'failed',
        error: error.message,
        duration_ms: Date.now() - startTime.getTime()
      };

      console.log(`❌ Auto-scraping failed: ${error.message}`);
    }
  }

  getStatus() {
    let nextRun = null;
    if (this.isRunning) {
      // Calculate next run time (every 5 minutes)
      const now = new Date();
      const nextMinute = Math.ceil(now.getMinutes() / 5) * 5;
      const nextRunTime = new Date(now);
      nextRunTime.setMinutes(nextMinute, 0, 0);
      if (nextRunTime <= now) {
        nextRunTime.setHours(nextRunTime.getHours() + 1);
        nextRunTime.setMinutes(0, 0, 0);
      }
      nextRun = nextRunTime.toISOString();
    }
    
    return {
      is_running: this.isRunning,
      last_run: this.lastRun,
      stats: this.stats,
      next_run: nextRun
    };
  }
}

module.exports = AutoScrapingScheduler;