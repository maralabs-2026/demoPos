import { canAccess, type AppRoute, type Rol } from "@/modules/auth";
import type { Frecuencia } from "./periodo";

// Rutina de control: qué revisar cada día, semana y mes para que stock y caja cierren bien.
// Son datos, como las guías: la pantalla solo los muestra y deja tildarlos.

export type { Frecuencia };

export interface PasoControl {
  id: string;
  titulo: string;
  detalle: string;
  roles: readonly Rol[];
  // Pantalla donde se hace. Si el rol no entra, el paso no se le muestra.
  ruta?: AppRoute;
}

export interface BloqueControl {
  id: string;
  frecuencia: Frecuencia;
  titulo: string;
  quien: string;
  cuando: string;
  pasos: readonly PasoControl[];
}

const TODOS: readonly Rol[] = ["dueno", "encargado", "cajero"];
const GESTION: readonly Rol[] = ["dueno", "encargado"];
const DUENO: readonly Rol[] = ["dueno"];

const BLOQUES: readonly BloqueControl[] = [
  {
    id: "abrir",
    frecuencia: "dia",
    titulo: "Al abrir",
    quien: "Cajero",
    cuando: "Antes de la primera venta",
    pasos: [
      {
        id: "fondo",
        titulo: "Contá el efectivo del cajón y abrí la caja con ese monto",
        detalle:
          "En Vender aparece «Abrí tu caja». El fondo inicial es lo que contaste, no lo que debería haber.",
        roles: TODOS,
        ruta: "/vender",
      },
      {
        id: "internet",
        titulo: "Fijate que haya internet",
        detalle:
          "Si se vendió sin conexión, abrí Vender con internet para que esas ventas se envíen.",
        roles: TODOS,
        ruta: "/vender",
      },
    ],
  },
  {
    id: "durante",
    frecuencia: "dia",
    titulo: "Durante el día",
    quien: "Todos",
    cuando: "En el momento, nunca después",
    pasos: [
      {
        id: "ventas",
        titulo: "Toda venta pasa por el sistema, también las transferencias",
        detalle:
          "Una venta que no se carga deja el stock mal y aparece como sobrante en el cierre. Después no se puede cargar con su fecha.",
        roles: TODOS,
        ruta: "/vender",
      },
      {
        id: "retiros",
        titulo:
          "Cada vez que sale o entra plata del cajón, cargalo con su motivo",
        detalle:
          "En Caja, como retiro o ingreso: pago a un proveedor, cambio, plata que se lleva el dueño. Todo.",
        roles: TODOS,
        ruta: "/caja",
      },
      {
        id: "gastos",
        titulo: "Un gasto pagado con el cajón se carga como gasto",
        detalle:
          "En Caja › Gastos, eligiendo la caja de la que salió: el sistema hace el retiro solo.",
        roles: GESTION,
        ruta: "/caja/gastos",
      },
      {
        id: "mercaderia",
        titulo: "La mercadería se carga cuando llega",
        detalle:
          "Con factura del proveedor, en Stock › Compras. Sin factura, como ingreso en Stock.",
        roles: GESTION,
        ruta: "/stock",
      },
    ],
  },
  {
    id: "cerrar",
    frecuencia: "dia",
    titulo: "Al cerrar el turno",
    quien: "Cajero",
    cuando: "Antes de irse",
    pasos: [
      {
        id: "contar",
        titulo: "Contá cada medio de pago y cerrá la caja",
        detalle:
          "Efectivo: lo que hay en el cajón. Transferencias y tarjetas: lo que muestra la cuenta o el posnet del turno.",
        roles: TODOS,
        ruta: "/caja",
      },
      {
        id: "nota",
        titulo: "Si sabés por qué algo no va a cuadrar, escribilo en la nota",
        detalle:
          "El cierre no se corrige después. La nota es lo que queda para entender la diferencia.",
        roles: TODOS,
        ruta: "/caja",
      },
    ],
  },
  {
    id: "control",
    frecuencia: "dia",
    titulo: "Control del día",
    quien: "Dueño o encargado",
    cuando: "Diez minutos, después del último cierre",
    pasos: [
      {
        id: "abiertas",
        titulo: "Que no quede ninguna caja abierta",
        detalle:
          "En Caja, «Otras cajas abiertas». Si alguien se olvidó, «Operá esta caja» y cerrala vos.",
        roles: GESTION,
        ruta: "/caja",
      },
      {
        id: "cierre-dia",
        titulo: "Revisá el cierre del día: ¿cuadra cada medio?",
        detalle:
          "En Caja › Cierre del día. Si sobra o falta, averiguá hoy por qué: mañana nadie se acuerda.",
        roles: GESTION,
        ruta: "/caja/dia",
      },
      {
        id: "transferencias",
        titulo: "Marcá las transferencias contra la cuenta del banco",
        detalle:
          "En Caja › Transferencias, con la app del banco abierta. Si hay una en el banco que no está en el sistema, es una venta que no se cargó.",
        roles: GESTION,
        ruta: "/caja/transferencias",
      },
      {
        id: "pendientes",
        titulo: "Resolvé los pendientes de Inicio",
        detalle:
          "Ventas sin internet o con QR confirmado a mano, cajas con diferencia, gastos por vencer y productos por vencer.",
        roles: GESTION,
        ruta: "/inicio",
      },
      {
        id: "negativo",
        titulo: "Corregí el stock negativo",
        detalle:
          "Si una venta dejó un producto en negativo, falta un ingreso de mercadería. Cargalo en Stock con su motivo.",
        roles: GESTION,
        ruta: "/stock",
      },
      {
        id: "reposicion",
        titulo: "Mirá la reposición para el pedido",
        detalle:
          "En Stock › Reposición. Copiala o compartila por WhatsApp con el proveedor.",
        roles: GESTION,
        ruta: "/stock/reposicion",
      },
    ],
  },
  {
    id: "semana",
    frecuencia: "semana",
    titulo: "Una vez por semana",
    quien: "Dueño o encargado",
    cuando: "Un día tranquilo, por ejemplo el lunes",
    pasos: [
      {
        id: "auditoria",
        titulo: "Auditá una categoría",
        detalle:
          "En Stock › Auditoría: contás sin ver el stock del sistema y al aplicar se generan los ajustes. Una categoría distinta cada semana, empezando por cigarrillos y bebidas.",
        roles: GESTION,
        ruta: "/stock/auditoria",
      },
      {
        id: "comparar",
        titulo: "Compará la semana con la anterior",
        detalle: "En Reportes, el total, por medio de pago y por cajero.",
        roles: GESTION,
        ruta: "/reportes",
      },
      {
        id: "diferencias",
        titulo: "Repasá las diferencias de caja de la semana",
        detalle:
          "En Caja › Historial de cajas. Una diferencia que se repite con el mismo cajero o el mismo medio es un hábito a corregir.",
        roles: GESTION,
        ruta: "/caja/historial",
      },
      {
        id: "gastos-semana",
        titulo: "Pagá o cargá los gastos de la semana",
        detalle: "En Caja › Gastos: los que están por pagar y los que vencen.",
        roles: GESTION,
        ruta: "/caja/gastos",
      },
    ],
  },
  {
    id: "mes",
    frecuencia: "mes",
    titulo: "Una vez por mes",
    quien: "Dueño",
    cuando: "Los primeros días del mes",
    pasos: [
      {
        id: "ganancia",
        titulo: "Mirá la ganancia neta del mes",
        detalle:
          "En Reportes. Si un producto no tiene costo cargado, la ganancia sale incompleta.",
        roles: GESTION,
        ruta: "/reportes",
      },
      {
        id: "analisis",
        titulo: "Revisá qué conviene vender",
        detalle:
          "En Reportes › Análisis: lo que más deja y lo que no se mueve.",
        roles: GESTION,
        ruta: "/reportes/analisis",
      },
      {
        id: "precios",
        titulo: "Actualizá los precios",
        detalle:
          "En Productos › Precios, por categoría o porcentaje, cuando cambien las listas de los proveedores.",
        roles: GESTION,
        ruta: "/productos/precios",
      },
      {
        id: "fijos",
        titulo: "Cargá los gastos fijos del mes",
        detalle: "Alquiler, luz, internet. El sistema no los repite solo.",
        roles: GESTION,
        ruta: "/caja/gastos",
      },
      {
        id: "respaldo",
        titulo: "Exportá ventas y stock a Excel",
        detalle:
          "En Reportes, «Exportá las ventas» y «Exportá el stock». Guardalo como respaldo propio.",
        roles: DUENO,
        ruta: "/reportes",
      },
    ],
  },
];

// Se filtra en el servidor, igual que las guías: los pasos de otro rol no llegan al navegador.
export function getControlParaRol(rol: Rol): readonly BloqueControl[] {
  return BLOQUES.map((bloque) => ({
    ...bloque,
    pasos: bloque.pasos.filter(
      (paso) =>
        paso.roles.includes(rol) && (!paso.ruta || canAccess(rol, paso.ruta)),
    ),
  })).filter((bloque) => bloque.pasos.length > 0);
}
