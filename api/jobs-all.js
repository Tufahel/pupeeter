const ComprehensiveJobScraper = require('./jobs-all-comprehensive');

/**
 * API Endpoint: Fetch ALL jobs from expatriates.com
 * This endpoint can fetch all available jobs with options for batching and limits
 */

module.exports = async (req, res) => {
  try {
    console.log('🚀 Starting COMPREHENSIVE job scraper - ALL JOBS MODE');
    
    // Parse query parameters
    const maxJobs = parseInt(req.query.maxJobs) || 999999; // Default: no limit
    const batchSize = parseInt(req.query.batchSize) || 10;
    const quickMode = req.query.quick === 'true'; // Quick mode for testing
    
    console.log(`📊 Configuration:
    - Max jobs: ${maxJobs === 999999 ? 'ALL' : maxJobs}
    - Batch size: ${batchSize}
    - Quick mode: ${quickMode ? 'YES' : 'NO'}`);
    
    // Initialize scraper
    const scraper = new ComprehensiveJobScraper();
    
    // Set options
    const options = {
      maxJobs: quickMode ? 20 : maxJobs, // In quick mode, limit to 20
      batchSize: batchSize
    };
    
    // Start scraping
    const result = await scraper.scrapeAllJobs(options);
    
    if (result.success) {
      console.log(`\\n🎉 COMPREHENSIVE SCRAPING COMPLETE!`);
      console.log(`📊 Results: ${result.jobsExtracted}/${result.jobsProcessed} jobs extracted (${result.successRate}% success rate)`);
      
      res.json({
        success: true,
        message: `Successfully scraped ${result.jobsExtracted} jobs from expatriates.com`,
        stats: {
          totalUrlsFound: result.totalUrlsFound,
          jobsProcessed: result.jobsProcessed,
          jobsExtracted: result.jobsExtracted,
          failedExtractions: result.failedExtractions,
          successRate: result.successRate
        },
        summary: result.summary,
        data: result.data,
        csvExported: true,
        note: quickMode ? 'Quick mode: Limited to 20 jobs for testing' : 'Full scrape completed',
        scraped_at: new Date().toISOString()
      });
      
    } else {
      throw new Error('Comprehensive scraping failed');
    }
    
  } catch (error) {
    console.error('❌ Comprehensive scraper error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to scrape all jobs',
      suggestion: 'Try using ?quick=true for a smaller test batch'
    });
  }
};
