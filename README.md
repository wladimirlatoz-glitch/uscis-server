# Servidor USCIS - AgenteMax

Servidor para consultar estados de casos de asilo en USCIS.

## Endpoints

- `GET /` — Health check
- `GET /status/:numeroRecibo` — Consulta un caso
- `POST /status/batch` — Consulta múltiples casos

## Deploy en Render
1. Sube este repositorio a GitHub
2. En Render: New Web Service → conecta el repo
3. Build Command: `npm install`
4. Start Command: `node server.js`
