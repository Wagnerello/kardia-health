const functions = require("firebase-functions");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Cloud Function Segura para Execução de IA (Gemini / Groq)
 * Garante que chaves de API nunca fiquem expostas no bundle do cliente.
 */
exports.analyzeData = functions.https.onCall(async (data, context) => {
  // 1. Verificação de Autenticação Obrigatória (Zero Trust)
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "O usuário deve estar autenticado para solicitar análises clínicas."
    );
  }

  const prompt = data.prompt;
  const imageBase64 = data.imageBase64;
  const mimeType = data.mimeType || "image/jpeg";

  if (!prompt || typeof prompt !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O prompt fornecido é inválido."
    );
  }

  // 2. Chaves de API no ambiente seguro do servidor
  const geminiKey = functions.config().gemini?.key || process.env.GEMINI_API_KEY;
  const groqKey = functions.config().groq?.key || process.env.GROQ_API_KEY;

  // Tentativa primária: Google Gemini
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelName = imageBase64 ? "gemini-2.0-flash" : "gemini-2.0-flash";
      const model = genAI.getGenerativeModel({ model: modelName });

      let result;
      if (imageBase64) {
        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
        ]);
      } else {
        result = await model.generateContent(prompt);
      }

      const response = await result.response;
      return { result: response.text(), provider: "gemini", model: modelName };
    } catch (geminiError) {
      console.warn("Erro no Gemini no servidor, tentando fallback:", geminiError.message);
    }
  }

  // Fallback secundário no servidor: Groq (somente texto)
  if (groqKey && !imageBase64) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (response.ok) {
        const groqData = await response.json();
        const text = groqData?.choices?.[0]?.message?.content?.trim();
        if (text) {
          return { result: text, provider: "groq", model: "llama-3.3-70b-versatile" };
        }
      }
    } catch (groqError) {
      console.error("Erro no Groq no servidor:", groqError.message);
    }
  }

  throw new functions.https.HttpsError(
    "internal",
    "Não foi possível processar a análise pelos serviços de inteligência."
  );
});
