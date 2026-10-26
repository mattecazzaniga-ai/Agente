// Disposizione dell'albero genealogico (FASE 3). Funzione pura: dallo stato calcola nodi e linee
// in coordinate astratte; la schermata Famiglia li disegna in SVG.
//
// Ogni "gruppo" è una persona di sangue con i suoi partner (attuali, ex, altri genitori dei figli).
// I figli del gruppo stanno sotto, uno accanto all'altro; il gruppo si centra sopra i figli.

export const LARGHEZZA = 92;
export const ALTEZZA = 118;

/** Partner da mostrare accanto a p: attuale, ex e altri genitori dei suoi figli (non di sangue con genitori noti). */
function partnerVisibili(state, p, giaPosti) {
  const ids = [p.partner, ...(p.ex ?? []), ...(p.figli ?? []).flatMap((id) => [state.persone[id]?.madre, state.persone[id]?.padre])];
  const out = [];
  for (const id of ids) {
    const q = state.persone[id];
    if (!q || q.id === p.id || giaPosti.has(q.id) || out.includes(q)) continue;
    // chi ha genitori nell'albero ha già il suo posto sotto di loro
    if (q.madre && state.persone[q.madre]?.sangue) continue;
    out.push(q);
  }
  return out;
}

export function layoutAlbero(state) {
  const nodi = [];
  const linee = [];
  const posti = new Set(); // persone già collocate (come membro di un gruppo o come figlio in attesa)
  const pos = new Map(); // id → { x, y }

  // gruppo = [persona, ...partner]; i figli sono quelli di chiunque nel gruppo sia di sangue
  function costruisci(p) {
    posti.add(p.id);
    const membri = [p];
    for (const q of partnerVisibili(state, p, posti)) {
      posti.add(q.id);
      membri.push(q);
    }
    // un partner di sangue (la coppia di partenza) può avere avuto altri partner
    for (const q of membri.slice(1).filter((m) => m.sangue)) {
      for (const r of partnerVisibili(state, q, posti)) {
        posti.add(r.id);
        membri.push(r);
      }
    }
    const figli = [...new Set(membri.filter((m) => m.sangue).flatMap((m) => m.figli ?? []))]
      .map((id) => state.persone[id])
      .filter((f) => f && !posti.has(f.id))
      .sort((a, b) => a.anno_nascita - b.anno_nascita);
    for (const f of figli) posti.add(f.id); // prenotati: non possono comparire come partner altrove
    return { membri, figli: figli.map((f) => costruisci(f)) };
  }

  const larghezza = (g) => Math.max(g.membri.length, g.figli.reduce((s, f) => s + larghezza(f), 0));

  function posiziona(g, x0, livello) {
    const w = larghezza(g);
    let x = x0;
    for (const f of g.figli) {
      posiziona(f, x, livello + 1);
      x += larghezza(f);
    }
    const inizio = x0 + (w - g.membri.length) / 2;
    g.membri.forEach((m, i) => {
      const punto = { x: (inizio + i + 0.5) * LARGHEZZA, y: livello * ALTEZZA + 40 };
      pos.set(m.id, punto);
      nodi.push({ persona: m, ...punto, livello });
    });
    const capo = g.membri[0];
    const pc = pos.get(capo.id);
    for (const m of g.membri.slice(1)) {
      const pm = pos.get(m.id);
      const attuale = capo.partner === m.id || m.partner === capo.id;
      linee.push({ tipo: "coppia", x1: pc.x, y1: pc.y, x2: pm.x, y2: pm.y, ex: !attuale });
    }
    for (const f of g.figli) {
      const figlio = f.membri[0];
      const genitori = g.membri.filter((m) => m.id === figlio.madre || m.id === figlio.padre).map((m) => pos.get(m.id));
      const da = genitori.length ? genitori.reduce((s, q) => s + q.x, 0) / genitori.length : pc.x;
      const pf = pos.get(figlio.id);
      linee.push({ tipo: "figlio", x1: da, y1: pc.y, x2: pf.x, y2: pf.y });
    }
    return w;
  }

  // radici: persone di sangue senza genitori noti (la coppia di partenza), prima l'uomo
  const radici = Object.values(state.persone)
    .filter((p) => p.sangue && !state.persone[p.madre] && !state.persone[p.padre])
    .sort((a, b) => (a.sesso === b.sesso ? a.anno_nascita - b.anno_nascita : a.sesso === "M" ? -1 : 1));
  let x = 0;
  for (const r of radici) {
    if (posti.has(r.id)) continue;
    x += posiziona(costruisci(r), x, 0);
  }
  const livelli = Math.max(0, ...nodi.map((n) => n.livello)) + 1;
  return { nodi, linee, larghezza: Math.max(1, x) * LARGHEZZA, altezza: livelli * ALTEZZA + 30 };
}
