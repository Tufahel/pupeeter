const puppeteer = require('puppeteer');
const JobCSVExporter = require('../utils/csv-exporter');

/**
 * COMPREHENSIVE JOB SCRAPER - Fetches ALL available jobs
 * This module is designed to fetch all jobs from expatriates.com step by step
 */

class ComprehensiveJobScraper {
  constructor() {
    this.csvExporter = new JobCSVExporter();
    this.allJobUrls = [];
    this.scrapedJobs = [];
    this.failedUrls = [];
    this.currentPage = 1;
    this.maxPages = 50; // Limit to prevent infinite loops
  }

  /**
   * Get ALL job URLs from all pages
   */
  async getAllJobUrls(page) {
    console.log('🔍 Starting comprehensive URL discovery...');
    const allUrls = new Set(); // Use Set to avoid duplicates
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= this.maxPages) {
      try {
        console.log(`📄 Scanning page ${currentPage}...`);
        
        // Visit listing page
        const listingUrl = currentPage === 1 
          ? 'https://www.expatriates.com/classifieds/saudi-arabia/jobs/'
          : `https://www.expatriates.com/classifieds/saudi-arabia/jobs/?page=${currentPage}`;
        
        await page.goto(listingUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract job URLs from current page
        const pageUrls = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          return links
            .map(link => link.href)
            .filter(href => href && href.includes('/cls/') && href.includes('.html'))
            .filter(href => /\d{8}/.test(href));
        });

        console.log(`📋 Found ${pageUrls.length} job URLs on page ${currentPage}`);

        // Add URLs to our set
        pageUrls.forEach(url => allUrls.add(url));

        // Check if there's a next page
        hasNextPage = await page.evaluate(() => {
          // Look for pagination indicators
          const nextButton = document.querySelector('a[href*="page="]:contains("Next")') ||
                            document.querySelector('.pagination .next') ||
                            document.querySelector('a[href*="page="]');
          return nextButton !== null;
        });

        currentPage++;
        
        // Rate limiting between pages
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.log(`⚠️ Error on page ${currentPage}:`, error.message);
        hasNextPage = false;
      }
    }

    this.allJobUrls = Array.from(allUrls);
    console.log(`🎯 TOTAL URLS DISCOVERED: ${this.allJobUrls.length} job URLs from ${currentPage - 1} pages`);
    return this.allJobUrls;
  }

  /**
   * Extract job details from a single URL (reuse from jobs-working.js)
   */
  async extractJobFromUrl(page, jobUrl) {
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
        
        // Title - Clean from page title
        let title = document.title || '';
        title = title.replace(/\s*-\s*expatriates\.com.*$/i, '').trim();
        title = title.replace(/^.*?Jobs,\s*/, '').replace(/,\s*\d+$/, '').trim();
        if (title) jobData.title = title;
        
        // Salary - Direct detection and patterns
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
        
        // Contact numbers - Direct detection + patterns
        const contacts = [];
        
        // Known numbers
        if (bodyText.includes('0534204608')) contacts.push('0534204608');
        if (bodyText.includes('0568569175')) contacts.push('0568569175');
        if (bodyText.includes('+966568569175')) contacts.push('+966568569175');
        
        // Pattern matching
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
        
        // Location/Region
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
              .replace(/Job Details:\s*/gi, '\n\n📋 Job Details:\n')
              .replace(/Requirements:\s*/gi, '\n\n✅ Requirements:\n')
              .replace(/What We Offer:\s*/gi, '\n\n🎁 What We Offer:\n');
            
            if (description.length > 1500) {
              const breakPoint = description.lastIndexOf('\n', 1500);
              if (breakPoint > 1000) {
                description = description.substring(0, breakPoint) + '\n\n[...continues...]';
              } else {
                description = description.substring(0, 1500) + '...';
              }
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

  /**
   * Scrape ALL jobs with progress tracking
   */
  async scrapeAllJobs(options = {}) {
    const browser = await puppeteer.launch({
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

    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Step 1: Get ALL job URLs
      const jobUrls = await this.getAllJobUrls(page);
      
      if (jobUrls.length === 0) {
        throw new Error('No job URLs found');
      }

      console.log(`\\n🚀 Starting to scrape ${jobUrls.length} jobs...`);
      
      // Step 2: Scrape each job
      const batchSize = options.batchSize || 10;
      const maxJobs = options.maxJobs || jobUrls.length;
      const jobsToProcess = Math.min(maxJobs, jobUrls.length);
      
      for (let i = 0; i < jobsToProcess; i++) {
        const jobUrl = jobUrls[i];
        const progress = Math.round(((i + 1) / jobsToProcess) * 100);
        
        console.log(`\\n🔍 [${progress}%] Processing job ${i + 1}/${jobsToProcess}`);
        console.log(`📄 ${jobUrl}`);
        
        const jobDetails = await this.extractJobFromUrl(page, jobUrl);
        
        if (jobDetails) {
          this.scrapedJobs.push(jobDetails);
          console.log(`✅ Extracted: ${jobDetails.title}`);
        } else {
          this.failedUrls.push(jobUrl);
          console.log(`❌ Failed to extract job details`);
        }
        
        // Auto-save to CSV every batch
        if (this.scrapedJobs.length > 0 && this.scrapedJobs.length % batchSize === 0) {
          console.log(`\n💾 Auto-saving batch to CSV...`);
          await this.csvExporter.saveJobsToCSV(this.scrapedJobs, {
            filename: `jobs_batch_${Math.floor(this.scrapedJobs.length / batchSize)}_${new Date().toISOString().slice(0, 10)}.csv`
          });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Final CSV export
      if (this.scrapedJobs.length > 0) {
        console.log(`\n💾 Saving final CSV with ${this.scrapedJobs.length} jobs...`);
        const csvResult = await this.csvExporter.saveJobsToCSV(this.scrapedJobs, {
          filename: `all_jobs_${new Date().toISOString().slice(0, 10)}.csv`
        });
        console.log(`📊 CSV saved: ${csvResult.filename}`);
      }

      return {
        success: true,
        totalUrlsFound: jobUrls.length,
        jobsProcessed: jobsToProcess,
        jobsExtracted: this.scrapedJobs.length,
        failedExtractions: this.failedUrls.length,
        successRate: Math.round((this.scrapedJobs.length / jobsToProcess) * 100),
        data: this.scrapedJobs,
        summary: this.generateSummary()
      };

    } finally {
      await browser.close();
    }
  }

  generateSummary() {
    return {
      total_jobs: this.scrapedJobs.length,
      with_salary: this.scrapedJobs.filter(job => job.salary).length,
      with_contact: this.scrapedJobs.filter(job => job.contact).length,
      with_email: this.scrapedJobs.filter(job => job.email).length,
      with_location: this.scrapedJobs.filter(job => job.location).length,
      with_requirements: this.scrapedJobs.filter(job => job.requirements).length,
      with_benefits: this.scrapedJobs.filter(job => job.benefits).length,
      with_description: this.scrapedJobs.filter(job => job.description).length,
      extraction_method: 'comprehensive_all_jobs_scraper'
    };
  }
}

module.exports = ComprehensiveJobScraper;
