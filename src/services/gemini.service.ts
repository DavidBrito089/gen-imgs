import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from "@google/genai";

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] });
  }

  async generateCategories(theme: string, count: number, exclude: string[] = []): Promise<string[]> {
    let prompt = `List exactly ${count} distinct, specific physical items or categories related to the theme "${theme}" in Spanish. 
    
    Guidelines:
    1. Provide the names in Spanish.
    2. Remove accents/diacritics and special characters (e.g. use "Algodon" instead of "Algodón").
    3. Use single words or underscores for spaces (e.g. "Agua_Oxigenada").
    4. Return ONLY the JSON array of strings.`;

    if (exclude.length > 0) {
      prompt += `\n    5. CRITICAL: Do NOT include these previously generated categories: ${exclude.join(', ')}. Find new, distinct ones.`;
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING
            }
          }
        }
      });

      const jsonStr = response.text;
      if (!jsonStr) return [];
      
      const categories = JSON.parse(jsonStr) as string[];
      // Limit to requested count just in case
      return categories.slice(0, count);
    } catch (error) {
      console.error('Error brainstorming categories:', error);
      throw error;
    }
  }

  async generateImage(theme: string, category: string): Promise<string | null> {
    // Prompting in English is usually better for Image models even if the category name is Spanish, 
    // but Imagen handles Spanish well too. To be safe, we can keep the context clear.
    // We pass the Spanish category name; Imagen should understand it especially with the theme context.
    const prompt = `A high quality, photorealistic, clear studio image of ${category} in the context of ${theme}. White background preferred.`;

    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1',
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        return response.generatedImages[0].image.imageBytes;
      }
      return null;
    } catch (error) {
      console.error(`Error generating image for ${category}:`, error);
      return null; // Fail gracefully for individual images
    }
  }
}