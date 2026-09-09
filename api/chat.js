export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "No messages provided"
      });
    }

    // Convert chat messages to Gemini format
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
      .filter((message) => message.parts[0].text.trim() !== "");

    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid message provided"
      });
    }

    // Check that the Vercel environment variable exists
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing");

      return res.status(500).json({
        error: "Gemini API key is not configured"
      });
    }

    const systemText = `
You are KULDEEP AI, a helpful personal AI assistant.

Rules:
- Answer clearly and helpfully.
- You can communicate in Hindi, English, or Hinglish.
- Match the user's language.
- Be friendly and natural.
- Use the previous conversation to understand context.
- For technical questions, explain step by step.
`.trim();

    const requestBody = {
      systemInstruction: {
        parts: [
          {
            text: systemText
          }
        ]
      },
      contents: conversation,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

    let response;
    let data;

    // Try up to 2 times
    for (let attempt = 1; attempt <= 2; attempt++) {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify(requestBody)
      });

      data = await response.json();

      // Success
      if (response.ok) {
        break;
      }

      // Retry temporary server errors
      if (
        (response.status === 503 || response.status === 429) &&
        attempt < 2
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      break;
    }

    // Gemini returned an error
    if (!response.ok) {
      console.error("Gemini API Error:", {
        status: response.status,
        message: data?.error?.message
      });

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error (${response.status})`
      });
    }

    // Extract Gemini response
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!reply) {
      console.error("Empty Gemini response:", data);

      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    return res.status(200).json({
      reply
    });

  } catch (error) {
    console.error("KULDEEP AI Server Error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
