import { google } from 'googleapis';
import 'dotenv/config';

function convertToString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function getValueFromPath(obj, path) {
  const value = path.split('.').reduce((current, key) => current?.[key], obj);
  if (Array.isArray(value)) {
    return convertToString(value[0]);
  }
  return convertToString(value);
}

function getArrayElement(obj, path, index) {
  const array = path.split('.').reduce((current, key) => current?.[key], obj);
  if (Array.isArray(array) && array.length > index) {
    return convertToString(array[index]);
  }
  return '';
}

class GoogleSheetsService {
  constructor() {
    try {
      this.auth = this.authorize();
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      
      if (!this.spreadsheetId) {
        throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not set in environment variables');
      }
    } catch (error) {
      console.error('Error initializing Google Sheets service:', error);
      throw error;
    }
  }

  authorize() {
    try {
      if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
        throw new Error('Missing Google Sheets credentials in environment variables');
      }

      return new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } catch (error) {
      console.error('Authorization error:', error);
      throw error;
    }
  }

  async initializeSheet() {
    try {
      const headers = [
        'analysisDate',
        'urlAnalyzed',
        'businessName',
        'industry',
        'description',
        'businessType',
        'yearEstablished',
        'mainOfferings',
        'pricingTier',
        'specialties',
        'primaryAudience',
        'demographics',
        'marketPositioning',
        'brandTone',
        'keyMessages',
        'uniqueSellingPoints',
        'email',
        'phone',
        'address',
        'loadTimeMs',
        'mobileFriendly',
        'socialPresenceScore',
        'socialPresencePlatformsTwitterPresent',
        'socialPresencePlatformsTwitterUrl',
        'socialPresenceScore',
        'socialPresenceSocialUrlsForDeeperScrape0',
        'socialPresenceSocialUrlsForDeeperScrape1',
        'socialPresenceSocialUrlsForDeeperScrape2',
        'socialPresenceEmbeddedContentInstagram',
        'socialPresenceEmbeddedContentFacebook',
        'socialPresenceEmbeddedContentTwitter',
        'socialPresenceEmbeddedContentYoutube',
        'socialPresenceEmbeddedContentSocialFeeds',
        'socialPresenceSharingOptionsFacebook',
        'socialPresenceSharingOptionsTwitter',
        'socialPresenceSharingOptionsLinkedin',
        'socialPresenceSharingOptionsGeneralShare',
        'contactInfoPhone0',
        'contactInfoPhone1',
        'contactInfoPhone2',
        'contactInfoPhone3',
        'contactInfoPhone4',
        'contactInfoPhone5',
        'contactInfoPhone6',
        'contactInfoPhone7',
        'contactInfoPhone8',
        'contactInfoPhone9',
        'contactInfoPhone10',
        'contactInfoPhone11',
        'contactInfoPhone12',
        'aiAnalysisBasicInfoBusinessName',
        'aiAnalysisBasicInfoIndustry',
        'aiAnalysisBasicInfoDescription',
        'aiAnalysisBasicInfoBusinessType',
        'aiAnalysisBasicInfoYearEstablished',
        'aiAnalysisProductsServicesMainOfferings0',
        'aiAnalysisProductsServicesMainOfferings1',
        'aiAnalysisProductsServicesMainOfferings2',
        'aiAnalysisProductsServicesMainOfferings3',
        'aiAnalysisProductsServicesMainOfferings4',
        'aiAnalysisProductsServicesMainOfferings5',
        'aiAnalysisProductsServicesPricingTier',
        'aiAnalysisProductsServicesSpecialties0',
        'aiAnalysisProductsServicesSpecialties1',
        'aiAnalysisProductsServicesSpecialties2',
        'aiAnalysisProductsServicesSpecialties3',
        'aiAnalysisTargetMarketPrimaryAudience',
        'aiAnalysisTargetMarketDemographics',
        'aiAnalysisTargetMarketMarketPositioning',
        'aiAnalysisBrandAnalysisTone',
        'aiAnalysisBrandAnalysisKeyMessages0',
        'aiAnalysisBrandAnalysisKeyMessages1',
        'aiAnalysisBrandAnalysisKeyMessages2',
        'aiAnalysisBrandAnalysisKeyMessages3',
        'aiAnalysisBrandAnalysisUniqueSellingPoints0',
        'aiAnalysisBrandAnalysisUniqueSellingPoints1',
        'aiAnalysisBrandAnalysisUniqueSellingPoints2',
        'metadataAnalysisDate',
        'metadataAnalysisVersion',
        'metadataUrlAnalyzed',
        'metadataAnalysisStatus',
        'technicalMetricsSeoMetaDescription',
        'socialPresencePlatformsLinkedinPresent',
        'socialPresencePlatformsLinkedinUrl',
        'socialPresencePlatformsYoutubePresent',
        'socialPresencePlatformsYoutubeUrl',
        'technicalMetricsTechnologyStackAnalytics0',
        'technicalMetricsTechnologyStackAnalytics1',
        'contactInfoEmail0',
        'contactInfoAddress0',
        'contactInfoAddress1'
      ];

      // Update the header row
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        resource: {
          values: [headers],
        },
      });

      // Format header row
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [
            {
              repeatCell: {
                range: {
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: headers.length
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 },
                    textFormat: { bold: true },
                    horizontalAlignment: 'CENTER',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: headers.length,
                },
              },
            },
          ],
        },
      });

      console.log('Sheet initialized with headers');
    } catch (error) {
      console.error('Error initializing sheet:', error.message);
      throw error;
    }
  }

  async appendAnalysis(analysis) {
    try {
      const rowData = [
        getValueFromPath(analysis, 'metadata.analysis_date'),
        getValueFromPath(analysis, 'metadata.url_analyzed'),
        getValueFromPath(analysis, 'basic_info.business_name'),
        getValueFromPath(analysis, 'basic_info.industry'),
        getValueFromPath(analysis, 'basic_info.description'),
        getValueFromPath(analysis, 'basic_info.business_type'),
        getValueFromPath(analysis, 'basic_info.year_established'),
        getValueFromPath(analysis, 'products_services.main_offerings'),
        getValueFromPath(analysis, 'products_services.pricing_tier'),
        getValueFromPath(analysis, 'products_services.specialties'),
        getValueFromPath(analysis, 'target_market.primary_audience'),
        getValueFromPath(analysis, 'target_market.demographics'),
        getValueFromPath(analysis, 'target_market.market_positioning'),
        getValueFromPath(analysis, 'brand_analysis.tone'),
        getValueFromPath(analysis, 'brand_analysis.key_messages'),
        getValueFromPath(analysis, 'brand_analysis.unique_selling_points'),
        getValueFromPath(analysis, 'contact_info.email'),
        getValueFromPath(analysis, 'contact_info.phone'),
        getValueFromPath(analysis, 'contact_info.address'),
        getValueFromPath(analysis, 'technical_metrics.load_time_ms'),
        getValueFromPath(analysis, 'technical_metrics.mobile_friendly'),
        getValueFromPath(analysis, 'social_presence.presence_score'),
        getValueFromPath(analysis, 'social_presence.platforms.twitter.present'),
        getValueFromPath(analysis, 'social_presence.platforms.twitter.url'),
        getValueFromPath(analysis, 'social_presence.presence_score'),
        getArrayElement(analysis, 'social_presence.social_urls_for_deeper_scrape', 0),
        getArrayElement(analysis, 'social_presence.social_urls_for_deeper_scrape', 1),
        getArrayElement(analysis, 'social_presence.social_urls_for_deeper_scrape', 2),
        getValueFromPath(analysis, 'social_presence.embedded_content.instagram'),
        getValueFromPath(analysis, 'social_presence.embedded_content.facebook'),
        getValueFromPath(analysis, 'social_presence.embedded_content.twitter'),
        getValueFromPath(analysis, 'social_presence.embedded_content.youtube'),
        getValueFromPath(analysis, 'social_presence.embedded_content.social_feeds'),
        getValueFromPath(analysis, 'social_presence.sharing_options.facebook'),
        getValueFromPath(analysis, 'social_presence.sharing_options.twitter'),
        getValueFromPath(analysis, 'social_presence.sharing_options.linkedin'),
        getValueFromPath(analysis, 'social_presence.sharing_options.general_share'),
        ...Array.from({ length: 13 }, (_, i) => getArrayElement(analysis, 'contact_info.phone', i)),
        getValueFromPath(analysis, 'ai_analysis.basic_info.business_name'),
        getValueFromPath(analysis, 'ai_analysis.basic_info.industry'),
        getValueFromPath(analysis, 'ai_analysis.basic_info.description'),
        getValueFromPath(analysis, 'ai_analysis.basic_info.business_type'),
        getValueFromPath(analysis, 'ai_analysis.basic_info.year_established'),
        ...Array.from({ length: 6 }, (_, i) => getArrayElement(analysis, 'ai_analysis.products_services.main_offerings', i)),
        getValueFromPath(analysis, 'ai_analysis.products_services.pricing_tier'),
        ...Array.from({ length: 4 }, (_, i) => getArrayElement(analysis, 'ai_analysis.products_services.specialties', i)),
        getValueFromPath(analysis, 'ai_analysis.target_market.primary_audience'),
        getValueFromPath(analysis, 'ai_analysis.target_market.demographics'),
        getValueFromPath(analysis, 'ai_analysis.target_market.market_positioning'),
        getValueFromPath(analysis, 'ai_analysis.brand_analysis.tone'),
        ...Array.from({ length: 4 }, (_, i) => getArrayElement(analysis, 'ai_analysis.brand_analysis.key_messages', i)),
        ...Array.from({ length: 3 }, (_, i) => getArrayElement(analysis, 'ai_analysis.brand_analysis.unique_selling_points', i)),
        getValueFromPath(analysis, 'metadata.analysis_date'),
        getValueFromPath(analysis, 'metadata.analysis_version'),
        getValueFromPath(analysis, 'metadata.url_analyzed'),
        getValueFromPath(analysis, 'metadata.analysis_status'),
        getValueFromPath(analysis, 'technical_metrics.seo_meta_description'),
        getValueFromPath(analysis, 'social_presence.platforms.linkedin.present'),
        getValueFromPath(analysis, 'social_presence.platforms.linkedin.url'),
        getValueFromPath(analysis, 'social_presence.platforms.youtube.present'),
        getValueFromPath(analysis, 'social_presence.platforms.youtube.url'),
        getArrayElement(analysis, 'technical_metrics.technology_stack.analytics', 0),
        getArrayElement(analysis, 'technical_metrics.technology_stack.analytics', 1),
        getArrayElement(analysis, 'contact_info.email', 0),
        getArrayElement(analysis, 'contact_info.address', 0),
        getArrayElement(analysis, 'contact_info.address', 1)
      ];

      // Append the row
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [rowData],
        },
      });

      console.log('Analysis appended to Google Sheets successfully');
    } catch (error) {
      console.error('Error appending to sheet:', error);
      throw error;
    }
  }
}

export const sheetsService = new GoogleSheetsService();
