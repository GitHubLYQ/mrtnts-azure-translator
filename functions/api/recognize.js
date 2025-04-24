// functions/api/recognize.js
// Adapted for Cloudflare Pages Functions

import axios from 'axios'; // Use import instead of require

// Cloudflare Functions automatically make environment variables available via context.env
// No need to declare apiKey/endpoint at the top level here

export async function onRequestPost(context) {
  // context contains request, env, params, waitUntil, next, data
  const { request, env } = context;

  // Get environment variables from context
  const apiKey = env.AZURE_CV_KEY;
  const endpoint = env.AZURE_CV_ENDPOINT; // e.g., https://YOUR_RESOURCE.cognitiveservices.azure.com/

  // Check if environment variables are configured
  if (!apiKey || !endpoint) {
    console.error('Server configuration error: Missing Azure CV credentials in Cloudflare environment variables.');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // No need to check req.method, as onRequestPost only handles POST

  // Get the request body as an ArrayBuffer (suitable for binary data like images)
  const requestBody = await request.arrayBuffer();

  if (!requestBody || requestBody.byteLength === 0) {
    return new Response(JSON.stringify({ error: 'Request body is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiUrl = `${endpoint.replace(/\/$/, '')}/vision/v3.2/ocr`; // Ensure correct path

  try {
    const azureResponse = await axios.post(apiUrl, requestBody, {
      params: {
        language: 'unk',
        detectOrientation: 'true',
        model_version: 'latest',
      },
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream', // Azure needs this for binary data
      },
      responseType: 'json', // Expect JSON response from Azure
    });

    // --- Process Azure response and extract text ---
    let extractedText = '';
    if (azureResponse.data?.regions?.length) {
      azureResponse.data.regions.forEach((region) => {
        region.lines.forEach((line) => {
          line.words.forEach((word) => {
            extractedText += word.text + ' ';
          });
          extractedText += '\n'; // Add newline after each line
        });
      });
    }
    // --- End processing ---

    // Success response to the frontend
    return new Response(JSON.stringify({ ocrText: extractedText.trim() || null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Azure CV API call failed:', error.response?.status, error.response?.data || error.message);
    let status = 500;
    let errorBody = { error: 'Failed to call Azure CV service.' };

    if (error.response) {
        status = error.response.status;
        errorBody = {
           error: `Azure CV API Error: ${error.response.data?.error?.message || error.response.statusText}`,
           details: error.response.data,
        };
    }

    return new Response(JSON.stringify(errorBody), {
      status: status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Optional: Add an onRequestGet or general onRequest handler if needed
// export async function onRequestGet(context) {
//   return new Response('Method Not Allowed', { status: 405 });
// }

// export async function onRequest(context) {
//   if (context.request.method === 'POST') {
//     return await onRequestPost(context);
//   }
//   return new Response('Method Not Allowed', { status: 405 });
// } 