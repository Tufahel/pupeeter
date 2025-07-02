const fs = require('fs');
const path = require('path');

class CSVComparator {
  constructor() {
    this.exportsDir = path.join(__dirname, '..', 'exports');
  }

  // Read existing CSV and extract posting IDs
  getExistingPostingIds(filename) {
    try {
      const filePath = path.join(this.exportsDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return new Set();
      }

      const csvContent = fs.readFileSync(filePath, 'utf8');
      const lines = csvContent.split('\n');
      
      if (lines.length <= 1) {
        return new Set(); // Empty or header only
      }

      const postingIds = new Set();
      
      // Skip header line
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          // Parse CSV line and extract posting ID (6th column)
          const columns = this.parseCSVLine(line);
          if (columns.length >= 6 && columns[5]) {
            const postingId = columns[5].replace(/"/g, '').trim();
            if (postingId) {
              postingIds.add(postingId);
            }
          }
        }
      }

      return postingIds;
    } catch (error) {
      console.log('⚠️ Error reading existing CSV:', error.message);
      return new Set();
    }
  }

  // Simple CSV line parser
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  // Filter jobs to only include new ones not in CSV
  filterNewJobs(jobs, csvFilename) {
    const existingIds = this.getExistingPostingIds(csvFilename);
    
    console.log(`🔍 CSV Comparison: ${existingIds.size} jobs already in ${csvFilename}`);
    
    const newJobs = jobs.filter(job => {
      const postingId = job.posting_id;
      if (!postingId) {
        return true; // Include jobs without posting ID
      }
      
      const isNew = !existingIds.has(postingId);
      if (!isNew) {
        console.log(`⏭️ Skipping job ${postingId} - already in CSV`);
      }
      return isNew;
    });

    console.log(`📊 CSV Filter: ${jobs.length} total → ${newJobs.length} new jobs to add`);
    
    return newJobs;
  }

  // Append new jobs to existing CSV
  appendToCSV(newJobs, filename) {
    try {
      const filePath = path.join(this.exportsDir, filename);
      
      if (newJobs.length === 0) {
        console.log('📄 No new jobs to append to CSV');
        return {
          success: true,
          filename,
          filePath,
          newRecords: 0,
          message: 'No new jobs to add'
        };
      }

      // Prepare CSV rows for new jobs
      const csvRows = newJobs.map(job => [
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

      const csvContent = csvRows.map(row => 
        row.map(field => `"${field}"`).join(',')
      ).join('\n');

      // Append to existing file or create new one
      if (fs.existsSync(filePath)) {
        fs.appendFileSync(filePath, '\n' + csvContent, 'utf8');
        console.log(`📄 Appended ${newJobs.length} new jobs to ${filename}`);
      } else {
        // Create new file with headers
        const csvHeaders = [
          'Job Title', 'Salary', 'Contact', 'Email', 'Location', 'Posting ID', 
          'Posted Date', 'Category', 'Employment Type', 'Company', 'Requirements', 
          'Benefits', 'Description', 'Job URL', 'Scraped At', 'Is Sponsored'
        ];
        
        const fullContent = [
          csvHeaders.join(','),
          csvContent
        ].join('\n');
        
        fs.writeFileSync(filePath, fullContent, 'utf8');
        console.log(`📄 Created new CSV ${filename} with ${newJobs.length} jobs`);
      }

      const stats = fs.statSync(filePath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      return {
        success: true,
        filename,
        filePath,
        newRecords: newJobs.length,
        fileSize: `${fileSizeInMB} MB`,
        message: `Added ${newJobs.length} new jobs`
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = CSVComparator;
