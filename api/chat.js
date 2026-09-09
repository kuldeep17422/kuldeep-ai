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

    // Convert conversation to Gemini format
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

Rules:
- Match the user's language.
- Be friendly and helpful.
- Use the conversation history for context.
- Give clear and accurate answers.
- For current, recent, latest, breaking, live, or today's information, use Google Search grounding when available.
- If web search results are available, base current-information answers on them.
- Do not invent sources or facts.
- For normal questions that do not need current information, answer normally.
- If the user asks "aaj", "kal", "yesterday", etc., use the current India date above.
- For technical questions, explain step by step.
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

          tools: [
            {
              google_search: {}
            }
          ],

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();

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

    // Get AI reply
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

    // Get Google Search sources
    const groundingChunks =
      data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const sources = groundingChunks
      .map((chunk) => {
        const web = chunk?.web;

        if (!web?.uri) {
          return null;
        }

        return {
          title: web.title || "Web source",
          url: web.uri
        };
      })
      .filter(Boolean);

    // Remove duplicate URLs
    const uniqueSources = Array.from(
      new Map(
        sources.map((source) => [source.url, source])
      ).values()
    ).slice(0, 6);

    return res.status(200).json({
      reply,
      sources: uniqueSources,
      realtime: uniqueSources.length > 0
    });

  } catch (error) {
    console.error("KULDEEP AI Server Error:", error);

    return res.status(500).json({
      error: error?.message || "Server error"
    });
  }
}
