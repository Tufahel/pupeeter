const puppeteer = require('puppeteer');

/**
 * ANALYSIS ENDPOINT - Provides detailed stats about sponsored vs regular jobs
 * This endpoint analyzes job distribution and detection accuracy
 */

async function jobsAnalysisHandler(req, res) {
  let browser = null;
  
  try {
    console.log('📊 Starting Jobs Analysis...');
    
    const startTime = Date.now();
    const pagesToAnalyze = parseInt(req.query.pages) || 3;
    const detailed = req.query.detailed === 'true';
    
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false' ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const analysis = {
      pages_analyzed: 0,
      total_jobs_found: 0,
      sponsored_jobs: 0,
      regular_jobs: 0,
      unknown_jobs: 0,
      accuracy_percentage: 0,
      page_breakdown: [],
      patterns: {
        sponsored_endings: {},
        regular_endings: {},
        unknown_patterns: []
      }
    };
    
    let detailedJobs = [];
    
    for (let currentPage = 1; currentPage <= pagesToAnalyze; currentPage++) {
      try {
        // Generate correct URL based on pagination pattern
        let listingUrl;
        if (currentPage === 1) {
          listingUrl = 'https://www.expatriates.com/classifieds/saudi-arabia/jobs/';
        } else {
          const indexNumber = (currentPage - 1) * 100;
          listingUrl = `https://www.expatriates.com/classifieds/saudi-arabia/jobs/index${indexNumber}.html`;
        }
        
        console.log(`📄 Analyzing page ${currentPage}: ${listingUrl}`);
        
        await page.goto(listingUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Analyze jobs on this page
        const pageAnalysis = await page.evaluate((detailed) => {
          const jobElements = Array.from(document.querySelectorAll('a'));
          const pageJobs = [];
          let pageSponsored = 0;
          let pageRegular = 0;
          let pageUnknown = 0;
          
          const sponsoredPatterns = {};
          const regularPatterns = {};
          const unknownPatterns = [];
          
          jobElements.forEach(link => {
            const href = link.href;
            
            // Check if it's a valid job URL
            if (href && href.includes('/cls/') && href.includes('.html') && /\d{8}/.test(href)) {
              const parentText = link.parentElement ? link.parentElement.textContent.trim() : '';
              const jobTitle = link.textContent.trim();
              
              // Classification logic
              const isSponsored = parentText.endsWith('Sponsored');
              const timestampPattern = /\w{3}, \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2} [AP]M - (\d+ \w+ ago|an hour ago|a day ago)$/;
              const hasTimestamp = timestampPattern.test(parentText);
              
              let classification = 'unknown';
              if (isSponsored) {
                classification = 'sponsored';
                pageSponsored++;
                
                // Track sponsored ending patterns
                const ending = parentText.slice(-20);
                sponsoredPatterns[ending] = (sponsoredPatterns[ending] || 0) + 1;
                
              } else if (hasTimestamp) {
                classification = 'regular';
                pageRegular++;
                
                // Track regular ending patterns  
                const timeMatch = parentText.match(/\d+ \w+ ago$/);
                if (timeMatch) {
                  const ending = timeMatch[0];
                  regularPatterns[ending] = (regularPatterns[ending] || 0) + 1;
                }
                
              } else {
                classification = 'unknown';
                pageUnknown++;
                unknownPatterns.push(parentText.slice(-50));
              }
              
              if (detailed) {
                pageJobs.push({
                  title: jobTitle.substring(0, 80),
                  url: href,
                  classification,
                  parentText: parentText.substring(0, 120),
                  isSponsored,
                  hasTimestamp
                });
              }
            }
          });
          
          return {
            jobs: pageJobs,
            sponsored: pageSponsored,
            regular: pageRegular,
            unknown: pageUnknown,
            total: pageSponsored + pageRegular + pageUnknown,
            sponsoredPatterns,
            regularPatterns,
            unknownPatterns: unknownPatterns.slice(0, 10) // Limit unknown patterns
          };
        }, detailed);
        
        // Add to overall analysis
        analysis.pages_analyzed++;
        analysis.total_jobs_found += pageAnalysis.total;
        analysis.sponsored_jobs += pageAnalysis.sponsored;
        analysis.regular_jobs += pageAnalysis.regular;
        analysis.unknown_jobs += pageAnalysis.unknown;
        
        analysis.page_breakdown.push({
          page: currentPage,
          url: listingUrl,
          total: pageAnalysis.total,
          sponsored: pageAnalysis.sponsored,
          regular: pageAnalysis.regular,
          unknown: pageAnalysis.unknown,
          sponsored_percentage: pageAnalysis.total > 0 ? ((pageAnalysis.sponsored / pageAnalysis.total) * 100).toFixed(1) : 0
        });
        
        // Merge patterns
        Object.entries(pageAnalysis.sponsoredPatterns).forEach(([pattern, count]) => {
          analysis.patterns.sponsored_endings[pattern] = (analysis.patterns.sponsored_endings[pattern] || 0) + count;
        });
        
        Object.entries(pageAnalysis.regularPatterns).forEach(([pattern, count]) => {
          analysis.patterns.regular_endings[pattern] = (analysis.patterns.regular_endings[pattern] || 0) + count;
        });
        
        analysis.patterns.unknown_patterns.push(...pageAnalysis.unknownPatterns);
        
        if (detailed) {
          detailedJobs.push(...pageAnalysis.jobs);
        }
        
        console.log(`📊 Page ${currentPage}: ${pageAnalysis.total} jobs (${pageAnalysis.sponsored} sponsored, ${pageAnalysis.regular} regular, ${pageAnalysis.unknown} unknown)`);
        
      } catch (error) {
        console.error(`❌ Error analyzing page ${currentPage}:`, error.message);
      }
    }
    
    // Calculate final statistics
    const classifiedJobs = analysis.sponsored_jobs + analysis.regular_jobs;
    analysis.accuracy_percentage = analysis.total_jobs_found > 0 ? 
      ((classifiedJobs / analysis.total_jobs_found) * 100).toFixed(1) : 0;
    
    // Clean up unknown patterns (remove duplicates and limit)
    analysis.patterns.unknown_patterns = [...new Set(analysis.patterns.unknown_patterns)].slice(0, 20);
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    const response = {
      success: true,
      message: `Analysis completed: ${analysis.total_jobs_found} jobs analyzed across ${analysis.pages_analyzed} pages`,
      processing_time: `${processingTime} seconds`,
      analysis,
      recommendations: {
        sponsored_detection: analysis.sponsored_jobs > 0 ? 'Working correctly - jobs ending with "Sponsored" detected' : 'No sponsored jobs found',
        regular_detection: analysis.regular_jobs > 0 ? 'Working correctly - jobs with timestamps detected' : 'No regular jobs found', 
        accuracy: parseFloat(analysis.accuracy_percentage) > 95 ? 'Excellent' : 
                 parseFloat(analysis.accuracy_percentage) > 85 ? 'Good' : 'Needs improvement',
        unknown_jobs: analysis.unknown_jobs > 0 ? `${analysis.unknown_jobs} jobs need pattern review` : 'All jobs classified successfully'
      }
    };
    
    if (detailed) {
      response.detailed_jobs = detailedJobs;
    }
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Jobs analysis failed'
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = jobsAnalysisHandler;
