import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Share2, Trash2, ChevronsUpDown, Check } from "lucide-react";
import { useSelectableUsers } from "@/hooks/useSelectableUsers";
import { cn } from "@/lib/utils";

interface Props {
  documentoId: string;
  ownerId?: string | null;
}

type AclRow = {
  id: string;
  user_id: string;
  permission: "read" | "edit";
  profile?: { name: string | null; email: string | null } | null;
};

export default function GedShareDialog({ documentoId, ownerId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [permission, setPermission] = useState<"read" | "edit">("read");
  const usersQ = useSelectableUsers({ enabled: open });

  const aclQ = useQuery({
    queryKey: ["ged_acl", documentoId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ged_document_acl")
        .select("id, user_id, permission")
        .eq("documento_id", documentoId);
      if (error) throw error;
      const rows = (data || []) as any[];
      if (!rows.length) return [] as AclRow[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, profile: map.get(r.user_id) || null })) as AclRow[];
    },
  });

  const acl = aclQ.data ?? [];
  const grantedIds = new Set(acl.map((a) => a.user_id));
  const availableUsers = (usersQ.data ?? []).filter(
    (u) => u.user_id !== ownerId && !grantedIds.has(u.user_id),
  );
  const selectedLabel =
    (usersQ.data ?? []).find((u) => u.user_id === selectedUser)?.name || "Selecione um usuário...";

  async function grant() {
    if (!selectedUser) return toast.error("Selecione um usuário.");
    const { error } = await (supabase as any).from("ged_document_acl").insert({
      documento_id: documentoId,
      user_id: selectedUser,
      permission,
    });
    if (error) return toast.error(error.message || "Falha ao compartilhar.");
    toast.success("Acesso concedido.");
    setSelectedUser("");
    qc.invalidateQueries({ queryKey: ["ged_acl", documentoId] });
  }

  async function revoke(id: string) {
    if (!confirm("Remover acesso?")) return;
    const { error } = await (supabase as any).from("ged_document_acl").delete().eq("id", id);
    if (error) return toast.error("Falha ao remover.");
    toast.success("Acesso removido.");
    qc.invalidateQueries({ queryKey: ["ged_acl", documentoId] });
  }

  async function changePerm(id: string, perm: "read" | "edit") {
    const { error } = await (supabase as any)
      .from("ged_document_acl")
      .update({ permission: perm })
      .eq("id", id);
    if (error) return toast.error("Falha ao atualizar.");
    qc.invalidateQueries({ queryKey: ["ged_acl", documentoId] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" /> Compartilhar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar documento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Apenas você (dono) e administradores enxergam este documento. Conceda acesso a outros
          usuários abaixo. Você só pode compartilhar com pessoas sob sua gestão.
        </p>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="flex-1 justify-between">
                  <span className="truncate">{selectedLabel}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[320px]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar usuário..." />
                  <CommandList>
                    <CommandEmpty>Nenhum usuário disponível.</CommandEmpty>
                    <CommandGroup>
                      {availableUsers.map((u) => (
                        <CommandItem
                          key={u.user_id}
                          value={`${u.name} ${u.email ?? ""}`}
                          onSelect={() => {
                            setSelectedUser(u.user_id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUser === u.user_id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm">{u.name}</span>
                            {u.email && (
                              <span className="text-xs text-muted-foreground">{u.email}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Select value={permission} onValueChange={(v) => setPermission(v as any)}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Leitura</SelectItem>
                <SelectItem value="edit">Edição</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={grant}>Conceder</Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Usuários com acesso
          </div>
          {aclQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : acl.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acesso compartilhado.</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {acl.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 p-2 border rounded-md"
                >
                  <div className="min-w-0">
                    <div className="text-sm truncate">{a.profile?.name ?? a.user_id}</div>
                    {a.profile?.email && (
                      <div className="text-xs text-muted-foreground truncate">
                        {a.profile.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={a.permission}
                      onValueChange={(v) => changePerm(a.id, v as any)}
                    >
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">Leitura</SelectItem>
                        <SelectItem value="edit">Edição</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => revoke(a.id)}
                      aria-label="Remover acesso"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Badge variant="outline" className="mr-auto text-xs">
            Documento privado por padrão
          </Badge>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
