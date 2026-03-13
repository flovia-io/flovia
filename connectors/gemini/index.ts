/**
 * Gemini Image Generation Connector
 *
 * Uses the Google GenAI SDK (@google/genai) to generate and edit images
 * via Gemini's native image generation capabilities (Nano Banana).
 *
 * Supported models:
 *  - gemini-2.5-flash-image          (fast, efficient)
 *  - gemini-3.1-flash-image-preview  (high-volume, 512–4K)
 *  - gemini-3-pro-image-preview      (professional asset production)
 */

import type { Connector, ConnectorActionResult } from '@flovia/core/connector';
import { GoogleGenAI } from '@google/genai';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

const SUPPORTED_MODELS = [
  { label: 'Gemini 2.5 Flash Image', value: 'gemini-2.5-flash-image' },
  { label: 'Gemini 3.1 Flash Image Preview', value: 'gemini-3.1-flash-image-preview' },
  { label: 'Gemini 3 Pro Image Preview', value: 'gemini-3-pro-image-preview' },
];

function getClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

export const geminiConnector: Connector<GeminiConfig> = {
  metadata: {
    id: 'gemini',
    name: 'Gemini Image Generation',
    description: 'Generate and edit images using Google Gemini (Nano Banana)',
    icon: 'gemini',
    category: 'ai',
    version: '1.0.0',
  },

  configFields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      placeholder: 'AIza...',
      required: true,
      helpText: 'Get your API key from https://aistudio.google.com/apikey',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      required: true,
      options: SUPPORTED_MODELS,
      helpText: 'Choose the Gemini image model to use',
    },
  ],

  actions: [
    {
      id: 'generate-image',
      name: 'Generate Image',
      description: 'Generate an image from a text prompt',
      inputSchema: {
        prompt: { type: 'string', label: 'Prompt', required: true, placeholder: 'A futuristic cityscape at sunset...' },
        aspectRatio: { type: 'string', label: 'Aspect Ratio', required: false, placeholder: '1:1' },
        imageSize: { type: 'string', label: 'Image Size', required: false, placeholder: '1K' },
      },
    },
    {
      id: 'edit-image',
      name: 'Edit Image',
      description: 'Edit an existing image with a text prompt',
      inputSchema: {
        prompt: { type: 'string', label: 'Prompt', required: true, placeholder: 'Add a wizard hat to the cat...' },
        imageBase64: { type: 'string', label: 'Image (base64)', required: true },
        mimeType: { type: 'string', label: 'MIME Type', required: false, placeholder: 'image/png' },
        aspectRatio: { type: 'string', label: 'Aspect Ratio', required: false, placeholder: '1:1' },
        imageSize: { type: 'string', label: 'Image Size', required: false, placeholder: '1K' },
      },
    },
  ],

  async testConnection(config) {
    try {
      const ai = getClient(config.apiKey);
      // Make a lightweight text-only call to verify the API key works
      const response = await ai.models.generateContent({
        model: config.model || 'gemini-2.5-flash-image',
        contents: 'Say "ok" in one word.',
      });
      if (response?.candidates?.[0]) {
        return { success: true };
      }
      return { success: false, error: 'Unexpected empty response from Gemini API' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, error: msg };
    }
  },

  async executeAction(actionId, config, params = {}): Promise<ConnectorActionResult> {
    try {
      const ai = getClient(config.apiKey);
      const model = config.model || 'gemini-2.5-flash-image';

      switch (actionId) {
        case 'generate-image': {
          const prompt = params.prompt as string;
          if (!prompt) return { success: false, error: 'prompt is required' };

          const aspectRatio = (params.aspectRatio as string) || '1:1';
          const imageSize = (params.imageSize as string) || '1K';

          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseModalities: ['TEXT', 'IMAGE'],
              imageConfig: {
                aspectRatio,
                imageSize,
              },
            },
          });

          const result: { text?: string; imageBase64?: string; mimeType?: string } = {};

          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if ((part as any).text) {
              result.text = (part as any).text;
            } else if ((part as any).inlineData) {
              result.imageBase64 = (part as any).inlineData.data;
              result.mimeType = (part as any).inlineData.mimeType;
            }
          }

          if (!result.imageBase64) {
            return { success: false, error: 'No image was generated. Try a different prompt.' };
          }

          return { success: true, data: result };
        }

        case 'edit-image': {
          const prompt = params.prompt as string;
          const imageBase64 = params.imageBase64 as string;
          if (!prompt) return { success: false, error: 'prompt is required' };
          if (!imageBase64) return { success: false, error: 'imageBase64 is required' };

          const mimeType = (params.mimeType as string) || 'image/png';
          const aspectRatio = (params.aspectRatio as string) || undefined;
          const imageSize = (params.imageSize as string) || '1K';

          const contents = [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ];

          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              responseModalities: ['TEXT', 'IMAGE'],
              ...(aspectRatio ? { imageConfig: { aspectRatio, imageSize } } : {}),
            },
          });

          const result: { text?: string; imageBase64?: string; mimeType?: string } = {};

          for (const part of response.candidates?.[0]?.content?.parts ?? []) {
            if ((part as any).text) {
              result.text = (part as any).text;
            } else if ((part as any).inlineData) {
              result.imageBase64 = (part as any).inlineData.data;
              result.mimeType = (part as any).inlineData.mimeType;
            }
          }

          if (!result.imageBase64) {
            return { success: false, error: 'No image was generated. Try a different prompt.' };
          }

          return { success: true, data: result };
        }

        default:
          return { success: false, error: `Unknown action: ${actionId}` };
      }
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },
};
