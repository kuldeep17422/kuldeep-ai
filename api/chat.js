export default async function handler(req, res) {
  // Only POST requests allowed
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body;

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid messages"
      });
    }

    // Remove system message and convert OpenAI-style messages
    // into Gemini format
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

    // Make sure there is something to send
    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No message provided"
      });
    }

    // Gemini API request
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text: `
You are KULDEEP AI, a helpful personal AI assistant.

Your behavior:
- Answer clearly and helpfully.
- You can communicate in Hindi, English, or Hinglish.
- Match the language used by the user.
- Be friendly and natural.
- If the user asks a technical question, explain step-by-step.
- Remember and use the conversation context provided to you.
- Do not claim to have capabilities that you do not have.
                `.trim()
              }
            ]
          },

          contents: conversation
        })
      }
    );

    const data = await response.json();

    // Gemini API error
    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API error"
      });
    }

    // Extract AI response
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // No response received
    if (!reply) {
      console.error("Unexpected Gemini response:", data);

      return res.status(500).json({
        error: "No response received from Gemini"
      });
    }

    // Send response to frontend
    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console.error("Server Error:", error);

    return res.status(500).json({
      error: "Server error"
    });
  }
}
