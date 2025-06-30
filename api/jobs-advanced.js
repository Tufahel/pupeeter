const puppeteer = require('puppeteer');

// Enhanced stealth configuration to bypass Cloudflare
async function createStealthPage(browser) {
  const page = await browser.newPage();
  
  // Remove automation indicators
  await page.evaluateOnNewDocument(() => {
    // Remove webdriver property
    delete navigator.__proto__.webdriver;
    
    // Mock chrome property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    
    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  // Set realistic viewport and user agent
  await page.setViewport({ 
    width: 1920, 
    height: 1080,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  });
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  });
  
  return page;
}

async function extractJobDetails(page, jobUrl, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt}/${retries}: Getting details from ${jobUrl}`);
      
      // Navigate with longer timeout
      await page.goto(jobUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check for Cloudflare challenge
      const isCloudflareChallenge = await page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        const title = document.title.toLowerCase();
        return title.includes('just a moment') || 
               bodyText.includes('checking your browser') ||
               bodyText.includes('enable javascript and cookies') ||
               bodyText.includes('cloudflare') ||
               bodyText.includes('verify you are human');
      });
      
      if (isCloudflareChallenge) {
        console.log(`⚠️ Cloudflare challenge detected on attempt ${attempt}, waiting...`);
        
        // Wait longer for challenge to resolve
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Try to wait for content to appear
        try {
          await page.waitForFunction(() => {
            const bodyText = document.body.textContent.toLowerCase();
            return !bodyText.includes('checking your browser') && 
                   !bodyText.includes('verify you are human') &&
                   bodyText.length > 500;
          }, { timeout: 15000 });
        } catch (e) {
          console.log(`⚠️ Challenge timeout on attempt ${attempt}`);
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            continue;
          }
        }
      }
      
      // Extract job details
      const jobDetails = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        const innerHTML = document.body.innerHTML || '';
        
        // Skip if still showing challenge
        if (bodyText.toLowerCase().includes('verify you are human') || 
            bodyText.toLowerCase().includes('checking your browser')) {
          return null;
        }
        
        // Initialize job data
        const jobData = {
          title: '',
          description: '',
          salary: '',
          location: '',
          contact: '',
          company: '',
          requirements: '',
          benefits: '',
          employment_type: '',
          experience: '',
          posting_id: '',
          posted_date: '',
          category: '',
          email: ''
        };
        
        // Extract title from various sources
        let title = document.title || '';
        title = title.replace(/\s*-\s*expatriates\.com.*$/i, '').trim();
        
        // Look for job title patterns in the content
        const titlePatterns = [
          /Hiring For ([^\\n\\r]+)/i,
          /Position: ([^\\n\\r]+)/i,
          /Job Title: ([^\\n\\r]+)/i,
          /Looking for ([^\\n\\r]+)/i,
        ];
        
        for (const pattern of titlePatterns) {
          const match = bodyText.match(pattern);
          if (match && match[1].trim().length > title.length) {
            title = match[1].trim();
          }
        }
        jobData.title = title;
        
        // Extract posting details
        const postingIdMatch = bodyText.match(/Posting ID: (\\d+)/i);
        if (postingIdMatch) jobData.posting_id = postingIdMatch[1];
        
        const postedMatch = bodyText.match(/Posted: ([^\\n\\r]+)/i);
        if (postedMatch) jobData.posted_date = postedMatch[1].trim();
        
        const categoryMatch = bodyText.match(/Category: ([^\\n\\r]+)/i);
        if (categoryMatch) jobData.category = categoryMatch[1].trim();
        
        const regionMatch = bodyText.match(/Region: ([^\\n\\r()]+)/i);
        if (regionMatch) jobData.location = regionMatch[1].trim();
        
        // Extract contact information
        const phonePatterns = [
          /\\+966[\\d\\s-]{9,}/g,
          /05[\\d\\s-]{8,}/g,
          /01[\\d\\s-]{8,}/g,
          /0\\d{9}/g
        ];
        
        const phones = [];
        for (const pattern of phonePatterns) {
          const matches = bodyText.match(pattern);
          if (matches) {
            phones.push(...matches.map(p => p.trim()));
          }
        }
        jobData.contact = [...new Set(phones)].join(', ');
        
        // Extract email
        const emailMatch = bodyText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
        if (emailMatch) jobData.email = emailMatch[1];
        
        // Extract salary
        const salaryPatterns = [
          /Salary:?\\s*(\\d+[^\\n\\r]*)/i,
          /salary\\s*(\\d+[^\\n\\r]*)/gi,
          /(\\d+)\\s*(?:sr|sar|riyal)/gi,
          /fixed salary[^\\n\\r]*?(\\d+)/gi
        ];
        
        for (const pattern of salaryPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            jobData.salary = match[1] || match[0];
            break;
          }
        }
        
        // Extract employment type
        const employmentTypes = ['full-time', 'part-time', 'contract', 'temporary', 'permanent'];
        for (const type of employmentTypes) {
          if (bodyText.toLowerCase().includes(type)) {
            jobData.employment_type = type;
            break;
          }
        }
        
        // Extract requirements section
        const reqMatch = bodyText.match(/(?:Requirements?|Qualifications?):[\\s\\S]*?(?=(?:What We Offer|Benefits|Contact|$))/i);
        if (reqMatch) {
          jobData.requirements = reqMatch[0].substring(0, 300).trim();
        }
        
        // Extract benefits section
        const benefitsMatch = bodyText.match(/(?:What We Offer|Benefits?):[\\s\\S]*?(?=(?:Requirements|Contact|$))/i);
        if (benefitsMatch) {
          jobData.benefits = benefitsMatch[0].substring(0, 300).trim();
        }
        
        // Get description (main content)
        let description = bodyText.replace(/\\s+/g, ' ').trim();
        // Remove common noise
        description = description.replace(/Verify you are human.*?$/, '');
        description = description.replace(/www\\.expatriates\\.com.*?$/, '');
        
        if (description.length > 100) {
          jobData.description = description.substring(0, 500) + (description.length > 500 ? '...' : '');
        }
        
        return jobData;
      });
      
      if (jobDetails && jobDetails.title && jobDetails.title !== 'www.expatriates.com') {
        console.log(`✅ Successfully extracted job details: ${jobDetails.title}`);
        return jobDetails;
      }
      
      console.log(`⚠️ No meaningful data extracted on attempt ${attempt}`);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.log(`❌ Error on attempt ${attempt}:`, error.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  
  return null;
}

module.exports = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting advanced job scraper with Cloudflare bypass...');
    
    // Launch browser with stealth configuration
    browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false' ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-sync',
        '--metrics-recording-only',
        '--disable-default-apps',
        '--no-default-browser-check',
        '--no-first-run',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-hang-monitor',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: 60000,
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
      })
    });
    
    const page = await createStealthPage(browser);
    
    // Test URLs from your data
    const testJobUrls = [
      'https://www.expatriates.com/cls/59966970.html',
      'https://www.expatriates.com/cls/60161086.html',
      'https://www.expatriates.com/cls/60193487.html'
    ];
    
    const limit = parseInt(req.query.limit) || 3;
    const jobs = [];
    
    console.log(`🎯 Testing ${Math.min(testJobUrls.length, limit)} specific job URLs...`);
    
    for (let i = 0; i < Math.min(testJobUrls.length, limit); i++) {
      const jobUrl = testJobUrls[i];
      console.log(`📄 Processing job ${i + 1}/${Math.min(testJobUrls.length, limit)}`);
      
      const jobDetails = await extractJobDetails(page, jobUrl);
      
      if (jobDetails) {
        jobs.push({
          id: jobDetails.posting_id || jobUrl.split('/').pop()?.replace('.html', ''),
          title: jobDetails.title,
          url: jobUrl,
          description: jobDetails.description,
          location: jobDetails.location || 'Saudi Arabia',
          salary: jobDetails.salary || null,
          contact: jobDetails.contact || null,
          email: jobDetails.email || null,
          company: jobDetails.company || null,
          employment_type: jobDetails.employment_type || null,
          requirements: jobDetails.requirements || null,
          benefits: jobDetails.benefits || null,
          category: jobDetails.category || null,
          posted_date: jobDetails.posted_date || null,
          posting_id: jobDetails.posting_id || null,
          scraped_at: new Date().toISOString()
        });
      } else {
        jobs.push({
          id: jobUrl.split('/').pop()?.replace('.html', ''),
          title: 'Failed to extract',
          url: jobUrl,
          description: 'Could not bypass Cloudflare protection',
          location: 'Saudi Arabia',
          error: 'Cloudflare blocked',
          scraped_at: new Date().toISOString()
        });
      }
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await browser.close();
    
    const successfulJobs = jobs.filter(j => !j.error);
    console.log(`✅ Successfully extracted ${successfulJobs.length}/${jobs.length} jobs`);
    
    res.status(200).json({
      success: true,
      count: jobs.length,
      successful_extractions: successfulJobs.length,
      data: jobs,
      scraped_at: new Date().toISOString(),
      summary: {
        with_salary: jobs.filter(j => j.salary).length,
        with_contact: jobs.filter(j => j.contact).length,
        with_email: jobs.filter(j => j.email).length,
        with_requirements: jobs.filter(j => j.requirements).length,
        errors: jobs.filter(j => j.error).length,
        method: 'advanced_stealth_scraping'
      }
    });
    
  } catch (error) {
    console.error('❌ Error during advanced scraping:', error);
    
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
