// functions/api/tts.js
// Adapted for Cloudflare Pages Functions - Enhanced Error Reporting

import axios from 'axios';

export async function onRequestPost(context) {
  const { request, env } = context;

  // Note: Renamed env vars for consistency if needed, ensure they match Cloudflare settings
  const subscriptionKey = env.AZURE_TTS_KEY; // Or AZURE_TTS_SUBSCRIPTION_KEY
  const apiEndpoint = env.AZURE_TTS_ENDPOINT; // Full URL: e.g., https://YOUR_REGION.tts.speech.microsoft.com/cognitiveservices/v1
  // const region = env.AZURE_TTS_REGION; // Region might be part of the endpoint or needed separately depending on Azure setup

  if (!subscriptionKey || !apiEndpoint) {
    console.error('Server configuration error: Missing Azure TTS credentials.');
    return new Response(JSON.stringify({ error: 'Server configuration error: Missing credentials' }), {
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
    console.log(`Attempting Azure TTS call to: ${apiEndpoint} with lang: ${languageCode}`); // Added log
    const azureResponse = await axios.post(apiEndpoint, ssml, {
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        // 'User-Agent': 'your-app-name' // Optional
      },
      responseType: 'arraybuffer', // Crucial for receiving audio data
    });

    console.log('Azure TTS call successful.'); // Added log
    // Send the audio data back with the correct content type
    return new Response(azureResponse.data, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error) {
    // Log the error server-side (if possible)
    console.error('Azure TTS API call failed:', error.message);

    let status = 500;
    let errorBody = {
        error: 'An unexpected error occurred during TTS processing.',
        azureErrorDetails: null, // Initialize detail field
    };

    if (axios.isAxiosError(error)) { // More robust check for Axios errors
        if (error.response) {
            // Error response received from Azure
            status = error.response.status;
            console.error(`Azure TTS Error Response Status: ${status}`);
            console.error('Azure TTS Error Response Headers:', JSON.stringify(error.response.headers));
            // Try to get details - Azure errors might be in data (often JSON) or plain text
            let details = error.response.data;
            // If data is ArrayBuffer (e.g., HTML error page), try decoding as text
            if (details instanceof ArrayBuffer) {
                try {
                    details = new TextDecoder().decode(details);
                    console.error('Azure TTS Error Response Body (decoded): ', details);
                } catch (decodeError) {
                    console.error('Failed to decode Azure error ArrayBuffer:', decodeError);
                    details = 'Could not decode error response body (ArrayBuffer).';
                }
            } else {
                 console.error('Azure TTS Error Response Body:', JSON.stringify(details));
            }

            errorBody = {
                error: `Azure TTS API request failed with status ${status}.`,
                azureStatus: status,
                azureStatusText: error.response.statusText,
                azureErrorDetails: details || 'No additional details available in response data.', // Add details here
            };
        } else if (error.request) {
            // Request was made but no response received
            console.error('Azure TTS Error: No response received. Request details:', error.request);
            status = 504; // Gateway Timeout might be appropriate
            errorBody.error = 'No response received from Azure TTS service.';
        } else {
            // Something happened in setting up the request
            console.error('Axios setup error during Azure TTS call:', error.message);
            errorBody.error = `Error setting up Azure TTS request: ${error.message}`;
        }
    } else {
         // Non-Axios error
         console.error('Non-Axios error during Azure TTS processing:', error);
         errorBody.error = `An unexpected error occurred: ${error.message || 'Unknown error'}`;
    }

    // Return the detailed error information as JSON
    return new Response(JSON.stringify(errorBody), {
      status: status, // Use determined status code
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 