import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // Import uuid for Azure Translator correlation ID

// Helper function to get env var or throw error
function getEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing environment variable: ${key}. Please check your .env file.`);
  }
  return value;
}

// Helper function to convert Base64 to Blob for Azure CV upload
function base64ToBlob(base64: string, contentType: string = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

/**
 * 调用 Azure Computer Vision API 进行 OCR 识别 (通过 Vite 开发代理)
 * @param imageDataBase64 Base64 编码的图像数据
 * @returns Promise resolving to an object containing the extracted text.
 * @throws Error if the API call fails or required env vars are missing
 */
export const recognizeImage = async (imageDataBase64: string): Promise<{ ocrText: string | null }> => {
  // API Key is still needed for the actual request header, read from client-side env
  const apiKey = getEnvVar('VITE_AZURE_COMPUTER_VISION_KEY');
  
  // Target the local proxy path configured in vite.config.ts
  // Add the necessary /vision path part which will remain after rewrite removes /api/vision
  const proxyApiUrl = '/api/vision/vision/v3.2/ocr'; 

  console.log(`通过 Vite 代理调用 Azure Computer Vision OCR API (路径: ${proxyApiUrl})`);

  try {
    const imageBlob = base64ToBlob(imageDataBase64);

    // Send POST request to the proxy path
    const response = await axios.post(proxyApiUrl, imageBlob, { 
      params: {
        language: 'unk',
        detectOrientation: 'true',
        model_version: 'latest'
      },
      headers: {
        // Key must still be sent, proxy only handles CORS/Target URL
        'Ocp-Apim-Subscription-Key': apiKey, 
        'Content-Type': 'application/octet-stream'
      }
    });

    // Process the OCR results (same logic as before)
    let extractedText = '';
    if (response.data?.regions?.length) { // Simplified check
      response.data.regions.forEach((region: any) => {
        region.lines.forEach((line: any) => {
          line.words.forEach((word: any) => {
            extractedText += word.text + ' ';
          });
          extractedText += '\n';
        });
      });
    }

    console.log("Azure CV OCR Result (via proxy):", extractedText.trim());
    return { ocrText: extractedText.trim() || null };

  } catch (error) {
    // Error handling remains mostly the same
    console.error('Azure Computer Vision API 调用失败 (通过代理):', error);
    if (axios.isAxiosError(error) && error.response) {
      // Handle specific Azure API errors (e.g., 401 Unauthorized, 400 Bad Request, 404 Not Found)
      console.error('Azure API Error Status:', error.response.status);
      console.error('Azure API Error Data:', error.response.data);
      let message = `调用 Azure CV 服务失败 (状态码: ${error.response.status})`;
      if (error.response.data?.error?.message) {
          message += `: ${error.response.data.error.message}`;
      }
      throw new Error(message);
    } else if (axios.isAxiosError(error) && error.request) {
        // Request was made but no response received (could be network issue, timeout, proxy misconfig)
        console.error('请求已发出但未收到 Azure CV 响应 (检查网络或代理配置):', error.request);
         throw new Error('调用 Azure CV 服务时未收到响应。');
    } else {
        // Other errors (e.g., setup error before request)
        console.error('调用 Azure CV 服务时发生错误:', error);
        throw new Error('调用 Azure Computer Vision 服务时发生未知错误。');
    }
  }
};

/**
 * 调用 Azure Translator API 进行文本翻译
 * @param text 要翻译的文本
 * @param targetLanguage 目标语言 ('ko' for Korean, 'en' for English)
 * @returns Promise resolving to the translated text
 * @throws Error if the API call fails or required env vars are missing
 */
export const translateText = async (text: string, targetLanguage: 'ko' | 'en'): Promise<string> => {
  const apiKey = getEnvVar('VITE_AZURE_TRANSLATOR_KEY');
  const endpoint = getEnvVar('VITE_AZURE_TRANSLATOR_ENDPOINT');
  const region = getEnvVar('VITE_AZURE_TRANSLATOR_REGION');

  try {
    const response = await axios({
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
            'Text': text
        }],
        responseType: 'json'
    });

    // Azure Translator 返回一个数组，即使只翻译一个文本
    if (response.data && Array.isArray(response.data) && response.data[0]?.translations?.[0]?.text) {
      return response.data[0].translations[0].text;
    } else {
      console.error('Azure Translator API 响应格式不符合预期:', response.data);
      throw new Error('无法从 Azure Translator 响应中解析翻译结果');
    }

  } catch (error) {
    console.error('Azure Translator API 调用失败:', error);
    if (axios.isAxiosError(error) && !error.response && error.message.includes('Network Error')) {
       console.error("***** DETECTED POTENTIAL CORS ISSUE with Azure Translator API *****");
       throw new Error('调用 Azure Translator 服务失败，可能存在 CORS 跨域问题。请检查浏览器控制台或考虑使用后端代理。');
    }
    if (axios.isAxiosError(error) && error.response) {
      console.error('Azure API Error Data:', error.response.data);
    }
    throw new Error('调用 Azure Translator 服务失败');
  }
};

/**
 * 调用 Azure TTS API 合成语音
 * @param text 要合成语音的文本
 * @param languageCode 语言代码 (e.g., 'ko-KR', 'en-US')
 * @returns Promise resolving to audio data as an ArrayBuffer
 * @throws Error if the API call fails or required env vars are missing
 */
export const synthesizeSpeech = async (text: string, languageCode: string): Promise<ArrayBuffer> => {
  const subscriptionKey = getEnvVar('VITE_AZURE_TTS_SUBSCRIPTION_KEY');
  const apiEndpoint = getEnvVar('VITE_AZURE_TTS_ENDPOINT');

  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  const ssml = `
    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${languageCode}'>
      <voice name='${languageCode === 'ko-KR' ? 'ko-KR-SunHiNeural' : 'en-US-JennyNeural'}'>${escapedText}</voice>
    </speak>`;

  try {
    const response = await axios.post(apiEndpoint, ssml, {
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
      },
      responseType: 'arraybuffer'
    });

    return response.data as ArrayBuffer;

  } catch (error) {
    console.error('Azure TTS API 调用失败:', error);
     if (axios.isAxiosError(error) && !error.response && error.message.includes('Network Error')) {
       console.error("***** DETECTED POTENTIAL CORS ISSUE with Azure TTS API *****");
       throw new Error('调用 Azure TTS 服务失败，可能存在 CORS 跨域问题。请检查浏览器控制台或考虑使用后端代理。');
    }
     if (axios.isAxiosError(error) && error.response) {
      console.error('Azure API Error Data:', error.response.data);
    }
    throw new Error('调用 Azure TTS 服务失败');
  }
}; 