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
    browser = await puppeteer.launch(
      {
      executablePath: executablePath(),
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  );

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
    const contentForAI = accumulatedText.slice(0, 15000);

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze the following website content and return a JSON object (and ONLY a JSON object) with the following structure:

{
  "basic_info": {
    "business_name": "",
    "website_url": "",
    "industry": "",
    "business_description": "",
    "contact_email": "",
    "phone_number": "",
    "physical_address": "",
    "operating_hours": "",
    "business_type": "",
    "year_established": "",
    "employee_count_range": ""
  },
  "social_presence": {
    "social_media_links": [],
    "social_media_platforms": [],
    "social_media_followers": "",
    "social_media_engagement_rate": "",
    "recent_social_media_posts": [],
    "social_media_hashtags": [],
    "social_content_themes": "",
    "platforms": {
      "twitter": {
        "present": false,
        "url": ""
      },
      "linkedin": {
        "present": false,
        "url": ""
      },
      "youtube": {
        "present": false,
        "url": ""
      }
    },
    "embedded_content": {
      "instagram": false,
      "facebook": false,
      "twitter": false,
      "youtube": false,
      "social_feeds": false
    },
    "sharing_options": {
      "facebook": false,
      "twitter": false,
      "linkedin": false,
      "general_share": false
    }
  },
  "reviews_reputation": {
    "google_rating": "",
    "google_review_count": "",
    "yelp_rating": "",
    "yelp_review_count": "",
    "average_rating": "",
    "total_review_count": "",
    "review_sentiment": "",
    "common_praise_points": [],
    "common_improvement_points": []
  },
  "business_operations": {
    "products_services": [],
    "price_range": "",
    "payment_methods": [],
    "booking_availability": "",
    "delivery_options": "",
    "service_areas": [],
    "languages_supported": [],
    "business_categories": []
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
  },
  "technical_metrics": {
    "load_time_ms": null,
    "mobile_friendly": null,
    "seo_meta_description": "",
    "technology_stack": {
      "analytics": []
    }
  }
}

Please extract as much information as possible from the text, populating every field above. If any field cannot be determined from the content, return it as empty, null, or an empty array. Return ONLY the JSON object, properly escaped with valid JSON formatting. No additional text or explanation.

Website Content:
${contentForAI}

Return ONLY the valid JSON object.`
        }
      ]
    });

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

    // ----------------------------
    // --- UPDATED: Merge Additional Data ---
    // ----------------------------

    // Merge technical metrics with AI analysis
    aiAnalysis.technical_metrics = {
      ...aiAnalysis.technical_metrics,
      load_time_ms: bkb.technical_metrics.performance.page_load_time,
      mobile_friendly: bkb.technical_metrics.mobile_friendly,
      seo_meta_description: bkb.technical_metrics.seo.meta_description,
      technology_stack: {
        analytics: bkb.technical_metrics.technology_stack.analytics
      }
    };

    // Merge social presence data
    aiAnalysis.social_presence = {
      ...aiAnalysis.social_presence,
      ...bkb.social_presence
    };

    // --- UPDATED: If AI doesn't provide a website, fill with the analyzed URL
    if (!aiAnalysis.basic_info.website_url) {
      aiAnalysis.basic_info.website_url = url;
    }

    // --- UPDATED: If no address from extraction, but AI found one
    if (
      aiAnalysis.basic_info?.physical_address &&
      (!bkb.contact_info.address || bkb.contact_info.address.length === 0)
    ) {
      bkb.contact_info.address = [aiAnalysis.basic_info.physical_address];
    }

    // ----------------------------
    // 6. Store the analysis results with exact column names
    // ----------------------------
    // --- UPDATED: Use `business_description` instead of `description`
    const analysisResults = {
      analysisDate: new Date().toISOString(),
      urlAnalyzed: url,
      businessName: bkb.contact_info?.business_name || '',
      industry: aiAnalysis.basic_info?.industry || '',
      // Use business_description from AI
      description: aiAnalysis.basic_info?.business_description || '',
      businessType: aiAnalysis.basic_info?.business_type || '',
      yearEstablished: aiAnalysis.basic_info?.year_established || '',
      mainOfferings: Array.isArray(aiAnalysis.business_operations?.products_services) 
        ? aiAnalysis.business_operations.products_services[0] || ''
        : '',
      pricingTier: aiAnalysis.business_operations?.price_range || '',
      specialties: Array.isArray(aiAnalysis.business_operations?.business_categories) 
        ? aiAnalysis.business_operations.business_categories[0] || ''
        : '',
      primaryAudience: aiAnalysis.target_market?.primary_audience || '',
      demographics: aiAnalysis.target_market?.demographics || '',
      marketPositioning: aiAnalysis.target_market?.market_positioning || '',
      brandTone: aiAnalysis.brand_analysis?.tone || '',
      // Convert array to comma-separated string
      keyMessages: Array.isArray(aiAnalysis.brand_analysis?.key_messages) 
        ? aiAnalysis.brand_analysis.key_messages.join(', ') || ''
        : '',
      uniqueSellingPoints: Array.isArray(aiAnalysis.brand_analysis?.unique_selling_points)
        ? aiAnalysis.brand_analysis.unique_selling_points.join(', ') || ''
        : '',
      email: Array.isArray(bkb.contact_info?.email) ? bkb.contact_info.email[0] || '' : '',
      phone: Array.isArray(bkb.contact_info?.phone) ? bkb.contact_info.phone[0] || '' : '',
      address: Array.isArray(bkb.contact_info?.address) ? bkb.contact_info.address[0] || '' : '',
      loadTimeMs: bkb.technical_metrics?.performance?.page_load_time || 0,
      mobileFriendly: bkb.technical_metrics?.mobile_friendly?.viewport_optimization || false,
      socialPresenceScore: bkb.social_presence?.presence_score || 0,
      socialPresencePlatformsTwitterPresent: bkb.social_presence?.platforms?.twitter?.present || false,
      socialPresencePlatformsTwitterUrl: bkb.social_presence?.platforms?.twitter?.url || '',
      socialPresenceSocialUrlsForDeeperScrape0: bkb.social_presence?.social_urls_for_deeper_scrape?.[0] || '',
      socialPresenceSocialUrlsForDeeperScrape1: bkb.social_presence?.social_urls_for_deeper_scrape?.[1] || '',
      socialPresenceSocialUrlsForDeeperScrape2: bkb.social_presence?.social_urls_for_deeper_scrape?.[2] || '',
      socialPresenceEmbeddedContentInstagram: bkb.social_presence?.embedded_content?.instagram || false,
      socialPresenceEmbeddedContentFacebook: bkb.social_presence?.embedded_content?.facebook || false,
      socialPresenceEmbeddedContentTwitter: bkb.social_presence?.embedded_content?.twitter || false,
      socialPresenceEmbeddedContentYoutube: bkb.social_presence?.embedded_content?.youtube || false,
      socialPresenceEmbeddedContentSocialFeeds: bkb.social_presence?.embedded_content?.social_feeds || false,
      socialPresenceSharingOptionsFacebook: bkb.social_presence?.sharing_options?.facebook || false,
      socialPresenceSharingOptionsTwitter: bkb.social_presence?.sharing_options?.twitter || false,
      socialPresenceSharingOptionsLinkedin: bkb.social_presence?.sharing_options?.linkedin || false,
      socialPresenceSharingOptionsGeneralShare: bkb.social_presence?.sharing_options?.general_share || false,
      contactInfoPhone0: bkb.contact_info?.phone?.[0] || '',
      contactInfoPhone1: bkb.contact_info?.phone?.[1] || '',
      contactInfoPhone2: bkb.contact_info?.phone?.[2] || '',
      contactInfoPhone3: bkb.contact_info?.phone?.[3] || '',
      contactInfoPhone4: bkb.contact_info?.phone?.[4] || '',
      contactInfoPhone5: bkb.contact_info?.phone?.[5] || '',
      contactInfoPhone6: bkb.contact_info?.phone?.[6] || '',
      contactInfoPhone7: bkb.contact_info?.phone?.[7] || '',
      contactInfoPhone8: bkb.contact_info?.phone?.[8] || '',
      contactInfoPhone9: bkb.contact_info?.phone?.[9] || '',
      contactInfoPhone10: bkb.contact_info?.phone?.[10] || '',
      contactInfoPhone11: bkb.contact_info?.phone?.[11] || '',
      contactInfoPhone12: bkb.contact_info?.phone?.[12] || '',
      // Again, use business_description for AI fields
      aiAnalysisBasicInfoBusinessName: aiAnalysis.basic_info?.business_name || '',
      aiAnalysisBasicInfoIndustry: aiAnalysis.basic_info?.industry || '',
      aiAnalysisBasicInfoDescription: aiAnalysis.basic_info?.business_description || '',
      aiAnalysisBasicInfoBusinessType: aiAnalysis.basic_info?.business_type || '',
      aiAnalysisBasicInfoYearEstablished: aiAnalysis.basic_info?.year_established || '',
      aiAnalysisProductsServicesMainOfferings0: aiAnalysis.business_operations?.products_services?.[0] || '',
      aiAnalysisProductsServicesMainOfferings1: aiAnalysis.business_operations?.products_services?.[1] || '',
      aiAnalysisProductsServicesMainOfferings2: aiAnalysis.business_operations?.products_services?.[2] || '',
      aiAnalysisProductsServicesMainOfferings3: aiAnalysis.business_operations?.products_services?.[3] || '',
      aiAnalysisProductsServicesMainOfferings4: aiAnalysis.business_operations?.products_services?.[4] || '',
      aiAnalysisProductsServicesMainOfferings5: aiAnalysis.business_operations?.products_services?.[5] || '',
      aiAnalysisProductsServicesPricingTier: aiAnalysis.business_operations?.price_range || '',
      aiAnalysisProductsServicesSpecialties0: aiAnalysis.business_operations?.business_categories?.[0] || '',
      aiAnalysisProductsServicesSpecialties1: aiAnalysis.business_operations?.business_categories?.[1] || '',
      aiAnalysisProductsServicesSpecialties2: aiAnalysis.business_operations?.business_categories?.[2] || '',
      aiAnalysisProductsServicesSpecialties3: aiAnalysis.business_operations?.business_categories?.[3] || '',
      aiAnalysisTargetMarketPrimaryAudience: aiAnalysis.target_market?.primary_audience || '',
      aiAnalysisTargetMarketDemographics: aiAnalysis.target_market?.demographics || '',
      aiAnalysisTargetMarketMarketPositioning: aiAnalysis.target_market?.market_positioning || '',
      aiAnalysisBrandAnalysisTone: aiAnalysis.brand_analysis?.tone || '',
      aiAnalysisBrandAnalysisKeyMessages0: aiAnalysis.brand_analysis?.key_messages?.[0] || '',
      aiAnalysisBrandAnalysisKeyMessages1: aiAnalysis.brand_analysis?.key_messages?.[1] || '',
      aiAnalysisBrandAnalysisKeyMessages2: aiAnalysis.brand_analysis?.key_messages?.[2] || '',
      aiAnalysisBrandAnalysisKeyMessages3: aiAnalysis.brand_analysis?.key_messages?.[3] || '',
      aiAnalysisBrandAnalysisUniqueSellingPoints0: aiAnalysis.brand_analysis?.unique_selling_points?.[0] || '',
      aiAnalysisBrandAnalysisUniqueSellingPoints1: aiAnalysis.brand_analysis?.unique_selling_points?.[1] || '',
      aiAnalysisBrandAnalysisUniqueSellingPoints2: aiAnalysis.brand_analysis?.unique_selling_points?.[2] || '',
      metadataAnalysisDate: new Date().toISOString(),
      metadataAnalysisVersion: "1.0.0",
      metadataUrlAnalyzed: url,
      metadataAnalysisStatus: "completed",
      technicalMetricsSeoMetaDescription: bkb.technical_metrics?.seo?.meta_description || '',
      socialPresencePlatformsLinkedinPresent: bkb.social_presence?.platforms?.linkedin?.present || false,
      socialPresencePlatformsLinkedinUrl: bkb.social_presence?.platforms?.linkedin?.url || '',
      socialPresencePlatformsYoutubePresent: bkb.social_presence?.platforms?.youtube?.present || false,
      socialPresencePlatformsYoutubeUrl: bkb.social_presence?.platforms?.youtube?.url || '',
      technicalMetricsTechnologyStackAnalytics0: bkb.technical_metrics?.technology_stack?.analytics?.[0] || '',
      technicalMetricsTechnologyStackAnalytics1: bkb.technical_metrics?.technology_stack?.analytics?.[1] || '',
      contactInfoEmail0: bkb.contact_info?.email?.[0] || '',
      contactInfoAddress0: bkb.contact_info?.address?.[0] || '',
      contactInfoAddress1: bkb.contact_info?.address?.[1] || '',
      // --- UPDATED: Shortened "all" to avoid the entire raw HTML ---
      all: JSON.stringify({
        metadata: {
          analysis_date: new Date().toISOString(),
          analysis_version: "1.0.0",
          url_analyzed: url,
          analysis_status: "completed"
        },
        technical_metrics: bkb.technical_metrics,
        social_presence: bkb.social_presence,
        contact_info: bkb.contact_info,
        ai_analysis: aiAnalysis
        // If you really need raw HTML, add: raw_text: accumulatedText
      })
    };

    return analysisResults;

  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(`Business analysis failed: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

// --- UPDATED: Stricter phoneRegex for extractContactInfo
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

// --- UPDATED: Stricter phone regex and deduplicate
async function extractContactInfo(page) {
  const contactInfo = {
    email: [],
    phone: [],
    address: []
  };

  // A stricter phone pattern: (xxx) xxx-xxxx or xxx.xxx.xxxx or xxx-xxx-xxxx
  const phoneRegex = /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/;
  
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
        
        // Check phoneRegex or tel:
        if (phoneRegex.test(text) || (href && href.includes('tel:'))) {
          contactInfo.phone.push(text.trim());
        }
      }
    }
    
    // Deduplicate phone
    contactInfo.phone = [...new Set(contactInfo.phone)];
    
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
