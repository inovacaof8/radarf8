import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import PageHeader from "@/components/pmo/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TeamFiltersBar, EMPTY_FILTERS, type TeamFiltersValue } from "@/components/filters/TeamFiltersBar";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { useTeamFilterOptions } from "@/hooks/useTeamFilterOptions";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";

type Meeting = {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  modality: string;
  project_id: string | null;
  program_id: string | null;
  portfolio_id: string | null;
  manager_id: string | null;
  organizer_id: string | null;
  created_by: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const MODALITY_LABEL: Record<string, string> = {
  presencial: "Presencial",
  online: "Online",
  hibrida: "Híbrida",
};

export default function MeetingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = usePersistedFilters<TeamFiltersValue>("meetings", EMPTY_FILTERS);
  const { people } = useTeamFilterOptions();
  const [creating, setCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillDate = searchParams.get("date");
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setCreating(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting")
        .select(
          "id, title, scheduled_at, status, modality, project_id, program_id, portfolio_id, manager_id, organizer_id, created_by",
        )
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data as Meeting[];
    },
  });

  const projects = useQuery({
    queryKey: ["meetings-projects-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const profiles = useSelectableUsers({ forMeeting: true });

  const create = useMutation({
    mutationFn: async (payload: any) => {
      const { data: u } = await supabase.auth.getUser();
      const insert = {
        ...payload,
        created_by: u.user?.id,
        organizer_id: u.user?.id,
        manager_id: payload.manager_id || u.user?.id,
        project_id: payload.project_id || null,
      };
      const { data, error } = await supabase.from("meeting").insert(insert).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (m) => {
      toast.success("Reunião criada");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setCreating(false);
      navigate(`/reunioes/${m.id}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar"),
  });

  const personArea = useMemo(() => new Map(people.map((p) => [p.user_id, p.primary_area_id])), [people]);

  const filtered = (list.data ?? []).filter((m) => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.statuses.length && !filters.statuses.includes(m.status)) return false;
    if (filters.personIds.length) {
      const personHit = [m.manager_id, m.organizer_id, m.created_by].some((id) => id && filters.personIds.includes(id));
      if (!personHit) return false;
    }
    if (filters.areaIds.length) {
      const aid = m.manager_id ? (personArea.get(m.manager_id) ?? null) : null;
      if (!aid || !filters.areaIds.includes(aid)) return false;
    }
    if (filters.period.from && m.scheduled_at.slice(0, 10) < filters.period.from) return false;
    if (filters.period.to && m.scheduled_at.slice(0, 10) > filters.period.to) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reuniões"
        description="Agende reuniões, gere atas com IA e acompanhe atividades."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nova reunião
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por título…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <TeamFiltersBar
            value={filters}
            onChange={setFilters}
            show={{ area: true, person: true, status: true, priority: false, period: true }}
            statusOptions={[
              { value: "agendada", label: "Agendada" },
              { value: "realizada", label: "Realizada" },
              { value: "cancelada", label: "Cancelada" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CalendarCheck className="mx-auto h-10 w-10 mb-2 opacity-50" />
              Nenhuma reunião encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => navigate(`/reunioes/${m.id}`)}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>{format(new Date(m.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                    <TableCell>{MODALITY_LABEL[m.modality] ?? m.modality}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABEL[m.status] ?? m.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova reunião</SheetTitle>
          </SheetHeader>
          <form
            id="new-meeting"
            className="space-y-4 mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget as HTMLFormElement);
              const projectId = fd.get("project_id");
              const managerId = fd.get("manager_id");
              create.mutate({
                title: fd.get("title"),
                scheduled_at: new Date(fd.get("scheduled_at") as string).toISOString(),
                modality: fd.get("modality") || "online",
                location: fd.get("location") || null,
                agenda: fd.get("agenda") || null,
                project_id: projectId && projectId !== "none" ? projectId : null,
                manager_id: managerId && managerId !== "self" ? managerId : null,
                status: "agendada",
              });
            }}
          >
            <div>
              <Label>Título *</Label>
              <Input name="title" required />
            </div>
            <div>
              <Label>Data e hora *</Label>
              <Input
                type="datetime-local"
                name="scheduled_at"
                required
                defaultValue={prefillDate ? `${prefillDate}T09:00` : undefined}
              />
            </div>
            <div>
              <Label>Modalidade</Label>
              <Select name="modality" defaultValue="online">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="hibrida">Híbrida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local / Link</Label>
              <Input name="location" placeholder="Sala, endereço ou link" />
            </div>
            <div>
              <Label>Pauta</Label>
              <Textarea name="agenda" rows={4} />
            </div>
            <div>
              <Label>Projeto (opcional)</Label>
              <Select name="project_id" defaultValue="none">
                <SelectTrigger>
                  <SelectValue placeholder="Sem vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {(projects.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gestor das pendências</Label>
              <Select name="manager_id" defaultValue="self">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Eu mesmo (criador)</SelectItem>
                  {(profiles.data ?? []).map((p: any) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Quem vai gerenciar as pendências (pode ser um assistente).
              </p>
            </div>
          </form>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button form="new-meeting" type="submit" disabled={create.isPending}>
              {create.isPending ? "Criando…" : "Criar"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
