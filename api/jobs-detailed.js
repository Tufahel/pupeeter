const puppeteer = require('puppeteer');

async function scrapeJobDetails(page, jobUrl) {
  try {
    console.log(`📄 Scraping job details from: ${jobUrl}`);
    
    await page.goto(jobUrl, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    const jobDetails = await page.evaluate(() => {
      // Try different selectors for job details
      const titleSelectors = [
        'h1',
        '.listing-title',
        '.job-title',
        '.classified-title',
        '[class*="title"]'
      ];
      
      const descriptionSelectors = [
        '.listing-description',
        '.job-description',
        '.classified-description',
        '.description',
        '[class*="description"]',
        '.listing-body',
        '.content',
        'p'
      ];
      
      const detailSelectors = [
        '.listing-details',
        '.job-details',
        '.classified-details',
        '.details',
        '[class*="detail"]'
      ];
      
      // Get title
      let title = '';
      for (const selector of titleSelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          title = el.textContent.trim();
          break;
        }
      }
      
      // Get description
      let description = '';
      for (const selector of descriptionSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          if (el.textContent.trim().length > 50) {
            description = el.textContent.trim();
            break;
          }
        }
        if (description) break;
      }
      
      // Get additional details
      const details = {};
      const detailElements = document.querySelectorAll('.listing-detail, .detail-item, tr');
      detailElements.forEach(el => {
        const text = el.textContent.trim();
        if (text.includes(':')) {
          const [key, value] = text.split(':').map(s => s.trim());
          if (key && value && key.length < 50 && value.length < 200) {
            details[key.toLowerCase().replace(/\s+/g, '_')] = value;
          }
        }
      });
      
      // Try to extract specific job information
      const extractInfo = (patterns) => {
        const text = (document.body.textContent || '').toLowerCase();
        for (const [key, pattern] of Object.entries(patterns)) {
          const match = text.match(pattern);
          if (match) {
            details[key] = match[1] || match[0];
          }
        }
      };
      
      extractInfo({
        salary: /salary[\s:]+([^.\n]+)/,
        experience: /experience[\s:]+([^.\n]+)/,
        location: /location[\s:]+([^.\n]+)/,
        company: /company[\s:]+([^.\n]+)/,
        employment_type: /(full[\s-]?time|part[\s-]?time|contract|temporary|permanent)/,
        education: /education[\s:]+([^.\n]+)/,
        skills: /skills[\s:]+([^.\n]+)/
      });
      
      return {
        title: title || 'No title found',
        description: description || 'No description found',
        details: details,
        fullText: document.body.textContent?.substring(0, 1000) || ''
      };
    });
    
    return jobDetails;
  } catch (error) {
    console.error(`❌ Error scraping job details from ${jobUrl}:`, error.message);
    return {
      title: 'Error loading job',
      description: 'Could not load job details',
      details: {},
      fullText: '',
      error: error.message
    };
  }
}

module.exports = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting enhanced job scraping...');
    
    // Launch browser with optimized settings
    const puppeteerOptions = {
      headless: process.env.PUPPETEER_HEADLESS !== 'false' ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-default-apps',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--window-size=1920,1080',
      ],
      timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 60000,
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Navigating to main job listings...');
    await page.goto('https://www.expatriates.com/classifieds/saudi-arabia/jobs/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('🔍 Extracting job URLs...');
    const jobUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/cls/"], a[href*="/classifieds/"]'));
      const urls = links.map(link => {
        const href = link.getAttribute('href');
        if (href) {
          return href.startsWith('http') ? href : 'https://www.expatriates.com' + href;
        }
        return null;
      }).filter(url => url && (url.includes('/cls/') || url.includes('/classifieds/')));
      
      // Remove duplicates
      return [...new Set(urls)];
    });

    console.log(`📋 Found ${jobUrls.length} job URLs to scrape`);
    
    // Limit the number of jobs to scrape (to avoid timeout)
    const maxJobs = parseInt(req.query.limit) || 10;
    const urlsToScrape = jobUrls.slice(0, maxJobs);
    
    console.log(`🎯 Scraping details for ${urlsToScrape.length} jobs...`);
    
    const jobs = [];
    for (let i = 0; i < urlsToScrape.length; i++) {
      const url = urlsToScrape[i];
      console.log(`📄 Processing job ${i + 1}/${urlsToScrape.length}: ${url}`);
      
      // If it's a category URL, skip detailed scraping (just add as category)
      if (url.includes('/classifieds/') && url.endsWith('/jobs/')) {
        jobs.push({
          title: `Job Category: ${url.split('/').slice(-3, -2)[0]}`,
          url: url,
          date_posted: new Date().toISOString(),
          location: 'Saudi Arabia',
          description: 'This is a job category page with multiple listings',
          type: 'category',
          scraped_at: new Date().toISOString()
        });
        continue;
      }
      
      // For individual job URLs (/cls/ links), scrape full details
      if (url.includes('/cls/')) {
        const jobDetails = await scrapeJobDetails(page, url);
        
        jobs.push({
          title: jobDetails.title,
          url: url,
          date_posted: new Date().toISOString(),
          location: jobDetails.details.location || 'Saudi Arabia',
          description: jobDetails.description,
          salary: jobDetails.details.salary || null,
          experience: jobDetails.details.experience || null,
          company: jobDetails.details.company || null,
          employment_type: jobDetails.details.employment_type || null,
          education: jobDetails.details.education || null,
          skills: jobDetails.details.skills || null,
          additional_details: jobDetails.details,
          type: 'job_detail',
          scraped_at: new Date().toISOString(),
          error: jobDetails.error || null
        });
      }
      
      // Small delay to be respectful to the server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await browser.close();
    
    console.log(`✅ Successfully scraped ${jobs.length} jobs with full details`);
    
    const response = {
      success: true,
      count: jobs.length,
      data: jobs,
      scraped_at: new Date().toISOString(),
      summary: {
        job_details: jobs.filter(j => j.type === 'job_detail').length,
        categories: jobs.filter(j => j.type === 'category').length,
        with_salary: jobs.filter(j => j.salary).length,
        with_company: jobs.filter(j => j.company).length,
        errors: jobs.filter(j => j.error).length
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error during enhanced scraping:', error);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
