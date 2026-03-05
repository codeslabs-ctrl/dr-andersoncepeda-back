import { loadEnv, PORT, BACKEND_URL } from "./env.ts";
import { chat, speechToText } from "./ai.ts";
import { getMessages, append } from "./state.ts";
import * as backend from "./backend.ts";

loadEnv();

// Al arrancar, mostrar a qué API se conecta el chat (para verificar que sea la misma que la app)
if (typeof console !== "undefined" && console.info) {
  console.info("[chatbot] BACKEND_URL =", BACKEND_URL, "(las consultas se crean en este API)");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** Formatea hora "HH:MM" o "HH:MM:SS" a "h:MM AM/PM". */
function formatHoraAmPm(h: unknown): string {
  const s = String(h ?? "").trim();
  const part = s.length >= 5 ? s.slice(0, 5) : s;
  const [hh, mm] = part.split(":");
  const hour = parseInt(hh ?? "0", 10);
  const min = (mm ?? "00").slice(0, 2);
  if (isNaN(hour) || hour < 0 || hour > 23) return s;
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h12}:${min} ${ampm}`;
}

function getToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

async function resolvePatientId(token: string, name: string): Promise<number | null> {
  const { data } = await backend.getPatients(token);
  if (!data?.length) return null;
  const lower = name.toLowerCase();
  const found = data.find(
    (p) =>
      `${(p as any).nombres ?? ""} ${(p as any).apellidos ?? ""}`.toLowerCase().includes(lower) ||
      lower.includes(`${(p as any).nombres ?? ""}`.toLowerCase())
  );
  return found ? (found as any).id : null;
}

async function resolveMedicoId(token: string, name: string): Promise<number | null> {
  const { data } = await backend.getMedicos(token);
  if (!data?.length) return null;
  const lower = name.toLowerCase();
  const found = data.find(
    (m) =>
      `${(m as any).nombres ?? ""} ${(m as any).apellidos ?? ""}`.toLowerCase().includes(lower) ||
      lower.includes(`${(m as any).nombres ?? ""}`.toLowerCase())
  );
  return found ? (found as any).id : null;
}

async function handleMessage(req: Request): Promise<Response> {
  let body: { message?: string; conversationId?: string; audioBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Body JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = getToken(req);
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: "Falta Authorization: Bearer token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  let message = (body.message ?? "").trim();
  if (body.audioBase64) {
    const text = await speechToText(body.audioBase64, body.mimeType ?? "audio/webm");
    message = text || message;
    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "No se pudo transcribir el audio. Intente de nuevo o escriba el mensaje." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
  if (!message) {
    return new Response(JSON.stringify({ success: false, error: "message o audio requerido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const conversationId = body.conversationId ?? crypto.randomUUID();
  const stateMessages = getMessages(conversationId);
  append(conversationId, "user", message);
  const messages = [...stateMessages, { role: "user" as const, content: message }];
  const { reply, action, actionData } = await chat(messages);
  let finalReply = reply;
  let parsedData: Record<string, unknown> | null = null;
  let resolvedAction = action;

  if (action && actionData) {
    try {
      parsedData = JSON.parse(actionData) as Record<string, unknown>;
    } catch {
      parsedData = null;
    }
  }

  // Fallback: si el usuario pide datos de un paciente o consultas y la IA no devolvió acción, intentar ejecutarla igual
  // No aplicar fallback de "consultas" cuando el usuario pide AGENDAR (sino interpretaría "consulta para X" como listar consultas de X)
  const esPedidoDeAgendar = /agendar|programar|sacar\s+(una\s+)?cita|pedir\s+(una\s+)?cita|agenda\s+una/i.test(message);
  if (!resolvedAction || !parsedData) {
    const msg = message.toLowerCase().trim();
    const datosDeMatch = message.match(/(?:me\s+das\s+|dame\s+)?(?:los\s+)?(?:datos|información|informacion)\s+(?:del?\s+|de la\s+)?(?:pacientes?\s+)?([A-Za-zÁáÉéÍíÓóÚúÑñ\s]{2,}?)(?:\?|\.|$)/i);
    const consultasProximosDiasMatch = /consultas?\s+(?:que\s+tengo\s+)?(?:con\s+mis\s+pacientes?\s+)?(?:para\s+)?(?:los\s+)?pr[oó]ximos\s+(?:dos\s+)?d[ií]as?|(?:los\s+)?pr[oó]ximos\s+(?:dos\s+)?d[ií]as?\s+.*consultas?|mis\s+citas?\s+(?:para\s+)?(?:los\s+)?pr[oó]ximos/i.test(message);
    const consultasHoyMatch = /consultas?\s+(?:de\s+)?hoy|agenda\s+(?:del?\s+)?d[ií]a|d[ií]a\s+de\s+hoy|citas?\s+de\s+hoy/i.test(message);
    const consultasDeMatch = message.match(/(?:consultas?|citas?)\s+(?:del?\s+|de la\s+)?(?:paciente\s+)?([A-Za-zÁáÉéÍíÓóÚúÑñ\s]{2,}?)(?:\?|\.|$)/i);

    if (datosDeMatch && datosDeMatch[1]) {
      resolvedAction = "get_patient_data";
      parsedData = { paciente_nombre: datosDeMatch[1].trim() };
    } else if (!esPedidoDeAgendar && consultasProximosDiasMatch) {
      resolvedAction = "get_consultations";
      parsedData = { tipo: "proximos_dias" };
    } else if (!esPedidoDeAgendar && consultasHoyMatch) {
      resolvedAction = "get_consultations";
      parsedData = { tipo: "hoy" };
    } else if (!esPedidoDeAgendar && consultasDeMatch && consultasDeMatch[1]) {
      resolvedAction = "get_consultations";
      parsedData = { tipo: "paciente", paciente_nombre: consultasDeMatch[1].trim() };
    }
  }

  if (resolvedAction && parsedData) {
    try {
      const data = parsedData;
      if (resolvedAction === "create_patient") {
        const r = await backend.createPatient(token, {
          nombres: String(data.nombres ?? ""),
          apellidos: String(data.apellidos ?? ""),
          cedula: String(data.cedula ?? ""),
          edad: Number(data.edad) || 0,
          sexo: String(data.sexo ?? "Femenino").startsWith("M") ? "Masculino" : "Femenino",
          email: String(data.email ?? ""),
          telefono: String(data.telefono ?? ""),
          remitido_por: data.remitido_por ? String(data.remitido_por) : undefined,
        });
        if (r.success) {
          finalReply = `Paciente creado correctamente. ¿Desea añadir antecedentes o agendar una consulta?`;
        } else {
          finalReply = "No se pudo crear el paciente. Revisa los datos e inténtalo de nuevo.";
        }
      } else if (resolvedAction === "schedule_consultation") {
        const fechaStr = String(data.fecha_pautada ?? "").trim();
        const horaStr = String(data.hora_pautada ?? "").trim();
        if (!fechaStr || !horaStr) {
          finalReply = "Indique la fecha exacta y la hora para agendar la consulta, por ejemplo: 5 de marzo a las 09:00 o 05/03 09:00.";
        } else {
          const hoy = new Date();
          const y = hoy.getFullYear(), m = String(hoy.getMonth() + 1).padStart(2, "0"), d = String(hoy.getDate()).padStart(2, "0");
          const hoyStr = `${y}-${m}-${d}`;
          const fechaCorregida = fechaStr.startsWith("2024-") ? fechaStr.replace(/^2024-/, `${y}-`) : fechaStr;
          if (fechaCorregida < hoyStr) {
            finalReply = "La fecha indicada ya pasó. Indique un día y hora futuros para agendar la consulta.";
          } else {
            let paciente_id = Number(data.paciente_id);
            if ((!paciente_id || paciente_id === 0) && data.paciente_nombre) {
              paciente_id = (await resolvePatientId(token, String(data.paciente_nombre))) ?? 0;
            }
            if (!paciente_id) {
              finalReply = "Indique el nombre del paciente para agendar la consulta.";
            } else {
              let medico_id = data.medico_id ? Number(data.medico_id) : 0;
              if ((!medico_id || medico_id === 0) && data.medico_nombre) {
                medico_id = (await resolveMedicoId(token, String(data.medico_nombre))) ?? 0;
              }
              if (!medico_id || medico_id === 0) {
                const userRes = await backend.getCurrentUser(token);
                if (userRes.success && userRes.data?.medico_id) {
                  medico_id = userRes.data.medico_id;
                }
              }
              if (!medico_id || medico_id === 0) {
                finalReply = "No se pudo determinar el médico. Indique el médico o asegúrese de estar logueado como médico.";
              } else {
                const r = await backend.createConsulta(token, {
                  paciente_id,
                  medico_id,
                  motivo_consulta: String(data.motivo_consulta ?? ""),
                  fecha_pautada: fechaCorregida,
                  hora_pautada: horaStr,
                  especialidad_id: data.especialidad_id ? Number(data.especialidad_id) : undefined,
                });
                if (r.success) {
                  const fechaMostrar = fechaCorregida.split("-").reverse().join("/");
                  finalReply = `Consulta agendada correctamente para el ${fechaMostrar} a las ${horaStr}. Puede verla en Gestión de Consultas; haga clic en el botón de abajo para ir.`;
                  append(conversationId, "assistant", finalReply);
                  return new Response(
                    JSON.stringify({
                      success: true,
                      reply: finalReply,
                      conversationId,
                      fromAudio: !!body.audioBase64,
                      navigateTo: "/admin/consultas",
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                  );
                } else {
                  const errMsg = r.error?.message;
                  finalReply = errMsg ? `No se pudo agendar: ${errMsg}` : "No se pudo agendar la consulta. Revisa los datos e inténtalo de nuevo.";
                }
              }
            }
          }
        }
      } else if (resolvedAction === "generate_report") {
        let paciente_id = Number(data.paciente_id);
        let medico_id = Number(data.medico_id);
        if ((!paciente_id || paciente_id === 0) && data.paciente_nombre) {
          paciente_id = (await resolvePatientId(token, String(data.paciente_nombre))) ?? 0;
        }
        if ((!medico_id || medico_id === 0) && data.medico_nombre) {
          medico_id = (await resolveMedicoId(token, String(data.medico_nombre))) ?? 0;
        }
        if (!paciente_id || !medico_id) {
          finalReply = "Faltan paciente o médico para el informe. Indique nombres.";
        } else {
          const r = await backend.createInforme(token, {
            titulo: String(data.titulo ?? "Informe médico"),
            tipo_informe: String(data.tipo_informe ?? "general"),
            contenido: String(data.contenido ?? ""),
            paciente_id,
            medico_id,
            observaciones: data.observaciones ? String(data.observaciones) : undefined,
          });
          if (r.success) {
            finalReply = "Informe médico creado correctamente.";
          } else {
            finalReply = "No se pudo crear el informe. Inténtalo de nuevo.";
          }
        }
      } else if (resolvedAction === "get_patient_data") {
        let paciente_id = Number(data.paciente_id);
        if ((!paciente_id || paciente_id === 0) && data.paciente_nombre) {
          const name = String(data.paciente_nombre ?? "").trim();
          paciente_id = name ? (await resolvePatientId(token, name)) ?? 0 : 0;
        }
        if (!paciente_id || paciente_id === 0) {
          finalReply = "Indica el nombre del paciente para ver sus datos.";
        } else {
          const r = await backend.getPatientById(token, paciente_id);
          if (r.success && r.data) {
            const p = r.data as Record<string, unknown>;
            const nombres = String(p.nombres ?? "");
            const apellidos = String(p.apellidos ?? "");
            const cedula = String(p.cedula ?? "-");
            const email = String(p.email ?? "-");
            const telefono = String(p.telefono ?? "-");
            const edad = p.edad != null ? String(p.edad) : "-";
            const sexo = String(p.sexo ?? "-");
            finalReply = `**Datos del paciente:**\nNombre: ${nombres} ${apellidos}\nCédula: ${cedula}\nEdad: ${edad} | Sexo: ${sexo}\nEmail: ${email}\nTeléfono: ${telefono}`;
          } else {
            finalReply = "No encontré los datos de ese paciente.";
          }
        }
      } else if (resolvedAction === "get_consultations") {
        const tipo = String(data.tipo ?? "").toLowerCase();
        if (tipo === "hoy") {
          const r = await backend.getConsultasDelDia(token);
          if (r.success && r.data && r.data.length > 0) {
            const lines = r.data.slice(0, 20).map((c: Record<string, unknown>) => {
              const hora = formatHoraAmPm(c.hora_pautada);
              const pac = `${c.paciente_nombre ?? ""} ${c.paciente_apellidos ?? ""}`.trim() || "—";
              const motivo = String(c.motivo_consulta ?? "-");
              const estado = String(c.estado_consulta ?? "");
              return `• ${hora} - ${pac} | ${motivo}${estado ? ` (${estado})` : ""}`;
            });
            finalReply = `**Sus consultas de hoy:**\n${lines.join("\n")}`;
          } else {
            finalReply = "No tiene consultas agendadas para hoy.";
          }
        } else if (tipo === "proximos_dias" || tipo === "proximos 2 dias" || tipo === "próximos_días") {
          const hoy = new Date();
          const hasta = new Date(hoy);
          hasta.setDate(hasta.getDate() + 2);
          const fd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
          const fh = `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, "0")}-${String(hasta.getDate()).padStart(2, "0")}`;
          const r = await backend.getConsultasRango(token, fd, fh);
          if (r.success && r.data && r.data.length > 0) {
            const byDate: Record<string, Record<string, unknown>[]> = {};
            for (const c of r.data) {
              const raw = String(c.fecha_pautada ?? "");
              const f = raw.includes("T") ? raw.split("T")[0]! : raw;
              if (!byDate[f]) byDate[f] = [];
              byDate[f].push(c);
            }
            const sortedDates = Object.keys(byDate).sort();
            const blocks = sortedDates.map((f) => {
              const [y, m, d] = f.split("-");
              const day = [d, m, y].join("/");
              const lines = byDate[f].map((c: Record<string, unknown>) => {
                const hora = formatHoraAmPm(c.hora_pautada);
                const pac = `${c.paciente_nombre ?? ""} ${c.paciente_apellidos ?? ""}`.trim() || "—";
                const motivo = String(c.motivo_consulta ?? "-");
                return `• ${hora} - ${pac} | ${motivo}`;
              });
              return `**${day}**\n${lines.join("\n")}`;
            });
            finalReply = `**Sus consultas para los próximos 2 días:**\n\n${blocks.join("\n\n")}`;
          } else {
            finalReply = "No tiene consultas agendadas para los próximos dos días.";
          }
        } else if (tipo === "paciente") {
          let paciente_id = Number(data.paciente_id);
          if ((!paciente_id || paciente_id === 0) && data.paciente_nombre) {
            const name = String(data.paciente_nombre ?? "").trim();
            paciente_id = name ? (await resolvePatientId(token, name)) ?? 0 : 0;
          }
          if (!paciente_id || paciente_id === 0) {
            finalReply = "Indica el nombre del paciente para ver sus consultas.";
          } else {
            const r = await backend.getConsultasByPaciente(token, paciente_id);
            if (r.success && r.data && r.data.length > 0) {
              const fmtFecha = (f: unknown) => { const s = String(f ?? ""); const part = s.includes("T") ? s.split("T")[0] : s; const [y, m, d] = part.split("-"); return [d, m, y].filter(Boolean).join("/") || s; };
              const lines = r.data.slice(0, 15).map((c: Record<string, unknown>) => {
                const fecha = fmtFecha(c.fecha_pautada);
                const hora = formatHoraAmPm(c.hora_pautada);
                const med = `${c.medico_nombre ?? ""} ${c.medico_apellidos ?? ""}`.trim() || "—";
                const motivo = String(c.motivo_consulta ?? "-");
                const estado = String(c.estado_consulta ?? "");
                return `• ${fecha} ${hora} - Dr(a). ${med} | ${motivo}${estado ? ` (${estado})` : ""}`;
              });
              finalReply = `**Consultas del paciente:**\n${lines.join("\n")}`;
            } else {
              finalReply = "No hay consultas registradas para ese paciente.";
            }
          }
        } else {
          finalReply = "Indica si quieres ver las consultas de hoy o las de un paciente.";
        }
      } else if (resolvedAction === "open_section") {
        let paciente_id = Number(data.paciente_id);
        if ((!paciente_id || paciente_id === 0) && (data.paciente_nombre || data.paciente_id === "pendiente")) {
          const name = String(data.paciente_nombre ?? "").trim();
          paciente_id = name ? (await resolvePatientId(token, name)) ?? 0 : 0;
        }
        if (!paciente_id || paciente_id === 0) {
          finalReply = "Indica el nombre del paciente para abrir esa sección.";
        } else {
          const path = String(data.path ?? "").trim();
          const urlPath = path === "antecedentes"
            ? `/patients/${paciente_id}/antecedentes`
            : path === "historia-medica"
            ? `/patients/${paciente_id}/historia-medica`
            : path === "historia-medica/nuevo"
            ? `/patients/${paciente_id}/historia-medica/nuevo`
            : /^historia-medica\/\d+$/.test(path)
            ? `/patients/${paciente_id}/${path}`
            : `/patients/${paciente_id}/${path}`;
          append(conversationId, "assistant", finalReply);
          return new Response(
            JSON.stringify({
              success: true,
              reply: finalReply,
              conversationId,
              fromAudio: !!body.audioBase64,
              navigateTo: urlPath,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch {
      finalReply = "No pude completar la acción. Por favor, inténtalo de nuevo.";
    }
  }
  // Nunca mostrar al usuario la línea cruda __ACTION__ (respuesta truncada o mal formada)
  if (finalReply.includes("__ACTION__")) {
    finalReply = "No pude procesar la solicitud. Por favor, inténtalo de nuevo (por ejemplo: indica día y hora en un solo mensaje).";
  }
  append(conversationId, "assistant", finalReply);
  return new Response(
    JSON.stringify({
      success: true,
      reply: finalReply,
      conversationId,
      fromAudio: !!body.audioBase64,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  if (url.pathname === "/health" && req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, service: "demomed-chatbot" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if ((url.pathname === "/message" || url.pathname === "/api/chat/message") && req.method === "POST") {
    return handleMessage(req);
  }
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

console.log(`🤖 Chatbot DemoMed escuchando en http://0.0.0.0:${PORT}`);
Deno.serve({ port: PORT, hostname: "0.0.0.0" }, handler);
