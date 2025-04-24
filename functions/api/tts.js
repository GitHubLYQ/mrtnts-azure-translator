// functions/api/tts.js
// Adapted for Cloudflare Pages Functions - Enhanced Error Reporting & Using Fetch

// import axios from 'axios'; // No longer needed

export async function onRequestPost(context) {
  const { request, env } = context;

  // Note: Renamed env vars for consistency if needed, ensure they match Cloudflare settings
  const subscriptionKey = env.AZURE_TTS_KEY; // Or AZURE_TTS_SUBSCRIPTION_KEY
  const apiEndpoint = env.AZURE_TTS_ENDPOINT; // Full URL: e.g., https://YOUR_REGION.tts.speech.microsoft.com/cognitiveservices/v1
  // const region = env.AZURE_TTS_REGION; // Region might be part of the endpoint or needed separately depending on Azure setup

  // Verify the key is read correctly
  console.log(`Azure Key Type: ${typeof subscriptionKey}, Length: ${subscriptionKey?.length}`);

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

  /* // Temporarily disable dynamic SSML generation
  // Simple SSML escaping
  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const ssml_dynamic = `
    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${languageCode}'>
      <voice name='${languageCode === 'ko-KR' ? 'ko-KR-SunHiNeural' : 'en-US-JennyNeural'}'>${escapedText}</voice>
    </speak>`;
  */

  // Use a hardcoded, simple SSML for testing
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='en-US-JennyNeural'>Hello</voice></speak>`;

  const headers = {
    'Ocp-Apim-Subscription-Key': subscriptionKey,
    'Content-Type': 'application/ssml+xml',
    'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
    // 'User-Agent': 'your-app-name' // Optional
  };

  try {
    console.log(`Attempting Azure TTS call to: ${apiEndpoint} with lang: ${languageCode}`); // Added log
    console.log('Sending SSML:', ssml); // Log the exact SSML
    console.log('Sending Headers:', JSON.stringify(headers)); // Log the headers

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: headers,
      body: ssml,
    });

    // Check if the request was successful
    if (!response.ok) {
      // Throw an error to be caught by the catch block
      // Try to include details from the response if possible
      let errorDetails = `Azure TTS API request failed with status ${response.status} (${response.statusText}).`;
      let azureErrorBody = null;
      try {
        // Attempt to read response body as text or decode ArrayBuffer
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('json')) {
          azureErrorBody = await response.json();
        } else if (contentType && contentType.includes('text')) {
          azureErrorBody = await response.text();
        } else {
          // Try decoding ArrayBuffer as text for unknown types or potential HTML errors
          const buffer = await response.arrayBuffer();
          azureErrorBody = new TextDecoder().decode(buffer);
        }
        console.error('Azure TTS Error Response Body (decoded):', azureErrorBody); 
      } catch (e) {
        console.error('Failed to read or parse Azure error response body:', e);
        azureErrorBody = 'Could not read error response body.'
      }

      // Construct a more informative error object
      const error = new Error(errorDetails);
      error.status = response.status;
      error.statusText = response.statusText;
      error.details = azureErrorBody || 'No additional details available.'; // Add parsed details
      throw error;
    }

    console.log('Azure TTS call successful via fetch.'); // Updated log

    // Get the audio data as ArrayBuffer
    const audioData = await response.arrayBuffer();

    // Send the audio data back with the correct content type
    return new Response(audioData, {
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

    // --> Modify catch block for generic errors <--
    // Check if the error object has status/details from our fetch error handling
    if (error.status) {
      status = error.status;
      errorBody = {
          error: error.message, // Use the message from the thrown error
          azureStatus: status,
          azureStatusText: error.statusText || '',
          azureErrorDetails: error.details || 'No additional details available in response data.', 
      };
    } else {
      // Handle other potential errors (e.g., network issues before response)
      console.error('Non-HTTP error during Azure TTS processing:', error);
      errorBody.error = `An unexpected error occurred: ${error.message || 'Unknown error'}`;
      // Keep status as 500 for truly unexpected errors
    }
    
    /* // Remove Axios-specific error handling
    if (axios.isAxiosError(error)) { 
        // ... axios specific code ...
    } else {
         // Non-Axios error
         console.error('Non-Axios error during Azure TTS processing:', error);
         errorBody.error = `An unexpected error occurred: ${error.message || 'Unknown error'}`;
    }
    */

    // Return the detailed error information as JSON
    return new Response(JSON.stringify(errorBody), {
      status: status, // Use determined status code
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 