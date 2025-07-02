const fs = require('fs');
const path = require('path');

// Database for tracking scraped jobs
class ScrapedJobsDB {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'exports', 'scraped_jobs_db.json');
    this.loadDB();
  }

  loadDB() {
    try {
      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        this.scrapedJobs = JSON.parse(data);
      } else {
        this.scrapedJobs = {};
      }
    } catch (error) {
      console.log('⚠️ Error loading scraped jobs DB, starting fresh:', error.message);
      this.scrapedJobs = {};
    }
  }

  saveDB() {
    try {
      const exportsDir = path.dirname(this.dbPath);
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.scrapedJobs, null, 2));
    } catch (error) {
      console.log('⚠️ Error saving scraped jobs DB:', error.message);
    }
  }

  hasJob(postingId) {
    return postingId && this.scrapedJobs.hasOwnProperty(postingId);
  }

  addJob(postingId, jobData) {
    if (postingId) {
      this.scrapedJobs[postingId] = {
        ...jobData,
        first_scraped: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
      this.saveDB();
    }
  }

  removeJob(postingId) {
    if (postingId && this.scrapedJobs[postingId]) {
      delete this.scrapedJobs[postingId];
      this.saveDB();
      return true;
    }
    return false;
  }

  getJob(postingId) {
    return this.scrapedJobs[postingId] || null;
  }

  getAllJobs() {
    return this.scrapedJobs;
  }

  getStats() {
    const totalJobs = Object.keys(this.scrapedJobs).length;
    const recentJobs = Object.values(this.scrapedJobs).filter(job => {
      const lastUpdated = new Date(job.last_updated);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastUpdated > oneDayAgo;
    }).length;

    let dbSizeKb = 0;
    try {
      if (fs.existsSync(this.dbPath)) {
        dbSizeKb = Math.round(fs.statSync(this.dbPath).size / 1024);
      }
    } catch (error) {
      console.log('⚠️ Could not get DB file size:', error.message);
    }

    return {
      total_tracked_jobs: totalJobs,
      recent_jobs_24h: recentJobs,
      db_size_kb: dbSizeKb
    };
  }

  cleanOldJobs() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [postingId, jobData] of Object.entries(this.scrapedJobs)) {
      const lastUpdated = new Date(jobData.last_updated);
      if (lastUpdated < sevenDaysAgo) {
        delete this.scrapedJobs[postingId];
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.saveDB();
      console.log(`🧹 Cleaned ${cleanedCount} old jobs from database`);
    }

    return cleanedCount;
  }

  clear() {
    this.scrapedJobs = {};
    this.saveDB();
  }

  size() {
    return Object.keys(this.scrapedJobs).length;
  }
}

module.exports = ScrapedJobsDB;
