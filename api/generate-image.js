export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // ==============================
    // 1. CHECK GEMINI API KEY
    // ==============================

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing from Vercel");

      return res.status(500).json({
        error:
          "GEMINI_API_KEY is missing. Add GEMINI_API_KEY in Vercel Environment Variables and redeploy."
      });
    }

    // ==============================
    // 2. GET REQUEST DATA
    // ==============================

    const {
      prompt,
      aspectRatio = "1:1",
      imageSize = "1K"
    } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        error: "Image prompt is required"
      });
    }

    // ==============================
    // 3. ALLOWED SETTINGS
    // ==============================

    const allowedRatios = [
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
      "21:9",
      "5:4",
      "4:5",
      "3:2",
      "2:3"
    ];

    const allowedSizes = [
      "1K",
      "2K",
      "4K"
    ];

    const finalAspectRatio = allowedRatios.includes(aspectRatio)
      ? aspectRatio
      : "1:1";

    const finalImageSize = allowedSizes.includes(imageSize)
      ? imageSize
      : "1K";

    // ==============================
    // 4. CALL GEMINI IMAGE API
    // ==============================

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: String(prompt).trim()
                }
              ]
            }
          ],

          generationConfig: {
            responseModalities: ["IMAGE"],

            responseFormat: {
              image: {
                aspectRatio: finalAspectRatio,
                imageSize: finalImageSize
              }
            }
          }
        })
      }
    );

    // ==============================
    // 5. READ GEMINI RESPONSE
    // ==============================

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Image API Error:", {
        status: response.status,
        error: data?.error
      });

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini image generation failed: ${response.status}`
      });
    }

    // ==============================
    // 6. FIND GENERATED IMAGE
    // ==============================

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      (part) =>
        part?.inlineData?.data ||
        part?.inline_data?.data
    );

    const imageData =
      imagePart?.inlineData?.data ||
      imagePart?.inline_data?.data;

    const mimeType =
      imagePart?.inlineData?.mimeType ||
      imagePart?.inline_data?.mime_type ||
      "image/png";

    // ==============================
    // 7. NO IMAGE ERROR
    // ==============================

    if (!imageData) {
      console.error(
        "Gemini response did not contain image:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error:
          "Gemini did not return an image. Please try another prompt."
      });
    }

    // ==============================
    // 8. SEND IMAGE TO FRONTEND
    // ==============================

    return res.status(200).json({
      success: true,

      imageDataUrl:
        `data:${mimeType};base64,${imageData}`,

      mimeType,

      aspectRatio: finalAspectRatio,

      imageSize: finalImageSize
    });

  } catch (error) {
    console.error(
      "Image Generation Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Image generation server error"
    });
  }
}
