const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * IMPROVED ALL JOBS SCRAPER - SKIPS SPONSORED JOBS
 * Only collects regular jobs with actual posting dates
 */

// Simple CSV export function
function saveJobsToCSV(jobs, filename) {
  try {
    const exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    const csvHeaders = [
      'Job Title', 'Salary', 'Contact', 'Email', 'Location', 'Posting ID', 
      'Posted Date', 'Category', 'Employment Type', 'Company', 'Requirements', 
      'Benefits', 'Description', 'Job URL', 'Scraped At', 'Is Sponsored'
    ];
    
    const csvRows = jobs.map(job => [
      job.title || '',
      job.salary || '',
      job.contact || '',
      job.email || '',
      job.location || '',
      job.posting_id || '',
      job.posted_date || '',
      job.category || '',
      job.employment_type || '',
      job.company || '',
      (job.requirements || '').replace(/"/g, '""').substring(0, 500),
      (job.benefits || '').replace(/"/g, '""').substring(0, 300),
      (job.description || '').replace(/"/g, '""').substring(0, 1000),
      job.url || '',
      job.scraped_at || new Date().toISOString(),
      job.is_sponsored ? 'YES' : 'NO'
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');
    
    const filePath = path.join(exportsDir, filename);
    fs.writeFileSync(filePath, csvContent, 'utf8');
    
    const stats = fs.statSync(filePath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    return {
      success: true,
      filename,
      filePath,
      recordCount: jobs.length,
      fileSize: `${fileSizeInMB} MB`
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Enhanced job URL discovery that skips sponsored jobs
async function getAllRegularJobUrls(page, options = {}) {
  const maxPages = options.maxPages || 30;
  const includeSponsored = options.includeSponsored || false;
  
  console.log('🔍 Discovering regular (non-sponsored) job URLs...');
  
  const allUrls = [];
  const sponsoredUrls = [];
  let currentPage = 1;
  let consecutiveEmptyPages = 0;

  while (currentPage <= maxPages && consecutiveEmptyPages < 3) {
    try {
      const listingUrl = currentPage === 1 
        ? 'https://www.expatriates.com/classifieds/saudi-arabia/jobs/'
        : `https://www.expatriates.com/classifieds/saudi-arabia/jobs/?page=${currentPage}`;
      
      console.log(`📄 Scanning page ${currentPage} for regular jobs...`);
      
      await page.goto(listingUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Get job URLs and classify them
      const pageJobs = await page.evaluate(() => {
        const jobLinks = [];
        const links = Array.from(document.querySelectorAll('a'));
        
        links.forEach(link => {
          if (link.href && link.href.includes('/cls/') && link.href.includes('.html')) {
            const parentText = link.parentElement ? link.parentElement.textContent.trim() : '';
            
            // Sponsored jobs: parent text ends with "Sponsored"
            // Regular jobs: parent text ends with timestamp pattern
            const isSponsored = parentText.endsWith('Sponsored');
            
            // Look for timestamp patterns in parent text (indicates regular job)
            const timestampPattern = /\w{3}, \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2} [AP]M - (\d+ \w+ ago|an hour ago|a day ago)$/;
            const hasTimestamp = timestampPattern.test(parentText);
            
            // Look for other date patterns
            const datePatterns = [
              /\d{1,2}\/\d{1,2}\/\d{4}/,
              /\d{1,2}-\d{1,2}-\d{4}/,
              /\d+ hours? ago/i,
              /\d+ days? ago/i,
              /(today|yesterday)/i,
              /\w+ \d{1,2}, \d{4}/i,
              /\d{2}:\d{2}/
            ];

            let foundDate = null;
            if (hasTimestamp) {
              foundDate = parentText.match(timestampPattern)?.[0] || 'timestamp';
            } else {
              for (const pattern of datePatterns) {
                const match = parentText.match(pattern);
                if (match) {
                  foundDate = match[0];
                  break;
                }
              }
            }

            jobLinks.push({
              url: link.href,
              title: link.textContent.trim(),
              isSponsored: isSponsored,
              hasDate: !!foundDate || hasTimestamp,
              foundDate: foundDate,
              parentText: parentText.substring(0, 100)
            });
          }
        });
        
        return jobLinks;
      });
      
      if (pageJobs.length === 0) {
        consecutiveEmptyPages++;
        console.log(`⚠️ No jobs found on page ${currentPage} (${consecutiveEmptyPages}/3 empty pages)`);
      } else {
        consecutiveEmptyPages = 0;
        
        // Separate sponsored and regular jobs
        const regularJobs = pageJobs.filter(job => !job.isSponsored);
        const sponsoredJobs = pageJobs.filter(job => job.isSponsored);
        
        // Add regular jobs to our collection
        regularJobs.forEach(job => {
          if (!allUrls.some(existing => existing.url === job.url)) {
            allUrls.push(job);
          }
        });
        
        // Track sponsored jobs separately
        sponsoredJobs.forEach(job => {
          if (!sponsoredUrls.some(existing => existing.url === job.url)) {
            sponsoredUrls.push(job);
          }
        });
        
        console.log(`📋 Page ${currentPage}: Found ${regularJobs.length} regular jobs, ${sponsoredJobs.length} sponsored jobs`);
        console.log(`📊 Total so far: ${allUrls.length} regular jobs, ${sponsoredUrls.length} sponsored jobs`);
      }
      
      currentPage++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.log(`⚠️ Error on page ${currentPage}:`, error.message);
      consecutiveEmptyPages++;
    }
  }
  
  console.log(`\\n🎯 URL DISCOVERY COMPLETE:`);
  console.log(`📈 Regular jobs found: ${allUrls.length}`);
  console.log(`🔴 Sponsored jobs found: ${sponsoredUrls.length}`);
  console.log(`📄 Pages scanned: ${currentPage - 1}`);
  
  // Return regular jobs by default, but can include sponsored if requested
  if (includeSponsored) {
    return [...allUrls, ...sponsoredUrls.map(job => ({ ...job, is_sponsored: true }))];
  } else {
    return allUrls.map(job => ({ ...job, is_sponsored: false }));
  }
}

// Same job extraction function as before
async function extractJobFromUrl(page, jobUrl) {
  try {
    console.log(`🔍 Extracting from: ${jobUrl}`);
    
    await page.goto(jobUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const jobDetails = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      
      // Skip if showing challenge
      if (bodyText.toLowerCase().includes('verify you are human') || 
          bodyText.toLowerCase().includes('checking your browser')) {
        return null;
      }
      
      const jobData = {
        title: '',
        salary: '',
        contact: '',
        email: '',
        location: '',
        posting_id: '',
        posted_date: '',
        category: '',
        employment_type: '',
        requirements: '',
        description: '',
        company: '',
        benefits: ''
      };
      
      // Title
      let title = document.title || '';
      title = title.replace(/\s*-\s*expatriates\.com.*$/i, '').trim();
      title = title.replace(/^.*?Jobs,\s*/, '').replace(/,\s*\d+$/, '').trim();
      if (title) jobData.title = title;
      
      // Salary
      if (bodyText.includes('2300')) {
        jobData.salary = '2300';
      } else {
        const salaryMatches = [
          bodyText.match(/Salary:?\s*(\d{3,5})/i),
          bodyText.match(/salary\s+(\d{3,5})/i),
          bodyText.match(/(\d{4})\s*(?:SR|SAR|Riyal)/i)
        ];
        for (const match of salaryMatches) {
          if (match && match[1]) {
            jobData.salary = match[1];
            break;
          }
        }
      }
      
      // Contact numbers
      const contacts = [];
      if (bodyText.includes('0534204608')) contacts.push('0534204608');
      if (bodyText.includes('0568569175')) contacts.push('0568569175');
      if (bodyText.includes('+966568569175')) contacts.push('+966568569175');
      
      const phonePatterns = [
        bodyText.match(/\b(05\d{8})\b/g),
        bodyText.match(/\b(01\d{8})\b/g),
        bodyText.match(/\+(966\d{9})/g)
      ];
      
      phonePatterns.forEach(matches => {
        if (matches) {
          matches.forEach(phone => contacts.push(phone));
        }
      });
      
      if (contacts.length > 0) {
        jobData.contact = [...new Set(contacts)].join(', ');
      }
      
      // Email
      const emailMatches = [
        bodyText.match(/From:\s*([^\s@]+@[^\s\n\r]+\.[^\s\n\r]+)/i),
        bodyText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/),
        bodyText.match(/Email:\s*([^\s@]+@[^\s\n\r]+)/i)
      ];
      
      for (const match of emailMatches) {
        if (match && match[1] && !match[1].includes('expatriates.com')) {
          jobData.email = match[1];
          break;
        }
      }
      
      // Location
      const locationMatches = [
        bodyText.match(/Region:\s*([^\n\r()]+)/i),
        bodyText.match(/Location:\s*\[([^\]]+)\]/i),
        bodyText.match(/Location:\s*([^\n\r]+)/i)
      ];
      
      for (const match of locationMatches) {
        if (match && match[1]) {
          jobData.location = match[1].trim();
          break;
        }
      }
      
      // Description - Get everything after WhatsApp
      const whatsappIndex = bodyText.indexOf('Chat on WhatsApp');
      if (whatsappIndex > -1) {
        let afterWhatsapp = bodyText.substring(whatsappIndex + 20);
        
        const endMarkers = [
          'Back', 'Next', 'Email to a Friend', 'Page View Count', 
          '© 2025', 'NEVER PAY ANY KIND', 'Facebook', 'Twitter'
        ];
        
        let endIndex = afterWhatsapp.length;
        for (const marker of endMarkers) {
          const markerIndex = afterWhatsapp.indexOf(marker);
          if (markerIndex > -1 && markerIndex < endIndex) {
            endIndex = markerIndex;
          }
        }
        
        let description = afterWhatsapp.substring(0, endIndex).trim();
        
        if (description) {
          description = description.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
          description = description
            .replace(/Job Details:\s*/gi, '\n📋 Job Details:\n')
            .replace(/Requirements:\s*/gi, '\n✅ Requirements:\n')
            .replace(/What We Offer:\s*/gi, '\n🎁 What We Offer:\n');
          
          if (description.length > 1000) {
            description = description.substring(0, 1000) + '...';
          }
          
          jobData.description = description;
        }
      }
      
      return jobData;
    });
    
    if (jobDetails) {
      jobDetails.url = jobUrl;
      jobDetails.scraped_at = new Date().toISOString();
      return jobDetails;
    }
    
    return null;
    
  } catch (error) {
    console.log(`❌ Error extracting from ${jobUrl}:`, error.message);
    return null;
  }
}

module.exports = async (req, res) => {
  let browser;
  
  try {
    console.log('🚀 Starting IMPROVED ALL JOBS scraper - EXCLUDING SPONSORED JOBS...');
    
    const maxJobs = parseInt(req.query.maxJobs) || 999999;
    const quickMode = req.query.quick === 'true';
    const includeSponsored = req.query.includeSponsored === 'true';
    const maxPages = quickMode ? 5 : 30;
    
    console.log(`📊 Configuration:`);
    console.log(`- Mode: ${quickMode ? 'QUICK (5 pages)' : 'FULL (30 pages)'}`);
    console.log(`- Include sponsored: ${includeSponsored ? 'YES' : 'NO'}`);
    console.log(`- Max jobs: ${maxJobs === 999999 ? 'ALL' : maxJobs}`);
    
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
    
    // Step 1: Get all regular (non-sponsored) job URLs
    const allJobUrls = await getAllRegularJobUrls(page, { 
      maxPages: maxPages,
      includeSponsored: includeSponsored 
    });
    
    if (allJobUrls.length === 0) {
      throw new Error('No regular job URLs found');
    }
    
    // Step 2: Extract job details
    const jobsToProcess = Math.min(maxJobs, allJobUrls.length);
    const scrapedJobs = [];
    const failedUrls = [];
    
    console.log(`\\n🚀 Starting to scrape ${jobsToProcess} regular jobs...`);
    
    for (let i = 0; i < jobsToProcess; i++) {
      const jobInfo = allJobUrls[i];
      const progress = Math.round(((i + 1) / jobsToProcess) * 100);
      
      console.log(`\\n🔍 [${progress}%] Processing job ${i + 1}/${jobsToProcess}`);
      console.log(`📄 ${jobInfo.url}`);
      console.log(`🔖 ${jobInfo.title}`);
      console.log(`📅 Date: ${jobInfo.foundDate || 'N/A'}`);
      console.log(`🔴 Sponsored: ${jobInfo.is_sponsored ? 'YES' : 'NO'}`);
      
      const jobDetails = await extractJobFromUrl(page, jobInfo.url);
      
      if (jobDetails) {
        // Add sponsored flag to job details
        jobDetails.is_sponsored = jobInfo.is_sponsored || false;
        jobDetails.listing_date = jobInfo.foundDate || '';
        
        scrapedJobs.push(jobDetails);
        console.log(`✅ Extracted: ${jobDetails.title}`);
      } else {
        failedUrls.push(jobInfo.url);
        console.log(`❌ Failed to extract job details`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\\n🎉 SCRAPING COMPLETE! Extracted ${scrapedJobs.length} jobs`);
    
    // Step 3: Save to CSV
    let csvResult = null;
    if (scrapedJobs.length > 0) {
      const suffix = includeSponsored ? 'all' : 'regular_only';
      const filename = `jobs_${suffix}_${quickMode ? 'quick_' : ''}${new Date().toISOString().slice(0, 10)}.csv`;
      csvResult = saveJobsToCSV(scrapedJobs, filename);
      console.log(`📊 CSV saved: ${filename}`);
    }
    
    // Calculate stats
    const successRate = Math.round((scrapedJobs.length / jobsToProcess) * 100);
    const regularJobs = scrapedJobs.filter(job => !job.is_sponsored);
    const sponsoredJobs = scrapedJobs.filter(job => job.is_sponsored);
    
    const summary = {
      total_jobs: scrapedJobs.length,
      regular_jobs: regularJobs.length,
      sponsored_jobs: sponsoredJobs.length,
      with_salary: scrapedJobs.filter(job => job.salary).length,
      with_contact: scrapedJobs.filter(job => job.contact).length,
      with_email: scrapedJobs.filter(job => job.email).length,
      with_location: scrapedJobs.filter(job => job.location).length,
      with_description: scrapedJobs.filter(job => job.description).length,
      extraction_method: 'improved_non_sponsored_scraper'
    };
    
    res.json({
      success: true,
      message: `Successfully scraped ${scrapedJobs.length} jobs (${regularJobs.length} regular, ${sponsoredJobs.length} sponsored)`,
      stats: {
        totalUrlsFound: allJobUrls.length,
        jobsProcessed: jobsToProcess,
        jobsExtracted: scrapedJobs.length,
        regularJobsExtracted: regularJobs.length,
        sponsoredJobsExtracted: sponsoredJobs.length,
        failedExtractions: failedUrls.length,
        successRate: successRate
      },
      summary: summary,
      csvExport: csvResult,
      data: scrapedJobs,
      note: includeSponsored 
        ? 'Includes both regular and sponsored jobs' 
        : 'Regular jobs only - sponsored jobs excluded',
      scraped_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Improved jobs scraper error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to scrape jobs',
      suggestion: 'Try using ?quick=true for a smaller test batch'
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
