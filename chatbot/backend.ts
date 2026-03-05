import { BACKEND_URL } from "./env.ts";

const BASE = BACKEND_URL;

/** Obtiene el usuario actual (rol, medico_id) usando el endpoint existente del backend. */
export async function getCurrentUser(
  token: string
): Promise<{ success: boolean; data?: { rol?: string; medico_id?: number }; error?: { message: string } }> {
  const res = await fetch(`${BASE}/auth/debug-user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false, error: { message: json?.error?.message || res.statusText } };
  const data = json?.data ?? {};
  return { success: true, data: { rol: data.role, medico_id: data.medico_id } };
}

export async function createPatient(
  token: string,
  data: {
    nombres: string;
    apellidos: string;
    cedula?: string;
    edad: number;
    sexo: string;
    email: string;
    telefono: string;
    remitido_por?: string;
    activo?: boolean;
  }
): Promise<{ success: boolean; data?: { id: number }; error?: { message: string } }> {
  const res = await fetch(`${BASE}/patients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...data, activo: data.activo ?? true }),
  });
  const json = await res.json();
  if (!res.ok) return { success: false, error: { message: json?.error?.message || res.statusText } };
  return { success: true, data: json?.data };
}

export async function createConsulta(
  token: string,
  data: {
    paciente_id: number;
    medico_id: number;
    motivo_consulta: string;
    fecha_pautada: string;
    hora_pautada: string;
    especialidad_id?: number;
  }
): Promise<{ success: boolean; data?: { id: number }; error?: { message: string }; status?: number }> {
  const url = `${BASE}/consultas`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  let json: { success?: boolean; data?: unknown; error?: { message?: string } } = {};
  try {
    json = await res.json();
  } catch {
    return { success: false, status: res.status, error: { message: `Respuesta inválida del servidor (${res.status})` } };
  }
  const msg = json?.error?.message || res.statusText;
  if (!res.ok) {
    return { success: false, status: res.status, error: { message: msg || `Error ${res.status}` } };
  }
  if (json.success === false) {
    return { success: false, status: res.status, error: { message: msg || "El servidor indicó que falló la creación" } };
  }
  return { success: true, data: json?.data as { id: number } };
}

export async function getPatients(token: string): Promise<{ success: boolean; data?: { id: number; nombres: string; apellidos: string }[] }> {
  const res = await fetch(`${BASE}/patients?limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false };
  const raw = json?.data;
  const list = Array.isArray(raw) ? raw : raw?.data;
  return { success: true, data: list ?? [] };
}

export async function getPatientById(
  token: string,
  id: number
): Promise<{ success: boolean; data?: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/patients/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false };
  return { success: true, data: json?.data ?? null };
}

export async function getConsultasHoy(token: string): Promise<{ success: boolean; data?: Record<string, unknown>[] }> {
  const res = await fetch(`${BASE}/consultas/hoy`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false };
  const list = json?.data ?? [];
  return { success: true, data: Array.isArray(list) ? list : [] };
}

/** Consultas del día del médico logueado (filtra por token). */
export async function getConsultasDelDia(token: string): Promise<{ success: boolean; data?: Record<string, unknown>[] }> {
  const res = await fetch(`${BASE}/consultas/del-dia`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false };
  const list = json?.data ?? [];
  return { success: true, data: Array.isArray(list) ? list : [] };
}

/** Consultas en un rango de fechas (el backend filtra por médico si el usuario es médico). */
export async function getConsultasRango(
  token: string,
  fecha_desde: string,
  fecha_hasta: string
): Promise<{ success: boolean; data?: Record<string, unknown>[] }> {
  const url = `${BASE}/consultas?fecha_desde=${encodeURIComponent(fecha_desde)}&fecha_hasta=${encodeURIComponent(fecha_hasta)}&limit=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) return { success: false };
  const list = json?.data ?? [];
  return { success: true, data: Array.isArray(list) ? list : [] };
}

export async function getConsultasByPaciente(
  token: string,
  pacienteId: number
): Promise<{ success: boolean; data?: Record<string, unknown>[] }> {
  const res = await fetch(`${BASE}/consultas/by-paciente/${pacienteId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false };
  const list = json?.data ?? [];
  return { success: true, data: Array.isArray(list) ? list : [] };
}

export async function getMedicos(token: string): Promise<{ success: boolean; data?: { id: number; nombres: string; apellidos: string }[] }> {
  const res = await fetch(`${BASE}/medicos`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) return { success: false };
  const list = json?.data ?? [];
  return { success: true, data: Array.isArray(list) ? list : [] };
}

export async function createInforme(
  token: string,
  data: {
    titulo: string;
    tipo_informe: string;
    contenido: string;
    paciente_id: number;
    medico_id: number;
    fecha_emision?: string;
    observaciones?: string;
  }
): Promise<{ success: boolean; data?: { id: number }; error?: { message: string } }> {
  const body = {
    ...data,
    fecha_emision: data.fecha_emision ?? new Date().toISOString().slice(0, 10),
  };
  const res = await fetch(`${BASE}/informes-medicos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) return { success: false, error: { message: json?.error?.message || res.statusText } };
  return { success: true, data: json?.data ?? json };
}
