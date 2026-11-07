// Genera le icone dell'app (PNG) senza dipendenze: fondo blu notte, pallina lime con la cucitura scura.
// Uso: node scripts/icone.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const crcTab = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (b) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTab[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const blocco = (tipo, dati) => {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(dati.length);
  const td = Buffer.concat([Buffer.from(tipo), dati]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([l, td, c]);
};

function icona(lato, { maschera = false } = {}) {
  const raw = Buffer.alloc((lato * 4 + 1) * lato);
  const cx = lato / 2;
  const r = lato * (maschera ? 0.3 : 0.36);
  const mare = [11, 16, 24]; // blu notte
  const sole = [212, 245, 60]; // lime
  const bianco = [11, 16, 24]; // cucitura scura
  for (let y = 0; y < lato; y++) {
    raw[y * (lato * 4 + 1)] = 0;
    for (let x = 0; x < lato; x++) {
      let col = mare;
      // campioni multipli per bordi morbidi
      let dentro = 0;
      let cucitura = 0;
      for (let sy = 0; sy < 3; sy++)
        for (let sx = 0; sx < 3; sx++) {
          const px = x + (sx + 0.5) / 3 - cx;
          const py = y + (sy + 0.5) / 3 - cx;
          const d = Math.hypot(px, py);
          if (d < r) {
            dentro++;
            // due archi (cuciture della palla)
            const d1 = Math.abs(Math.hypot(px - r * 1.25, py) - r * 0.9);
            const d2 = Math.abs(Math.hypot(px + r * 1.25, py) - r * 0.9);
            if (Math.min(d1, d2) < lato * 0.018) cucitura++;
          }
        }
      const fd = dentro / 9;
      const fc = cucitura / 9;
      const pall = sole.map((v, i) => v * (1 - fc / Math.max(fd, 1e-9)) + bianco[i] * (fc / Math.max(fd, 1e-9)));
      col = mare.map((v, i) => Math.round(v * (1 - fd) + (fd ? pall[i] : 0) * fd));
      const o = y * (lato * 4 + 1) + 1 + x * 4;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lato, 0);
  ihdr.writeUInt32BE(lato, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), blocco("IHDR", ihdr), blocco("IDAT", deflateSync(raw, { level: 9 })), blocco("IEND", Buffer.alloc(0))]);
}

writeFileSync("public/icone/icona-192.png", icona(192));
writeFileSync("public/icone/icona-512.png", icona(512));
writeFileSync("public/icone/icona-180.png", icona(180));
writeFileSync("public/icone/maschera-512.png", icona(512, { maschera: true }));
console.log("icone create");
