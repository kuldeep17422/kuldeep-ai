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

    // =========================================
    // INDIA DATE & TIME
    // =========================================

    const now = new Date();

    const indiaDate = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(now);

    const indiaTime = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(now);

    const indiaDay = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long"
    }).format(now);


    // =========================================
    // CONVERSATION
    // =========================================

    const conversation = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role:
          message.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: String(message.content || "")
          }
        ]
      }))
      .filter((message) => {
        return (
          message.parts[0].text.trim() !== ""
        );
      });


    if (conversation.length === 0) {
      return res.status(400).json({
        error: "No valid message found"
      });
    }


    // =========================================
    // SYSTEM INSTRUCTION
    // =========================================

    const systemInstruction = `
You are KULDEEP AI, a professional personal AI assistant.

You can communicate in Hindi, English, or Hinglish.

CURRENT INDIA DATE AND TIME:

Today:
${indiaDay}, ${indiaDate}

Current India time:
${indiaTime}

Timezone:
Asia/Kolkata (IST)

DATE RULES:

- "Aaj" means the current India date above.
- "Kal" and "yesterday" must be calculated from the current India date.
- Never guess the current date.
- Use Asia/Kolkata for date/time questions unless another timezone is explicitly requested.

REAL-TIME INFORMATION:

You have access to Google Search grounding.

Use web search when the user asks about information that may have changed recently, including:

- latest news
- today's news
- current events
- recent technology updates
- current sports results
- current products or prices
- recent software versions
- current company information
- current political/public information
- recent releases
- latest trends
- information after your knowledge cutoff
- any question where current web information would materially improve accuracy

For stable general knowledge, you do not need to search unnecessarily.

When using web information:
- Prefer trustworthy sources.
- Give a concise answer.
- Mention important sources naturally when useful.
- Never pretend old knowledge is current.
- If current information cannot be verified, say so.

GENERAL RULES:

- Match the user's language.
- Be friendly and professional.
- Remember conversation context.
- Give clear and accurate answers.
- For technical questions, explain step by step.
- Use clean formatting.
- Do not pretend to have capabilities you do not have.
- Keep answers useful and reasonably concise.
    `.trim();


    // =========================================
    // GEMINI REQUEST
    // =========================================

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key":
            process.env.GEMINI_API_KEY
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

          // =====================================
          // GOOGLE SEARCH GROUNDING
          // =====================================

          tools: [
            {
              google_search: {}
            }
          ],

          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048
          }

        })
      }
    );


    // =========================================
    // API RESPONSE
    // =========================================

    const data = await response.json();


    if (!response.ok) {

      console.error(
        "Gemini API Error:",
        {
          status: response.status,
          error: data?.error
        }
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          `Gemini API error: ${response.status}`
      });

    }


    // =========================================
    // AI TEXT
    // =========================================

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map(
          (part) => part.text || ""
        )
        .join("")
        .trim();


    if (!reply) {

      console.error(
        "Empty Gemini response:",
        data
      );

      return res.status(502).json({
        error:
          "Gemini returned an empty response"
      });

    }


    // =========================================
    // EXTRACT WEB SOURCES
    // =========================================

    const sources = [];

    const groundingChunks =
      data?.candidates?.[0]
        ?.groundingMetadata
        ?.groundingChunks || [];


    for (const chunk of groundingChunks) {

      const uri =
        chunk?.web?.uri;

      const title =
        chunk?.web?.title;


      if (
        uri &&
        !sources.some(
          source =>
            source.url === uri
        )
      ) {

        sources.push({
          title:
            title || "Web source",

          url: uri
        });

      }

    }


    // =========================================
    // FINAL RESPONSE
    // =========================================

    return res.status(200).json({

      reply,

      sources: sources.slice(0, 6),

      realtime:
        sources.length > 0

    });


  } catch (error) {

    console.error(
      "KULDEEP AI Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Server error"
    });

  }
}
