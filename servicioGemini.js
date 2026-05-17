const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  throw new Error('GEMINI_API_KEY no está configurada. Agrega la clave en el archivo .env del backend.');
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const extractJsonFromText = (text) => {
  const cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : cleaned;
  const jsonMatch = candidate.match(/(\{[\s\S]*\})|(\[[\s\S]*\])/);
  return jsonMatch ? jsonMatch[0] : candidate;
};

const sanitizeJsonText = (text) => {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (!inString) {
      if (char === '"') {
        inString = true;
      }
      result += char;
      continue;
    }

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      result += char;
      continue;
    }

    if (char === '"') {
      inString = false;
      result += char;
      continue;
    }

    if (char === '\r' || char === '\n') {
      result += '\\n';
      continue;
    }

    result += char;
  }

  return result;
};

const parseJsonResponse = (rawText) => {
  try {
    return JSON.parse(rawText);
  } catch (error) {
    const extracted = extractJsonFromText(rawText);
    const sanitizedStrings = sanitizeJsonText(extracted);
    const sanitized = sanitizedStrings.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
    return JSON.parse(sanitized);
  }
};

const buildReciboPrompt = (textoExtraido) => {
  return `Eres un asistente que recibe texto extraído de un recibo de compra. Responde únicamente con JSON válido, sin explicaciones adicionales.

La salida debe tener exactamente esta estructura:
{
  "idTicket": 0,
  "fecha": "YYYY-MM-DD",
  "categorias": [
    { "nombre": "Texto del producto o servicio", "categoria": "Comida|Vivienda|Servicios|Transporte|Salud|Entretenimiento|Viajes|Gustos|Otros", "gasto": 0 }
  ]
}

Reglas:
- Convierte montos a número decimal sin símbolo de moneda.
- Usa la categoría más adecuada de la lista.
- No agregues campos extra.
- Si no puedes inferir un idTicket del recibo, deja idTicket en 0.
- Si la fecha se puede inferir, usa el formato YYYY-MM-DD. Si no, deja la fecha como 0000-00-00.

Texto del recibo:
${textoExtraido}`;
};

const analizarTextoRecibo = async (textoExtraido) => {
  if (!textoExtraido || typeof textoExtraido !== 'string') {
    throw new Error('textoExtraido debe ser un string con el texto OCR del recibo.');
  }

  const prompt = buildReciboPrompt(textoExtraido);
  
  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    return parseJsonResponse(rawText);
  } catch (error) {
    console.error('Error generando contenido con Gemini:', error);
    throw error;
  }
};

module.exports = {
  analizarTextoRecibo,
};
