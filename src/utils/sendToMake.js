import fetch from 'node-fetch';

export const sendToMake = async (data) => {
  try {
    if (!process.env.MAKE_WEBHOOK_URL) {
      console.warn('MAKE_WEBHOOK_URL not set');
      return;
    }
    const response = await fetch(process.env.MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.statusText}`);
    }
    console.log('Data sent to Make.com successfully');
  } catch (error) {
    console.error('Error sending to Make.com:', error);
  }
};