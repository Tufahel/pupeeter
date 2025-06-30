const puppeteer = require('puppeteer');

module.exports = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting smart job scraping (avoiding Cloudflare)...');
    
    const puppeteerOptions = {
      headless: process.env.PUPPETEER_HEADLESS !== 'false' ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
      ],
      timeout: parseInt(process.env.PUPPETEER_TIMEOUT) || 60000,
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.setJavaScriptEnabled(true);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    const limit = parseInt(req.query.limit) || 15;
    const allJobs = [];
    
    // URLs to scrape (focus on listing pages to avoid individual job page issues)
    const cities = [
      { name: 'Riyadh', url: 'https://www.expatriates.com/classifieds/riyadh/jobs/' },
      { name: 'Jeddah', url: 'https://www.expatriates.com/classifieds/jeddah/jobs/' },
      { name: 'Dammam', url: 'https://www.expatriates.com/classifieds/dammam/jobs/' },
      { name: 'Khobar', url: 'https://www.expatriates.com/classifieds/khobar/jobs/' }
    ];
    
    console.log(`📋 Scraping from ${cities.length} city job listing pages...`);
    
    for (const city of cities) {
      try {
        console.log(`🏙️ Scraping jobs from ${city.name}...`);
        
        await page.goto(city.url, {
          waitUntil: 'networkidle2',
          timeout: 20000
        });
        
        // Wait for page to load
        await page.waitForTimeout(2000);
        
        const cityJobs = await page.evaluate((cityName) => {
          const jobs = [];
          
          // Try multiple selectors to find job listings
          const selectors = [
            'a[href*="/cls/"]',
            '.listing-title a',
            '.classified-title a',
            '.job-title a',
            'tr a[href*="/cls/"]',
            'table a[href*="/cls/"]'
          ];
          
          const foundLinks = new Set();
          
          for (const selector of selectors) {
            const links = document.querySelectorAll(selector);
            
            for (const link of links) {
              const href = link.getAttribute('href');
              if (href && href.includes('/cls/') && !foundLinks.has(href)) {
                foundLinks.add(href);
                
                const title = link.textContent?.trim() || 'Job Listing';
                const url = href.startsWith('http') ? href : 'https://www.expatriates.com' + href;
                
                // Try to get additional info from the parent element
                const parent = link.closest('tr, .listing, .classified, .job-item') || link.parentElement;
                const parentText = parent ? parent.textContent.trim() : '';
                
                // Extract information from the listing context
                const info = {
                  title: title.replace(/\s+/g, ' ').trim(),
                  url: url,
                  location: cityName,
                  date_posted: null,
                  salary: null,
                  company: null,
                  description: '',
                  employment_type: null,
                  skills: [],
                  contact: null,
                  job_id: href.match(/\/cls\/(\d+)/)?.[1] || null
                };
                
                // Extract salary from parent text
                const salaryMatch = parentText.match(/(\d+[\s,]*(?:sr|sar|riyal|monthly|yearly))/i);
                if (salaryMatch) {
                  info.salary = salaryMatch[1].trim();
                }
                
                // Extract phone numbers
                const phoneMatch = parentText.match(/(?:\+966|05|01)[\d\s-]{8,}/);
                if (phoneMatch) {
                  info.contact = phoneMatch[0];
                }
                
                // Extract employment type
                const employmentTypes = ['full-time', 'part-time', 'contract', 'temporary', 'permanent'];
                for (const type of employmentTypes) {
                  if (parentText.toLowerCase().includes(type)) {
                    info.employment_type = type;
                    break;
                  }
                }
                
                // Extract skills from listing text
                const skillKeywords = [
                  'english', 'arabic', 'driver', 'license', 'experience',
                  'excel', 'computer', 'management', 'sales', 'engineer',
                  'mechanic', 'technician', 'supervisor', 'assistant'
                ];
                
                const textLower = parentText.toLowerCase();
                for (const skill of skillKeywords) {
                  if (textLower.includes(skill)) {
                    info.skills.push(skill);
                  }
                }
                
                // Get a description from the parent text (first 200 chars)
                const cleanText = parentText.replace(/\s+/g, ' ').trim();
                if (cleanText.length > 50) {
                  info.description = cleanText.substring(0, 200) + (cleanText.length > 200 ? '...' : '');
                }
                
                jobs.push(info);
              }
            }
          }
          
          return jobs;
        }, city.name);
        
        console.log(`✅ Found ${cityJobs.length} jobs in ${city.name}`);
        allJobs.push(...cityJobs);
        
        // Add delay between cities
        await page.waitForTimeout(3000);
        
      } catch (error) {
        console.error(`❌ Error scraping ${city.name}:`, error.message);
      }
    }
    
    // Remove duplicates and limit results
    const uniqueJobs = allJobs.filter((job, index, self) => 
      index === self.findIndex(j => j.job_id === job.job_id)
    );
    
    const limitedJobs = uniqueJobs.slice(0, limit).map(job => ({
      ...job,
      scraped_at: new Date().toISOString()
    }));
    
    await browser.close();
    
    console.log(`✅ Successfully scraped ${limitedJobs.length} jobs from ${cities.length} cities`);
    
    const response = {
      success: true,
      count: limitedJobs.length,
      total_found: uniqueJobs.length,
      data: limitedJobs,
      scraped_at: new Date().toISOString(),
      summary: {
        cities: cities.map(c => c.name),
        with_salary: limitedJobs.filter(j => j.salary && j.salary !== '').length,
        with_contact: limitedJobs.filter(j => j.contact && j.contact !== '').length,
        with_skills: limitedJobs.filter(j => j.skills && j.skills.length > 0).length,
        employment_types: [...new Set(limitedJobs.map(j => j.employment_type))].filter(Boolean),
        job_categories: [...new Set(limitedJobs.map(j => {
          const title = j.title.toLowerCase();
          if (title.includes('driver')) return 'driver';
          if (title.includes('engineer')) return 'engineer';
          if (title.includes('manager')) return 'manager';
          if (title.includes('sales')) return 'sales';
          if (title.includes('mechanic')) return 'mechanic';
          if (title.includes('teacher')) return 'teacher';
          if (title.includes('nurse')) return 'nurse';
          return 'other';
        }))],
        method: 'smart_listing_scraping'
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error during smart scraping:', error);
    
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
