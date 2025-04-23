const axios = require('axios');
const { v4: uuidv4 } = require('uuid'); // 需要安装 uuid

const apiKey = process.env.AZURE_TRANSLATOR_KEY;
const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT;
const region = process.env.AZURE_TRANSLATOR_REGION;

if (!apiKey || !endpoint || !region) {
  console.error('Missing Azure Translator environment variables');
}

module.exports = async (req, res) => {
   if (!apiKey || !endpoint || !region) {
    return res.status(500).json({ error: 'Server configuration error: Missing Azure Translator credentials.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { text, targetLanguage } = req.body; // 前端需要发送 JSON: { text: "...", targetLanguage: "ko" }

  if (!text || !targetLanguage || !['ko', 'en'].includes(targetLanguage)) {
    return res.status(400).json({ error: 'Invalid request body. Requires "text" and "targetLanguage" ("ko" or "en").' });
  }

  try {
    const azureResponse = await axios({
      baseURL: endpoint,
      url: '/translate',
      method: 'post',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-type': 'application/json',
        'X-ClientTraceId': uuidv4().toString()
      },
      params: {
        'api-version': '3.0',
        'to': targetLanguage
      },
      data: [{
        'Text': text // 使用大写 'Text'
      }],
      responseType: 'json'
    });

    if (azureResponse.data && Array.isArray(azureResponse.data) && azureResponse.data[0]?.translations?.[0]?.text) {
      res.status(200).json({ translatedText: azureResponse.data[0].translations[0].text });
    } else {
      console.error('Azure Translator API unexpected response format:', azureResponse.data);
      res.status(500).json({ error: 'Failed to parse translation result.' });
    }

  } catch (error) {
    console.error('Azure Translator API call failed:', error.response?.status, error.response?.data || error.message);
     if (error.response) {
      res.status(error.response.status).json({
         error: `Azure Translator API Error: ${error.response.data?.error?.message || error.response.statusText}`,
         details: error.response.data
         });
    } else {
      res.status(500).json({ error: 'Failed to call Azure Translator service.' });
    }
  }
};
