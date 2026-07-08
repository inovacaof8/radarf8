import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoF8 from "@/assets/f8-logo.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Week = {
  id: string;
  week_num: number;
  week_date: string;
  goal: number;
  blockers: string;
  status: string;
  pct: number | null;
  done: number | null;
  total: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type Item = {
  id: string;
  week_id: string;
  text: string;
  owner: string;
  status: string; // pendente | feito | faltou
  kind: string; // current | next
  due: string | null;
  ordem: number;
  origin: string; // combined | new
};

const C_YELLOW = "#ffcd00";
const LINE = "rgba(255,205,0,.18)";
const CARD = "#141416";
const WEEKS = "pdca_weeks";
const ITEMS = "pdca_items";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtBR(dateStr?: string | null): string {
  if (!dateStr) return "";
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${y}`;
  }
  return dateStr;
}

export default function PdcaPlacar() {
  const [week, setWeek] = useState<Week | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<Week[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedTag, setSavedTag] = useState(false);
  const [viewWeek, setViewWeek] = useState<Week | null>(null);
  const [viewItems, setViewItems] = useState<Item[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<Item | null>(null);
  const [selectedWeekNum, setSelectedWeekNum] = useState(1);

  const loadWeekItems = useCallback(async (w: Week) => {
    setViewLoading(true);
    setViewError(null);
    try {
      const { data, error } = await supabase
        .from(ITEMS as any)
        .select("*")
        .eq("week_id", w.id)
        .order("ordem");
      if (error) throw error;
      setViewItems(((data ?? []) as unknown) as Item[]);
    } catch (e: any) {
      setViewError(e?.message ?? "Erro ao carregar semana");
      setViewItems([]);
    } finally {
      setViewLoading(false);
    }
  }, []);

  function selectWeek(w: Week) {
    setViewWeek(w);
    setViewItems([]);
    setViewError(null);
    setViewLoading(false);
  }

  async function loadWeekByNumber() {
    const num = Math.max(1, Number(selectedWeekNum) || 1);
    const { data: found, error } = await supabase
      .from(WEEKS as any)
      .select("*")
      .eq("week_num", num)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      alert("Não consegui carregar essa semana. Tente de novo.");
      return;
    }

    let picked = (found as unknown) as Week | null;

    if (!picked) {
      if (!confirm(`A Semana ${num} ainda não existe. Deseja criá-la agora?`)) return;
      const { data: created, error: cErr } = await supabase
        .from(WEEKS as any)
        .insert({ week_num: num, week_date: todayISO(), goal: 80, status: "current" } as any)
        .select()
        .single();
      if (cErr || !created) {
        alert("Não consegui criar a semana. Tente de novo.");
        return;
      }
      picked = (created as unknown) as Week;
    }

    setSelectedWeekNum(picked.week_num);
    if (picked.status === "archived") {
      selectWeek(picked);
      loadWeekItems(picked);
      return;
    }

    setWeek(picked);
    const [{ data: its }, { data: hist }] = await Promise.all([
      supabase.from(ITEMS as any).select("*").eq("week_id", picked.id).order("ordem"),
      supabase
        .from(WEEKS as any)
        .select("*")
        .eq("status", "archived")
        .order("week_num", { ascending: true }),
    ]);
    setItems(((its ?? []) as unknown) as Item[]);
    setHistory(((hist ?? []) as unknown) as Week[]);
  }

  const flashSaved = useCallback(() => {
    setSavedTag(true);
    setTimeout(() => setSavedTag(false), 900);
  }, []);

  const loadBoard = useCallback(async (opts?: { resetSelection?: boolean }) => {
    let { data: current } = await supabase
      .from(WEEKS as any)
      .select("*")
      .eq("status", "current")
      .order("week_num", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!current) {
      const { data: created } = await supabase
        .from(WEEKS as any)
        .insert({ week_num: 1, week_date: todayISO(), goal: 80, status: "current" } as any)
        .select()
        .single();
      current = created;
    }
    if (!current) return;

    const cur = (current as unknown) as Week;
    setWeek(cur);
    if (opts?.resetSelection) setSelectedWeekNum(cur.week_num);
    const [{ data: its }, { data: hist }] = await Promise.all([
      supabase.from(ITEMS as any).select("*").eq("week_id", cur.id).order("ordem"),
      supabase
        .from(WEEKS as any)
        .select("*")
        .eq("status", "archived")
        .order("week_num", { ascending: true }),
    ]);
    setItems(((its ?? []) as unknown) as Item[]);
    setHistory(((hist ?? []) as unknown) as Week[]);
  }, []);

  useEffect(() => {
    loadBoard({ resetSelection: true });
  }, [loadBoard]);

  const currentItems = useMemo(() => items.filter((i) => i.kind === "current"), [items]);
  const nextItems = useMemo(() => items.filter((i) => i.kind === "next"), [items]);
  const total = currentItems.length;
  const done = currentItems.filter((i) => i.status === "feito").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function patchWeek(patch: Partial<Week>) {
    if (!week) return;
    setWeek({ ...week, ...patch });
    setSaving(true);
    await supabase.from(WEEKS as any).update(patch as any).eq("id", week.id);
    setSaving(false);
    flashSaved();
  }

  async function addItem(kind: "current" | "next") {
    if (!week) return;
    const ordem = items.filter((i) => i.kind === kind).length + 1;
    const { data } = await supabase
      .from(ITEMS as any)
      .insert({ week_id: week.id, text: "", owner: "", status: "pendente", kind, ordem, origin: "new" } as any)
      .select()
      .single();
    if (data) setItems((arr) => [...arr, (data as unknown) as Item]);
    flashSaved();
  }

  async function patchItem(id: string, patch: Partial<Item>) {
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from(ITEMS as any).update(patch as any).eq("id", id);
    flashSaved();
  }

  async function delItem(id: string) {
    const target = items.find((x) => x.id === id) || null;
    setItems((arr) => arr.filter((x) => x.id !== id));
    await supabase.from(ITEMS as any).delete().eq("id", id);
    if (target) {
      setUndoItem(target);
      window.setTimeout(() => {
        setUndoItem((u) => (u && u.id === target.id ? null : u));
      }, 10000);
    }
    flashSaved();
  }

  async function restoreUndo() {
    if (!undoItem) return;
    const { id, ...rest } = undoItem;
    const { data } = await supabase
      .from(ITEMS as any)
      .insert({ ...rest } as any)
      .select()
      .single();
    if (data) setItems((arr) => [...arr, (data as unknown) as Item]);
    setUndoItem(null);
    flashSaved();
  }

  function cycleStatus(it: Item) {
    const next = it.status === "feito" ? "faltou" : it.status === "faltou" ? "pendente" : "feito";
    patchItem(it.id, { status: next });
  }

  async function closeWeek() {
    if (!week) return;
    if (!currentItems.length) {
      alert("Adicione combinados antes de fechar a semana.");
      return;
    }
    if (
      !confirm(
        `Fechar a Semana ${week.week_num} com placar de ${pct}%? Os combinados da próxima semana viram o novo placar.`,
      )
    )
      return;

    await supabase
      .from(WEEKS as any)
      .update({
        status: "archived",
        pct, done, total,
        archived_at: new Date().toISOString(),
      } as any)
      .eq("id", week.id);

    const { data: nw } = await supabase
      .from(WEEKS as any)
      .insert({
        week_num: week.week_num + 1,
        week_date: todayISO(),
        goal: week.goal,
        status: "current",
      } as any)
      .select()
      .single();

    const carriedItems = [
      ...currentItems.filter((it) => it.status !== "feito"),
      ...nextItems,
    ];
    const newWeek = (nw as unknown) as Week;
    if (newWeek && carriedItems.length) {
      await supabase.from(ITEMS as any).insert(
        carriedItems.map((n, i) => ({
          week_id: newWeek.id,
          text: n.text,
          owner: n.owner,
          due: n.due,
          status: "pendente",
          kind: "current",
          origin: "combined",
          ordem: i + 1,
        })) as any,
      );
    }

    setWeek(newWeek);
    setSelectedWeekNum(newWeek.week_num);
    const [{ data: its }, { data: hist }] = await Promise.all([
      supabase.from(ITEMS as any).select("*").eq("week_id", newWeek.id).order("ordem"),
      supabase
        .from(WEEKS as any)
        .select("*")
        .eq("status", "archived")
        .order("week_num", { ascending: true }),
    ]);
    setItems(((its ?? []) as unknown) as Item[]);
    setHistory(((hist ?? []) as unknown) as Week[]);
    flashSaved();
  }

  async function clearAll() {
    if (!confirm("Isso apaga a semana atual e todo o histórico. Tem certeza?")) return;
    await supabase.from(WEEKS as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    const { data: created } = await supabase
      .from(WEEKS as any)
      .insert({ week_num: 1, week_date: todayISO(), goal: 80, status: "current" } as any)
      .select()
      .single();
    const newWeek = (created as unknown) as Week;
    setWeek(newWeek);
    setSelectedWeekNum(newWeek.week_num);
    setItems([]);
    setHistory([]);
    flashSaved();
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ week, items, history }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "placar_combinado_backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPDF(w: Week, its: Item[]) {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const YELLOW: [number, number, number] = [255, 205, 0];

    const cur = its.filter((i) => i.kind === "current");
    const nxt = its.filter((i) => i.kind === "next");
    const combined = cur.filter((i) => i.origin === "combined");
    const novas = cur.filter((i) => i.origin !== "combined");
    const tot = cur.length;
    const dn = cur.filter((i) => i.status === "feito").length;
    const pc = tot ? Math.round((dn / tot) * 100) : 0;

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, pageW, 90, "F");
    doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
    doc.rect(0, 90, pageW, 4, "F");

    doc.setTextColor(YELLOW[0], YELLOW[1], YELLOW[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PLACAR DO COMBINADO", marginX, 42);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("Grupo F8", marginX, 60);

    doc.setFontSize(11);
    doc.text(`Semana ${w.week_num}  ·  ${fmtBR(w.week_date)}`, pageW - marginX, 42, { align: "right" });
    doc.setTextColor(YELLOW[0], YELLOW[1], YELLOW[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text(`${w.pct ?? pc}%`, pageW - marginX, 75, { align: "right" });

    let y = 120;
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(marginX, y, pageW - marginX * 2, 64, 8, 8, "FD");
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("CUMPRIDOS", marginX + 16, y + 20);
    doc.text("TOTAL", marginX + 140, y + 20);
    doc.text("META", marginX + 240, y + 20);
    doc.text("STATUS", marginX + 340, y + 20);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(String(w.done ?? dn), marginX + 16, y + 48);
    doc.text(String(w.total ?? tot), marginX + 140, y + 48);
    doc.text(`${w.goal}%`, marginX + 240, y + 48);
    doc.setFontSize(12);
    const hit = (w.pct ?? pc) >= w.goal;
    const _c = hit ? YELLOW : [120, 120, 120] as [number, number, number];
    doc.setTextColor(_c[0], _c[1], _c[2]);
    doc.text(hit ? "META BATIDA" : "ABAIXO DA META", marginX + 340, y + 48);

    y += 90;

    const renderTable = (title: string, rows: Item[]) => {
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`${title}  (${rows.length})`, marginX, y);
      y += 8;
      autoTable(doc, {
        startY: y + 4,
        head: [["Status", "Combinado", "Responsável", "Prazo"]],
        body: rows.length
          ? rows.map((it) => [
              it.status === "feito" ? "FEITO" : it.status === "faltou" ? "FALTOU" : "PENDENTE",
              it.text || "—",
              it.owner || "—",
              fmtBR(it.due) || "—",
            ])
          : [["", "Nenhum item.", "", ""]],
        styles: { fontSize: 10, cellPadding: 6, valign: "middle" },
        headStyles: { fillColor: [20, 20, 20], textColor: YELLOW, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 110 },
          3: { cellWidth: 80 },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            const v = String(data.cell.raw);
            if (v === "FEITO") data.cell.styles.textColor = [20, 130, 60];
            else if (v === "FALTOU") data.cell.styles.textColor = [200, 50, 50];
            else if (v === "PENDENTE") data.cell.styles.textColor = [130, 130, 130];
          }
        },
        margin: { left: marginX, right: marginX },
      });
      y = (doc as any).lastAutoTable.finalY + 24;
    };

    renderTable("Combinados do início da reunião", combined);
    renderTable("Tarefas novas da reunião", novas);
    if (nxt.length) renderTable("Combinados para a próxima semana", nxt);

    if (w.blockers && w.blockers.trim()) {
      if (y > 720) { doc.addPage(); y = 60; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text("Bloqueios da semana", marginX, y);
      y += 14;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(w.blockers, pageW - marginX * 2);
      doc.text(lines, marginX, y);
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Grupo F8 · Placar do Combinado · gerado em ${new Date().toLocaleString("pt-BR")}`,
        marginX,
        doc.internal.pageSize.getHeight() - 20,
      );
      doc.text(`${i}/${pageCount}`, pageW - marginX, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    }

    doc.save(`placar-semana-${w.week_num}.pdf`);
  }

  if (!week) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60" style={{ background: "#000" }}>
        Carregando placar…
      </div>
    );
  }

  const gaugeC = 2 * Math.PI * 80;
  const gaugeOffset = gaugeC * (1 - pct / 100);

  let leadBig = "Comece adicionando os combinados";
  let leadSm = "Marque cada um como feito ou faltou para ver o placar.";
  if (total > 0) {
    leadBig = `${done} de ${total} combinados cumpridos`;
    if (pct >= 90) leadSm = "Semana excelente. O time cumpriu quase tudo.";
    else if (pct >= 70) leadSm = "Boa semana. A maior parte saiu do papel.";
    else if (pct >= 50) leadSm = "Metade do caminho. Dá para subir na próxima.";
    else leadSm = "Semana de aprender. Vamos ajustar e melhorar.";
  }
  const needed = Math.max(0, Math.ceil((week.goal / 100) * total) - done);
  const goalMsg =
    total === 0
      ? ""
      : pct >= week.goal
        ? `Meta de ${week.goal}% batida.`
        : `Meta de ${week.goal}%. Faltam ${needed} ${needed === 1 ? "combinado" : "combinados"} para bater.`;

  return (
    <div className="min-h-screen text-white" style={{ background: "#000000" }}>
      <div className="mx-auto max-w-[1080px] px-5 pb-16 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5" style={{ borderBottom: `1px solid ${LINE}` }}>
          <div className="flex items-center gap-3.5">
            <img src={logoF8} alt="Grupo F8" className="h-[56px] w-[56px] rounded-[12px]" />
            <h1 className="text-[42px] leading-[0.9]">
              Placar do <span style={{ color: C_YELLOW }}>Combinado</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <Field label="Semana">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={selectedWeekNum}
                  onChange={(e) => setSelectedWeekNum(parseInt(e.target.value) || 1)}
                  className="f8-input w-[92px]"
                />
                <button
                  onClick={loadWeekByNumber}
                  className="rounded-[8px] px-3 py-2 text-[15px] font-bold uppercase tracking-[0.1em]"
                  style={{ background: C_YELLOW, color: "#000", border: `1px solid ${C_YELLOW}` }}
                >
                  Carregar semana
                </button>
              </div>
            </Field>
            <Field label="Meta %">
              <input
                type="number"
                min={0}
                max={100}
                value={week.goal}
                onChange={(e) => patchWeek({ goal: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                className="f8-input w-[92px]"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={week.week_date}
                onChange={(e) => patchWeek({ week_date: e.target.value })}
                className="f8-input"
              />
            </Field>
          </div>
        </div>

        <div className="my-7 flex flex-wrap items-center gap-10 rounded-[18px] px-9 py-8" style={{ background: CARD, border: `1px solid ${LINE}` }}>
          <div className="relative h-[190px] w-[190px] shrink-0">
            <svg width="190" height="190" viewBox="0 0 190 190">
              <circle cx="95" cy="95" r="80" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="14" />
              <circle cx="95" cy="95" r="80" fill="none" stroke={C_YELLOW} strokeWidth="14" strokeLinecap="round"
                transform="rotate(-90 95 95)" strokeDasharray={gaugeC} strokeDashoffset={gaugeOffset}
                style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.7,.2,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <b className="text-[68px] leading-[0.8]" style={{ color: C_YELLOW }}>{pct}%</b>
              <small className="text-[18px] tracking-[0.1em] text-white/55">{done} de {total}</small>
            </div>
          </div>
          <div className="min-w-[240px] flex-1">
            <div className="text-[18px] uppercase tracking-[0.2em]" style={{ color: C_YELLOW, marginBottom: 8 }}>
              Resultado da semana
            </div>
            <div className="text-[46px] leading-[0.95]">{leadBig}</div>
            <div className="mt-1.5 text-[22px] text-white/60">{leadSm}</div>
            {goalMsg && (
              <div className="mt-2.5 text-[18px]" style={{ color: pct >= week.goal ? C_YELLOW : "rgba(255,255,255,.55)" }}>
                {goalMsg}
              </div>
            )}
          </div>
        </div>

        <Section title="Combinados da semana" hint="Clique no círculo para marcar feito ou faltou">
          {(() => {
            const combined = currentItems.filter((i) => i.origin === "combined");
            const novas = currentItems.filter((i) => i.origin !== "combined");
            const renderItem = (it: Item) => (
              <ItemRow
                key={it.id}
                it={it}
                onCycle={() => cycleStatus(it)}
                onText={(v) => patchItem(it.id, { text: v })}
                onOwner={(v) => patchItem(it.id, { owner: v })}
                onDue={(v) => patchItem(it.id, { due: v || null })}
                onDel={() => delItem(it.id)}
              />
            );
            return (
              <>
                <div className="mb-2 mt-1 text-[14px] uppercase tracking-[0.14em]" style={{ color: C_YELLOW }}>
                  Combinados do início da reunião <span className="text-white/40">({combined.length})</span>
                </div>
                {combined.length === 0 ? (
                  <div className="mb-3 text-[16px] text-white/40">Nenhum combinado vindo da semana anterior.</div>
                ) : (
                  <div className="mb-3">{combined.map(renderItem)}</div>
                )}
                <div className="mb-2 mt-4 text-[14px] uppercase tracking-[0.14em]" style={{ color: C_YELLOW }}>
                  Tarefas novas da reunião <span className="text-white/40">({novas.length})</span>
                </div>
                {novas.length === 0 ? (
                  <div className="mb-2 text-[16px] text-white/40">Nenhuma tarefa nova adicionada.</div>
                ) : (
                  <div>{novas.map(renderItem)}</div>
                )}
                <AddBtn onClick={() => addItem("current")} label="+ Adicionar tarefa nova" />
              </>
            );
          })()}
        </Section>

        <Section title="Bloqueios da semana" hint="O que travou e virou tarefa">
          <textarea
            value={week.blockers}
            onChange={(e) => patchWeek({ blockers: e.target.value })}
            placeholder="Anote aqui o que atrapalhou e o que vai ser feito sobre isso."
            className="w-full resize-y rounded-[12px] p-3.5 text-[18px] outline-none"
            style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)", color: "#fff", minHeight: 88 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C_YELLOW)}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.07)")}
          />
        </Section>

        <Section title="Combinados para a próxima semana" hint="Viram o placar da semana que vem">
          {nextItems.map((it) => (
            <NextRow
              key={it.id}
              it={it}
              onText={(v) => patchItem(it.id, { text: v })}
              onOwner={(v) => patchItem(it.id, { owner: v })}
              onDue={(v) => patchItem(it.id, { due: v || null })}
              onDel={() => delItem(it.id)}
            />
          ))}
          <AddBtn onClick={() => addItem("next")} label="+ Adicionar tarefa" />
        </Section>

        <div className="mt-9 flex flex-wrap gap-3.5 pt-6" style={{ borderTop: `1px solid ${LINE}` }}>
          <Btn onClick={closeWeek} variant="primary">Fechar semana e arquivar</Btn>
          <Btn onClick={() => exportPDF(week, items)}>Exportar PDF</Btn>
          <Btn onClick={() => window.print()}>Imprimir</Btn>
          <Btn onClick={exportData}>Exportar dados</Btn>
          <Btn onClick={clearAll} variant="danger">Limpar tudo</Btn>
        </div>

        <div className="mt-10">
          <h2 className="mb-4 text-[30px]">Histórico de placares</h2>
          {history.length === 0 ? (
            <div className="py-3.5 text-[20px] text-white/40">
              Ainda não há semanas arquivadas. Use Fechar semana ao final de cada reunião.
            </div>
          ) : (
            <>
              <div className="flex h-[150px] items-end gap-2.5 overflow-x-auto py-2.5" style={{ borderBottom: `1px solid ${LINE}` }}>
                {history.map((h) => {
                  const p = h.pct ?? 0;
                  const hit = h.goal != null && p >= h.goal;
                  return (
                    <button key={h.id} onClick={() => selectWeek(h)}
                      className="flex w-[54px] shrink-0 cursor-pointer flex-col items-center gap-1.5 border-none bg-transparent"
                      title={`Abrir Semana ${h.week_num}`}>
                      <div className="text-[22px]" style={{ color: C_YELLOW }}>{p}%</div>
                      <div style={{ width: 34, height: Math.max(4, p * 1.2), borderRadius: "6px 6px 0 0",
                        background: hit
                          ? `linear-gradient(180deg, ${C_YELLOW}, rgba(255,205,0,.4))`
                          : `linear-gradient(180deg, rgba(255,205,0,.5), rgba(255,205,0,.12))` }} />
                      <div className="text-[15px] text-white/50">S{h.week_num}</div>
                    </button>
                  );
                })}
              </div>
              <div>
                {[...history].reverse().map((h) => {
                  const p = h.pct ?? 0;
                  const hit = h.goal != null && p >= h.goal;
                  return (
                    <button key={h.id} onClick={() => selectWeek(h)}
                      className="flex w-full cursor-pointer justify-between border-none bg-transparent py-2.5 text-left text-[20px] text-white transition hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                      <span>Semana {h.week_num} <span className="text-white/45">{fmtBR(h.week_date)}</span></span>
                      <span>
                        <b style={{ color: C_YELLOW }}>{p}%</b> {h.done} de {h.total}{" "}
                        <span style={{ color: hit ? C_YELLOW : "rgba(255,255,255,.4)" }}>meta {h.goal}%</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {viewWeek && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.75)" }} onClick={() => setViewWeek(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-[820px] overflow-y-auto rounded-[18px] p-7"
            style={{ background: CARD, border: `1px solid ${LINE}` }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-[14px] uppercase tracking-[0.2em]" style={{ color: C_YELLOW }}>Semana arquivada</div>
                <h2 className="text-[34px]">Semana {viewWeek.week_num} · {fmtBR(viewWeek.week_date)}</h2>
                <div className="text-[18px] text-white/60">
                  <b style={{ color: C_YELLOW }}>{viewWeek.pct ?? 0}%</b> · {viewWeek.done} de {viewWeek.total} · meta {viewWeek.goal}%
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => loadWeekItems(viewWeek)} disabled={viewLoading}
                  className="rounded-md px-3 py-1.5 text-[14px] font-bold uppercase tracking-[0.14em] disabled:opacity-60"
                  style={{ background: C_YELLOW, color: "#000" }}>
                  {viewLoading ? "Carregando…" : viewItems.length ? "Recarregar" : "Carregar semana"}
                </button>
                <button onClick={() => exportPDF(viewWeek, viewItems)} disabled={!viewItems.length}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-[14px] uppercase tracking-[0.14em] text-white/80 hover:bg-white/10 disabled:opacity-40">
                  Exportar PDF
                </button>
                <button onClick={() => setViewWeek(null)}
                  className="rounded-md border border-white/15 px-3 py-1.5 text-[14px] uppercase tracking-[0.14em] text-white/70 hover:bg-white/10">
                  Fechar
                </button>
              </div>
            </div>

            {viewError && (
              <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-[16px] text-red-200">{viewError}</div>
            )}

            {!viewItems.length && !viewLoading && !viewError ? (
              <div className="rounded-md border border-white/10 bg-white/[0.02] p-6 text-center text-[18px] text-white/60">
                Clique em <b style={{ color: C_YELLOW }}>Carregar semana</b> para ver os combinados desta semana.
              </div>
            ) : viewLoading ? (
              <div className="py-10 text-center text-[18px] text-white/60">Carregando…</div>
            ) : (
              (() => {
                const cur = viewItems.filter((i) => i.kind === "current");
                const nxt = viewItems.filter((i) => i.kind === "next");
                const combined = cur.filter((i) => i.origin === "combined");
                const novas = cur.filter((i) => i.origin !== "combined");
                const renderRow = (it: Item) => (
                  <div key={it.id} className="flex flex-wrap items-center gap-3 py-2 text-[18px]"
                    style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                    <span className="w-[80px] text-[14px] tracking-[0.08em]"
                      style={{ color: it.status === "feito" ? C_YELLOW : it.status === "faltou" ? "rgba(255,140,140,.85)" : "rgba(255,255,255,.45)" }}>
                      {it.status === "feito" ? "FEITO" : it.status === "faltou" ? "FALTOU" : "PENDENTE"}
                    </span>
                    <span className="min-w-[160px] flex-1">{it.text || <i className="text-white/30">(sem texto)</i>}</span>
                    <span style={{ color: C_YELLOW }}>{it.owner}</span>
                    {it.due && <span className="text-white/50">prazo {fmtBR(it.due)}</span>}
                  </div>
                );
                return (
                  <>
                    <h3 className="mb-2 mt-4 text-[22px]">Combinados do início da reunião <span className="text-[16px] text-white/40">({combined.length})</span></h3>
                    {combined.length === 0 ? (<div className="text-white/40">Nenhum combinado vindo da semana anterior.</div>) : combined.map(renderRow)}
                    <h3 className="mb-2 mt-5 text-[22px]">Tarefas novas da reunião <span className="text-[16px] text-white/40">({novas.length})</span></h3>
                    {novas.length === 0 ? (<div className="text-white/40">Nenhuma tarefa nova adicionada.</div>) : novas.map(renderRow)}
                    {nxt.length > 0 && (<>
                      <h3 className="mb-2 mt-5 text-[22px]">Combinados para a próxima semana <span className="text-[16px] text-white/40">({nxt.length})</span></h3>
                      {nxt.map(renderRow)}
                    </>)}
                  </>
                );
              })()
            )}

            {viewWeek.blockers && (
              <>
                <h3 className="mb-2 mt-5 text-[22px]">Bloqueios</h3>
                <div className="whitespace-pre-wrap text-[18px] text-white/75">{viewWeek.blockers}</div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-50 rounded-lg px-3.5 py-2 text-[17px] tracking-wider transition-opacity"
        style={{ background: C_YELLOW, color: "#000", opacity: savedTag || saving ? 1 : 0 }}>
        {saving ? "Salvando…" : "Salvo"}
      </div>

      <style>{`
        .f8-input {
          background: #000;
          border: 1px solid ${LINE};
          color: #fff;
          font-size: 18px;
          padding: 8px 12px;
          border-radius: 8px;
        }
        .f8-input:focus { outline: none; border-color: ${C_YELLOW}; }
        @media print { body { background: #fff !important; color: #000 !important; } }
      `}</style>

      {undoItem && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[12px] px-5 py-3 text-[16px] text-white shadow-lg"
          style={{ background: "#1f1f22", border: `1px solid ${LINE}` }}>
          <span>Item excluído{undoItem.text ? `: "${undoItem.text.slice(0, 40)}"` : ""}</span>
          <button onClick={restoreUndo} className="rounded-[8px] px-3 py-1 font-bold" style={{ background: C_YELLOW, color: "#000" }}>Desfazer</button>
          <button onClick={() => setUndoItem(null)} className="text-white/50 hover:text-white" aria-label="Fechar">✕</button>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-[14px] uppercase tracking-[0.14em] text-white/50">{label}</span>
      {children}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mt-9">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-[28px]">{title}</h2>
        {hint && <span className="text-[16px] text-white/45">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ItemRow({ it, onCycle, onText, onOwner, onDue, onDel }: {
  it: Item; onCycle: () => void; onText: (v: string) => void; onOwner: (v: string) => void; onDue: (v: string) => void; onDel: () => void;
}) {
  const isFeito = it.status === "feito";
  const isFaltou = it.status === "faltou";
  const stLabel = isFeito ? "FEITO" : isFaltou ? "FALTOU" : "PENDENTE";
  const stSym = isFeito ? "✓" : isFaltou ? "✕" : "";
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-3.5 rounded-[12px] px-3.5 py-2.5"
      style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)" }}>
      <button onClick={onCycle}
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[20px] transition"
        style={{
          border: isFaltou ? `2px dashed rgba(255,255,255,.35)` : `2px solid ${isFeito ? C_YELLOW : "rgba(255,255,255,.3)"}`,
          background: isFeito ? C_YELLOW : "transparent",
          color: isFeito ? "#000" : "rgba(255,255,255,.5)",
        }}>{stSym}</button>
      <input value={it.text} onChange={(e) => onText(e.target.value)} placeholder="O que foi combinado"
        className="min-w-[120px] flex-1 border-none bg-transparent px-0.5 py-1 text-[20px] outline-none"
        style={{ color: isFaltou ? "rgba(255,255,255,.5)" : "#fff" }} />
      <input value={it.owner} onChange={(e) => onOwner(e.target.value)} placeholder="Responsável"
        className="w-[150px] border-none bg-transparent px-0.5 py-1 text-[17px] outline-none" style={{ color: C_YELLOW }} />
      <input type="date" value={it.due ?? ""} onChange={(e) => onDue(e.target.value)}
        className="f8-input" style={{ width: 160 }} title="Prazo" />
      <span className="w-[80px] text-right text-[15px] tracking-[0.08em] text-white/40">{stLabel}</span>
      <button onClick={onDel} className="border-none bg-transparent px-1 text-[24px] leading-none text-white/30 transition hover:text-red-400">×</button>
    </div>
  );
}

function NextRow({ it, onText, onOwner, onDue, onDel }: {
  it: Item; onText: (v: string) => void; onOwner: (v: string) => void; onDue: (v: string) => void; onDel: () => void;
}) {
  return (
    <div className="mb-2.5 flex items-center gap-3 rounded-[12px] px-3.5 py-2.5"
      style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)" }}>
      <input value={it.text} onChange={(e) => onText(e.target.value)} placeholder="O que combinar"
        className="flex-1 border-none bg-transparent px-0.5 py-1 text-[20px] outline-none" style={{ color: "#fff" }} />
      <input value={it.owner} onChange={(e) => onOwner(e.target.value)} placeholder="Responsável"
        className="w-[150px] border-none bg-transparent px-0.5 py-1 text-[17px] outline-none" style={{ color: C_YELLOW }} />
      <input type="date" value={it.due ?? ""} onChange={(e) => onDue(e.target.value)} className="f8-input" style={{ width: 160 }} />
      <button onClick={onDel} className="border-none bg-transparent px-1 text-[24px] leading-none text-white/30 transition hover:text-red-400">×</button>
    </div>
  );
}

function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="w-full rounded-[10px] bg-transparent px-4 py-3 text-[19px] tracking-wide transition hover:bg-[rgba(255,205,0,0.08)]"
      style={{ border: `1px dashed ${LINE}`, color: C_YELLOW }}>
      {label}
    </button>
  );
}

function Btn({ onClick, children, variant }: { onClick: () => void; children: React.ReactNode; variant?: "primary" | "danger" }) {
  const base = "rounded-[10px] px-5 py-3 text-[18px] tracking-wide transition";
  if (variant === "primary") {
    return (
      <button onClick={onClick} className={`${base} font-semibold`}
        style={{ background: C_YELLOW, color: "#000", border: `1px solid ${C_YELLOW}` }}>{children}</button>
    );
  }
  if (variant === "danger") {
    return (
      <button onClick={onClick} className={base}
        style={{ background: "transparent", color: "rgba(255,140,140,.9)", border: "1px solid rgba(255,140,140,.3)" }}>{children}</button>
    );
  }
  return (
    <button onClick={onClick} className={base}
      style={{ background: "transparent", color: "#fff", border: `1px solid ${LINE}` }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C_YELLOW)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = LINE)}>{children}</button>
  );
}
