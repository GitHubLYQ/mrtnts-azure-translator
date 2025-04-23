const axios = require('axios');

// 从 Vercel 环境变量读取配置 (在 Vercel 项目设置中配置)
const apiKey = process.env.AZURE_CV_KEY;
const endpoint = process.env.AZURE_CV_ENDPOINT; // 完整的端点 URL，例如 https://YOUR_RESOURCE.cognitiveservices.azure.com/

if (!apiKey || !endpoint) {
  console.error('Missing Azure Computer Vision environment variables');
  // 不能在函数顶级直接 throw，要在 handler 里处理
}

module.exports = async (req, res) => {
  // 检查环境变量是否缺失
  if (!apiKey || !endpoint) {
    return res.status(500).json({ error: 'Server configuration error: Missing Azure CV credentials.' });
  }

  // 只接受 POST 请求
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // 检查 Content-Type，期望是 application/octet-stream
  // 注意：Vercel 会自动处理请求体，我们直接使用 req.body (通常是 Buffer)
  // 但如果前端是用 base64 发送，需要在这里解码
  // 假设前端会发送 Blob/Buffer，Vercel < 4MB 会自动解析为 Buffer
  if (!req.body) {
      return res.status(400).json({ error: 'Request body is required.' });
  }

  const apiUrl = `${endpoint.replace(/\/$/, '')}/vision/v3.2/ocr`; // 确保路径正确

  try {
    const azureResponse = await axios.post(apiUrl, req.body, {
      params: {
        language: 'unk',
        detectOrientation: 'true',
        model_version: 'latest'
      },
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        // Vercel 可能会自动设置 Content-Type，但明确指定更安全
        // 'Content-Type': req.headers['content-type'] || 'application/octet-stream'
         'Content-Type': 'application/octet-stream' // Azure 需要这个
      },
       responseType: 'json' // 期望 Azure 返回 JSON
    });

    // --- 处理 Azure 响应并提取文本 ---
    let extractedText = '';
    if (azureResponse.data?.regions?.length) {
       azureResponse.data.regions.forEach((region) => {
         region.lines.forEach((line) => {
           line.words.forEach((word) => {
             extractedText += word.text + ' ';
           });
           extractedText += '\\n';
         });
       });
    }
    // --- 结束处理 ---

    // 成功响应给前端
    res.status(200).json({ ocrText: extractedText.trim() || null });

  } catch (error) {
    console.error('Azure CV API call failed:', error.response?.status, error.response?.data || error.message);
    if (error.response) {
      // 将 Azure 的错误信息转发给前端（或者只记录日志，返回通用错误）
      res.status(error.response.status).json({
         error: `Azure CV API Error: ${error.response.data?.error?.message || error.response.statusText}`,
         details: error.response.data
         });
    } else {
      res.status(500).json({ error: 'Failed to call Azure CV service.' });
    }
  }
};
