const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

/**
 * CSV Export Utility for Job Data
 * Saves scraped jobs to CSV files with timestamps
 */

class JobCSVExporter {
  constructor() {
    // Create exports directory if it doesn't exist
    this.exportsDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  /**
   * Generate CSV filename with timestamp
   */
  generateFilename(prefix = 'jobs') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.csv`;
  }

  /**
   * Get CSV file path
   */
  getFilePath(filename) {
    return path.join(this.exportsDir, filename);
  }

  /**
   * Define CSV headers for job data
   */
  getCSVHeaders() {
    return [
      { id: 'title', title: 'Job Title' },
      { id: 'salary', title: 'Salary' },
      { id: 'contact', title: 'Contact' },
      { id: 'email', title: 'Email' },
      { id: 'location', title: 'Location' },
      { id: 'posting_id', title: 'Posting ID' },
      { id: 'posted_date', title: 'Posted Date' },
      { id: 'category', title: 'Category' },
      { id: 'employment_type', title: 'Employment Type' },
      { id: 'company', title: 'Company' },
      { id: 'requirements', title: 'Requirements' },
      { id: 'benefits', title: 'Benefits' },
      { id: 'description', title: 'Description' },
      { id: 'url', title: 'Job URL' },
      { id: 'scraped_at', title: 'Scraped At' }
    ];
  }

  /**
   * Save jobs to CSV file
   */
  async saveJobsToCSV(jobs, options = {}) {
    try {
      const filename = options.filename || this.generateFilename('jobs');
      const filePath = this.getFilePath(filename);
      
      // Clean and prepare job data for CSV
      const cleanedJobs = jobs.map(job => ({
        title: this.cleanCSVField(job.title),
        salary: this.cleanCSVField(job.salary),
        contact: this.cleanCSVField(job.contact),
        email: this.cleanCSVField(job.email),
        location: this.cleanCSVField(job.location),
        posting_id: this.cleanCSVField(job.posting_id),
        posted_date: this.cleanCSVField(job.posted_date),
        category: this.cleanCSVField(job.category),
        employment_type: this.cleanCSVField(job.employment_type),
        company: this.cleanCSVField(job.company),
        requirements: this.cleanCSVField(job.requirements, 500), // Limit length
        benefits: this.cleanCSVField(job.benefits, 300),
        description: this.cleanCSVField(job.description, 1000), // Limit length
        url: this.cleanCSVField(job.url),
        scraped_at: job.scraped_at || new Date().toISOString()
      }));

      // Create CSV writer
      const csvWriter = createCsvWriter({
        path: filePath,
        header: this.getCSVHeaders(),
        encoding: 'utf8'
      });

      // Write data to CSV
      await csvWriter.writeRecords(cleanedJobs);

      console.log(`📊 CSV Export: Saved ${cleanedJobs.length} jobs to ${filename}`);
      
      return {
        success: true,
        filename: filename,
        filePath: filePath,
        recordCount: cleanedJobs.length,
        fileSize: this.getFileSize(filePath)
      };

    } catch (error) {
      console.error('❌ CSV Export Error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clean CSV field data
   */
  cleanCSVField(value, maxLength = null) {
    if (!value) return '';
    
    let cleaned = String(value)
      .replace(/[\r\n]+/g, ' ') // Replace line breaks with spaces
      .replace(/"/g, '""')      // Escape quotes
      .trim();
    
    if (maxLength && cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength) + '...';
    }
    
    return cleaned;
  }

  /**
   * Get file size in human readable format
   */
  getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
      return `${fileSizeInMB} MB`;
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * List all exported CSV files
   */
  listExportedFiles() {
    try {
      const files = fs.readdirSync(this.exportsDir)
        .filter(file => file.endsWith('.csv'))
        .map(file => {
          const filePath = path.join(this.exportsDir, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            size: this.getFileSize(filePath),
            created: stats.birthtime.toISOString(),
            modified: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      return files;
    } catch (error) {
      console.error('Error listing exported files:', error.message);
      return [];
    }
  }

  /**
   * Delete old CSV files (keep only latest N files)
   */
  cleanupOldFiles(keepCount = 10) {
    try {
      const files = this.listExportedFiles();
      if (files.length > keepCount) {
        const filesToDelete = files.slice(keepCount);
        filesToDelete.forEach(file => {
          const filePath = path.join(this.exportsDir, file.filename);
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted old CSV: ${file.filename}`);
        });
        return filesToDelete.length;
      }
      return 0;
    } catch (error) {
      console.error('Error cleaning up old files:', error.message);
      return 0;
    }
  }
}

module.exports = JobCSVExporter;
