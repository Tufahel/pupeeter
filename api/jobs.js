const puppeteer = require('puppeteer');

module.exports = async (req, res) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.expatriates.com/classifieds/saudi-arabia/jobs/', {
    waitUntil: 'networkidle2',
  });

  const jobs = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('ul.listings > li'));
    return list.map(el => {
      const a = el.querySelector('a');
      const title = a?.innerText.trim() || '';
      const url = 'https://www.expatriates.com' + (a?.getAttribute('href') || '');
      const date = el.querySelector('div.listing-info time')?.getAttribute('datetime') || '';
      return { title, url, date_posted: date, location: 'Saudi Arabia' };
    });
  });

  await browser.close();
  res.status(200).json(jobs);
};
