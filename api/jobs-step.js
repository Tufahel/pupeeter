const ComprehensiveJobScraper = require('./jobs-all-comprehensive');

/**
 * API Endpoint: Step-by-step job scraping with pagination
 * This allows you to scrape jobs in manageable batches
 */

// Store scraping state in memory (in production, use Redis or database)
const scrapingState = {
  totalUrls: 0,
  processedUrls: 0,
  allUrls: [],
  isInitialized: false,
  lastUpdated: null
};

module.exports = async (req, res) => {
  try {
    console.log('🚀 Starting STEP-BY-STEP job scraper');
    
    // Parse query parameters
    const action = req.query.action || 'scrape'; // 'init', 'scrape', 'status'
    const batchSize = parseInt(req.query.batchSize) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const scraper = new ComprehensiveJobScraper();
    
    // Action: Initialize - Get all URLs first
    if (action === 'init') {
      console.log('🔍 Initializing: Discovering all job URLs...');
      
      const browser = await require('puppeteer').launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        const allUrls = await scraper.getAllJobUrls(page);
        
        // Update state
        scrapingState.totalUrls = allUrls.length;
        scrapingState.allUrls = allUrls;
        scrapingState.processedUrls = 0;
        scrapingState.isInitialized = true;
        scrapingState.lastUpdated = new Date().toISOString();
        
        console.log(`✅ Initialization complete: Found ${allUrls.length} job URLs`);
        
        res.json({
          success: true,
          action: 'initialized',
          totalUrls: allUrls.length,
          message: `Discovered ${allUrls.length} job URLs ready for scraping`,
          nextStep: `/api/jobs-step?action=scrape&batchSize=${batchSize}`,
          estimatedBatches: Math.ceil(allUrls.length / batchSize),
          estimatedTime: `${Math.ceil((allUrls.length * 3) / 60)} minutes`
        });
        
      } finally {
        await browser.close();
      }
      
      return;
    }
    
    // Action: Get Status
    if (action === 'status') {
      const progress = scrapingState.totalUrls > 0 
        ? Math.round((scrapingState.processedUrls / scrapingState.totalUrls) * 100)
        : 0;
        
      res.json({
        success: true,
        action: 'status',
        isInitialized: scrapingState.isInitialized,
        totalUrls: scrapingState.totalUrls,
        processedUrls: scrapingState.processedUrls,
        remainingUrls: scrapingState.totalUrls - scrapingState.processedUrls,
        progress: progress,
        isComplete: scrapingState.processedUrls >= scrapingState.totalUrls,
        lastUpdated: scrapingState.lastUpdated,
        nextBatch: scrapingState.processedUrls < scrapingState.totalUrls 
          ? `/api/jobs-step?action=scrape&offset=${scrapingState.processedUrls}&batchSize=${batchSize}`
          : null
      });
      
      return;
    }
    
    // Action: Scrape batch
    if (action === 'scrape') {
      if (!scrapingState.isInitialized) {
        return res.status(400).json({
          success: false,
          error: 'Not initialized',
          message: 'Please initialize first by calling /api/jobs-step?action=init'
        });
      }
      
      const startIndex = offset;
      const endIndex = Math.min(startIndex + batchSize, scrapingState.allUrls.length);
      const urlsToScrape = scrapingState.allUrls.slice(startIndex, endIndex);
      
      if (urlsToScrape.length === 0) {
        return res.json({
          success: true,
          action: 'complete',
          message: 'All jobs have been scraped!',
          totalProcessed: scrapingState.processedUrls
        });
      }
      
      console.log(`🔍 Scraping batch: ${startIndex + 1}-${endIndex} of ${scrapingState.totalUrls}`);
      
      const browser = await require('puppeteer').launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        const batchJobs = [];
        
        for (let i = 0; i < urlsToScrape.length; i++) {
          const jobUrl = urlsToScrape[i];
          const jobIndex = startIndex + i + 1;
          
          console.log(`📄 [${jobIndex}/${scrapingState.totalUrls}] ${jobUrl}`);
          
          const jobDetails = await scraper.extractJobFromUrl(page, jobUrl);
          
          if (jobDetails) {
            batchJobs.push(jobDetails);
            console.log(`✅ Extracted: ${jobDetails.title}`);
          } else {
            console.log(`❌ Failed to extract`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Update state
        scrapingState.processedUrls += urlsToScrape.length;
        scrapingState.lastUpdated = new Date().toISOString();
        
        // Save batch to CSV
        if (batchJobs.length > 0) {
          const csvResult = await scraper.csvExporter.saveJobsToCSV(batchJobs, {
            filename: `jobs_batch_${Math.floor(startIndex / batchSize) + 1}_${new Date().toISOString().slice(0, 10)}.csv`
          });
          console.log(`💾 Saved batch to: ${csvResult.filename}`);
        }
        
        const progress = Math.round((scrapingState.processedUrls / scrapingState.totalUrls) * 100);
        const isComplete = scrapingState.processedUrls >= scrapingState.totalUrls;
        
        res.json({
          success: true,
          action: 'batch_complete',
          batchResults: {
            processed: urlsToScrape.length,
            extracted: batchJobs.length,
            failed: urlsToScrape.length - batchJobs.length
          },
          progress: {
            current: scrapingState.processedUrls,
            total: scrapingState.totalUrls,
            percentage: progress,
            remaining: scrapingState.totalUrls - scrapingState.processedUrls
          },
          data: batchJobs,
          csvSaved: batchJobs.length > 0,
          isComplete: isComplete,
          nextBatch: !isComplete 
            ? `/api/jobs-step?action=scrape&offset=${scrapingState.processedUrls}&batchSize=${batchSize}`
            : null,
          message: isComplete 
            ? `🎉 ALL JOBS SCRAPED! Total: ${scrapingState.processedUrls} jobs`
            : `Batch complete. ${progress}% done. ${scrapingState.totalUrls - scrapingState.processedUrls} jobs remaining.`
        });
        
      } finally {
        await browser.close();
      }
      
      return;
    }
    
    // Invalid action
    res.status(400).json({
      success: false,
      error: 'Invalid action',
      validActions: ['init', 'scrape', 'status'],
      examples: [
        '/api/jobs-step?action=init',
        '/api/jobs-step?action=status',
        '/api/jobs-step?action=scrape&batchSize=20'
      ]
    });
    
  } catch (error) {
    console.error('❌ Step-by-step scraper error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Step-by-step scraping failed'
    });
  }
};
