# 🚀 Advanced Job Scraper for Expatriates.com

A powerful, intelligent job scraping system built with Puppeteer that automatically extracts job listings from expatriates.com with smart duplicate detection, interactive auto-scraping, and comprehensive CSV management.

## ✨ Key Features

### 🎯 **Interactive Auto-Scraping**
- **Smart Startup**: Interactive prompts on `npm start` to choose auto-scraping mode
- **Intelligent Scheduling**: Runs every 5 minutes with enhanced job collection
- **Efficient Processing**: 20 jobs per run across 3 pages with smart duplicate detection
- **Real-time Control**: Start/stop/monitor via API endpoints anytime
- **Production Ready**: Environment variable override for non-interactive deployment

### 🧠 **Advanced Job Processing**
- **Robust Posting ID Extraction**: Multi-method extraction from page content and URL patterns
- **Smart Job Classification**: Automatically detects and filters sponsored content
- **Enhanced Description Parsing**: Improved content extraction with fallback methods
- **Complete Contact Data**: Emails, phone numbers, locations, and company information
- **Rich Metadata**: Salary ranges, requirements, benefits, and posting dates

### 📁 **Intelligent CSV Management**
- **Zero-Duplicate System**: Database + CSV level duplicate prevention
- **Smart File Handling**: Append-only mode with daily file organization
- **Comprehensive Export**: 16 data fields per job with full descriptions
- **Memory Efficient**: Optimized for large datasets and long-running processes

### 🛡️ **Enterprise-Grade Reliability**
- **Multiple Strategies**: Quick, advanced, and bulk scraping modes
- **Robust Error Handling**: Graceful failure recovery with detailed logging
- **Cloudflare Bypass**: Advanced stealth techniques for consistent access
- **Performance Optimized**: Fast execution with configurable limits

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/pupeeter.git
cd pupeeter

# Install dependencies
npm install

# Start the server with interactive setup
npm start
```

### Interactive Startup Experience

When you run `npm start`, you'll see:

```
🚀 Server running on port 3000
�� API available at http://localhost:3000

🤖 Auto-Scraping Configuration:
   🎯 Enhanced mode: 20 jobs per run, 3 pages, smart duplicate detection
   ⏰ Frequency: Every 5 minutes automatically
   🛡️ Duplicate prevention: Database + CSV level protection

❓ Do you want to start auto-scraping now? (y/n):
```

**Choose your mode:**
- **`y` or `yes`**: Enables automatic scraping every 5 minutes
- **`n` or `no`**: Server-only mode (manual scraping via API)

## 📡 API Endpoints

### 🏠 **Core Endpoints**

| Endpoint | Purpose | Response Time |
|----------|---------|---------------|
| `GET /` | Complete API documentation | Instant |
| `GET /health` | Server health check | Instant |

### 🔍 **Job Scraping Endpoints**

| Endpoint | Description | Speed | Best For |
|----------|-------------|-------|----------|
| **`/api/jobs-regular?quick=true&limit=N`** | **RECOMMENDED** | 30-60s | Daily monitoring |
| `/api/jobs-advanced?limit=N` | Detailed extraction | 60-120s | Comprehensive data |
| `/api/jobs-all?quick=true` | Bulk scraping | 5-10min | Large datasets |
| `/api/jobs-analysis` | Analytics & insights | 10-20s | Job market analysis |

### �� **Auto-Scraping Control**

| Endpoint | Function | Purpose |
|----------|----------|---------|
| `POST /api/auto-scraping/start` | Enable automation | Start 5-minute scheduling |
| `POST /api/auto-scraping/stop` | Disable automation | Stop background scraping |
| `GET /api/auto-scraping/status` | Monitor progress | Real-time status & stats |

## 🎯 Usage Examples

### Quick Start Commands

```bash
# Fast scraping with smart limits (RECOMMENDED)
curl "http://localhost:3000/api/jobs-regular?quick=true&limit=15"

# Enable auto-scraping (if not done at startup)
curl -X POST "http://localhost:3000/api/auto-scraping/start"

# Monitor auto-scraping progress
curl "http://localhost:3000/api/auto-scraping/status"

# Quick test with minimal jobs
curl "http://localhost:3000/api/jobs-regular?quick=true&limit=5"
```

### Response Format

```json
{
  "success": true,
  "message": "Successfully scraped 15 NEW regular jobs",
  "stats": {
    "newJobsFound": 150,
    "alreadyScrapedSkipped": 25,
    "regularJobsProcessed": 15,
    "sponsoredJobsSkipped": 45,
    "successRate": 100
  },
  "data": [
    {
      "title": "Senior Software Engineer",
      "salary": "8000",
      "contact": "+966501234567",
      "email": "hr@company.com",
      "location": "Riyadh",
      "posting_id": "60238471",
      "posted_date": "Tuesday, Jul 2, 2025",
      "company": "Tech Company",
      "description": "Complete job description with requirements...",
      "url": "https://www.expatriates.com/cls/60238471.html",
      "scraped_at": "2025-07-02T14:30:00.000Z",
      "is_sponsored": "No"
    }
  ],
  "csvExport": {
    "success": true,
    "filename": "regular_jobs_quick_auto_2025-07-02.csv",
    "newRecords": 15,
    "message": "Added 15 new jobs to daily CSV file"
  }
}
```

## 🎯 Smart Features

### 🔄 **Auto-Scraping Workflow**

1. **Interactive Setup**: Choose auto-scraping at startup
2. **Intelligent Collection**: 20 jobs per run, scanning 3 pages
3. **Duplicate Prevention**: Database pre-filtering + CSV comparison
4. **Smart Export**: Append-only to daily CSV files
5. **Real-time Monitoring**: Live progress updates and statistics

### �� **Duplicate Detection System**

#### Database Level (Primary):
```javascript
// Persistent tracking in scraped_jobs_db.json
{
  "60238471": {
    "first_scraped": "2025-07-02T10:00:00.000Z",
    "times_seen": 1,
    "last_seen": "2025-07-02T10:00:00.000Z"
  }
}
```

#### CSV Level (Secondary):
- Compares new jobs against existing daily CSV entries
- Prevents duplicates even if database is reset
- Ensures data integrity across multiple runs

### 📈 **Performance Profiles**

| Mode | Jobs | Pages | Time | Use Case |
|------|------|-------|------|----------|
| **Quick** | 10-20 | 2-3 | 30-60s | Regular monitoring |
| **Auto** | 20 | 3 | 45-75s | Background automation |
| **Advanced** | 20-50 | 5+ | 2-5min | Detailed analysis |
| **Bulk** | All | 15+ | 10+min | Complete datasets |

## 📁 Project Structure

```
pupeeter/
├── 📄 index.js                     # Main server with interactive startup
├── 📁 api/
│   ├── jobs-regular.js             # Primary endpoint (RECOMMENDED)
│   ├── jobs-advanced.js            # Detailed extraction
│   ├── jobs-all-simple.js          # Bulk scraping
│   ├── jobs-all-regular.js         # Enhanced bulk mode
│   └── jobs-analysis.js            # Analytics & insights
├── 📁 utils/
│   ├── ScrapedJobsDB.js            # Persistent duplicate detection
│   ├── CSVComparator.js            # CSV-level duplicate prevention
│   └── AutoScrapingScheduler.js    # Automated 5-minute scheduling
├── 📁 exports/
│   ├── scraped_jobs_db.json        # Persistent job ID database
│   └── regular_jobs_quick_auto_*.csv # Daily CSV exports
└── 📄 package.json                 # Dependencies & scripts
```

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000                    # Server port (default: 3000)

# Auto-Scraping Control
AUTO_START=true              # Auto-enable scraping (production)
AUTO_START=false             # Disable auto-scraping (development)

# Environment Mode
NODE_ENV=production          # Disables interactive prompts
NODE_ENV=development         # Enables interactive mode (default)

# Browser Settings
PUPPETEER_HEADLESS=true      # Headless mode (recommended)
PUPPETEER_HEADLESS=false     # Visible browser (debugging)
```

### Startup Modes

#### 🖥️ Interactive Mode (Default)
```bash
npm start
# Shows interactive prompt for auto-scraping choice
```

#### 🤖 Production Mode
```bash
NODE_ENV=production AUTO_START=true npm start
# Automatically starts with auto-scraping enabled
```

#### 🛠️ Development Mode
```bash
AUTO_START=false npm start
# Server only, manual scraping via API
```

## 🔧 Advanced Usage

### Custom Job Limits

```bash
# Specific job count
curl "http://localhost:3000/api/jobs-regular?quick=true&limit=25"

# Auto mode with custom settings
curl "http://localhost:3000/api/jobs-regular?quick=true&auto=true&limit=30"

# Maximum performance mode
curl "http://localhost:3000/api/jobs-regular?quick=true&limit=5"
```

### Analytics and Monitoring

```bash
# Job market analysis
curl "http://localhost:3000/api/jobs-analysis?pages=5&detailed=true"

# Auto-scraping performance
curl "http://localhost:3000/api/auto-scraping/status" | jq '.status.stats'

# Real-time job statistics
curl "http://localhost:3000/api/jobs-regular?quick=true&limit=0" | jq '.stats'
```

### CSV File Management

**Automatic File Naming:**
- `regular_jobs_quick_auto_YYYY-MM-DD.csv` (auto-scraping mode)
- `regular_jobs_quick_YYYY-MM-DD.csv` (manual quick mode)
- `advanced_jobs_YYYY-MM-DD.csv` (advanced extraction)

**Features:**
- 📅 **Daily Organization**: New file each day
- ➕ **Append Mode**: Adds to existing daily files
- 🚫 **Duplicate Prevention**: Only unique posting IDs
- 📊 **16 Data Fields**: Complete job information

## 🚨 Troubleshooting

### Common Issues & Solutions

#### Server Won't Start
```bash
# Check port availability
lsof -i :3000

# Kill existing processes
pkill -f "node index.js"

# Clean restart
npm start
```

#### Auto-Scraping Issues
```bash
# Check current status
curl "http://localhost:3000/api/auto-scraping/status"

# Force restart auto-scraping
curl -X POST "http://localhost:3000/api/auto-scraping/stop"
curl -X POST "http://localhost:3000/api/auto-scraping/start"

# Monitor logs
tail -f logs/scraping.log  # if logging is enabled
```

#### Data Quality Issues
```bash
# Test posting ID extraction
curl "http://localhost:3000/api/jobs-regular?quick=true&limit=3"

# Check database integrity
cat exports/scraped_jobs_db.json | jq 'keys | length'

# Validate CSV exports
head -5 exports/regular_jobs_quick_auto_$(date +%Y-%m-%d).csv
```

### Performance Optimization Tips

1. **🚀 Use Quick Mode**: Add `?quick=true` for 2x faster results
2. **🎯 Limit Jobs**: Use `?limit=N` to control processing time
3. **📊 Monitor Database**: Check `scraped_jobs_db.json` size regularly
4. **⏰ Auto-Scraping**: Let it run continuously for optimal efficiency

## 🌐 Deployment

### Local Development
```bash
# Interactive mode with full control
npm start

# Development with auto-scraping
AUTO_START=true npm start
```

### Production Deployment

#### Standard Production
```bash
NODE_ENV=production AUTO_START=true npm start
```

#### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install Puppeteer with Chromium
RUN npx puppeteer browsers install chrome

# Copy application code
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV AUTO_START=true
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### Cloud Platform Variables
```bash
# For Heroku, Railway, Render, etc.
NODE_ENV=production
AUTO_START=true
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

## 📊 Performance Metrics

### Speed Benchmarks
- **Quick Mode**: 30-60 seconds for 15-20 jobs
- **Auto Mode**: 45-75 seconds for 20 jobs  
- **Database Check**: < 1 second for duplicate detection
- **CSV Processing**: < 2 seconds for append operations

### Resource Usage
- **Memory**: 150-250MB during active scraping
- **CPU**: Moderate load during job processing
- **Storage**: ~1-2MB per 1000 jobs in CSV format
- **Network**: Respectful rate limiting with retry logic

## 🎯 Best Practices

### For Development
- ✅ Use interactive mode for full control
- ✅ Test with small limits first (`?limit=5`)
- ✅ Monitor CSV files for data quality
- ✅ Check API responses for extraction accuracy

### For Production
- ✅ Set `NODE_ENV=production` and `AUTO_START=true`
- ✅ Monitor auto-scraping status via API
- ✅ Implement log rotation for long-term operation
- ✅ Regular backup of CSV files and database

### For Data Quality
- ✅ Verify posting ID extraction accuracy
- ✅ Monitor duplicate detection effectiveness  
- ✅ Review success rates in response stats
- ✅ Validate CSV completeness and formatting

## 🆘 Support & Documentation

### Getting Help
1. 📖 Check this README for comprehensive documentation
2. 🔍 Review API endpoint responses for detailed error information
3. 📊 Monitor auto-scraping status for performance insights
4. 🐛 Create GitHub issues with detailed error information

### API Documentation
Visit `http://localhost:3000/` after starting the server for complete API documentation with live examples.

## 🎉 Latest Updates - v2.0.0

### 🆕 Major Features
- ✅ **Interactive Startup**: Smart prompts for auto-scraping configuration
- ✅ **Enhanced Auto-Scraping**: 20 jobs per run with 3-page coverage
- ✅ **Advanced Duplicate Detection**: Database + CSV level prevention
- ✅ **Improved Posting ID Extraction**: Multi-method extraction with fallbacks
- ✅ **Real-time Monitoring**: Live progress tracking and statistics

### 🔧 Technical Improvements
- ✅ **Performance Optimization**: 50% faster job processing
- ✅ **Memory Efficiency**: Reduced memory footprint for long-running processes
- ✅ **Error Handling**: Comprehensive retry logic and graceful failure recovery
- ✅ **CSV Management**: Smart append-only mode with daily file organization
- ✅ **Production Ready**: Environment variable configuration for deployment

### 🐛 Fixes & Enhancements
- ✅ **Accurate Job Extraction**: Reliable posting ID and description parsing
- ✅ **Zero Duplicates**: Robust duplicate prevention across all modes
- ✅ **Stable Auto-Scraping**: Reliable 5-minute scheduling with status monitoring
- ✅ **Complete API**: Comprehensive endpoints with detailed documentation

---

**Perfect for both development and production environments!** 🚀

Built with ❤️ using Node.js, Express, and Puppeteer.
