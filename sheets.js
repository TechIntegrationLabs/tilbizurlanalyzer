import { google } from 'googleapis';
import 'dotenv/config';

// Function to flatten nested objects into a single-level object with dot notation
function flattenObject(obj, prefix = '') {
  const flattened = {};
  
  for (const key in obj) {
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      const nested = flattenObject(obj[key], prefix ? `${prefix}.${key}` : key);
      Object.assign(flattened, nested);
    } else {
      // Convert arrays and other values to strings appropriately
      const value = obj[key];
      const finalValue = Array.isArray(value) ? value.join(', ') : value;
      flattened[prefix ? `${prefix}.${key}` : key] = finalValue || '';
    }
  }
  
  return flattened;
}

class GoogleSheetsService {
  constructor() {
    console.log('Initializing Google Sheets service...');
    console.log('Using spreadsheet ID:', process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
    
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

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      return auth;
    } catch (error) {
      console.error('Authorization error:', error);
      throw error;
    }
  }

  async initializeSheet() {
    try {
      const headers = [
        'Analysis Date',
        'URL Analyzed',
        'Business Name',
        'Industry',
        'Description',
        'Business Type',
        'Year Established',
        'Main Offerings',
        'Pricing Tier',
        'Specialties',
        'Primary Audience',
        'Demographics',
        'Market Positioning',
        'Brand Tone',
        'Key Messages',
        'Unique Selling Points',
        'Email',
        'Phone',
        'Address',
        'Load Time (ms)',
        'Mobile Friendly',
        'Social Presence Score'
      ];

      // First, try to read the spreadsheet to verify access
      try {
        await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: 'A1:A1',
        });
      } catch (error) {
        console.error('Error accessing spreadsheet:', error.message);
        if (error.message.includes('not found')) {
          console.error('Spreadsheet not found. Please check the spreadsheet ID and make sure it exists.');
        }
        if (error.message.includes('permission')) {
          console.error('Permission denied. Make sure the service account email has edit access to the spreadsheet.');
        }
        throw error;
      }

      // Update the header row
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:V1',  
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
      if (error.message.includes('Unable to parse range')) {
        console.error('Please make sure the Google Sheet exists and you have edit access');
      }
      throw error;
    }
  }

  async appendAnalysis(analysis) {
    try {
      console.log('Appending analysis to sheet...');
      const flatData = flattenObject(analysis);
      
      // Get headers from first row
      const headerResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: '1:1',
      });
      
      if (!headerResponse.data.values) {
        throw new Error('No headers found in spreadsheet');
      }

      const headers = headerResponse.data.values[0];
      
      // Create row data in the same order as headers
      const rowData = [
        flatData['metadata.analysis_date'] || '',
        flatData['metadata.url_analyzed'] || '',
        flatData['basic_info.business_name'] || '',
        flatData['basic_info.industry'] || '',
        flatData['basic_info.description'] || '',
        flatData['basic_info.business_type'] || '',
        flatData['basic_info.year_established'] || '',
        flatData['products_services.main_offerings'] || '',
        flatData['products_services.pricing_tier'] || '',
        flatData['products_services.specialties'] || '',
        flatData['target_market.primary_audience'] || '',
        flatData['target_market.demographics'] || '',
        flatData['target_market.market_positioning'] || '',
        flatData['brand_analysis.tone'] || '',
        flatData['brand_analysis.key_messages'] || '',
        flatData['brand_analysis.unique_selling_points'] || '',
        flatData['contact_info.email'] || '',
        flatData['contact_info.phone'] || '',
        flatData['contact_info.address'] || '',
        flatData['technical_metrics.load_time_ms'] || '',
        flatData['technical_metrics.mobile_friendly'] || '',
        flatData['social_presence.presence_score'] || ''
      ];

      // Append the row
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [rowData],
        },
      });

      console.log('Analysis appended to Google Sheets successfully');
      return response.data;
    } catch (error) {
      console.error('Error appending to sheet:', error);
      throw error;
    }
  }
}

export const sheetsService = new GoogleSheetsService();
