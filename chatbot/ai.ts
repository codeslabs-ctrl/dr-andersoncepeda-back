import {
  AI_PROVIDER,
  OPENAI_API_KEY,
  OPENAI_CHAT_MODEL,
  ANTHROPIC_API_KEY,
  ANTHROPIC_CHAT_MODEL,
  GEMINI_API_KEY,
  GEMINI_CHAT_MODEL,
} from "./env.ts";

const ACTION_REGEX = /__ACTION__(\w+)__([\s\S]*?)__(?=$|\n)/;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `Eres el asistente de DemoMed, un sistema de gestión clínica. Ayudas al médico a:

1) Crear un nuevo paciente (datos personales: nombres, apellidos, cédula, edad, sexo, email, teléfono). Después de crear puedes preguntar si desea añadir antecedentes y/o agendar una consulta.
2) Agendar una consulta (paciente, fecha, hora, motivo). El usuario del chat es el médico logueado: NO preguntes "¿con qué médico?". Solo pide día, hora y motivo si faltan. IMPORTANTE para la fecha: si el usuario dice "mañana", "pasado mañana", "próximo viernes", "la próxima semana", etc., NO inventes la fecha. Pregunta siempre: "¿Puede indicar la fecha exacta? Por ejemplo: 5 de marzo o 05/03." Solo cuando responda con un día concreto (ej. "5 de marzo", "el 10", "05/03") usa esa fecha en formato YYYY-MM-DD (año actual). Si desde el inicio dan fecha concreta y hora, entonces sí escribe la acción. Si falta el motivo, pregúntalo por separado. Responde en una o dos frases cortas.
3) Generar un informe médico (paciente, médico, tipo y contenido breve).
4) Gestionar la historia médica del paciente: abrir la lista de controles, crear un nuevo control o editar un control existente. Cuando el médico pida "nuevo control", "añadir control", "historia de [paciente]" o "ver/editar controles", usa open_section para llevarle a la pantalla correspondiente.
5) Gestionar antecedentes del paciente: cuando pida "añadir antecedentes", "editar antecedentes" o "antecedentes de [paciente]", usa open_section para llevarle a la sección de antecedentes del paciente. Los antecedentes se gestionan mejor en la pantalla dedicada que en el chat.
6) Mostrar datos de un paciente: cuando pidan "datos de [nombre]", "información del paciente [nombre]", "dame los datos de [nombre]" o "¿quién es [nombre]?", DEBES escribir en esa misma respuesta la acción get_patient_data. No respondas solo con "estoy buscando" o "un momento": escribe siempre la línea __ACTION__get_patient_data__{"paciente_nombre":"Nombre"}__ para que el sistema devuelva los datos al usuario.
7) Mostrar consultas agendadas: cuando pidan "consultas de hoy" o "agenda del día", usa get_consultations con tipo "hoy" (muestra solo las del médico logueado). Cuando pidan "mis consultas para los próximos dos días" o "consultas para los próximos 2 días", usa get_consultations con tipo "proximos_dias". Cuando pidan "consultas de [paciente]" o "citas de [paciente]" (para LISTAR), usa get_consultations con tipo "paciente". IMPORTANTE: "agendar (una) consulta para [paciente]" es para CREAR una cita nueva (schedule_consultation), NO para listar.

Reglas:
- Responde siempre en español, de forma breve y clara.
- Para get_patient_data y get_consultations: SIEMPRE incluye la línea __ACTION__ en la misma respuesta cuando tengas el nombre o el tipo. El usuario verá el resultado solo si escribes la acción; si solo dices "estoy buscando", no pasará nada.
- Extrae datos del mensaje del usuario (nombres, cédula, paciente, etc.) cuando los mencione.
- Si falta algún dato obligatorio, pide solo ese dato (uno o dos a la vez).
- Para antecedentes e historia médica/controles: NO pidas los datos en el chat. Identifica al paciente (nombre o ID) y ejecuta open_section para que el médico use el formulario completo en la aplicación.
- Cuando tengas TODOS los datos necesarios para ejecutar una acción, escribe en una sola línea exactamente:
  __ACTION__nombre_accion__{"campo":"valor",...}__
  Sustituye por JSON válido (comillas dobles, sin comas finales). En la línea siguiente escribe una frase breve (el sistema sustituirá el resultado por los datos reales).

Acciones y sus datos (ejemplos de JSON válido):
- create_patient: {"nombres":"Juan","apellidos":"Pérez","cedula":"","edad":30,"sexo":"Masculino","email":"j@e.com","telefono":"","remitido_por":""}
- schedule_consultation: NO incluyas médico. Solo cuando tengas fecha exacta (día concreto, no "mañana" ni "próximo viernes"), hora y motivo. Si el usuario dijo "mañana" o "próximo viernes", pide "¿Puede indicar la fecha exacta? Por ejemplo: 5 de marzo o 05/03." Ejemplo cuando ya tengan fecha concreta: {"paciente_nombre":"Laura Branigan","motivo_consulta":"Control","fecha_pautada":"${new Date().getFullYear()}-03-06","hora_pautada":"10:00"}. fecha_pautada en YYYY-MM-DD con año actual. Si falta fecha concreta, hora o motivo, pida ese dato y NO escribas la acción.
- generate_report: {"paciente_id":1,"medico_id":1,"titulo":"Informe","tipo_informe":"general","contenido":"...","observaciones":""}
- open_section: para antecedentes de un paciente por nombre: {"paciente_nombre":"Laura Branigan","path":"antecedentes"}
  Para historia médica: {"paciente_nombre":"Laura Branigan","path":"historia-medica"}
  Para nuevo control: {"paciente_nombre":"Nombre","path":"historia-medica/nuevo"}
  path puede ser: "antecedentes", "historia-medica", "historia-medica/nuevo" o "historia-medica/123" (editar control 123). Siempre incluye paciente_nombre si no tienes paciente_id numérico.
- get_patient_data: {"paciente_nombre":"Nombre Completo"} o {"paciente_id":123}. Para mostrar en el chat los datos del paciente (nombre, cédula, email, teléfono, etc.).
- get_consultations: para hoy (solo las del médico): {"tipo":"hoy"}. Para próximos 2 días: {"tipo":"proximos_dias"}. Para consultas de un paciente: {"tipo":"paciente","paciente_nombre":"Nombre"} o {"tipo":"paciente","paciente_id":123}.

No inventes IDs. Escribe siempre JSON válido entre las dos __ (sin texto literal como "JSON_CON_LOS_DATOS").
Solo escribe __ACTION__ cuando tengas los datos. Si falta algo, pide el dato sin escribir __ACTION__.`;

function parseContent(content: string): { reply: string; action?: string; actionData?: string } {
  const match = content.match(ACTION_REGEX);
  let reply = content.trim();
  let action: string | undefined;
  let actionData: string | undefined;
  if (match) {
    action = match[1];
    actionData = match[2].trim();
    reply = content.replace(ACTION_REGEX, "").trim();
  }
  return { reply, action, actionData };
}

/** OpenAI Chat Completions */
async function chatOpenAI(messages: ChatMessage[]): Promise<{ reply: string; action?: string; actionData?: string }> {
  const body = {
    model: OPENAI_CHAT_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.4,
    max_tokens: 800,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { reply: "No pude conectar con el asistente. Inténtalo de nuevo en un momento." };
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  return parseContent(content);
}

/** Anthropic Claude Messages API */
async function chatClaude(messages: ChatMessage[]): Promise<{ reply: string; action?: string; actionData?: string }> {
  const system = messages.find((m) => m.role === "system")?.content ?? SYSTEM_PROMPT;
  const apiMessages = messages.filter((m) => m.role !== "system").map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  const body = {
    model: ANTHROPIC_CHAT_MODEL,
    max_tokens: 800,
    system: system,
    messages: apiMessages,
  };
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { reply: "No pude conectar con el asistente. Inténtalo de nuevo en un momento." };
  }
  const data = await res.json();
  const part = data?.content?.find((p: { type: string }) => p.type === "text");
  const content = (part?.text ?? "").trim();
  return parseContent(content);
}

/** Google Gemini generateContent (Google AI) */
async function chatGemini(messages: ChatMessage[]): Promise<{ reply: string; action?: string; actionData?: string }> {
  const systemPart = messages.find((m) => m.role === "system")?.content ?? SYSTEM_PROMPT;
  const chatMessages = messages.filter((m) => m.role !== "system");
  const contents = chatMessages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));
  const body = {
    systemInstruction: { parts: [{ text: systemPart }] },
    contents: contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 800,
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { reply: "No pude conectar con el asistente. Inténtalo de nuevo en un momento." };
  }
  const data = await res.json();
  const textPart = data?.candidates?.[0]?.content?.parts?.[0];
  const content = (textPart?.text ?? "").trim();
  return parseContent(content);
}

export async function chat(
  messages: ChatMessage[]
): Promise<{ reply: string; action?: string; actionData?: string }> {
  if (AI_PROVIDER === "claude") {
    if (!ANTHROPIC_API_KEY) {
      return { reply: "El asistente no está configurado. Contacta al administrador." };
    }
    return chatClaude(messages);
  }
  if (AI_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) {
      return { reply: "El asistente no está configurado. Contacta al administrador." };
    }
    return chatGemini(messages);
  }
  if (!OPENAI_API_KEY) {
    return { reply: "El asistente no está configurado. Contacta al administrador." };
  }
  return chatOpenAI(messages);
}

/** Transcripción de audio con Gemini (audio understanding). */
async function speechToTextGemini(audioBase64: string, mimeType = "audio/webm"): Promise<string> {
  const body = {
    contents: [
      {
        parts: [
          { text: "Transcribe this audio to text. Use the same language as the speaker. Reply only with the transcription, no other text or commentary." },
          {
            inlineData: {
              mimeType: mimeType || "audio/webm",
              data: audioBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0,
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return "";
  const data = await res.json();
  const textPart = data?.candidates?.[0]?.content?.parts?.[0];
  return (textPart?.text ?? "").trim();
}

/** Convierte audio base64 a texto. Con Gemini usa su audio understanding; con OpenAI/Claude usa Whisper (requiere OPENAI_API_KEY). */
export async function speechToText(audioBase64: string, mimeType = "audio/webm"): Promise<string> {
  if (AI_PROVIDER === "gemini" && GEMINI_API_KEY) {
    return speechToTextGemini(audioBase64, mimeType);
  }
  if (!OPENAI_API_KEY) return "";
  const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([binary], { type: mimeType }), "audio.webm");
  form.append("model", "whisper-1");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.text ?? "").trim();
}
