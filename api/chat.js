export default async function handler(req, res) {
  // Only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body || {};

    // Check messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Invalid messages"
      });
    }

    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing");

      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel"
      });
    }

    // Convert messages to Gemini format
    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: String(message.content || "")
          }
        ]
      }))
      .filter(
        (message) =>
          message.parts[0].text.trim().length > 0
      );

    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid message found"
      });
    }

    // KULDEEP AI instructions
    const systemInstruction = `
You are KULDEEP AI, a helpful personal AI assistant.

You can communicate in:
- Hindi
- English
- Hinglish

Instructions:
- Match the language used by the user.
- Be friendly, clear and helpful.
- Remember the conversation context provided in the request.
- For technical questions, explain step by step.
- Do not make up information.
- Keep answers easy to understand.
`.trim();

    // Gemini API URL
    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },

      contents: conversation,

      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    // Call Gemini
    const response = await fetch(apiUrl, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },

      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    // Gemini error
    if (!response.ok) {
      console.error("Gemini API Error:", {
        status: response.status,
        error: data?.error
      });

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error: ${response.status}`
      });
    }

    // Get AI response
    const reply = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim();

    // Empty response
    if (!reply) {
      console.error("Gemini returned no text:", data);

      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    // Send reply to frontend
    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("KULDEEP AI Server Error:", error);

    return res.status(500).json({
      error: error?.message || "Server error"
    });
  }
}
