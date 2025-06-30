const puppeteer = require('puppeteer');

module.exports = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting job scraping...');
    
    // Launch browser with optimized settings for deployment
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
        '--disable-images', // Speed up loading
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

    // Use custom executable path if provided (for deployment)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(puppeteerOptions);

    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Navigating to target website...');
    await page.goto('https://www.expatriates.com/classifieds/saudi-arabia/jobs/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Take a screenshot for debugging (optional)
    if (process.env.NODE_ENV === 'development') {
      await page.screenshot({ path: 'debug-screenshot.png' });
      console.log('📸 Debug screenshot saved');
    }

    console.log('🔍 Extracting job data...');
    const jobs = await page.evaluate(() => {
      // Debug: log what we're finding
      console.log('Page title:', document.title);
      
      // Try multiple selectors to find job listings
      const selectors = [
        'ul.listings > li',
        '.listing-item',
        '.job-listing',
        '[class*="listing"]',
        'tr[class*="listing"]',
        '.classified-listing'
      ];
      
      let list = [];
      for (const selector of selectors) {
        list = Array.from(document.querySelectorAll(selector));
        console.log(`Selector "${selector}" found:`, list.length, 'elements');
        if (list.length > 0) break;
      }
      
      // If we still don't have listings, try a more general approach
      if (list.length === 0) {
        // Look for links that might be job listings
        const links = Array.from(document.querySelectorAll('a[href*="/classifieds/saudi-arabia/jobs/"]'));
        console.log('Found job links:', links.length);
        
        return links.slice(0, 10).map((link, index) => {
          const title = link.textContent?.trim().replace(/\s+/g, ' ') || `Job Listing ${index + 1}`;
          const url = link.href.startsWith('http') ? link.href : 'https://www.expatriates.com' + link.getAttribute('href');
          
          return {
            title: title.length > 100 ? title.substring(0, 100) + '...' : title,
            url: url,
            date_posted: new Date().toISOString(),
            location: 'Saudi Arabia',
            description: title.length > 200 ? title.substring(0, 200) + '...' : title,
            scraped_at: new Date().toISOString()
          };
        });
      }
      
      // Process the found listings
      return list.slice(0, 20).map((el, index) => {
        const a = el.querySelector('a') || el.closest('a');
        let title = '';
        let url = '';
        let description = '';
        
        if (a) {
          title = a.textContent?.trim().replace(/\s+/g, ' ') || '';
          url = a.href?.startsWith('http') ? a.href : 'https://www.expatriates.com' + (a.getAttribute('href') || '');
        } else {
          title = el.textContent?.trim().replace(/\s+/g, ' ') || `Listing ${index + 1}`;
          url = 'https://www.expatriates.com/classifieds/saudi-arabia/jobs/';
        }
        
        // Clean up title
        title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Try to get description from various elements
        const descEl = el.querySelector('p, .description, .listing-description') || el;
        description = descEl.textContent?.trim().replace(/\s+/g, ' ') || title;
        
        // Try to get date
        const dateEl = el.querySelector('time, .date, .listing-date');
        const date = dateEl?.getAttribute('datetime') || dateEl?.textContent || '';
        
        // Skip if title is too short or just whitespace
        if (title.length < 3 || title.match(/^\s*$/)) {
          return null;
        }
        
        return { 
          title: title.length > 100 ? title.substring(0, 100) + '...' : title,
          url: url,
          date_posted: date || new Date().toISOString(),
          location: 'Saudi Arabia',
          description: description.length > 200 ? description.substring(0, 200) + '...' : description,
          scraped_at: new Date().toISOString()
        };
      }).filter(job => job !== null);
    });

    await browser.close();
    
    console.log(`✅ Successfully scraped ${jobs.length} jobs`);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
      scraped_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during scraping:', error);
    
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
