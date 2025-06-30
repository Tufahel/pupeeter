# Puppeteer Job Scraper

A Node.js web scraper built with Puppeteer that extracts job listings from expatriates.com for Saudi Arabia positions.

## Features

- 🔍 Scrapes job listings from expatriates.com
- 🚀 RESTful API with Express.js
- 📊 JSON response format with metadata
- ⚡ Optimized for cloud deployment
- 🛡️ Error handling and logging
- 🌐 CORS enabled for web applications

## API Endpoints

- `GET /` - API information and status
- `GET /api/jobs` - Fetch job listings
- `GET /health` - Health check endpoint

## Local Development

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Tufahel/pupeeter.git
cd pupeeter
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Test the API:
```bash
curl http://localhost:3000/api/jobs
```

## Deployment

### Option 1: Render.com

1. **Connect your GitHub repository to Render**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub account and select this repository

2. **Configure the service**
   - **Name**: `puppeteer-job-scraper`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npx puppeteer browsers install chrome`
   - **Start Command**: `npm start`

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ```

4. **Deploy**: Click "Create Web Service"

### Option 2: Replit

1. **Import to Replit**
   - Go to [replit.com](https://replit.com)
   - Click "Create Repl" → "Import from GitHub"
   - Enter your repository URL

2. **Configure the Repl**
   - The `replit.toml` file will automatically configure the environment
   - Click "Run" to start the application

3. **Deploy to Production**
   - Click the "Deploy" tab in Replit
   - Follow the deployment wizard

## Usage Examples

### Fetch Jobs
```bash
curl https://your-app-url.com/api/jobs
```

### Response Format
```json
{
  "success": true,
  "count": 25,
  "data": [
    {
      "title": "Software Engineer",
      "url": "https://www.expatriates.com/classifieds/saudi-arabia/jobs/12345",
      "date_posted": "2025-06-29T10:00:00Z",
      "location": "Saudi Arabia",
      "description": "Looking for experienced software engineer...",
      "scraped_at": "2025-06-29T14:30:00Z"
    }
  ],
  "scraped_at": "2025-06-29T14:30:00Z"
}
```

## Technical Details

- **Runtime**: Node.js with Express.js
- **Scraping**: Puppeteer with headless Chrome
- **Deployment**: Optimized for serverless/container platforms
- **Browser Args**: Configured for cloud environments

## Troubleshooting

### Common Issues

1. **Browser Launch Failed**
   - Ensure Chromium is installed: `npx puppeteer browsers install chrome`
   - Check browser arguments for your platform

2. **Memory Issues**
   - The scraper uses optimized browser settings for cloud deployment
   - Consider upgrading your hosting plan if issues persist

3. **Timeout Errors**
   - Network timeouts are set to 30 seconds
   - The target website might be temporarily unavailable

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request
