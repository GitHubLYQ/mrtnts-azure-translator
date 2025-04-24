// functions/api/translate.js
// Adapted for Cloudflare Pages Functions

import axios from 'axios';
// import { v4 as uuidv4 } from 'uuid'; // UUID is not typically needed/available directly here

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.AZURE_TRANSLATOR_KEY;
  const endpoint = env.AZURE_TRANSLATOR_ENDPOINT;
  const region = env.AZURE_TRANSLATOR_REGION;

  if (!apiKey || !endpoint || !region) {
    console.error('Server configuration error: Missing Azure Translator credentials.');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let requestBody;
  try {
    requestBody = await request.json(); // Expect JSON body: { text: "...", targetLanguage: "ko" }
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { text, targetLanguage } = requestBody;

  if (!text || !targetLanguage || !['ko', 'en'].includes(targetLanguage)) {
    return new Response(JSON.stringify({ error: 'Invalid request body. Requires "text" and "targetLanguage" ("ko" or "en").' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Get Cloudflare request ID as a potential trace ID substitute
  const traceId = request.headers.get('cf-request-id') || crypto.randomUUID(); // Fallback to random UUID


  try {
    const azureResponse = await axios({
      baseURL: endpoint,
      url: '/translate',
      method: 'post',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-type': 'application/json',
        'X-ClientTraceId': traceId // Use CF request ID or generated UUID
      },
      params: {
        'api-version': '3.0',
        'to': targetLanguage,
      },
      data: [{
        'Text': text, // Use Azure's expected casing
      }],
      responseType: 'json',
    });

    if (azureResponse.data && Array.isArray(azureResponse.data) && azureResponse.data[0]?.translations?.[0]?.text) {
      return new Response(JSON.stringify({ translatedText: azureResponse.data[0].translations[0].text }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      console.error('Azure Translator API unexpected response format:', azureResponse.data);
      return new Response(JSON.stringify({ error: 'Failed to parse translation result.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Azure Translator API call failed:', error.response?.status, error.response?.data || error.message);
    let status = 500;
    let errorBody = { error: 'Failed to call Azure Translator service.' };

    if (error.response) {
      status = error.response.status;
      errorBody = {
         error: `Azure Translator API Error: ${error.response.data?.error?.message || error.response.statusText}`,
         details: error.response.data,
      };
    }
    return new Response(JSON.stringify(errorBody), {
      status: status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 