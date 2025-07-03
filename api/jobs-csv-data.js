const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Read CSV data and return as JSON
 * Supports reading specific date files or latest file
 */
async function getJobsFromCSV(req, res) {
    try {
        const { date, limit, search, location, salary_min } = req.query;
        
        // Determine which CSV file to read
        let csvFileName;
        
        if (date) {
            // Read specific date file
            csvFileName = `regular_jobs_quick_auto_${date}.csv`;
        } else {
            // Find the latest CSV file
            const exportsDir = path.join(__dirname, '..', 'exports');
            const files = fs.readdirSync(exportsDir)
                .filter(file => file.startsWith('regular_jobs_quick_auto_') && file.endsWith('.csv'))
                .sort()
                .reverse();
            
            if (files.length === 0) {
                return res.json({
                    success: false,
                    message: 'No CSV files found',
                    data: []
                });
            }
            
            csvFileName = files[0]; // Latest file
        }
        
        const csvFilePath = path.join(__dirname, '..', 'exports', csvFileName);
        
        // Check if file exists
        if (!fs.existsSync(csvFilePath)) {
            return res.json({
                success: false,
                message: `CSV file not found: ${csvFileName}`,
                data: []
            });
        }
        
        // Read CSV data
        const jobs = [];
        
        return new Promise((resolve) => {
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    // Clean and format the data
                    const job = {
                        title: row['Job Title'] || '',
                        salary: row['Salary'] || '',
                        contact: row['Contact'] || '',
                        email: row['Email'] || '',
                        location: row['Location'] || '',
                        posting_id: row['Posting ID'] || '',
                        posted_date: row['Posted Date'] || '',
                        category: row['Category'] || '',
                        employment_type: row['Employment Type'] || '',
                        company: row['Company'] || '',
                        requirements: row['Requirements'] || '',
                        benefits: row['Benefits'] || '',
                        description: row['Description'] || '',
                        url: row['Job URL'] || '',
                        scraped_at: row['Scraped At'] || '',
                        is_sponsored: row['Is Sponsored'] || 'No'
                    };
                    
                    // Apply filters
                    let includeJob = true;
                    
                    // Search filter
                    if (search) {
                        const searchTerm = search.toLowerCase();
                        includeJob = includeJob && (
                            job.title.toLowerCase().includes(searchTerm) ||
                            job.description.toLowerCase().includes(searchTerm) ||
                            job.company.toLowerCase().includes(searchTerm) ||
                            job.location.toLowerCase().includes(searchTerm)
                        );
                    }
                    
                    // Location filter
                    if (location) {
                        includeJob = includeJob && job.location.toLowerCase().includes(location.toLowerCase());
                    }
                    
                    // Salary filter (minimum)
                    if (salary_min && job.salary && job.salary.trim() !== '') {
                        const jobSalary = parseInt(job.salary.replace(/[^\d]/g, ''));
                        const minSalary = parseInt(salary_min);
                        includeJob = includeJob && !isNaN(jobSalary) && jobSalary >= minSalary;
                    }
                    
                    if (includeJob) {
                        jobs.push(job);
                    }
                })
                .on('end', () => {
                    // Apply limit
                    const limitedJobs = limit ? jobs.slice(0, parseInt(limit)) : jobs;
                    
                    // Get file stats
                    const stats = fs.statSync(csvFilePath);
                    
                    const response = {
                        success: true,
                        message: `Successfully loaded ${limitedJobs.length} jobs from CSV`,
                        metadata: {
                            source_file: csvFileName,
                            file_size: `${(stats.size / 1024).toFixed(2)} KB`,
                            last_modified: stats.mtime.toISOString(),
                            total_jobs_in_file: jobs.length,
                            returned_jobs: limitedJobs.length,
                            filters_applied: {
                                search: search || null,
                                location: location || null,
                                salary_min: salary_min || null,
                                limit: limit || null
                            }
                        },
                        data: limitedJobs
                    };
                    
                    res.json(response);
                    resolve();
                })
                .on('error', (error) => {
                    console.error('Error reading CSV:', error);
                    res.status(500).json({
                        success: false,
                        message: 'Error reading CSV file',
                        error: error.message
                    });
                    resolve();
                });
        });
        
    } catch (error) {
        console.error('Error in getJobsFromCSV:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

/**
 * Get list of available CSV files
 */
async function getAvailableCSVFiles(req, res) {
    try {
        const exportsDir = path.join(__dirname, '..', 'exports');
        
        if (!fs.existsSync(exportsDir)) {
            return res.json({
                success: false,
                message: 'Exports directory not found',
                files: []
            });
        }
        
        const files = fs.readdirSync(exportsDir)
            .filter(file => file.startsWith('regular_jobs_quick_auto_') && file.endsWith('.csv'))
            .map(file => {
                const filePath = path.join(exportsDir, file);
                const stats = fs.statSync(filePath);
                
                // Extract date from filename
                const dateMatch = file.match(/regular_jobs_quick_auto_(\d{4}-\d{2}-\d{2})\.csv/);
                const date = dateMatch ? dateMatch[1] : 'unknown';
                
                return {
                    filename: file,
                    date: date,
                    size: `${(stats.size / 1024).toFixed(2)} KB`,
                    last_modified: stats.mtime.toISOString(),
                    job_count: null // Would need to read file to get accurate count
                };
            })
            .sort((a, b) => b.date.localeCompare(a.date)); // Latest first
        
        res.json({
            success: true,
            message: `Found ${files.length} CSV files`,
            files: files
        });
        
    } catch (error) {
        console.error('Error in getAvailableCSVFiles:', error);
        res.status(500).json({
            success: false,
            message: 'Error listing CSV files',
            error: error.message
        });
    }
}

/**
 * Get CSV statistics and summary
 */
async function getCSVStats(req, res) {
    try {
        const { date } = req.query;
        
        // Determine which CSV file to analyze
        let csvFileName;
        
        if (date) {
            csvFileName = `regular_jobs_quick_auto_${date}.csv`;
        } else {
            // Find the latest CSV file
            const exportsDir = path.join(__dirname, '..', 'exports');
            const files = fs.readdirSync(exportsDir)
                .filter(file => file.startsWith('regular_jobs_quick_auto_') && file.endsWith('.csv'))
                .sort()
                .reverse();
            
            if (files.length === 0) {
                return res.json({
                    success: false,
                    message: 'No CSV files found'
                });
            }
            
            csvFileName = files[0];
        }
        
        const csvFilePath = path.join(__dirname, '..', 'exports', csvFileName);
        
        if (!fs.existsSync(csvFilePath)) {
            return res.json({
                success: false,
                message: `CSV file not found: ${csvFileName}`
            });
        }
        
        // Analyze CSV data
        const jobs = [];
        const locationStats = {};
        const salaryStats = [];
        const contactMethods = { phone: 0, email: 0, both: 0, neither: 0 };
        
        return new Promise((resolve) => {
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (row) => {
                    jobs.push(row);
                    
                    // Location statistics
                    const location = row['Location'] || 'Unknown';
                    locationStats[location] = (locationStats[location] || 0) + 1;
                    
                    // Salary statistics
                    const salary = row['Salary'] || '';
                    if (salary && salary.trim() !== '') {
                        const numericSalary = parseInt(salary.replace(/[^\d]/g, ''));
                        if (!isNaN(numericSalary) && numericSalary > 0) {
                            salaryStats.push(numericSalary);
                        }
                    }
                    
                    // Contact method statistics
                    const hasPhone = (row['Contact'] || '').trim() !== '';
                    const hasEmail = (row['Email'] || '').trim() !== '';
                    
                    if (hasPhone && hasEmail) {
                        contactMethods.both++;
                    } else if (hasPhone) {
                        contactMethods.phone++;
                    } else if (hasEmail) {
                        contactMethods.email++;
                    } else {
                        contactMethods.neither++;
                    }
                })
                .on('end', () => {
                    // Calculate salary statistics
                    let salaryAnalysis = {};
                    if (salaryStats.length > 0) {
                        salaryStats.sort((a, b) => a - b);
                        salaryAnalysis = {
                            min: salaryStats[0],
                            max: salaryStats[salaryStats.length - 1],
                            median: salaryStats[Math.floor(salaryStats.length / 2)],
                            average: Math.round(salaryStats.reduce((a, b) => a + b, 0) / salaryStats.length),
                            count: salaryStats.length
                        };
                    }
                    
                    // Sort locations by count
                    const topLocations = Object.entries(locationStats)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 10)
                        .map(([location, count]) => ({ location, count }));
                    
                    const stats = fs.statSync(csvFilePath);
                    
                    res.json({
                        success: true,
                        message: `Statistics for ${csvFileName}`,
                        stats: {
                            file_info: {
                                filename: csvFileName,
                                size: `${(stats.size / 1024).toFixed(2)} KB`,
                                last_modified: stats.mtime.toISOString()
                            },
                            job_counts: {
                                total_jobs: jobs.length,
                                jobs_with_salary: salaryStats.length,
                                jobs_with_contact: contactMethods.phone + contactMethods.both,
                                jobs_with_email: contactMethods.email + contactMethods.both,
                                sponsored_jobs: jobs.filter(job => job['Is Sponsored'] === 'Yes').length
                            },
                            locations: {
                                total_unique_locations: Object.keys(locationStats).length,
                                top_locations: topLocations
                            },
                            salary_analysis: salaryAnalysis,
                            contact_methods: contactMethods
                        }
                    });
                    
                    resolve();
                })
                .on('error', (error) => {
                    console.error('Error analyzing CSV:', error);
                    res.status(500).json({
                        success: false,
                        message: 'Error analyzing CSV file',
                        error: error.message
                    });
                    resolve();
                });
        });
        
    } catch (error) {
        console.error('Error in getCSVStats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

module.exports = { getJobsFromCSV, getAvailableCSVFiles, getCSVStats };
