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

/** Opciones para chat con Tool Use: el orquestador ejecuta herramientas y devuelve resultados al modelo. */
export interface ChatOptions {
  executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}

const CHAT_TOOLS = [
  { type: "function" as const, function: { name: "buscar_paciente", description: "Busca un paciente por nombre o cédula en el sistema", parameters: { type: "object", properties: { query: { type: "string", description: "Nombre completo o número de cédula del paciente" } }, required: ["query"] } } },
  { type: "function" as const, function: { name: "nuevo_paciente", description: "Ingresar los datos de un nuevo paciente en el sistema", parameters: { type: "object", properties: { nombres: { type: "string" }, apellidos: { type: "string" }, edad: { type: "number" }, sexo: { type: "string" }, email: { type: "string" }, telefono: { type: "string" }, cedula: { type: "string" } }, required: ["nombres", "apellidos", "edad", "sexo", "email", "telefono"] } } },
  { type: "function" as const, function: { name: "actualizar_paciente", description: "Actualiza los datos personales o médicos de un paciente", parameters: { type: "object", properties: { paciente_id: { type: "number" }, datos: { type: "object", description: "Campos a fusionar con el paciente (objeto JSON flexible; p.ej. email, telefono, notas).", properties: {} } }, required: ["paciente_id", "datos"] } } },
  { type: "function" as const, function: { name: "agendar_consulta", description: "Agenda una cita médica. IMPORTANTE: Acepta fechas exactas o relativas (mañana, el lunes, próximo viernes). TIPO DE CONSULTA: Si el paciente ya tiene consultas agendadas (usa buscar_consultas tipo 'paciente' antes), solo se permite 'seguimiento' o 'control'. Si el paciente no tiene consultas previas, solo se permite 'primera_vez'. No uses primera_vez para pacientes con consultas ya agendadas.", parameters: { type: "object", properties: { paciente_id: { type: "number" }, paciente_nombre: { type: "string" }, fecha: { type: "string", description: "La expresión de tiempo usada por el usuario (ej: 'mañana', '2026-03-15', 'este viernes'). No pidas aclaraciones al usuario si ya mencionó un tiempo." }, hora: { type: "string" }, motivo: { type: "string" }, tipo_consulta: { type: "string", enum: ["primera_vez", "seguimiento", "control"], description: "primera_vez SOLO si el paciente no tiene consultas agendadas; si ya tiene consultas, usar seguimiento o control." } }, required: ["fecha", "hora", "motivo", "tipo_consulta"] } } },
  { type: "function" as const, function: { name: "listar_clinicas", description: "Lista las clínicas de atención disponibles (pie de récipe, datos de clínica). Usar antes de generar récipe si hay varias y el usuario debe elegir 1 o 2 para el pie del PDF.", parameters: { type: "object", properties: { omitir: { type: "string", description: "No enviar; llamar sin argumentos o con objeto vacío." } } } } },
  { type: "function" as const, function: { name: "buscar_consultas", description: "Lista las consultas: 'hoy' = del día; 'proximos_dias' = próximos 2 días; 'paciente' = de un paciente (indica paciente_nombre o paciente_id). Puedes usar solo el nombre del paciente o la cédula, no hace falta el ID.", parameters: { type: "object", properties: { tipo: { type: "string", enum: ["hoy", "proximos_dias", "paciente"], description: "hoy, proximos_dias o paciente" }, paciente_id: { type: "number", description: "ID del paciente (opcional si envías paciente_nombre)" }, paciente_nombre: { type: "string", description: "Nombre completo o cédula del paciente para buscar sus consultas. Usar cuando el usuario diga el nombre (ej. Veronica Calderon) sin pedir el ID." } }, required: ["tipo"] } } },
  { type: "function" as const, function: { name: "listar_pacientes_activos", description: "Lista pacientes activos (flag activo) con al menos una consulta en consultas_pacientes con el médico de la sesión. Última consulta = fecha_pautada más reciente contigo (desempate: hora_pautada, fecha_creacion, id); el estado es estado_consulta de esa fila. Si el resultado incluye respuesta_chat, muéstrala al usuario sin cambios (lista con viñetas, fechas DD/MM/YYYY y hora 12 h AM/PM). No uses tablas markdown: la app no las renderiza bien.", parameters: { type: "object", properties: { limite: { type: "number", description: "Máximo de filas (1–500, por defecto 200)." } }, required: [] } } },
  { type: "function" as const, function: { name: "obtener_historial", description: "Obtiene el historial médico (controles) del paciente. Cada ítem en data incluye: fecha_consulta, motivo_consulta, diagnostico, plan, conclusiones, examenes_paraclinicos (exámenes de laboratorio/imagen u otros paraclínicos; puede venir con HTML), etc. Úsalo completo para el informe narrativo: no omitas examenes_paraclinicos si vienen con texto. Puedes indicar paciente_id o paciente_nombre. Si el resultado incluye historial_incompleto: true y mensaje_recordatorio, y el usuario quiere generar un informe: muestra solo el texto de mensaje_recordatorio y espera la respuesta. No pidas tipo ni contenido en el mismo mensaje. Si el usuario elige ir a la aplicación a completar la historia, usa open_section (path historia-medica). Si elige generar el informe con su contenido: entonces pide tipo y contenido, y añade esta línea: «El informe se generará con el texto que me indiques; no incluirá datos de la consulta reciente porque no están completos en la historia.»", parameters: { type: "object", properties: { paciente_id: { type: "number" }, paciente_nombre: { type: "string", description: "Nombre completo o cédula del paciente" }, limite: { type: "number", description: "Máximo de controles a devolver (por defecto 10, máx. 50)" } }, required: [] } } },
  { type: "function" as const, function: { name: "get_patient_data", description: "Obtiene los datos completos de un paciente (nombre, cédula, edad, sexo, email, teléfono). Necesario para redactar la introducción del informe narrativo.", parameters: { type: "object", properties: { paciente_id: { type: "number" }, paciente_nombre: { type: "string" } }, required: [] } } },
  { type: "function" as const, function: { name: "generar_informe", description: "Crea un informe médico. El contenido DEBE estar en prosa narrativa: párrafos con oraciones completas. Para generarlo debes haber llamado antes a get_patient_data y obtener_historial; con esos datos redactas el contenido, integrando en la narrativa los exámenes paraclínicos (campo examenes_paraclinicos de cada control del historial) cuando existan y no estén vacíos—en prosa o párrafo dedicado, sin copiar solo listas crudas si puedes resumir clínicamente. NO incluyas el nombre del médico en el contenido. Si obtuviste un historial con historial_incompleto y mensaje_recordatorio: muestra solo ese recordatorio y espera. Si el usuario elige completar la historia, usa open_section. Si elige generar con su contenido, pide tipo y contenido y añade: «El informe se generará con el texto que me indiques; no incluirá datos de la consulta reciente porque no están completos en la historia.»", parameters: { type: "object", properties: { paciente_id: { type: "number" }, paciente_nombre: { type: "string", description: "Si no tienes paciente_id, indica el nombre del paciente" }, tipo_informe: { type: "string", description: "Ej: consulta, examen, general, control" }, contenido: { type: "string", description: "Texto del informe en prosa narrativa (HTML o texto), construido a partir de datos del paciente y del historial" }, observaciones: { type: "string" } }, required: ["tipo_informe", "contenido"] } } },
  { type: "function" as const, function: { name: "crear_recipe_medico", description: "Dos PDF (medicamentos + indicaciones). Médico; consulta completada/finalizada. **Paciente:** SIEMPRE \`paciente_nombre\` (completo) o \`paciente_id\`. No afirmes que no existe sin invocar \`buscar_paciente\` o esta tool; si \`get_patient_data\` ya mostró a alguien, reutiliza ese nombre. **Pie clínicas (máx. 2):** varias → listar_clinicas + pies_clinica_ids; una → automático.", parameters: { type: "object", properties: { paciente_id: { type: "number" }, paciente_nombre: { type: "string" }, nombres_medicamentos: { type: "string", description: "Un medicamento por línea, solo nombre (p. ej. Acetaminofén\\nLoratadina)" }, texto_indicaciones: { type: "string" }, texto_recipe: { type: "string", description: "Opcional; dosis en texto, no va al PDF de nombres" }, fecha_emision: { type: "string" }, pies_clinica_ids: { type: "array", items: { type: "number" }, description: "1 o 2 IDs de clínica para el pie del PDF. Omitir solo si hay una clínica en el sistema o el usuario ya eligió." } }, required: ["nombres_medicamentos", "texto_indicaciones"] } } },
  { type: "function" as const, function: { name: "open_section", description: "Abre en la aplicación la sección de antecedentes o historia médica del paciente. DEBES invocar esta herramienta en el mismo turno si el usuario pide ir a la app, ver/cargar historia, antecedentes o controles; solo entonces el cliente mostrará el botón «Abrir en la aplicación». PROHIBIDO decir que hay un botón debajo si no invocas open_section en esa respuesta.", parameters: { type: "object", properties: { paciente_id: { type: "number" }, paciente_nombre: { type: "string", description: "Nombre del paciente (ej. Sandra Romero) para antecedentes o historia" }, path: { type: "string", enum: ["antecedentes", "historia-medica", "historia-medica/nuevo"], description: "antecedentes = antecedentes médicos; historia-medica = controles; historia-medica/nuevo = nuevo control" } }, required: ["path"] } } },
];

const TOOL_USE_SYSTEM_PROMPT = `### ROL
Eres el asistente virtual del consultorio del Dr. Anderson Cepeda (gestión clínica en la aplicación). Profesional, directo y eficiente. No digas que trabajas para otra marca o producto distinto (p. ej. "DemoMed").

### REGLAS DE ORO SOBRE FECHAS (CRÍTICO)
- **NO VALIDAR FECHAS:** Si el usuario dice "mañana", "el lunes", "el 20 de marzo" o "este viernes", acéptalo DE INMEDIATO.
- **PARÁMETRO FECHA:** Pasa el texto tal cual al campo \`fecha\` de la herramienta. El backend se encarga de la conversión.
- **PROHIBIDO:** No pidas formatos exactos (DD/MM/AAAA) ni confirmaciones de calendario si el usuario ya dio una referencia temporal.

### FLUJO DE AGENDAMIENTO
1. **Captura:** Necesitas Fecha (ej: "mañana"), Hora, Motivo y Tipo de consulta.
2. **Tipo de consulta (OBLIGATORIO):** Antes de agendar, verifica con \`buscar_consultas\` (tipo "paciente") si el paciente tiene consultas agendadas. Si **ya tiene consultas** → solo puedes usar \`seguimiento\` o \`control\` (nunca \`primera_vez\`). Si **no tiene consultas** → solo \`primera_vez\`.
3. **Confirmación:** Antes de ejecutar \`agendar_consulta\`, presenta un resumen con el tipo correcto según lo anterior.
4. **Ejecución:** Solo tras el "sí", invoca \`agendar_consulta\` con el tipo adecuado.

### REGLAS DE HERRAMIENTAS
- **Datos de paciente:** Si preguntan por info de alguien, llama a \`get_patient_data\` antes de hablar.
- **Listado pacientes activos:** \`listar_pacientes_activos\`. Si devuelve \`respuesta_chat\`, repítela tal cual (lista, AM/PM). No tablas markdown.
- **Secciones:** Si piden historia médica, antecedentes, «llévame», ir a la app o completar la historia: llama a \`open_section\` en ese mismo turno. No digas que aparece el botón «Abrir en la aplicación» si no llamas a \`open_section\`.
- **Informes:** Prosa narrativa con \`get_patient_data\` y \`obtener_historial\`. Si el JSON del historial trae \`examenes_paraclinicos\` en algún control, inclúyelo en el relato (no lo ignores).
- **Récipe PDF:** siempre **paciente_nombre** o id si el usuario nombró al paciente; no digas que no está sin usar la herramienta. **Pie clínicas (máx. 2):** varias → \`listar_clinicas\` + **pies_clinica_ids**; una → ok. nombres_medicamentos + texto_indicaciones. Éxito → **PDF medicamentos** e **indicaciones**.

### CONTEXTO
Hoy es sábado 14 de marzo de 2026.`;

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function getToolUseSystemPrompt(): string {
  const d = new Date();
  const dia = DIAS_SEMANA[d.getDay()];
  const fecha = `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  const hoyLinea = `Hoy es ${dia} ${fecha}.`;
  return TOOL_USE_SYSTEM_PROMPT.replace(/Hoy es [^.]+\.[\s]*$/, hoyLinea);
}

const SYSTEM_PROMPT = `Eres el asistente virtual del consultorio del Dr. Anderson Cepeda (gestión clínica en la aplicación). Ayudas al médico a:

1) Crear un nuevo paciente (datos personales: nombres, apellidos, cédula, edad, sexo, email, teléfono). Después de crear puedes preguntar si desea añadir antecedentes y/o agendar una consulta.
2) Agendar una consulta (paciente, fecha, hora, motivo, tipo_consulta). El usuario del chat es el médico logueado: NO preguntes "¿con qué médico?". Solo pide día, hora y motivo si faltan. TIPO DE CONSULTA: Antes de agendar, llama a get_consultations con tipo "paciente" para ese paciente. Si el paciente ya tiene consultas agendadas → tipo_consulta debe ser solo "seguimiento" o "control" (nunca "primera_vez"). Si no tiene consultas previas → tipo_consulta debe ser solo "primera_vez". IMPORTANTE para la fecha: si el usuario dice "mañana", "pasado mañana", "próximo viernes", etc., NO inventes la fecha. Pregunta: "¿Puede indicar la fecha exacta? Por ejemplo: 5 de marzo o 05/03." Solo cuando responda con un día concreto usa esa fecha en formato YYYY-MM-DD (año actual). Si falta el motivo, pregúntalo por separado. Responde en una o dos frases cortas.
3) Generar un informe médico (paciente, médico, tipo y contenido breve).
4) Gestionar la historia médica del paciente: abrir la lista de controles, crear un nuevo control o editar un control existente. Cuando el médico pida "nuevo control", "añadir control", "historia de [paciente]" o "ver/editar controles", usa open_section para llevarle a la pantalla correspondiente.
5) Gestionar antecedentes del paciente: cuando pida "añadir antecedentes", "editar antecedentes" o "antecedentes de [paciente]", usa open_section para llevarle a la sección de antecedentes del paciente. Los antecedentes se gestionan mejor en la pantalla dedicada que en el chat.
6) Mostrar datos de un paciente: cuando pidan "datos de [nombre]", "información del paciente [nombre]", "dame los datos de [nombre]" o "¿quién es [nombre]?", DEBES escribir en esa misma respuesta la acción get_patient_data. No respondas solo con "estoy buscando" o "un momento": escribe siempre la línea __ACTION__get_patient_data__{"paciente_nombre":"Nombre"}__ para que el sistema devuelva los datos al usuario.
7) Mostrar consultas agendadas: cuando pidan "consultas de hoy" o "agenda del día", usa get_consultations con tipo "hoy" (muestra solo las del médico logueado). Cuando pidan "mis consultas para los próximos dos días" o "consultas para los próximos 2 días", usa get_consultations con tipo "proximos_dias". Cuando pidan "consultas de [paciente]" o "citas de [paciente]" (para LISTAR), usa get_consultations con tipo "paciente". IMPORTANTE: "agendar (una) consulta para [paciente]" es para CREAR una cita nueva (schedule_consultation), NO para listar.
8) Listado de pacientes activos del médico: cuando pidan "mis pacientes activos", "listado de pacientes", "pacientes con última consulta", etc., escribe __ACTION__list_active_patients__{"limite":200}__. La respuesta trae la última consulta contigo por fecha_pautada más reciente y el estado_consulta de esa fila; muéstralo en tabla markdown.
9) Récipe PDF: pie con **1 o 2 clínicas** (\`pies_clinica_ids\`). Si hay varias, lista IDs y pregunta antes. Ej.: __ACTION__create_medical_recipe__{"paciente_nombre":"...","nombres_medicamentos":"Acetaminofén\\nLoratadina","texto_indicaciones":"...","pies_clinica_ids":[2,5]}__. Consulta completada/finalizada contigo.

Reglas:
- Responde siempre en español, de forma breve y clara, en nombre del consultorio del Dr. Anderson Cepeda (no menciones "DemoMed" ni otras marcas).
- Para get_patient_data y get_consultations: SIEMPRE incluye la línea __ACTION__ en la misma respuesta cuando tengas el nombre o el tipo. El usuario verá el resultado solo si escribes la acción; si solo dices "estoy buscando", no pasará nada.
- Extrae datos del mensaje del usuario (nombres, cédula, paciente, etc.) cuando los mencione.
- Si falta algún dato obligatorio, pide solo ese dato (uno o dos a la vez).
- Para antecedentes e historia médica/controles: NO pidas los datos en el chat. Identifica al paciente (nombre o ID) y ejecuta open_section para que el médico use el formulario completo en la aplicación.
- Cuando tengas TODOS los datos necesarios para ejecutar una acción, escribe en una sola línea exactamente:
  __ACTION__nombre_accion__{"campo":"valor",...}__
  Sustituye por JSON válido (comillas dobles, sin comas finales). En la línea siguiente escribe una frase breve (el sistema sustituirá el resultado por los datos reales).

Acciones y sus datos (ejemplos de JSON válido):
- create_patient: {"nombres":"Juan","apellidos":"Pérez","cedula":"","edad":30,"sexo":"Masculino","email":"j@e.com","telefono":"","remitido_por":""}
- schedule_consultation: NO incluyas médico. Necesitas fecha_pautada (YYYY-MM-DD), hora_pautada, motivo_consulta y tipo_consulta. tipo_consulta: "primera_vez" SOLO si el paciente no tiene consultas (usa get_consultations tipo "paciente" antes); si ya tiene consultas usa "seguimiento" o "control". Si el usuario dijo "mañana" o "próximo viernes", pide la fecha exacta (ej. 05/03). Ejemplo cuando ya tengan fecha concreta y sea primera vez: {"paciente_nombre":"Laura Branigan","motivo_consulta":"Revisión","fecha_pautada":"${new Date().getFullYear()}-03-06","hora_pautada":"10:00","tipo_consulta":"primera_vez"}. Si falta fecha concreta, hora, motivo o no sabes si es primera_vez/seguimiento/control, pide ese dato y NO escribas la acción.
- generate_report: {"paciente_id":1,"medico_id":1,"titulo":"Informe","tipo_informe":"general","contenido":"...","observaciones":""}
- open_section: para antecedentes de un paciente por nombre: {"paciente_nombre":"Laura Branigan","path":"antecedentes"}
  Para historia médica: {"paciente_nombre":"Laura Branigan","path":"historia-medica"}
  Para nuevo control: {"paciente_nombre":"Nombre","path":"historia-medica/nuevo"}
  path puede ser: "antecedentes", "historia-medica", "historia-medica/nuevo" o "historia-medica/123" (editar control 123). Siempre incluye paciente_nombre si no tienes paciente_id numérico.
- get_patient_data: {"paciente_nombre":"Nombre Completo"} o {"paciente_id":123}. Para mostrar en el chat los datos del paciente (nombre, cédula, email, teléfono, etc.).
- get_consultations: para hoy (solo las del médico): {"tipo":"hoy"}. Para próximos 2 días: {"tipo":"proximos_dias"}. Para consultas de un paciente: {"tipo":"paciente","paciente_nombre":"Nombre"} o {"tipo":"paciente","paciente_id":123}.
- list_active_patients: {"limite":200} opcional. Pacientes activos con al menos una consulta contigo; última = fecha_pautada más reciente; columna de estado = estado_consulta de esa consulta.
- create_medical_recipe: paciente, nombres_medicamentos (una línea por nombre), texto_indicaciones, y **pies_clinica_ids** [id] o [id1,id2] si hay varias clínicas en el sistema.

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

/** Log cuerpo de error del proveedor (diagnóstico en PM2 / consola). No exponer al cliente. */
async function logAiHttpError(tag: string, res: Response, extra?: string): Promise<void> {
  let body = "";
  try {
    body = (await res.text()).slice(0, 4000);
  } catch {
    body = "(no se pudo leer el cuerpo)";
  }
  const hint = extra ? ` ${extra}` : "";
  if (typeof console !== "undefined" && console.error) {
    console.error(`[chatbot-ai] ${tag} HTTP ${res.status}${hint}: ${body}`);
  }
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
    await logAiHttpError("openai-chat", res);
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
    await logAiHttpError("gemini-chat", res);
    return { reply: "No pude conectar con el asistente. Inténtalo de nuevo en un momento." };
  }
  const data = await res.json();
  const textPart = data?.candidates?.[0]?.content?.parts?.[0];
  const content = (textPart?.text ?? "").trim();
  return parseContent(content);
}

/** Loop Tool Use para OpenAI. */
async function chatWithToolsOpenAI(messages: ChatMessage[], executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>): Promise<{ reply: string; navigateTo?: string }> {
  type OpenAIMsg = { role: string; content: string | null; tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }> };
  let apiMessages: OpenAIMsg[] = [{ role: "system", content: getToolUseSystemPrompt() }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
  const maxRounds = 8;
  for (let round = 0; round < maxRounds; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model: OPENAI_CHAT_MODEL, messages: apiMessages, temperature: 0.4, max_tokens: 800, tools: CHAT_TOOLS }),
    });
    if (!res.ok) {
      await logAiHttpError("openai-tools", res, `round=${round}`);
      return { reply: "No pude conectar con el asistente. Inténtalo de nuevo." };
    }
    const data = await res.json();
    const choice = data?.choices?.[0];
    const finishReason = choice?.finish_reason ?? "";
    const msg = choice?.message ?? {};
    const toolCalls = msg.tool_calls;
    if (finishReason !== "tool_calls" || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      return { reply: ((msg.content ?? "").trim()) || "No pude generar una respuesta." };
    }
    apiMessages.push({ role: "assistant", content: msg.content ?? null, tool_calls: toolCalls });
    for (const tc of toolCalls) {
      const name = tc.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try { if (tc.function?.arguments) args = JSON.parse(tc.function.arguments); } catch { args = {}; }
      const result = await executeTool(name, args);
      const nav = result && typeof result === "object" && "navigateTo" in result ? String((result as { navigateTo?: string }).navigateTo ?? "") : "";
      const toolMessage = result && typeof result === "object" && "message" in result ? String((result as { message?: string }).message ?? "").trim() : "";
      const respuestaChat = result && typeof result === "object" ? String((result as { respuesta_chat?: string }).respuesta_chat ?? "").trim() : "";
      if (nav) return { reply: toolMessage || (msg.content ?? "").trim() || "Listo.", navigateTo: nav };
      if (respuestaChat) return { reply: respuestaChat };
      apiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) } as unknown as OpenAIMsg);
    }
  }
  return { reply: "Se alcanzó el límite de pasos. Inténtalo de nuevo." };
}

/** Loop Tool Use para Anthropic Claude. `null` = error HTTP al proveedor (el caller puede hacer fallback sin tools). */
async function chatWithToolsClaude(messages: ChatMessage[], executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>): Promise<{ reply: string; navigateTo?: string } | null> {
  const toolsClaude = CHAT_TOOLS.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }));
  type ClaudeMsg = { role: "user" | "assistant"; content: string | Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> };
  let apiMessages: ClaudeMsg[] = messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const maxRounds = 8;
  const maxTokensTools = 4096;
  for (let round = 0; round < maxRounds; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: ANTHROPIC_CHAT_MODEL,
        max_tokens: maxTokensTools,
        system: getToolUseSystemPrompt(),
        messages: apiMessages,
        tools: toolsClaude,
        tool_choice: { type: "auto" },
      }),
    });
    if (!res.ok) {
      await logAiHttpError("claude-tools", res, `round=${round} model=${ANTHROPIC_CHAT_MODEL}`);
      return null;
    }
    const data = await res.json();
    const content = data?.content ?? [];
    const toolUseBlocks = content.filter((p: { type: string }) => p.type === "tool_use");
    const textBlock = content.find((p: { type: string }) => p.type === "text");
    const text = (textBlock?.text ?? "").trim();
    if (!Array.isArray(toolUseBlocks) || toolUseBlocks.length === 0) return { reply: text || "No pude generar una respuesta." };
    apiMessages.push({ role: "assistant", content: content });
    const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
    for (const block of toolUseBlocks) {
      const name = block.name ?? "";
      const result = await executeTool(name, (block.input ?? {}) as Record<string, unknown>);
      const nav = result && typeof result === "object" && "navigateTo" in result ? String((result as { navigateTo?: string }).navigateTo ?? "") : "";
      const toolMessage = result && typeof result === "object" && "message" in result ? String((result as { message?: string }).message ?? "").trim() : "";
      const respuestaChat = result && typeof result === "object" ? String((result as { respuesta_chat?: string }).respuesta_chat ?? "").trim() : "";
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      if (nav) return { reply: toolMessage || text || "Listo.", navigateTo: nav };
      if (respuestaChat) return { reply: respuestaChat };
    }
    apiMessages.push({ role: "user", content: toolResults });
  }
  return { reply: "Se alcanzó el límite de pasos. Inténtalo de nuevo." };
}

/** Loop Tool Use para Google Gemini. */
async function chatWithToolsGemini(messages: ChatMessage[], executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>): Promise<{ reply: string; navigateTo?: string }> {
  const decls = CHAT_TOOLS.map((t) => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters }));
  const history = messages.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
  const maxRounds = 8;
  for (let round = 0; round < maxRounds; round++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [...history], systemInstruction: { parts: [{ text: getToolUseSystemPrompt() }] }, tools: [{ functionDeclarations: decls }], generationConfig: { temperature: 0.4, maxOutputTokens: 800 } }),
    });
    if (!res.ok) {
      await logAiHttpError("gemini-tools", res, `round=${round}`);
      return { reply: "No pude conectar con el asistente. Inténtalo de nuevo." };
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const fnCall = parts.find((p: { functionCall?: unknown }) => p.functionCall);
    const textPart = parts.find((p: { text?: string }) => p.text);
    const text = (textPart?.text ?? "").trim();
    if (!fnCall?.functionCall) return { reply: text || "No pude generar una respuesta." };
    const name = fnCall.functionCall.name ?? "";
    const args = (fnCall.functionCall.args ?? {}) as Record<string, unknown>;
    const result = await executeTool(name, args);
    const nav = result && typeof result === "object" && "navigateTo" in result ? String((result as { navigateTo?: string }).navigateTo ?? "") : "";
    const toolMessage = result && typeof result === "object" && "message" in result ? String((result as { message?: string }).message ?? "").trim() : "";
    const respuestaChat = result && typeof result === "object" ? String((result as { respuesta_chat?: string }).respuesta_chat ?? "").trim() : "";
    history.push({ role: "model", parts: [{ functionCall: { name: fnCall.functionCall.name, args: fnCall.functionCall.args } }] });
    history.push({ role: "user", parts: [{ functionResponse: { name: name, response: result } }] });
    if (nav) return { reply: toolMessage || text || "Listo.", navigateTo: nav };
    if (respuestaChat) return { reply: respuestaChat };
  }
  return { reply: "Se alcanzó el límite de pasos. Inténtalo de nuevo." };
}

export async function chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<{ reply: string; action?: string; actionData?: string; navigateTo?: string }> {
  const executeTool = options?.executeTool;
  if (executeTool) {
    if (AI_PROVIDER === "claude") {
      if (!ANTHROPIC_API_KEY) return { reply: "El asistente no está configurado. Contacta al administrador." };
      const toolReply = await chatWithToolsClaude(messages, executeTool);
      if (toolReply !== null) return toolReply;
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[chatbot-ai] Claude tool-use rechazado por la API; usando chat sin tools (legacy). Revisa logs [chatbot-ai] claude-tools arriba.");
      }
      return chatClaude(messages);
    }
    if (AI_PROVIDER === "gemini") {
      if (!GEMINI_API_KEY) return { reply: "El asistente no está configurado. Contacta al administrador." };
      return chatWithToolsGemini(messages, executeTool);
    }
    if (!OPENAI_API_KEY) return { reply: "El asistente no está configurado. Contacta al administrador." };
    return chatWithToolsOpenAI(messages, executeTool);
  }
  if (AI_PROVIDER === "claude") {
    if (!ANTHROPIC_API_KEY) return { reply: "El asistente no está configurado. Contacta al administrador." };
    return chatClaude(messages);
  }
  if (AI_PROVIDER === "gemini") {
    if (!GEMINI_API_KEY) return { reply: "El asistente no está configurado. Contacta al administrador." };
    return chatGemini(messages);
  }
  if (!OPENAI_API_KEY) return { reply: "El asistente no está configurado. Contacta al administrador." };
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
