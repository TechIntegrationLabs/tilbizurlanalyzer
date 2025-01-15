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
        'contactInfoAddress1',
        'all'
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
      // Create row data directly from the analysis object's properties
      const rowData = Object.values(analysis);

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
