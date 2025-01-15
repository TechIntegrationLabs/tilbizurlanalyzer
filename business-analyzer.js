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
    headless: "new",
    timeout: 60000,
    waitUntil: 'networkidle0',
    measurePerformance: true,
    checkSocial: true,
    checkTechnical: true
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

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Navigate to page
    console.log('Navigating to website...');
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: config.timeout 
    });

    // Technical Analysis
    if (config.checkTechnical) {
      console.log('Analyzing technical metrics...');
      bkb.technical_metrics = await analyzeTechnicalMetrics(page);
    }

    // Social Media Analysis
    if (config.checkSocial) {
      console.log('Analyzing social media presence...');
      bkb.social_presence = await analyzeSocialPresence(page);
    }

    // Extract contact information
    console.log('Extracting contact information...');
    bkb.contact_info = await extractContactInfo(page);

    // Extract visible content for AI analysis
    console.log('Extracting page content...');
    const visibleText = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let text = '';
      let node;
      while (node = walker.nextNode()) {
        if (node.parentElement.offsetHeight > 0 && node.textContent.trim()) {
          text += node.textContent.trim() + ' ';
        }
      }
      return text;
    });

    // AI Analysis with Claude
    console.log('Performing AI analysis...');
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 4096,
      messages: [{
        role: "user",
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

        Website Content: ${visibleText.slice(0, 15000)}
        
        Return ONLY the JSON object, no additional text or explanation. Ensure all values are properly escaped and the JSON is valid.`
      }]
    });

    // Parse Claude's analysis
    try {
      const responseText = message.content[0].text;
      // Find the first occurrence of a JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const aiAnalysis = JSON.parse(jsonMatch[0]);
          bkb.ai_analysis = aiAnalysis;
        } catch (parseError) {
          console.warn('Could not parse AI analysis JSON:', parseError.message);
          bkb.ai_analysis = { error: 'Failed to parse AI analysis' };
        }
      }
    } catch (error) {
      console.warn('Error processing AI analysis:', error.message);
      bkb.ai_analysis = { error: 'AI analysis failed' };
    }

    // Add metadata
    bkb.metadata = {
      analysis_date: new Date().toISOString(),
      analysis_version: "1.0.0",
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
    presence_score: 0
  };
  
  try {
    // Check for social media links
    for (const [platform, selector] of Object.entries(SELECTORS.SOCIAL_MEDIA)) {
      const links = await page.$$(selector);
      if (links.length > 0) {
        social.platforms[platform] = {
          present: true,
          url: await page.evaluate(el => el.href, links[0])
        };
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
        if (text.match(/[\d\-\(\)\.]{10,}/) || (href && href.includes('tel:'))) {
          contactInfo.phone.push(text.trim());
        }
      }
    }
    
    // Extract address
    const addressElements = await page.$$(SELECTORS.BUSINESS.address);
    for (const el of addressElements) {
      const text = await page.evaluate(el => el.textContent, el);
      if (text.length > 10) { // Basic filter for address-like content
        contactInfo.address.push(text.trim());
      }
    }

  } catch (error) {
    console.warn('Error extracting contact info:', error.message);
  }
  
  return contactInfo;
}

export { analyzeBusiness, FIELD_GROUPS };