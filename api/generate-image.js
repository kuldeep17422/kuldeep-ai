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
      aspectRatio = "1:1",
      imageSize = "1K"
    } = req.body || {};

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        error: "Image prompt is required"
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-image",

          input: [
            {
              type: "text",
              text: prompt.trim()
            }
          ],

          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: aspectRatio,
            image_size: imageSize
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Image Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Image generation failed: ${response.status}`
      });
    }

    const imageBase64 =
      data?.output_image?.data ||
      data?.output?.find?.(
        item => item?.type === "image"
      )?.data;

    if (!imageBase64) {
      console.error("No image returned:", data);

      return res.status(502).json({
        error: "Gemini did not return an image"
      });
    }

    return res.status(200).json({
      success: true,
      imageDataUrl: `data:image/png;base64,${imageBase64}`
    });

  } catch (error) {
    console.error("Image Generation Server Error:", error);

    return res.status(500).json({
      error: error?.message || "Server error"
    });
  }
}
