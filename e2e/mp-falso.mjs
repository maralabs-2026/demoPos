// Simulador de la API de órdenes de Mercado Pago para los tests e2e. POST /__pagar aprueba la última.
import { createServer } from "node:http";

const ordenes = new Map();
let ultima = null;
let numero = 0;

function leer(req) {
  return new Promise((resolve) => {
    let datos = "";
    req.on("data", (c) => (datos += c));
    req.on("end", () => resolve(datos ? JSON.parse(datos) : {}));
  });
}

createServer(async (req, res) => {
  const responder = (codigo, cuerpo) => {
    res.writeHead(codigo, { "Content-Type": "application/json" });
    res.end(JSON.stringify(cuerpo));
  };
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") return responder(200, {});
  if (req.method === "POST" && url.pathname === "/__pagar") {
    ultima.status = "processed";
    ultima.total_paid_amount = ultima.total_amount;
    return responder(200, ultima);
  }
  if (req.method === "POST" && url.pathname === "/v1/orders") {
    const body = await leer(req);
    ultima = {
      id: `ORDE2E${Date.now()}${++numero}`,
      status: "created",
      external_reference: body.external_reference,
      total_amount: body.total_amount,
    };
    ordenes.set(ultima.id, ultima);
    return responder(201, ultima);
  }

  const [, , , id, accion] = url.pathname.split("/");
  const orden = ordenes.get(id);
  if (!orden) return responder(404, {});
  if (req.method === "POST" && accion === "cancel") orden.status = "canceled";
  return responder(200, orden);
}).listen(4010, "127.0.0.1");
