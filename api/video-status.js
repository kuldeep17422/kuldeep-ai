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
      operationName
    } = req.body || {};

    if (!operationName) {
      return res.status(400).json({
        error: "operationName is required"
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const operation =
      await ai.operations.getVideosOperation({
        operation: {
          name: operationName
        }
      });

    if (!operation.done) {

      return res.status(200).json({
        done: false
      });

    }

    if (operation.error) {

      return res.status(500).json({
        error:
          operation.error.message ||
          "Video generation failed."
      });

    }

    const generatedVideo =
      operation.response
        ?.generatedVideos?.[0]
        ?.video;

    if (!generatedVideo) {

      return res.status(502).json({
        error:
          "Video completed but no video file was returned."
      });

    }

    /*
      Depending on the current SDK response,
      the video resource can expose a URI.
    */

    const videoUri =
      generatedVideo.uri ||
      generatedVideo.url;

    if (!videoUri) {

      return res.status(502).json({
        error:
          "Video URL was not available."
      });

    }

    return res.status(200).json({
      done: true,
      videoUrl: videoUri
    });

  } catch (error) {

    console.error(
      "Video Status Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Could not check video status."
    });

  }

}
