export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Invalid messages"
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    // India date & time
    const now = new Date();

    const indiaDate = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(now);

    const indiaTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(now);

    const indiaDay = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long"
    }).format(now);

    // Convert OpenAI-style messages to Gemini format
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
      .filter((message) => {
        return message.parts[0].text.trim() !== "";
      });

    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid message found"
      });
    }

    const systemInstruction = `
You are KULDEEP AI, a helpful personal AI assistant.

You can communicate in Hindi, English, or Hinglish.

Current India date:
${indiaDate}

Current India day:
${indiaDay}

Current India time:
${indiaTime}

Important rules:
- Match the user's language.
- Be friendly and helpful.
- Remember the conversation context provided in the messages.
- Answer clearly and accurately.
- For technical questions, explain step by step.
- If the user asks "aaj", "kal", "yesterday", etc., use the current India date above.
- Do not pretend to have capabilities you do not have.
    `.trim();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
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
                text: systemInstruction
              }
            ]
          },

          contents: conversation,

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

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

    const reply = data?.candidates?.[0]?.content?.parts
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
      reply: reply
    });

  } catch (error) {
    console.error("KULDEEP AI Server Error:", error);

    return res.status(500).json({
      error: error?.message || "Server error"
    });
  }
}
