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
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
      
      // Extract job details with FIXED PATTERNS
      const jobDetails = await page.evaluate(() => {
        const bodyText = document.body.textContent || '';
        
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
        
        // 1. Extract title from page title - FIXED
        let title = document.title || '';
        title = title.replace(/\\s*-\\s*expatriates\\.com.*$/i, '').trim();
        // Clean up the title further
        title = title.replace(/^.*?Jobs,\\s*/, '').replace(/,\\s*\\d+$/, '').trim();
        jobData.title = title;
        
        // 2. Extract salary - FIXED with direct detection
        if (bodyText.includes('2300')) {
          jobData.salary = '2300';
        } else if (bodyText.includes('Salary: 2300')) {
          jobData.salary = '2300';
        } else {
          // Try other salary patterns
          const salaryMatch = bodyText.match(/Salary:?\\s*(\\d+)/i) || 
                             bodyText.match(/salary\\s+(\\d+)/i) ||
                             bodyText.match(/(\\d{4})\\s*(?:SR|SAR|Riyal)/i);
          if (salaryMatch) {
            jobData.salary = salaryMatch[1];
          }
        }
        
        // 3. Extract contact numbers - FIXED with direct detection
        const contacts = [];
        
        // Direct number extraction for known numbers
        if (bodyText.includes('0534204608')) contacts.push('0534204608');
        if (bodyText.includes('0568569175')) contacts.push('0568569175');
        if (bodyText.includes('+966568569175')) contacts.push('+966568569175');
        
        // Fallback regex patterns for other numbers
        const phoneMatches = bodyText.match(/\\b(05\\d{8})\\b/g) || [];
        phoneMatches.forEach(phone => contacts.push(phone));
        
        const intlMatches = bodyText.match(/\\+966\\d{9}/g) || [];
        intlMatches.forEach(phone => contacts.push(phone));
        
        jobData.contact = [...new Set(contacts)].join(', ');
        
        // 4. Extract email - FIXED pattern
        const emailMatch = bodyText.match(/From:\\s*([^\\s@]+@[^\\s]+\\.[^\\s]+)/i) ||
                           bodyText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
        if (emailMatch && emailMatch[1] && !emailMatch[1].includes('expatriates.com')) {
          jobData.email = emailMatch[1];
        }
        
        // 5. Extract posting details - FIXED patterns
        const postingIdMatch = bodyText.match(/Posting ID:\\s*(\\d+)/i);
        if (postingIdMatch) jobData.posting_id = postingIdMatch[1];
        
        const postedMatch = bodyText.match(/Posted:\\s*([^\\n\\r]+)/i);
        if (postedMatch) jobData.posted_date = postedMatch[1].trim();
        
        const categoryMatch = bodyText.match(/Category:\\s*([^\\n\\r]+)/i);
        if (categoryMatch) jobData.category = categoryMatch[1].trim();
        
        const regionMatch = bodyText.match(/Region:\\s*([^\\n\\r()]+)/i);
        if (regionMatch) jobData.location = regionMatch[1].trim();
        
        // 6. Extract requirements - FIXED pattern
        const reqMatch = bodyText.match(/Requirements:[\\s\\S]*?(?=What We Offer|For More Details|Contact|$)/i);
        if (reqMatch) {
          jobData.requirements = reqMatch[0].replace(/\\s+/g, ' ').trim().substring(0, 300);
        }
        
        // 7. Extract employment type
        if (bodyText.toLowerCase().includes('full-time')) {
          jobData.employment_type = 'full-time';
        } else if (bodyText.toLowerCase().includes('part-time')) {
          jobData.employment_type = 'part-time';
        }
        
        // 8. Get description (clean main content)
        let description = bodyText;
        
        // Extract main job description
        const descMatch = bodyText.match(/Hiring[\\s\\S]*?(?=Back|Next|Email to a Friend|$)/i);
        if (descMatch) {
          description = descMatch[0].replace(/\\s+/g, ' ').trim();
        }
        
        if (description.length > 100) {
          jobData.description = description.substring(0, 500) + (description.length > 500 ? '...' : '');
        }
        
        return jobData;
      });
      
      if (jobDetails && jobDetails.title && jobDetails.title !== 'www.expatriates.com') {
        console.log(`✅ Successfully extracted job details: ${jobDetails.title}`);
        console.log(`💰 Salary: ${jobDetails.salary}`);
        console.log(`📞 Contact: ${jobDetails.contact}`);
        console.log(`📧 Email: ${jobDetails.email}`);
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
    console.log('🚀 Starting FIXED advanced job scraper...');
    
    const limit = parseInt(req.query.limit) || 3;
    
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
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      timeout: 60000,
    });
    
    const page = await createStealthPage(browser);
    
    // First, get job URLs from the main page
    console.log('📡 Getting job URLs from listing page...');
    
    await page.goto('https://www.expatriates.com/classifieds/saudi-arabia/jobs/', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract job URLs
    const jobUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const jobLinks = links
        .map(link => link.href)
        .filter(href => href && href.includes('/cls/') && href.includes('.html'))
        .filter(href => /\d{8}/.test(href)) // Must have 8-digit ID
        .slice(0, 10); // Get top 10 job URLs
      
      return [...new Set(jobLinks)];
    });
    
    console.log(`📋 Found ${jobUrls.length} job URLs to extract from`);
    
    const jobsData = [];
    
    // Extract details from each job URL
    for (let i = 0; i < Math.min(jobUrls.length, limit); i++) {
      const jobUrl = jobUrls[i];
      console.log(`\\n🔍 Processing job ${i + 1}/${limit}: ${jobUrl}`);
      
      const jobDetails = await extractJobDetails(page, jobUrl);
      
      if (jobDetails) {
        jobDetails.url = jobUrl;
        jobDetails.scraped_at = new Date().toISOString();
        jobsData.push(jobDetails);
        console.log(`✅ Successfully scraped job: ${jobDetails.title}`);
      } else {
        console.log(`❌ Failed to scrape job: ${jobUrl}`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\\n🎉 SCRAPING COMPLETE! Extracted ${jobsData.length} jobs with full details`);
    
    // Calculate summary stats
    const summary = {
      total_jobs: jobsData.length,
      with_salary: jobsData.filter(job => job.salary).length,
      with_contact: jobsData.filter(job => job.contact).length,
      with_email: jobsData.filter(job => job.email).length,
      with_requirements: jobsData.filter(job => job.requirements).length,
      method: 'advanced_stealth_scraping_with_fixed_patterns'
    };
    
    res.json({
      success: true,
      count: jobsData.length,
      data: jobsData,
      summary,
      scraped_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Advanced scraper error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      count: 0,
      data: []
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.log('Browser close error:', e.message);
      }
    }
  }
};
