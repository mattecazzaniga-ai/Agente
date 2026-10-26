// Genera le icone PNG della PWA dalle stesse forme di icons/icon.svg, senza dipendenze esterne.
//   node tools/make-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const PRIMARIO = [0x2f, 0x4b, 0x7c];
const ACCENTO = [0xe8, 0xa8, 0x7c];
const CHIARO = [0xfa, 0xf8, 0xf5];

/** Colore del punto (x, y) nello spazio 512×512 dell'icona; null = trasparente. */
function colore(x, y, { maschera }) {
  const dentro = (cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  const segmento = (x1, y1, x2, y2, w) => {
    const dx = x2 - x1, dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
    return (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2 <= (w / 2) ** 2;
  };
  if (!maschera) {
    const r = 112; // angoli arrotondati
    const qx = Math.max(r - x, 0, x - (512 - r)), qy = Math.max(r - y, 0, y - (512 - r));
    if (qx * qx + qy * qy > r * r) return null;
  }
  if (dentro(256, 150, 54) || dentro(150, 350, 46) || dentro(362, 350, 46)) return ACCENTO;
  if (segmento(256, 204, 256, 278, 22) || segmento(150, 278, 362, 278, 22) || segmento(150, 278, 150, 304, 22) || segmento(362, 278, 362, 304, 22)) return CHIARO;
  return PRIMARIO;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function blocco(tipo, dati) {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lunghezza, corpo, crc]);
}

function png(lato, opzioni = {}) {
  const S = 4; // supercampionamento per bordi morbidi
  const scala = opzioni.maschera ? 512 / (lato * 0.8) : 512 / lato; // l'icona maskable ha margine di sicurezza
  const offset = opzioni.maschera ? lato * 0.1 : 0;
  const righe = [];
  for (let y = 0; y < lato; y++) {
    const riga = Buffer.alloc(1 + lato * 4);
    for (let x = 0; x < lato; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const px = (x + (sx + 0.5) / S - offset) * scala, py = (y + (sy + 0.5) / S - offset) * scala;
          const fuori = px < 0 || py < 0 || px > 512 || py > 512;
          const c = fuori ? (opzioni.maschera ? PRIMARIO : null) : colore(px, py, opzioni);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 255; }
        }
      const n = S * S, coperti = a / 255 || 1;
      riga.set([r / coperti, g / coperti, b / coperti, a / n].map(Math.round), 1 + x * 4);
    }
    righe.push(riga);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lato, 0);
  ihdr.writeUInt32BE(lato, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), blocco("IHDR", ihdr), blocco("IDAT", deflateSync(Buffer.concat(righe))), blocco("IEND", Buffer.alloc(0))]);
}

writeFileSync("icons/icon-180.png", png(180, { maschera: true }));
writeFileSync("icons/icon-192.png", png(192));
writeFileSync("icons/icon-512.png", png(512));
writeFileSync("icons/icon-maskable-512.png", png(512, { maschera: true }));
console.log("Icone generate in icons/");
