/**
 * Lector mínimo de hojas Excel 97-2003 (.xls, BIFF8 dentro de un contenedor OLE/CFB).
 *
 * El Ministerio (Boletín estadístico de Transportes / MIVAU) publica las series
 * de valor tasado y transacciones solo en .xls. No queremos una dependencia
 * para eso (la de npm está sin mantener y con avisos de seguridad), y solo
 * hacen falta los valores de las celdas: textos y números, sin formatos.
 *
 * Soporta: SST (+ CONTINUE), LABELSST, LABEL, NUMBER, RK, MULRK y FORMULA con
 * resultado numérico o de texto. Las celdas de error o booleanas quedan a null.
 */

export type Celda = string | number | null;
export interface HojaXls {
  nombre: string;
  filas: Celda[][];
}

const FIN_CADENA = 0xfffffffe;
const LIBRE = 0xffffffff;

/** Extrae el flujo "Workbook" del contenedor OLE. */
export function flujoWorkbook(buf: Uint8Array): Uint8Array {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const firma = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (!firma.every((b, i) => buf[i] === b)) throw new Error("No es un .xls (falta la firma OLE)");

  const tamSector = 1 << dv.getUint16(0x1e, true);
  const primerDir = dv.getUint32(0x30, true);
  const corteMini = dv.getUint32(0x38, true);
  let difatSig = dv.getUint32(0x44, true);
  const nDifat = dv.getUint32(0x48, true);
  const offset = (s: number) => (s + 1) * tamSector;

  // Sectores de la FAT: 109 en la cabecera + cadena DIFAT
  const sectoresFat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const s = dv.getUint32(0x4c + i * 4, true);
    if (s !== LIBRE) sectoresFat.push(s);
  }
  const porSector = tamSector / 4;
  for (let n = 0; n < nDifat && difatSig !== FIN_CADENA && difatSig !== LIBRE; n++) {
    const base = offset(difatSig);
    for (let i = 0; i < porSector - 1; i++) {
      const s = dv.getUint32(base + i * 4, true);
      if (s !== LIBRE) sectoresFat.push(s);
    }
    difatSig = dv.getUint32(base + (porSector - 1) * 4, true);
  }
  const fat = new Uint32Array(sectoresFat.length * porSector);
  sectoresFat.forEach((s, k) => {
    const base = offset(s);
    for (let i = 0; i < porSector; i++) fat[k * porSector + i] = dv.getUint32(base + i * 4, true);
  });

  const cadena = (inicio: number): number[] => {
    const out: number[] = [];
    for (let s = inicio; s !== FIN_CADENA && s < fat.length; s = fat[s]) {
      out.push(s);
      if (out.length > fat.length) throw new Error("Cadena FAT circular");
    }
    return out;
  };
  const leer = (inicio: number, tam: number) => {
    const out = new Uint8Array(cadena(inicio).length * tamSector);
    cadena(inicio).forEach((s, i) => out.set(buf.subarray(offset(s), offset(s) + tamSector), i * tamSector));
    return out.subarray(0, tam);
  };

  const dir = leer(primerDir, cadena(primerDir).length * tamSector);
  const ddv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  for (let e = 0; e + 128 <= dir.length; e += 128) {
    const largo = ddv.getUint16(e + 64, true);
    if (largo < 2) continue;
    let nombre = "";
    for (let i = 0; i < largo / 2 - 1; i++) nombre += String.fromCharCode(ddv.getUint16(e + i * 2, true));
    if (ddv.getUint8(e + 66) !== 2 || (nombre !== "Workbook" && nombre !== "Book")) continue;
    const inicio = ddv.getUint32(e + 116, true);
    const tam = ddv.getUint32(e + 120, true);
    if (tam < corteMini) throw new Error("Libro demasiado pequeño (mini-stream no soportado)");
    return leer(inicio, tam);
  }
  throw new Error("El .xls no tiene flujo Workbook");
}

interface Registro { tipo: number; datos: Uint8Array; pos: number }

function registros(wb: Uint8Array): Registro[] {
  const out: Registro[] = [];
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  for (let p = 0; p + 4 <= wb.length; ) {
    const tipo = dv.getUint16(p, true);
    const largo = dv.getUint16(p + 2, true);
    out.push({ tipo, datos: wb.subarray(p + 4, p + 4 + largo), pos: p });
    p += 4 + largo;
  }
  return out;
}

/** Lector que cruza los límites entre el SST y sus CONTINUE. */
class LectorSegmentos {
  private seg = 0;
  private pos = 0;
  constructor(private readonly segs: Uint8Array[]) {}
  private ajustar() {
    while (this.seg < this.segs.length && this.pos >= this.segs[this.seg].length) { this.seg++; this.pos = 0; }
  }
  u8(): number { this.ajustar(); return this.segs[this.seg][this.pos++]; }
  u16(): number { return this.u8() | (this.u8() << 8); }
  u32(): number { return (this.u16() | (this.u16() << 16)) >>> 0; }
  saltar(n: number) { for (let i = 0; i < n; i++) this.u8(); }
  /** cch caracteres; si cruzan a un CONTINUE, este empieza con un byte de opciones. */
  caracteres(cch: number, alto: boolean): string {
    let s = "";
    let altoActual = alto;
    for (let i = 0; i < cch; i++) {
      if (this.pos >= this.segs[this.seg].length) {
        this.seg++; this.pos = 0;
        altoActual = (this.segs[this.seg][this.pos++] & 1) === 1;
      }
      s += String.fromCharCode(altoActual ? this.u16() : this.u8());
    }
    return s;
  }
  agotado(): boolean { this.ajustar(); return this.seg >= this.segs.length; }
}

function leerSst(segs: Uint8Array[]): string[] {
  const r = new LectorSegmentos(segs);
  r.u32();
  const unicos = r.u32();
  const out: string[] = [];
  for (let i = 0; i < unicos && !r.agotado(); i++) {
    const cch = r.u16();
    const op = r.u8();
    const runs = op & 0x8 ? r.u16() : 0;
    const ext = op & 0x4 ? r.u32() : 0;
    out.push(r.caracteres(cch, (op & 1) === 1));
    r.saltar(runs * 4 + ext);
  }
  return out;
}

/** XLUnicodeString de un solo registro (LABEL, STRING, BOUNDSHEET con cch de 8 bits). */
function cadenaSimple(d: Uint8Array, p: number, cch8 = false): string {
  const cch = cch8 ? d[p] : d[p] | (d[p + 1] << 8);
  const q = p + (cch8 ? 1 : 2);
  const alto = (d[q] & 1) === 1;
  let s = "";
  for (let i = 0; i < cch; i++) {
    s += String.fromCharCode(alto ? d[q + 1 + i * 2] | (d[q + 2 + i * 2] << 8) : d[q + 1 + i]);
  }
  return s;
}

export function rk(v: number): number {
  let n: number;
  if (v & 2) {
    n = v >> 2;
  } else {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setUint32(4, v & 0xfffffffc, true);
    dv.setUint32(0, 0, true);
    n = dv.getFloat64(0, true);
  }
  return v & 1 ? n / 100 : n;
}

export function leerXls(buf: Uint8Array): HojaXls[] {
  const wb = flujoWorkbook(buf);
  const recs = registros(wb);
  const hojasDecl: { nombre: string; pos: number }[] = [];
  let sst: string[] = [];

  for (let i = 0; i < recs.length; i++) {
    const r = recs[i];
    if (r.tipo === 0x0085) {
      const dv = new DataView(r.datos.buffer, r.datos.byteOffset, r.datos.byteLength);
      if (r.datos[5] === 0) hojasDecl.push({ pos: dv.getUint32(0, true), nombre: cadenaSimple(r.datos, 6, true) });
    } else if (r.tipo === 0x00fc) {
      const segs = [r.datos];
      while (recs[i + 1]?.tipo === 0x003c) segs.push(recs[++i].datos);
      sst = leerSst(segs);
    } else if (r.tipo === 0x000a) {
      break; // fin del globals
    }
  }

  const porPos = new Map(recs.map((r, i) => [r.pos, i]));
  return hojasDecl.map(({ nombre, pos }) => {
    const filas: Celda[][] = [];
    const poner = (f: number, c: number, v: Celda) => {
      (filas[f] ??= [])[c] = v;
    };
    let pendiente: [number, number] | null = null;
    for (let i = (porPos.get(pos) ?? recs.length) + 1; i < recs.length; i++) {
      const { tipo, datos: d } = recs[i];
      if (tipo === 0x000a) break;
      if (tipo === 0x0207) {
        if (pendiente) { poner(pendiente[0], pendiente[1], cadenaSimple(d, 0)); pendiente = null; }
        continue;
      }
      if (d.length < 6) continue;
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
      const f = dv.getUint16(0, true);
      const c = dv.getUint16(2, true);
      switch (tipo) {
        case 0x00fd: poner(f, c, sst[dv.getUint32(6, true)] ?? null); break;
        case 0x0203: poner(f, c, dv.getFloat64(6, true)); break;
        case 0x027e: poner(f, c, rk(dv.getUint32(6, true))); break;
        case 0x0204: poner(f, c, cadenaSimple(d, 6)); break;
        case 0x00bd: {
          const ultima = dv.getUint16(d.length - 2, true);
          for (let k = 0; c + k <= ultima; k++) poner(f, c + k, rk(dv.getUint32(6 + k * 6, true)));
          break;
        }
        case 0x0006: {
          if (dv.getUint16(12, true) === 0xffff) {
            if (d[6] === 0) pendiente = [f, c];
            else poner(f, c, null);
          } else {
            poner(f, c, dv.getFloat64(6, true));
          }
          break;
        }
      }
    }
    for (let k = 0; k < filas.length; k++) filas[k] ??= [];
    return { nombre, filas };
  });
}
