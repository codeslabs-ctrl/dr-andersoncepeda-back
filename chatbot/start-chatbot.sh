#!/usr/bin/env bash
# Levantar el chatbot (Deno) - DrAnderson Cepeda
# Requisitos: Deno instalado (https://deno.land/)
# Uso: desde backend/   -> ./chatbot/start-chatbot.sh
#      desde chatbot/   -> ./start-chatbot.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v deno &>/dev/null; then
  echo "Deno no está instalado. Instálalo desde https://deno.land/"
  exit 1
fi

if [ ! -f .env ]; then
  echo "No existe .env en la carpeta chatbot. Copia .env.example a .env y configura PORT, BACKEND_URL y AI_PROVIDER."
fi

echo "Iniciando chatbot en: $SCRIPT_DIR"
echo "Puerto y BACKEND_URL se leen de .env (ej. PORT=4999, BACKEND_URL=http://localhost:3006/api/v1)"
echo ""

deno run --allow-net --allow-env --allow-read server.ts
