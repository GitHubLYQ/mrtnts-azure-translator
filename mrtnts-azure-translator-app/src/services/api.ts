import axios from 'axios';
// uuid 不再需要在前端导入

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
 * 调用 Azure Computer Vision API 进行 OCR 识别 (通过后端代理)
 * @param imageDataBase64 Base64 编码的图像数据
 * @returns Promise resolving to an object containing the extracted text.
 * @throws Error if the API call fails or required env vars are missing
 */
export const recognizeImage = async (imageDataBase64: string): Promise<{ ocrText: string | null }> => {
  console.log('调用后端代理 /api/recognize');
  try {
    const imageBlob = base64ToBlob(imageDataBase64);
    // 将 Blob 发送到后端函数
    const response = await axios.post('/api/recognize', imageBlob, {
      headers: {
        'Content-Type': 'application/octet-stream' // 告诉后端我们发送的是二进制流
      },
       // 后端函数应该返回 JSON
    });
    console.log("后端代理识别结果:", response.data);
    // 后端函数应直接返回 { ocrText: "..." } 结构
    return response.data;
  } catch (error: any) {
    console.error('调用 /api/recognize 失败:', error.response?.data || error.message);
    throw new Error(`识别代理调用失败: ${error.response?.data?.error || error.message}`);
  }
};

/**
 * 调用 Azure Translator API 进行文本翻译 (通过后端代理)
 * @param text 要翻译的文本
 * @param targetLanguage 目标语言 ('ko' for Korean, 'en' for English)
 * @returns Promise resolving to the translated text
 * @throws Error if the API call fails or required env vars are missing
 */
export const translateText = async (text: string, targetLanguage: 'ko' | 'en'): Promise<string> => {
  console.log(`调用后端代理 /api/translate (目标: ${targetLanguage})`);
  try {
    const response = await axios.post('/api/translate', {
      text: text,
      targetLanguage: targetLanguage
    }); // 发送 JSON
     console.log("后端代理翻译结果:", response.data);
    // 后端函数应返回 { translatedText: "..." }
    if (!response.data?.translatedText) {
         throw new Error("从代理收到的翻译结果格式无效");
    }
    return response.data.translatedText;
  } catch (error: any) {
    console.error('调用 /api/translate 失败:', error.response?.data || error.message);
     throw new Error(`翻译代理调用失败: ${error.response?.data?.error || error.message}`);
  }
};

/**
 * 调用 Azure TTS API 合成语音 (通过后端代理)
 * @param text 要合成语音的文本
 * @param languageCode 语言代码 (e.g., 'ko-KR', 'en-US')
 * @returns Promise resolving to audio data as an ArrayBuffer
 * @throws Error if the API call fails or required env vars are missing
 */
export const synthesizeSpeech = async (text: string, languageCode: string): Promise<ArrayBuffer> => {
  console.log(`调用后端代理 /api/tts (语言: ${languageCode})`);
  try {
    const response = await axios.post('/api/tts', {
      text: text,
      languageCode: languageCode
    }, {
      responseType: 'arraybuffer' // 期望从后端函数获取音频数据
    });
     console.log("后端代理 TTS 响应状态:", response.status);
    return response.data; // 直接返回 ArrayBuffer
  } catch (error: any) {
    console.error('调用 /api/tts 失败:', error.response?.statusText || error.message);
     throw new Error(`TTS 代理调用失败: ${error.response?.statusText || error.message}`);
  }
}; 