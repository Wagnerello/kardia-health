const functions = require("firebase-functions");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa a API do Gemini. 
// Certifique-se de configurar a variável de ambiente no Firebase:
// firebase functions:config:set gemini.key="SUA_CHAVE_AQUI"
// Ou usando o Firebase Secrets Manager (recomendado)

exports.analyzeData = functions.https.onCall(async (data, context) => {
  // Verifica se o usuário está autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "O usuário deve estar logado para usar este serviço."
    );
  }

  const prompt = data.prompt;
  if (!prompt || typeof prompt !== 'string') {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "O prompt fornecido é inválido."
    );
  }

  try {
    const apiKey = functions.config().gemini?.key || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "internal",
        "A chave da API do Gemini não está configurada."
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // ou o modelo que preferir

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return { result: text };
  } catch (error) {
    console.error("Erro ao chamar API do Gemini:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Ocorreu um erro ao processar a análise."
    );
  }
});
