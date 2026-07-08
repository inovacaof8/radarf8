import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { ONBOARDING_QUIZ } from "@/data/onboarding-quiz";
import { Settings as SettingsIcon, Trophy, Users, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface ProfileLite {
  user_id: string;
  name: string;
  email: string | null;
  primary_area_id: string | null;
  status: string;
}

export default function OnboardingDashboard() {
  // ---- Settings ----
  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["onboarding-settings-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_settings")
        .select("*")
        .eq("id", true)
        .single();
      return data;
    },
  });

  // ---- Eligible users (todos os ativos sem cargo isento) ----
  const { data: rolesByUser } = useQuery({
    queryKey: ["onb-user-roles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role:role_id(name)");
      const map: Record<string, string[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.user_id]) map[r.user_id] = [];
        if (r.role?.name) map[r.user_id].push(r.role.name);
      });
      return map;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["onb-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, name, email, primary_area_id, status")
        .eq("status", "active");
      return (data || []) as ProfileLite[];
    },
  });

  const { data: areas } = useQuery({
    queryKey: ["onb-areas"],
    queryFn: async () => {
      const { data } = await supabase.from("area").select("id, name");
      return (data || []) as { id: string; name: string }[];
    },
  });

  const { data: progressRows } = useQuery({
    queryKey: ["onb-progress-all"],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_progress").select("*");
      return data || [];
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["onb-attempts-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_quiz_attempt")
        .select("*")
        .order("submitted_at", { ascending: false });
      return data || [];
    },
  });

  const { data: answers } = useQuery({
    queryKey: ["onb-answers-all"],
    queryFn: async () => {
      const { data } = await supabase.from("onboarding_quiz_answer").select("*");
      return data || [];
    },
  });

  // ---- Filters ----
  const [areaFilter, setAreaFilter] = useState<string>("");

  const exempt = settings?.exempt_role_names || ["Administrador"];

  const eligible = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter((p) => {
      const roles = rolesByUser?.[p.user_id] || [];
      const isExempt = roles.some((r) => exempt.includes(r));
      if (isExempt) return false;
      if (areaFilter && p.primary_area_id !== areaFilter) return false;
      return true;
    });
  }, [profiles, rolesByUser, exempt, areaFilter]);

  const progressById = useMemo(() => {
    const m: Record<string, any> = {};
    (progressRows || []).forEach((r) => (m[r.user_id] = r));
    return m;
  }, [progressRows]);

  const bestAttemptByUser = useMemo(() => {
    const m: Record<string, any> = {};
    (attempts || []).forEach((a) => {
      if (!m[a.user_id] || a.score > m[a.user_id].score) m[a.user_id] = a;
    });
    return m;
  }, [attempts]);

  // KPIs
  const total = eligible.length;
  const completed = eligible.filter((u) => progressById[u.user_id]?.completed_at).length;
  const inProgress = eligible.filter(
    (u) => progressById[u.user_id] && !progressById[u.user_id].completed_at,
  ).length;
  const notStarted = total - completed - inProgress;
  const avgScore =
    eligible.reduce((acc, u) => acc + (bestAttemptByUser[u.user_id]?.score || 0), 0) /
    (eligible.filter((u) => bestAttemptByUser[u.user_id]).length || 1);
  const avgDuration =
    (progressRows || []).reduce((a, r) => a + (r.time_spent_seconds || 0), 0) /
    (progressRows?.length || 1);

  // Por área
  const byArea = useMemo(() => {
    const groups: Record<string, { total: number; done: number; name: string }> = {};
    eligible.forEach((u) => {
      const aid = u.primary_area_id || "sem-area";
      const aname = areas?.find((a) => a.id === aid)?.name || "Sem área";
      if (!groups[aid]) groups[aid] = { total: 0, done: 0, name: aname };
      groups[aid].total++;
      if (progressById[u.user_id]?.completed_at) groups[aid].done++;
    });
    return Object.values(groups).map((g) => ({
      name: g.name,
      Concluído: Math.round((g.done / g.total) * 100),
      total: g.total,
    }));
  }, [eligible, areas, progressById]);

  // Acertos/erros por pergunta
  const perQuestion = useMemo(() => {
    return ONBOARDING_QUIZ.map((q, i) => {
      const list = (answers || []).filter((a) => a.question_key === q.key);
      const correct = list.filter((a) => a.is_correct).length;
      return {
        name: `Q${i + 1}`,
        Acertos: list.length ? Math.round((correct / list.length) * 100) : 0,
      };
    });
  }, [answers]);

  // Ranking
  const ranking = useMemo(() => {
    return eligible
      .map((u) => ({
        name: u.name,
        area: areas?.find((a) => a.id === u.primary_area_id)?.name || "—",
        score: bestAttemptByUser[u.user_id]?.score ?? null,
        total: bestAttemptByUser[u.user_id]?.total ?? ONBOARDING_QUIZ.length,
        completed: !!progressById[u.user_id]?.completed_at,
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [eligible, areas, bestAttemptByUser, progressById]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o engajamento e o desempenho dos colaboradores no quiz.
          </p>
        </div>
        <SettingsDialog settings={settings} onSaved={refetchSettings} />
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <select
          className="border rounded px-3 py-2 text-sm bg-background"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="">Todas as áreas</option>
          {areas?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI icon={<Users />} label="Elegíveis" value={total} />
        <KPI
          icon={<CheckCircle2 />}
          label="Concluídos"
          value={`${completed} (${total ? Math.round((completed / total) * 100) : 0}%)`}
        />
        <KPI icon={<Users />} label="Em andamento" value={inProgress} />
        <KPI icon={<Users />} label="Não iniciaram" value={notStarted} />
        <KPI
          icon={<Trophy />}
          label="Nota média"
          value={`${avgScore.toFixed(1)} / ${ONBOARDING_QUIZ.length}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Tempo médio para concluir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {Math.round(avgDuration / 60)} min
          </div>
          <p className="text-xs text-muted-foreground">
            Considerando todos que iniciaram o onboarding.
          </p>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conclusão por área (%)</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={byArea}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="Concluído" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acerto por pergunta (%)</CardTitle>
          </CardHeader>
          <CardContent style={{ height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={perQuestion}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="Acertos" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de colaboradores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left">#</th>
                  <th className="text-left">Colaborador</th>
                  <th className="text-left">Área</th>
                  <th className="text-center">Nota</th>
                  <th className="text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-muted/40">
                    <td className="py-2">{i + 1}</td>
                    <td>{r.name}</td>
                    <td>{r.area}</td>
                    <td className="text-center">
                      {r.score !== null ? `${r.score}/${r.total}` : "—"}
                    </td>
                    <td className="text-center">
                      {r.completed ? (
                        <span className="text-green-600 font-medium">Concluído</span>
                      ) : r.score !== null ? (
                        <span className="text-amber-600">Quiz feito</span>
                      ) : (
                        <span className="text-muted-foreground">Não iniciou</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!ranking.length && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-muted-foreground">
                      Nenhum colaborador elegível encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
          <span className="h-4 w-4">{icon}</span>
          {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function SettingsDialog({ settings, onSaved }: { settings: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [passing, setPassing] = useState(settings?.passing_score ?? 5);
  const [exempt, setExempt] = useState((settings?.exempt_role_names || []).join(", "));
  const [enabled, setEnabled] = useState(settings?.enabled ?? true);

  const save = async () => {
    const list = exempt
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const { error } = await supabase
      .from("onboarding_settings")
      .update({
        passing_score: passing,
        exempt_role_names: list,
        enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Configurações salvas.");
    setOpen(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SettingsIcon className="h-4 w-4" /> Configurações
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações do Onboarding</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Onboarding ativo</Label>
            <select
              className="w-full border rounded px-3 py-2 text-sm bg-background mt-1"
              value={enabled ? "1" : "0"}
              onChange={(e) => setEnabled(e.target.value === "1")}
            >
              <option value="1">Ativo (obrigatório)</option>
              <option value="0">Desativado</option>
            </select>
          </div>
          <div>
            <Label>Nota mínima para liberar o sistema (de 7)</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={passing}
              onChange={(e) => setPassing(Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Cargos isentos (nomes separados por vírgula)</Label>
            <Input value={exempt} onChange={(e) => setExempt(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Ex.: Administrador, PMO
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
