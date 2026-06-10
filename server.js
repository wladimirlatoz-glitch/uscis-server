const express = require("express");
const cors = require("cors");
const axios = require("axios");
const cheerio = require("cheerio");
 
const app = express();
app.use(cors());
app.use(express.json());
 
const PORT = process.env.PORT || 3001;
 
async function consultarUscis(numeroRecibo) {
  try {
    // Primero hacemos GET para obtener las cookies de sesión
    const session = await axios.get("https://egov.uscis.gov/casestatus/landing.do", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 20000,
    });
 
    const cookies = session.headers["set-cookie"] || [];
    const cookieStr = cookies.map(c => c.split(";")[0]).join("; ");
 
    // Luego POST con el número de recibo
    const response = await axios.post(
      "https://egov.uscis.gov/casestatus/mycasestatus.do",
      new URLSearchParams({ appReceiptNum: numeroRecibo, caseStatusSearchBtn: "CHECK+STATUS" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://egov.uscis.gov/casestatus/landing.do",
          "Cookie": cookieStr,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 20000,
      }
    );
 
    const $ = cheerio.load(response.data);
 
    // Intentar varios selectores posibles
    let titulo = $(".rows.text-center h1").first().text().trim()
               || $(".appointment-sec h1").first().text().trim()
               || $("h1").first().text().trim();
 
    let detalle = $(".rows.text-center p").first().text().trim()
                || $(".appointment-sec p").first().text().trim()
                || $("p").first().text().trim();
 
    if (!titulo || titulo.length < 3) {
      return { estado: "No disponible", detalle: "USCIS no devolvió información", ok: false };
    }
 
    return { estado: titulo, detalle: detalle.slice(0, 400), ok: true };
 
  } catch (err) {
    const status = err.response ? err.response.status : "timeout";
    return { estado: "Error de consulta (" + status + ")", detalle: err.message, ok: false };
  }
}
 
// Consultar un solo caso
app.get("/status/:numeroRecibo", async (req, res) => {
  const { numeroRecibo } = req.params;
  if (!numeroRecibo || numeroRecibo.length < 10) {
    return res.status(400).json({ error: "Número de recibo inválido" });
  }
  const resultado = await consultarUscis(numeroRecibo);
  res.json({ numeroRecibo, ...resultado, timestamp: new Date().toISOString() });
});
 
// Consultar múltiples casos
app.post("/status/batch", async (req, res) => {
  const { casos } = req.body;
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
    await new Promise(r => setTimeout(r, 1200));
  }
 
  res.json({ resultados, total: resultados.length, fecha: new Date().toISOString() });
});
 
// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", mensaje: "Servidor USCIS AgenteMax activo", version: "2.0.0", timestamp: new Date().toISOString() });
});
 
app.listen(PORT, () => {
  console.log("Servidor USCIS corriendo en puerto " + PORT);
});
