const puppeteer = require('puppeteer');

async function scrapeJobListings(page, listingUrl) {
  try {
    console.log(`📋 Scraping job listings from: ${listingUrl}`);
    
    await page.goto(listingUrl, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });

    const jobLinks = await page.evaluate(() => {
      // Look for individual job links
      const links = Array.from(document.querySelectorAll('a[href*="/cls/"]'));
      return links.map(link => {
        const href = link.getAttribute('href');
        const title = link.textContent?.trim() || 'No title';
        return {
          url: href.startsWith('http') ? href : 'https://www.expatriates.com' + href,
          title: title
        };
      }).filter(job => job.url.includes('/cls/'));
    });

    return jobLinks;
  } catch (error) {
    console.error(`❌ Error scraping listings from ${listingUrl}:`, error.message);
    return [];
  }
}

async function scrapeJobDetails(page, jobUrl) {
  try {
    console.log(`🔍 Getting details from: ${jobUrl}`);
    
    await page.goto(jobUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    // Wait a bit for any JavaScript to load
    await page.waitForTimeout(3000);
    
    // Check if we hit a Cloudflare challenge
    const isCloudflareChallenge = await page.evaluate(() => {
      return document.title.includes('Just a moment') || 
             document.body.textContent.includes('Enable JavaScript and cookies') ||
             document.body.textContent.includes('Cloudflare');
    });
    
    if (isCloudflareChallenge) {
      console.log('⚠️ Cloudflare challenge detected, waiting...');
      await page.waitForTimeout(5000);
      
      // Try to wait for the challenge to complete
      try {
        await page.waitForFunction(() => {
          return !document.title.includes('Just a moment') && 
                 !document.body.textContent.includes('Enable JavaScript and cookies');
        }, { timeout: 10000 });
      } catch (e) {
        console.log('⚠️ Cloudflare challenge timeout, proceeding anyway...');
      }
    }

    const jobDetails = await page.evaluate(() => {
      // Skip if still showing Cloudflare challenge
      if (document.title.includes('Just a moment') || 
          document.body.textContent.includes('Enable JavaScript and cookies')) {
        return {
          title: 'Cloudflare Challenge',
          description: 'Unable to bypass Cloudflare protection',
          location: 'Saudi Arabia',
          salary: null,
          company: null,
          contact: null,
          employment_type: null,
          experience: null,
          education: null,
          skills: [],
          error: 'Cloudflare challenge'
        };
      }

      // Initialize data object
      const data = {
        title: '',
        description: '',
        location: '',
        salary: '',
        company: '',
        contact: '',
        posted_date: '',
        employment_type: '',
        experience: '',
        education: '',
        skills: [],
        category: '',
        job_id: ''
      };

      // Get title - try multiple approaches
      let title = document.title || '';
      
      // Remove common suffixes from title
      title = title.replace(/\s*-\s*expatriates\.com.*$/i, '');
      title = title.replace(/\s*\|\s*.*$/i, '');
      title = title.trim();
      
      if (!title || title.length < 3) {
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent.trim();
      }
      
      // If still no good title, try to extract from content
      if (!title || title.length < 3) {
        const contentText = document.body.textContent || '';
        const lines = contentText.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 100);
        if (lines.length > 0) {
          title = lines[0];
        }
      }
      
      data.title = title;

      // Get main content - look for the job description
      let description = '';
      
      // Try to get content from tables (common structure for classified ads)
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const tableText = table.textContent?.trim() || '';
        if (tableText.length > description.length && tableText.length > 100) {
          description = tableText;
        }
      }
      
      // If no table content, try other selectors
      if (description.length < 100) {
        const contentSelectors = [
          '.listing-content',
          '.classified-content', 
          '.job-content',
          '.content',
          '.main-content',
          '#content',
          'main',
          '.container'
        ];
        
        for (const selector of contentSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent?.trim() || '';
            if (text.length > description.length && text.length > 100) {
              description = text;
            }
          }
        }
      }
      
      // Clean up description
      description = description.replace(/\s+/g, ' ').trim();
      data.description = description;

      // Extract structured information from the page text
      const fullText = document.body.textContent || '';
      const lines = fullText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Look for patterns in the text
      for (const line of lines) {
        const lower = line.toLowerCase();
        
        // Location extraction
        if ((lower.includes('location') || lower.includes('city') || lower.includes('area')) && line.includes(':')) {
          const match = line.match(/(?:location|city|area)[\s:]+(.+)/i);
          if (match && match[1].trim().length < 50) {
            data.location = match[1].trim();
          }
        }
        
        // Check for Saudi cities
        const saudiCities = ['riyadh', 'jeddah', 'dammam', 'khobar', 'jubail', 'medina', 'mecca', 'taif', 'abha'];
        for (const city of saudiCities) {
          if (lower.includes(city)) {
            data.location = city.charAt(0).toUpperCase() + city.slice(1);
            break;
          }
        }
        
        // Salary extraction
        if ((lower.includes('salary') || lower.includes('wage') || lower.includes('sr') || lower.includes('sar')) && 
            (line.includes(':') || /\d+/.test(line))) {
          const match = line.match(/(?:salary|wage)[\s:]*(.+)/i) || 
                       line.match(/(sr|sar)[\s]*([\d,]+)/i) ||
                       line.match(/(\d+[\s,]*(?:sr|sar|riyal))/i);
          if (match) {
            data.salary = match[1] || match[0];
            data.salary = data.salary.trim();
          }
        }
        
        // Company extraction
        if ((lower.includes('company') || lower.includes('employer') || lower.includes('organization')) && line.includes(':')) {
          const match = line.match(/(?:company|employer|organization)[\s:]+(.+)/i);
          if (match && match[1].trim().length < 100) {
            data.company = match[1].trim();
          }
        }
        
        // Contact extraction
        if (lower.includes('contact') || lower.includes('phone') || lower.includes('mobile') || lower.includes('email')) {
          const phoneMatch = line.match(/(?:\+966|05|01)[\d\s-]{8,}/);
          const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          if (phoneMatch || emailMatch) {
            data.contact = phoneMatch ? phoneMatch[0] : emailMatch[0];
          }
        }
        
        // Experience extraction
        if (lower.includes('experience') && line.includes(':')) {
          const match = line.match(/experience[\s:]+(.+)/i);
          if (match && match[1].trim().length < 100) {
            data.experience = match[1].trim();
          }
        }
        
        // Education extraction
        if ((lower.includes('education') || lower.includes('qualification') || lower.includes('degree')) && line.includes(':')) {
          const match = line.match(/(?:education|qualification|degree)[\s:]+(.+)/i);
          if (match && match[1].trim().length < 100) {
            data.education = match[1].trim();
          }
        }
      }

      // Extract employment type from full text
      const employmentTypes = ['full-time', 'part-time', 'contract', 'temporary', 'permanent', 'internship', 'freelance'];
      for (const type of employmentTypes) {
        if (fullText.toLowerCase().includes(type)) {
          data.employment_type = type;
          break;
        }
      }

      // Extract skills (common job skills)
      const skillKeywords = [
        'english', 'arabic', 'hindi', 'urdu',
        'microsoft office', 'excel', 'word', 'powerpoint', 'outlook',
        'autocad', 'photoshop', 'illustrator', 'corel draw',
        'programming', 'java', 'python', 'javascript', 'php', 'sql',
        'management', 'leadership', 'supervision', 'team lead',
        'sales', 'marketing', 'customer service', 'communication',
        'accounting', 'finance', 'bookkeeping', 'quickbooks',
        'driving', 'driver license', 'valid license',
        'mechanical', 'electrical', 'civil engineering', 'construction',
        'medical', 'nursing', 'healthcare', 'clinical'
      ];
      
      const foundSkills = [];
      const textLower = fullText.toLowerCase();
      for (const skill of skillKeywords) {
        if (textLower.includes(skill.toLowerCase())) {
          foundSkills.push(skill);
        }
      }
      data.skills = foundSkills;

      // Extract job ID from URL or page
      const urlMatch = window.location.href.match(/\/cls\/(\d+)/);
      if (urlMatch) {
        data.job_id = urlMatch[1];
      }

      // Try to get posted date
      const dateElements = document.querySelectorAll('[datetime], .date, .posted-date');
      for (const el of dateElements) {
        const dateText = el.getAttribute('datetime') || el.textContent;
        if (dateText && dateText.match(/\d{4}|\d{2}\/\d{2}/)) {
          data.posted_date = dateText.trim();
          break;
        }
      }

      return data;
    });

    return jobDetails;
  } catch (error) {
    console.error(`❌ Error getting job details from ${jobUrl}:`, error.message);
    return {
      title: 'Error loading job',
      description: 'Could not load job details',
      location: 'Saudi Arabia',
      salary: null,
      company: null,
      contact: null,
      employment_type: null,
      experience: null,
      education: null,
      skills: [],
      error: error.message
    };
  }
}

module.exports = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting comprehensive job scraping...');
    
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
    
    // Set a more realistic user agent and viewport
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Enable JavaScript and cookies
    await page.setJavaScriptEnabled(true);
    
    // Set extra headers to look more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    const limit = parseInt(req.query.limit) || 10;
    const allJobs = [];
    
    // URLs to scrape
    const baseUrls = [
      'https://www.expatriates.com/classifieds/saudi-arabia/jobs/',
      'https://www.expatriates.com/classifieds/riyadh/jobs/',
      'https://www.expatriates.com/classifieds/jeddah/jobs/',
      'https://www.expatriates.com/classifieds/dammam/jobs/'
    ];
    
    console.log(`📋 Scraping from ${baseUrls.length} job listing pages...`);
    
    // First, collect all job URLs
    const allJobUrls = [];
    for (const baseUrl of baseUrls) {
      const jobLinks = await scrapeJobListings(page, baseUrl);
      allJobUrls.push(...jobLinks);
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Remove duplicates
    const uniqueJobUrls = allJobUrls.filter((job, index, self) => 
      index === self.findIndex(j => j.url === job.url)
    );
    
    console.log(`🎯 Found ${uniqueJobUrls.length} unique job URLs. Scraping details for ${Math.min(limit, uniqueJobUrls.length)} jobs...`);
    
    // Get detailed information for each job
    for (let i = 0; i < Math.min(limit, uniqueJobUrls.length); i++) {
      const jobUrl = uniqueJobUrls[i];
      console.log(`📄 Processing job ${i + 1}/${Math.min(limit, uniqueJobUrls.length)}: ${jobUrl.title}`);
      
      const jobDetails = await scrapeJobDetails(page, jobUrl.url);
      
      if (jobDetails) {
        allJobs.push({
          id: jobUrl.url.split('/').pop()?.replace('.html', '') || i,
          title: jobDetails.title || jobUrl.title,
          url: jobUrl.url,
          description: jobDetails.description,
          location: jobDetails.location || 'Saudi Arabia',
          salary: jobDetails.salary || null,
          company: jobDetails.company || null,
          contact: jobDetails.contact || null,
          employment_type: jobDetails.employment_type || null,
          experience: jobDetails.experience || null,
          education: jobDetails.education || null,
          skills: jobDetails.skills || [],
          scraped_at: new Date().toISOString()
        });
      }
      
      // Delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    await browser.close();
    
    console.log(`✅ Successfully scraped ${allJobs.length} jobs with full details`);
    
    const response = {
      success: true,
      count: allJobs.length,
      total_found: uniqueJobUrls.length,
      data: allJobs,
      scraped_at: new Date().toISOString(),
      summary: {
        with_salary: allJobs.filter(j => j.salary && j.salary !== '').length,
        with_company: allJobs.filter(j => j.company && j.company !== '').length,
        with_contact: allJobs.filter(j => j.contact && j.contact !== '').length,
        with_skills: allJobs.filter(j => j.skills && j.skills.length > 0).length,
        cities: [...new Set(allJobs.map(j => j.location))].filter(Boolean)
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Error during comprehensive scraping:', error);
    
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
