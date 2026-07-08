export const NOTIF_TYPES: Record<string, string> = {
  comunicado: "Comunicado",
  orientacao: "Orientação",
  procedimento: "Procedimento",
  alerta: "Alerta",
  convocacao: "Convocação",
  atualizacao: "Atualização",
  informacao_administrativa: "Informação administrativa",
  outro: "Outro",
};

export const NOTIF_PRIORITIES: Record<string, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const NOTIF_PRIORITY_COLORS: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700 border-slate-300",
  normal: "bg-blue-100 text-blue-700 border-blue-300",
  alta: "bg-orange-100 text-orange-800 border-orange-300",
  urgente: "bg-red-100 text-red-800 border-red-300",
};

export const NOTIF_STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  enviada: "Enviada",
  cancelada: "Cancelada",
  arquivada: "Arquivada",
};

export const NOTIF_ACK_STATUS: Record<string, string> = {
  nao_lida: "Não lida",
  visualizada: "Visualizada",
  ciencia_pendente: "Ciência pendente",
  ciencia_confirmada: "Ciência confirmada",
  ciencia_vencida: "Ciência vencida",
};

export const NOTIF_GROUP_TYPES: Record<string, string> = {
  permanente: "Permanente",
  temporario: "Temporário",
  area: "Vinculado a área",
  projeto: "Vinculado a projeto",
  operacao: "Vinculado a operação",
};
