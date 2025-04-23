const axios = require('axios');

const subscriptionKey = process.env.AZURE_TTS_SUBSCRIPTION_KEY;
const apiEndpoint = process.env.AZURE_TTS_ENDPOINT; // 完整的 URL，例如 https://YOUR_REGION.tts.speech.microsoft.com/cognitiveservices/v1

if (!subscriptionKey || !apiEndpoint) {
  console.error('Missing Azure TTS environment variables');
}

module.exports = async (req, res) => {
  if (!subscriptionKey || !apiEndpoint) {
    return res.status(500).json({ error: 'Server configuration error: Missing Azure TTS credentials.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { text, languageCode } = req.body; // 前端需要发送 JSON: { text: "...", languageCode: "ko-KR" }

  if (!text || !languageCode) {
    return res.status(400).json({ error: 'Invalid request body. Requires "text" and "languageCode".' });
  }

  // 简单的 SSML 转义
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const ssml = `
    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${languageCode}'>
      <voice name='${languageCode === 'ko-KR' ? 'ko-KR-SunHiNeural' : 'en-US-JennyNeural'}'>${escapedText}</voice>
    </speak>`;

  try {
    const azureResponse = await axios.post(apiEndpoint, ssml, {
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        // 'User-Agent': 'your-app-name' // 可选
      },
      responseType: 'arraybuffer' // 重要：获取音频数据
    });

    // 设置正确的响应头并将音频数据发送回前端
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(azureResponse.data);

  } catch (error) {
    console.error('Azure TTS API call failed:', error.response?.status, error.message);
    // 注意：音频错误响应可能不是 JSON
    if (error.response) {
      res.status(error.response.status).send(`Azure TTS API Error: ${error.response.statusText}`); // 发送文本错误
    } else {
      res.status(500).send('Failed to call Azure TTS service.');
    }
  }
};
