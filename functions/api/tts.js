// functions/api/tts.js
// Adapted for Cloudflare Pages Functions

import axios from 'axios';

export async function onRequestPost(context) {
  const { request, env } = context;

  // Note: Renamed env vars for consistency if needed, ensure they match Cloudflare settings
  const subscriptionKey = env.AZURE_TTS_KEY; // Or AZURE_TTS_SUBSCRIPTION_KEY
  const apiEndpoint = env.AZURE_TTS_ENDPOINT; // Full URL: e.g., https://YOUR_REGION.tts.speech.microsoft.com/cognitiveservices/v1
  // const region = env.AZURE_TTS_REGION; // Region might be part of the endpoint or needed separately depending on Azure setup

  if (!subscriptionKey || !apiEndpoint) {
    console.error('Server configuration error: Missing Azure TTS credentials.');
    // Return JSON error for consistency, even though frontend expects ArrayBuffer on success
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let requestBody;
  try {
    requestBody = await request.json(); // Expect JSON: { text: "...", languageCode: "ko-KR" }
  } catch (e) {
     return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { text, languageCode } = requestBody;

  if (!text || !languageCode) {
     return new Response(JSON.stringify({ error: 'Invalid request body. Requires "text" and "languageCode".' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simple SSML escaping
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
        // 'User-Agent': 'your-app-name' // Optional
      },
      responseType: 'arraybuffer', // Crucial for receiving audio data
    });

    // Send the audio data back with the correct content type
    return new Response(azureResponse.data, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error) {
    console.error('Azure TTS API call failed:', error.response?.status, error.message);
    let status = 500;
    let errorMessage = 'Failed to call Azure TTS service.';

    if (error.response) {
        status = error.response.status;
        // TTS errors might return plain text or other formats, try to get text
        errorMessage = `Azure TTS API Error: ${error.response.statusText || 'Unknown error'}`;
        // Log the detailed error if possible (might be binary)
        // console.error('Azure TTS Error Body:', error.response.data);
    }

    // Respond with a JSON error, even though success is audio
     return new Response(JSON.stringify({ error: errorMessage }), {
      status: status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 