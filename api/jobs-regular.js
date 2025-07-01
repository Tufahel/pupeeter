const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * REGULAR JOBS SCRAPER - Only fetches non-sponsored jobs
 * This scraper identifies and skips sponsored jobs, focusing on regular jobs with posting dates
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
      job.is_sponsored || 'No'
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

// Job extraction function (enhanced version)
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
        benefits: '',
        is_sponsored: 'No'
      };
      
      // Title
      let title = document.title || '';
      title = title.replace(/\s*-\s*expatriates\.com.*$/i, '').trim();
      title = title.replace(/^.*?Jobs,\s*/, '').replace(/,\s*\d+$/, '').trim();
      if (title) jobData.title = title;
      
      // Salary patterns
      const salaryPatterns = [
        bodyText.match(/Salary:?\s*(\d{3,5})/i),
        bodyText.match(/salary\s+(\d{3,5})/i),
        bodyText.match(/(\d{4})\s*(?:SR|SAR|Riyal)/i),
        bodyText.match(/(\d{3,5})\s*SAR/i)
      ];
      
      for (const match of salaryPatterns) {
        if (match && match[1]) {
          jobData.salary = match[1];
          break;
        }
      }
      
      // Contact numbers
      const contacts = [];
      const phonePatterns = [
        bodyText.match(/\b(05\d{8})\b/g),
        bodyText.match(/\b(01\d{8})\b/g),
        bodyText.match(/\+(966\d{9})/g),
        bodyText.match(/\b(\d{10})\b/g)
      ];
      
      phonePatterns.forEach(matches => {
        if (matches) {
          matches.forEach(phone => {
            if (phone && phone.length >= 9) {
              contacts.push(phone);
            }
          });
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
        bodyText.match(/Location:\s*([^\n\r]+)/i),
        bodyText.match(/City:\s*([^\n\r]+)/i)
      ];
      
      for (const match of locationMatches) {
        if (match && match[1]) {
          jobData.location = match[1].trim();
          break;
        }
      }
      
      // Posted date
      const dateMatches = [
        bodyText.match(/Posted:\s*([^\n\r]+)/i),
        bodyText.match(/Date:\s*([^\n\r]+)/i),
        bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{4})/),
        bodyText.match(/(\d{1,2}-\d{1,2}-\d{4})/),
        bodyText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i)
      ];
      
      for (const match of dateMatches) {
        if (match && match[1]) {
          jobData.posted_date = match[1].trim();
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
    console.log('🚀 Starting REGULAR JOBS scraper (skipping sponsored)...');
    
    const maxJobs = parseInt(req.query.maxJobs) || 999999;
    const quickMode = req.query.quick === 'true';
    const actualLimit = quickMode ? 20 : maxJobs;
    
    console.log(`📊 Mode: ${quickMode ? 'QUICK (20 regular jobs)' : 'FULL (all regular jobs)'}`);
    
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
    
    // Step 1: Get all regular (non-sponsored) job URLs with correct pagination
    console.log('🔍 Discovering regular job URLs (skipping sponsored)...');
    
    const allJobUrls = [];
    let currentPage = 1;
    const maxPages = quickMode ? 3 : 15; // Search more pages to find regular jobs
    let totalSponsored = 0;
    let totalRegular = 0;
    
    while (currentPage <= maxPages) {
      try {
        // Generate correct URL based on pagination pattern
        let listingUrl;
        if (currentPage === 1) {
          listingUrl = 'https://www.expatriates.com/classifieds/saudi-arabia/jobs/';
        } else {
          const indexNumber = (currentPage - 1) * 100;
          listingUrl = `https://www.expatriates.com/classifieds/saudi-arabia/jobs/index${indexNumber}.html`;
        }
        
        console.log(`📄 Scanning page ${currentPage}: ${listingUrl}`);
        
        await page.goto(listingUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract job URLs and check if they're sponsored
        const pageResults = await page.evaluate(() => {
          const jobElements = Array.from(document.querySelectorAll('a'));
          const jobUrls = [];
          let sponsoredCount = 0;
          let regularCount = 0;
          
          jobElements.forEach(link => {
            const href = link.href;
            
            // Check if it's a valid job URL
            if (href && href.includes('/cls/') && href.includes('.html') && /\d{8}/.test(href)) {
              // Get the parent element text to check for sponsored vs regular pattern
              const parentText = link.parentElement ? link.parentElement.textContent.trim() : '';
              
              // Sponsored jobs: parent text ends with "Sponsored"
              // Regular jobs: parent text ends with timestamp pattern (e.g., "Tue, Jul 1, 2025, 5:43:12 PM - 3 minutes ago")
              const isSponsored = parentText.endsWith('Sponsored');
              const hasTimestamp = /\w{3}, \w{3} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2} [AP]M - (\d+ \w+ ago|an hour ago|a day ago)$/.test(parentText) ||
                                 /\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}|Today|Yesterday|ago|Posted/.test(parentText);
              
              if (isSponsored) {
                sponsoredCount++;
              } else if (hasTimestamp || (!isSponsored && parentText.length > 0)) {
                // This is a regular job - include it
                jobUrls.push(href);
                regularCount++;
              }
            }
          });
          
          return {
            jobUrls: [...new Set(jobUrls)], // Remove duplicates
            sponsoredCount,
            regularCount
          };
        });
        
        totalSponsored += pageResults.sponsoredCount;
        totalRegular += pageResults.regularCount;
        
        console.log(`📊 Page ${currentPage} results: ${pageResults.regularCount} regular jobs, ${pageResults.sponsoredCount} sponsored jobs`);
        
        // Add regular job URLs to our collection
        pageResults.jobUrls.forEach(url => {
          if (!allJobUrls.includes(url)) {
            allJobUrls.push(url);
          }
        });
        
        // If no jobs found on this page, we might have reached the end
        if (pageResults.jobUrls.length === 0 && pageResults.sponsoredCount === 0) {
          console.log(`📋 No jobs found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        console.log(`📋 Total regular jobs found so far: ${allJobUrls.length}`);
        
        currentPage++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
        
      } catch (error) {
        console.log(`⚠️ Error on page ${currentPage}:`, error.message);
        break;
      }
    }
    
    console.log(`\\n🎯 DISCOVERY COMPLETE!`);
    console.log(`📊 Total URLs discovered: ${allJobUrls.length} regular jobs`);
    console.log(`📊 Sponsored jobs skipped: ${totalSponsored}`);
    console.log(`📊 Regular jobs found: ${totalRegular}`);
    
    if (allJobUrls.length === 0) {
      throw new Error('No regular job URLs found');
    }
    
    // Step 2: Extract job details from regular jobs only
    const jobsToProcess = Math.min(actualLimit, allJobUrls.length);
    const scrapedJobs = [];
    const failedUrls = [];
    
    console.log(`\\n🚀 Starting to scrape ${jobsToProcess} regular jobs...`);
    
    for (let i = 0; i < jobsToProcess; i++) {
      const jobUrl = allJobUrls[i];
      const progress = Math.round(((i + 1) / jobsToProcess) * 100);
      
      console.log(`\\n🔍 [${progress}%] Processing regular job ${i + 1}/${jobsToProcess}`);
      console.log(`📄 ${jobUrl}`);
      
      const jobDetails = await extractJobFromUrl(page, jobUrl);
      
      if (jobDetails) {
        scrapedJobs.push(jobDetails);
        console.log(`✅ Extracted: ${jobDetails.title} | Salary: ${jobDetails.salary || 'N/A'} | Contact: ${jobDetails.contact || 'N/A'}`);
      } else {
        failedUrls.push(jobUrl);
        console.log(`❌ Failed to extract job details`);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\\n🎉 REGULAR JOBS SCRAPING COMPLETE! Extracted ${scrapedJobs.length} regular jobs`);
    
    // Step 3: Save to CSV
    let csvResult = null;
    if (scrapedJobs.length > 0) {
      const filename = `regular_jobs_${quickMode ? 'quick_' : ''}${new Date().toISOString().slice(0, 10)}.csv`;
      csvResult = saveJobsToCSV(scrapedJobs, filename);
      console.log(`📊 CSV saved: ${filename}`);
    }
    
    // Calculate stats
    const successRate = Math.round((scrapedJobs.length / jobsToProcess) * 100);
    
    const summary = {
      total_jobs: scrapedJobs.length,
      regular_jobs_only: true,
      sponsored_jobs_skipped: totalSponsored,
      with_salary: scrapedJobs.filter(job => job.salary).length,
      with_contact: scrapedJobs.filter(job => job.contact).length,
      with_email: scrapedJobs.filter(job => job.email).length,
      with_location: scrapedJobs.filter(job => job.location).length,
      with_description: scrapedJobs.filter(job => job.description).length,
      with_posted_date: scrapedJobs.filter(job => job.posted_date).length,
      extraction_method: 'regular_jobs_only_scraper'
    };
    
    res.json({
      success: true,
      message: `Successfully scraped ${scrapedJobs.length} REGULAR jobs (${totalSponsored} sponsored jobs skipped)`,
      stats: {
        totalRegularUrlsFound: allJobUrls.length,
        sponsoredJobsSkipped: totalSponsored,
        regularJobsProcessed: jobsToProcess,
        regularJobsExtracted: scrapedJobs.length,
        failedExtractions: failedUrls.length,
        successRate: successRate
      },
      summary: summary,
      csvExport: csvResult,
      data: scrapedJobs,
      note: quickMode ? 'Quick mode: Limited to 20 regular jobs for testing' : 'Full scrape of regular jobs completed',
      scraped_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Regular jobs scraper error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to scrape regular jobs',
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
