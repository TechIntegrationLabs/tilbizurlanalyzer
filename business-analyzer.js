import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { executablePath } from 'puppeteer';
import Anthropic from '@anthropic-ai/sdk';

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Enhanced field groups for comprehensive business analysis
const FIELD_GROUPS = {
  BASIC_INFO: [
    'business_name', 'website_url', 'industry', 'business_description',
    'contact_email', 'phone_number', 'physical_address', 'operating_hours',
    'business_type', 'year_established', 'employee_count_range'
  ],
  SOCIAL_PRESENCE: [
    'social_media_links', 'social_media_platforms', 'social_media_followers',
    'social_media_engagement_rate', 'recent_social_media_posts',
    'social_media_hashtags', 'social_content_themes'
  ],
  REVIEWS_REPUTATION: [
    'google_rating', 'google_review_count', 'yelp_rating', 'yelp_review_count',
    'average_rating', 'total_review_count', 'review_sentiment',
    'common_praise_points', 'common_improvement_points'
  ],
  BUSINESS_OPERATIONS: [
    'products_services', 'price_range', 'payment_methods',
    'booking_availability', 'delivery_options', 'service_areas',
    'languages_supported', 'business_categories'
  ]
};

// Enhanced selectors for better data extraction
const SELECTORS = {
  SOCIAL_MEDIA: {
    instagram: 'a[href*="instagram.com"]',
    facebook: 'a[href*="facebook.com"]',
    twitter: 'a[href*="twitter.com"]',
    linkedin: 'a[href*="linkedin.com"]',
    youtube: 'a[href*="youtube.com"]',
    tiktok: 'a[href*="tiktok.com"]'
  },
  CONTACT: {
    email: [
      'a[href^="mailto:"]',
      '[class*="email"]',
      '[class*="contact"]'
    ],
    phone: [
      'a[href^="tel:"]',
      '[class*="phone"]',
      '[class*="contact"]'
    ]
  },
  BUSINESS: {
    prices: '[class*="price"], [class*="cost"], .amount',
    hours: '[class*="hours"], [class*="schedule"], [class*="timing"]',
    address: '[class*="address"], [class*="location"]'
  }
};

/**
 * Recursive or multi-page crawling logic
 * @param {Object} browser
 * @param {String} url
 * @param {Object} visited - A set/dict of visited URLs to prevent re-visits
 * @param {Number} depth - The current depth of the crawl
 * @param {Number} maxDepth - The maximum depth to crawl
 * @returns {String} - Accumulated text from all visited pages
 */
async function crawlSite({ browser, url, visited, depth, maxDepth = 1 }) {
  if (depth > maxDepth || visited[url]) return ''; // limit depth or avoid re-visiting
  
  visited[url] = true;
  
  // Open a new page
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    
    // Extract visible text from the page
    const pageText = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let text = '';
      let node;
      while ((node = walker.nextNode())) {
        if (
          node.parentElement &&
          node.parentElement.offsetHeight > 0 &&
          node.textContent.trim()
        ) {
          text += node.textContent.trim() + ' ';
        }
      }
      return text;
    });
    
    // Optionally collect more links (if maxDepth > 0)
    let subLinksText = '';
    if (depth < maxDepth) {
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]'))
          .map(link => link.href)
          .filter(href => href.startsWith(window.location.origin))
      );
      
      // Recursively crawl child links
      for (const link of links) {
        subLinksText += await crawlSite({
          browser,
          url: link,
          visited,
          depth: depth + 1,
          maxDepth
        });
      }
    }
    
    await page.close();
    return pageText + '\n' + subLinksText;
    
  } catch (err) {
    console.warn(`Error crawling ${url}:`, err.message);
    try { await page.close(); } catch {}
    return '';
  }
}

async function analyzeBusiness({
  url,
  apiKey,
  fieldGroups = Object.keys(FIELD_GROUPS),
  options = {}
}) {
  if (!url || !apiKey) {
    throw new Error('URL and Anthropic API key are required');
  }

  const defaultOptions = {
    headless: 'new',
    timeout: 60000,
    waitUntil: 'networkidle0',
    measurePerformance: true,
    checkSocial: true,
    checkTechnical: true,
    crawlDepth: 0 // set how deep you want to crawl internally
  };
  
  const config = { ...defaultOptions, ...options };
  let browser;
  let bkb = {}; // Business Knowledge Base object
  
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      executablePath: executablePath(),
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // ----------------------------
    // 1. Crawl the site to gather text (multi-page if desired)
    // ----------------------------
    console.log('Navigating (and possibly crawling) to website...');
    const visitedUrls = {};
    const accumulatedText = await crawlSite({
      browser,
      url,
      visited: visitedUrls,
      depth: 0,
      maxDepth: config.crawlDepth
    });

    // After crawling, we have potentially multiple pages of text in `accumulatedText`

    // ----------------------------
    // 2. Analyze Technical Metrics on the main page (if enabled)
    // ----------------------------
    if (config.checkTechnical) {
      console.log('Analyzing technical metrics (main page)...');
      const mainPage = await browser.newPage();
      await mainPage.goto(url, { waitUntil: 'networkidle0', timeout: config.timeout });
      bkb.technical_metrics = await analyzeTechnicalMetrics(mainPage);
      await mainPage.close();
    }

    // ----------------------------
    // 3. Analyze Social Presence (just main page)
    // ----------------------------
    if (config.checkSocial) {
      console.log('Analyzing social media presence...');
      const socialPage = await browser.newPage();
      await socialPage.goto(url, { waitUntil: 'networkidle0', timeout: config.timeout });
      bkb.social_presence = await analyzeSocialPresence(socialPage);
      await socialPage.close();
    }

    // ----------------------------
    // 4. Extract Contact Information
    // ----------------------------
    console.log('Extracting contact information...');
    const contactPage = await browser.newPage();
    await contactPage.goto(url, { waitUntil: 'networkidle0', timeout: config.timeout });
    bkb.contact_info = await extractContactInfo(contactPage);
    await contactPage.close();

    // ----------------------------
    // 5. AI Analysis with Claude
    // ----------------------------
    console.log('Performing AI analysis...');
    // We feed the multi-page content from accumulatedText, truncated to length if needed
    const contentForAI = accumulatedText.slice(0, 15000);

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze this website content and return a JSON object (and only a JSON object) with the following structure:
{
  "basic_info": {
    "business_name": "",
    "industry": "",
    "description": "",
    "business_type": "",
    "year_established": null
  },
  "products_services": {
    "main_offerings": [],
    "pricing_tier": "",
    "specialties": []
  },
  "target_market": {
    "primary_audience": "",
    "demographics": "",
    "market_positioning": ""
  },
  "brand_analysis": {
    "tone": "",
    "key_messages": [],
    "unique_selling_points": []
  }
}

Website Content: ${contentForAI}

Return ONLY the JSON object, no additional text or explanation. Ensure all values are properly escaped and the JSON is valid.`
        }
      ]
    });

    // Parse Claude's analysis
    let aiAnalysis;
    try {
      const responseText = message.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiAnalysis = JSON.parse(jsonMatch[0]);
      } else {
        aiAnalysis = { error: 'No valid JSON object found in AI response' };
      }
    } catch (error) {
      console.warn('Error processing AI analysis:', error.message);
      aiAnalysis = { error: 'AI analysis failed' };
    }

    bkb.ai_analysis = aiAnalysis;

    // ----------------------------
    // 6. Add metadata
    // ----------------------------
    bkb.metadata = {
      analysis_date: new Date().toISOString(),
      analysis_version: '1.1.0',
      url_analyzed: url,
      analysis_status: 'complete'
    };

    return bkb;

  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(`Business analysis failed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

async function analyzeTechnicalMetrics(page) {
  const metrics = {};
  
  try {
    // Performance metrics
    metrics.performance = await page.evaluate(() => {
      return {
        page_load_time: performance.timing.loadEventEnd - performance.timing.navigationStart,
        dom_content_loaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
        first_paint: performance.getEntriesByType('paint')[0]?.startTime || null,
        navigation_type: performance.navigation.type
      };
    });
    
    // SSL Status
    metrics.ssl_status = page.url().startsWith('https');
    
    // Mobile-friendliness check
    metrics.mobile_friendly = await page.evaluate(() => {
      const viewport = Math.min(document.documentElement.clientWidth, window.innerWidth);
      const hasViewportMeta = !!document.querySelector('meta[name="viewport"]');
      const textReadable = window.getComputedStyle(document.body).fontSize >= '12px';
      return {
        viewport_optimization: hasViewportMeta,
        text_readability: textReadable,
        viewport_width: viewport
      };
    });
    
    // Technology detection
    metrics.technology_stack = await page.evaluate(() => {
      const technologies = {
        cms: null,
        analytics: [],
        marketing: [],
        payment: []
      };
      
      // Check for common technologies
      const scripts = Array.from(document.scripts).map(s => s.src);
      if (scripts.some(s => s.includes('wp-'))) technologies.cms = 'WordPress';
      if (scripts.some(s => s.includes('shopify'))) technologies.cms = 'Shopify';
      if (scripts.some(s => s.includes('squarespace'))) technologies.cms = 'Squarespace';
      
      // Analytics tools
      if (scripts.some(s => s.includes('google-analytics'))) technologies.analytics.push('Google Analytics');
      if (scripts.some(s => s.includes('facebook'))) technologies.analytics.push('Facebook Pixel');
      if (window.ga || window.gtag) technologies.analytics.push('Google Analytics');
      if (window.fbq) technologies.analytics.push('Facebook Pixel');
      
      // Marketing tools
      if (scripts.some(s => s.includes('mailchimp'))) technologies.marketing.push('Mailchimp');
      if (scripts.some(s => s.includes('hubspot'))) technologies.marketing.push('HubSpot');
      
      // Payment systems
      if (scripts.some(s => s.includes('stripe'))) technologies.payment.push('Stripe');
      if (scripts.some(s => s.includes('paypal'))) technologies.payment.push('PayPal');
      
      return technologies;
    });

    // SEO Metrics
    metrics.seo = await page.evaluate(() => {
      return {
        title: document.title,
        meta_description: document.querySelector('meta[name="description"]')?.content,
        has_robots_txt: document.querySelector('meta[name="robots"]')?.content,
        heading_structure: {
          h1: document.querySelectorAll('h1').length,
          h2: document.querySelectorAll('h2').length,
          h3: document.querySelectorAll('h3').length
        },
        image_alt_texts: Array.from(document.images).filter(img => img.alt).length,
        internal_links: Array.from(document.links).filter(link =>
          link.hostname === window.location.hostname
        ).length,
        external_links: Array.from(document.links).filter(link =>
          link.hostname !== window.location.hostname
        ).length
      };
    });

  } catch (error) {
    console.warn('Error collecting some metrics:', error.message);
  }
  
  return metrics;
}

async function analyzeSocialPresence(page) {
  const social = {
    platforms: {},
    presence_score: 0,
    social_urls_for_deeper_scrape: []
  };
  
  try {
    // Check for social media links
    for (const [platform, selector] of Object.entries(SELECTORS.SOCIAL_MEDIA)) {
      const links = await page.$$(selector);
      if (links.length > 0) {
        // get href from first matched link
        const href = await page.evaluate(el => el.href, links[0]);
        social.platforms[platform] = {
          present: true,
          url: href
        };
        social.social_urls_for_deeper_scrape.push(href);
        social.presence_score += 1;
      }
    }
    
    // Extract embedded social content
    social.embedded_content = await page.evaluate(() => {
      return {
        instagram: Array.from(document.querySelectorAll('[class*="instagram-media"]')).length,
        facebook: Array.from(document.querySelectorAll('[class*="fb-post"]')).length,
        twitter: Array.from(document.querySelectorAll('[class*="twitter-tweet"]')).length,
        youtube: Array.from(document.querySelectorAll('[class*="youtube-player"]')).length,
        social_feeds: Array.from(document.querySelectorAll('[class*="social-feed"]')).length
      };
    });
    
    // Check for social sharing buttons
    social.sharing_options = await page.evaluate(() => {
      return {
        facebook: !!document.querySelector('[class*="facebook-share"]'),
        twitter: !!document.querySelector('[class*="twitter-share"]'),
        linkedin: !!document.querySelector('[class*="linkedin-share"]'),
        general_share: !!document.querySelector('[class*="share"]')
      };
    });

  } catch (error) {
    console.warn('Error analyzing social presence:', error.message);
  }
  
  return social;
}

async function extractContactInfo(page) {
  const contactInfo = {
    email: [],
    phone: [],
    address: []
  };
  
  try {
    // Extract email addresses
    for (const selector of SELECTORS.CONTACT.email) {
      const elements = await page.$$(selector);
      for (const el of elements) {
        const text = await page.evaluate(el => el.textContent, el);
        const href = await page.evaluate(el => el.href, el);
        if (text.includes('@') || (href && href.includes('mailto:'))) {
          contactInfo.email.push(text.trim());
        }
      }
    }
    
    // Extract phone numbers
    for (const selector of SELECTORS.CONTACT.phone) {
      const elements = await page.$$(selector);
      for (const el of elements) {
        const text = await page.evaluate(el => el.textContent, el);
        const href = await page.evaluate(el => el.href, el);
        // basic phone matching
        if (
          text.match(/[\d\-\(\)\.\s]{7,}/) || // allow parentheses, dashes, etc.
          (href && href.includes('tel:'))
        ) {
          contactInfo.phone.push(text.trim());
        }
      }
    }
    
    // Extract address
    const addressElements = await page.$$(SELECTORS.BUSINESS.address);
    for (const el of addressElements) {
      const text = await page.evaluate(el => el.textContent, el);
      // Basic filter for address-like content
      if (text.trim().length > 10) {
        contactInfo.address.push(text.trim());
      }
    }

  } catch (error) {
    console.warn('Error extracting contact info:', error.message);
  }
  
  return contactInfo;
}

export { analyzeBusiness, FIELD_GROUPS };
