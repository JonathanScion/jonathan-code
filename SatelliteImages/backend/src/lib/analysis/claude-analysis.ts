/**
 * Claude AI Image Analysis Module
 * Uses Anthropic Claude API for satellite image analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

// Analysis result types
export interface AIAnalysisResult {
  analysisType: 'general' | 'disaster' | 'landuse' | 'change';
  timestamp: string;
  summary: string;
  confidence: number;
  findings: AnalysisFinding[];
  recommendations: string[];
  rawAnalysis?: string;
}

export interface AnalysisFinding {
  category: string;
  description: string;
  confidence: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  area?: string;
}

export interface DisasterAnalysis extends AIAnalysisResult {
  disasterType?: 'fire' | 'flood' | 'storm' | 'earthquake' | 'drought' | 'none';
  affectedArea?: string;
  severity: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  urgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface LandClassification extends AIAnalysisResult {
  classifications: {
    type: 'urban' | 'agricultural' | 'forest' | 'water' | 'barren' | 'wetland' | 'grassland' | 'snow';
    percentage: number;
    confidence: number;
  }[];
  dominantType: string;
}

// Initialize Anthropic client
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

// Convert image file to base64
async function imageToBase64(imagePath: string): Promise<{ data: string; mediaType: string }> {
  const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const fileBuffer = fs.readFileSync(absolutePath);
  const base64Data = fileBuffer.toString('base64');

  // Determine media type from extension
  const ext = path.extname(imagePath).toLowerCase();
  const mediaTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
  };

  const mediaType = mediaTypes[ext] || 'image/jpeg';

  return { data: base64Data, mediaType };
}

// General satellite image analysis
export async function analyzeImage(
  imagePath: string,
  analysisType: 'general' | 'disaster' | 'landuse' = 'general',
  additionalContext?: string
): Promise<AIAnalysisResult> {
  const client = getClient();
  const { data: imageData, mediaType } = await imageToBase64(imagePath);

  const prompts: Record<string, string> = {
    general: `You are an expert satellite imagery analyst. Analyze this satellite image and provide:
1. A brief summary of what you observe
2. Key findings with confidence levels (0-100%)
3. Any notable features, structures, or patterns
4. Actionable recommendations based on your analysis

Format your response as JSON with this structure:
{
  "summary": "Brief overview of the image",
  "confidence": 85,
  "findings": [
    {"category": "Infrastructure", "description": "...", "confidence": 90},
    {"category": "Vegetation", "description": "...", "confidence": 85}
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}`,

    disaster: `You are an expert disaster assessment analyst specializing in satellite imagery. Analyze this image for signs of:
- Active fires or burn scars
- Flooding or water damage
- Storm damage (debris, structural damage)
- Drought conditions
- Landslides or erosion

Provide your assessment in JSON format:
{
  "summary": "Brief disaster assessment",
  "confidence": 85,
  "disasterType": "fire|flood|storm|earthquake|drought|none",
  "severity": "none|low|moderate|high|extreme",
  "urgency": "none|low|medium|high|critical",
  "affectedArea": "Estimated area description",
  "findings": [
    {"category": "Fire Detection", "description": "...", "confidence": 90, "severity": "high", "location": "Northwest quadrant"}
  ],
  "recommendations": ["Immediate action 1", "Monitoring suggestion 2"]
}`,

    landuse: `You are an expert land use classification analyst. Analyze this satellite image and classify the land cover types visible.

Identify percentages of:
- Urban/Built-up areas
- Agricultural land (crops, fields)
- Forest/Dense vegetation
- Water bodies
- Barren/Bare land
- Wetlands
- Grassland/Shrubland
- Snow/Ice

Provide your classification in JSON format:
{
  "summary": "Overview of land use patterns",
  "confidence": 85,
  "dominantType": "agricultural",
  "classifications": [
    {"type": "urban", "percentage": 15, "confidence": 90},
    {"type": "agricultural", "percentage": 45, "confidence": 85},
    {"type": "forest", "percentage": 25, "confidence": 80},
    {"type": "water", "percentage": 10, "confidence": 95},
    {"type": "barren", "percentage": 5, "confidence": 75}
  ],
  "findings": [
    {"category": "Urban Development", "description": "...", "confidence": 88}
  ],
  "recommendations": ["Land use observation 1", "Monitoring suggestion 2"]
}`
  };

  const systemPrompt = additionalContext
    ? `${prompts[analysisType]}\n\nAdditional context: ${additionalContext}`
    : prompts[analysisType];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageData,
              },
            },
            {
              type: 'text',
              text: systemPrompt,
            },
          ],
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const rawText = textContent.text;

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      analysisType,
      timestamp: new Date().toISOString(),
      summary: parsed.summary || 'Analysis complete',
      confidence: parsed.confidence || 75,
      findings: parsed.findings || [],
      recommendations: parsed.recommendations || [],
      rawAnalysis: rawText,
      ...parsed, // Include any type-specific fields (disasterType, classifications, etc.)
    };
  } catch (error: any) {
    console.error('Claude analysis error:', error);
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

// Specialized disaster detection
export async function detectDisasters(imagePath: string): Promise<DisasterAnalysis> {
  const result = await analyzeImage(imagePath, 'disaster');
  return result as DisasterAnalysis;
}

// Specialized land use classification
export async function classifyLandUse(imagePath: string): Promise<LandClassification> {
  const result = await analyzeImage(imagePath, 'landuse');
  return result as LandClassification;
}

// Change detection between two images
export async function detectChanges(
  imagePath1: string,
  imagePath2: string,
  context?: { date1?: string; date2?: string }
): Promise<AIAnalysisResult> {
  const client = getClient();

  const [image1, image2] = await Promise.all([
    imageToBase64(imagePath1),
    imageToBase64(imagePath2),
  ]);

  const dateContext = context?.date1 && context?.date2
    ? `\nImage 1 was captured on ${context.date1}. Image 2 was captured on ${context.date2}.`
    : '';

  const prompt = `You are an expert satellite imagery change detection analyst. Compare these two satellite images of the same location and identify:

1. Significant changes between the images
2. New construction or development
3. Vegetation changes (growth, clearing, damage)
4. Water level changes
5. Any signs of damage or disaster
6. Infrastructure changes${dateContext}

Provide your analysis in JSON format:
{
  "summary": "Overview of changes detected",
  "confidence": 85,
  "findings": [
    {"category": "Construction", "description": "New building detected in northeast", "confidence": 90, "severity": "low"},
    {"category": "Vegetation", "description": "Forest clearing of approximately 2 hectares", "confidence": 85, "severity": "medium"}
  ],
  "recommendations": ["Monitor continued development", "Investigate vegetation loss"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Image 1 (Before):',
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image1.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: image1.data,
              },
            },
            {
              type: 'text',
              text: 'Image 2 (After):',
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image2.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: image2.data,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const rawText = textContent.text;

    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);

    return {
      analysisType: 'change',
      timestamp: new Date().toISOString(),
      summary: parsed.summary || 'Change detection complete',
      confidence: parsed.confidence || 75,
      findings: parsed.findings || [],
      recommendations: parsed.recommendations || [],
      rawAnalysis: rawText,
    };
  } catch (error: any) {
    console.error('Claude change detection error:', error);
    throw new Error(`Change detection failed: ${error.message}`);
  }
}
