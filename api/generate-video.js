import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    const {
      prompt,
      imageData,
      mimeType = "image/png",
      aspectRatio = "16:9"
    } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Video prompt is required"
      });
    }

    if (!imageData) {
      return res.status(400).json({
        error: "Please provide an image"
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    let base64Image = imageData;

    if (base64Image.includes(",")) {
      base64Image = base64Image.split(",")[1];
    }

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",

      prompt: prompt.trim(),

      image: {
        imageBytes: base64Image,
        mimeType: mimeType
      },

      config: {
        aspectRatio: aspectRatio
      }
    });

    return res.status(200).json({
      success: true,
      operationName: operation.name
    });

  } catch (error) {
    console.error("Video Generation Error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Video generation failed"
    });
  }
}
