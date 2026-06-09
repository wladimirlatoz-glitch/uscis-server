const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ── Consultar un caso en USCIS ──────────────────────────────────
async function consultarUscis(numeroRecibo) {
  try {
    const url = "https://egov.uscis.gov/casestatus/mycasestatus.do";
    const response = await axios.post(
      url,
      new URLSearchParams({ appReceiptNum: numeroRecibo, caseStatusSearchBtn: "CHECK+STATUS" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://egov.uscis.gov/casestatus/landing.do",
        },
        timeout: 15000,
      }
    );

    const $ = cheerio.load(response.data);
    const titulo = $("h1").first().text().trim() ||
                   $(".appointment-sec h1").first().text().trim() ||
                   $(".rows.text-center h1").first().text().trim();
    const detalle = $(".rows.text-center p").first().text().trim() ||
                    $(".appointment-sec p").first().text().trim();

    if (!titulo || titulo.toLowerCase().includes("case not found")) {
      return { estado: "Case Not Found", detalle: "No se encontró el caso", ok: false };
    }

    return { estado: titulo, detalle: detalle.slice(0, 300), ok: true };

  } catch (err) {
    return { estado: "Error de consulta", detalle: err.message, ok: false };
  }
}

// ── Endpoint: consultar un solo caso ───────────────────────────
app.get("/status/:numeroRecibo", async (req, res) => {
  const { numeroRecibo } = req.params;
  if (!numeroRecibo || numeroRecibo.length < 10) {
    return res.status(400).json({ error: "Número de recibo inválido" });
  }
  const resultado = await consultarUscis(numeroRecibo);
  res.json({ numeroRecibo, ...resultado, timestamp: new Date().toISOString() });
});

// ── Endpoint: consultar múltiples casos ────────────────────────
app.post("/status/batch", async (req, res) => {
  const { casos } = req.body; // [{ id, nombre, numero }]
  if (!Array.isArray(casos) || casos.length === 0) {
    return res.status(400).json({ error: "Se requiere un array de casos" });
  }

  const resultados = [];
  for (const caso of casos) {
    const resultado = await consultarUscis(caso.numero);
    resultados.push({
      id: caso.id,
      nombre: caso.nombre,
      numero: caso.numero,
      ...resultado,
      timestamp: new Date().toISOString(),
    });
    // Pausa entre consultas para no sobrecargar USCIS
    await new Promise(r => setTimeout(r, 800));
  }

  res.json({ resultados, total: resultados.length, fecha: new Date().toISOString() });
});

// ── Health check ───────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", mensaje: "Servidor USCIS activo", version: "1.0.0" });
});

app.listen(PORT, () => {
  console.log(`Servidor USCIS corriendo en puerto ${PORT}`);
});
