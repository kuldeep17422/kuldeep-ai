export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

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

    // Supported by Gemini 3.1 Flash Image
    const allowedAspectRatios = [
      "1:1",
      "1:4",
      "1:8",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "4:1",
      "8:1",
      "9:16",
      "16:9",
      "21:9"
    ];

    const allowedImageSizes = [
      "1K",
      "2K",
      "4K"
    ];

    const finalAspectRatio =
      allowedAspectRatios.includes(aspectRatio)
        ? aspectRatio
        : "1:1";

    const finalImageSize =
      allowedImageSizes.includes(imageSize)
        ? imageSize
        : "1K";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          model: "gemini-3.1-flash-image",

          input: String(prompt).trim(),

          response_format: {
            type: "image",

            // IMPORTANT:
            // Gemini currently supports JPEG here
            mime_type: "image/jpeg",

            aspect_ratio: finalAspectRatio,

            image_size: finalImageSize
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Image Error:", {
        status: response.status,
        error: data?.error
      });

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini image generation failed: ${response.status}`
      });
    }

    // Gemini returns the generated image here
    const imageBase64 =
      data?.output_image?.data;

    if (!imageBase64) {
      console.error(
        "No generated image found:",
        JSON.stringify(data)
      );

      return res.status(502).json({
        error:
          "Gemini did not return an image."
      });
    }

    return res.status(200).json({
      success: true,

      imageDataUrl:
        `data:image/jpeg;base64,${imageBase64}`,

      mimeType: "image/jpeg",

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
