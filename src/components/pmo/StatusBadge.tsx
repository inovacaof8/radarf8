import { Badge } from "@/components/ui/badge";

const PROJECT_STATUS: Record<string, string> = {
  iniciacao: "Iniciação",
  planejamento: "Planejamento",
  execucao: "Execução",
  monitoramento: "Monitoramento",
  encerramento: "Encerramento",
  cancelado: "Cancelado",
};

const SIMPLE_STATUS: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  encerrado: "Encerrado",
};

export function StatusBadge({ status, kind = "project" }: { status: string; kind?: "project" | "simple" }) {
  const map = kind === "project" ? PROJECT_STATUS : SIMPLE_STATUS;
  const label = map[status] ?? status;
  const cls =
    status === "execucao" || status === "ativo" ? "bg-success text-success-foreground" :
    status === "planejamento" || status === "monitoramento" ? "bg-info text-info-foreground" :
    status === "iniciacao" ? "bg-secondary text-secondary-foreground" :
    status === "encerramento" || status === "encerrado" ? "bg-muted text-muted-foreground" :
    status === "cancelado" || status === "pausado" ? "bg-destructive text-destructive-foreground" :
    "bg-secondary text-secondary-foreground";
  return <Badge className={`${cls} text-[10px] uppercase tracking-wider font-bold`}>{label}</Badge>;
}

export function HealthBadge({ h }: { h: string }) {
  const cls = h === "vermelho" ? "health-vermelho" : h === "amarelo" ? "health-amarelo" : "health-verde";
  const label = h === "vermelho" ? "Crítico" : h === "amarelo" ? "Atenção" : "Saudável";
  return <span className={`${cls} px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider`}>{label}</span>;
}
