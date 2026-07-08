import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function LegalDocuments() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [newContent, setNewContent] = useState("");
  const [requiresAcceptance, setRequiresAcceptance] = useState(true);
  const [viewContent, setViewContent] = useState("");

  const { data: docs, isLoading } = useQuery({
    queryKey: ["legal-docs"],
    queryFn: async () => { const { data } = await supabase.from("legal_documents").select("*"); return data || []; },
  });

  const { data: versions } = useQuery({
    queryKey: ["legal-versions"],
    queryFn: async () => { const { data } = await supabase.from("legal_document_versions").select("*").order("version", { ascending: false }); return data || []; },
  });

  const getVersions = (docId: string) => versions?.filter((v) => v.document_id === docId) || [];
  const getLatest = (docId: string) => getVersions(docId)[0];

  const openEditor = (docId: string) => {
    const latest = getLatest(docId);
    setSelectedDoc(docId);
    setNewContent(latest?.content || "");
    setRequiresAcceptance(true);
    setEditorOpen(true);
  };

  const publishVersion = async () => {
    if (!selectedDoc || !newContent.trim()) return;
    const latest = getLatest(selectedDoc);
    const newVersion = (latest?.version || 0) + 1;
    await supabase.from("legal_document_versions").insert({
      document_id: selectedDoc, version: newVersion, content: newContent,
      requires_acceptance: requiresAcceptance, published_by: profile?.name || "Admin",
    });
    await supabase.from("audit_logs").insert({
      user_id: user!.id, user_name: profile?.name || "", action: "legal_version_published",
      module: "legal-documents", details: `Versão ${newVersion} publicada`,
    });
    toast.success(`Versão ${newVersion} publicada.`);
    setEditorOpen(false);
    queryClient.invalidateQueries({ queryKey: ["legal-versions"] });
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Documentos Legais</h1><p className="text-muted-foreground">Gerencie os documentos legais e suas versões</p></div>
      <Tabs defaultValue={docs?.[0]?.id}>
        <TabsList>{docs?.map((doc) => <TabsTrigger key={doc.id} value={doc.id}>{doc.title}</TabsTrigger>)}</TabsList>
        {docs?.map((doc) => (
          <TabsContent key={doc.id} value={doc.id}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{doc.title}</CardTitle>
                <Button onClick={() => openEditor(doc.id)} className="gap-2"><Plus className="h-4 w-4" /> Nova Versão</Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Versão</TableHead><TableHead>Publicado em</TableHead><TableHead>Por</TableHead><TableHead>Aceite</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {getVersions(doc.id).map((ver) => (
                        <TableRow key={ver.id}>
                          <TableCell className="font-medium">v{ver.version}</TableCell>
                          <TableCell>{new Date(ver.published_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>{ver.published_by}</TableCell>
                          <TableCell><span className={`text-xs px-2 py-0.5 rounded ${ver.requires_acceptance ? "status-active" : "status-inactive"}`}>{ver.requires_acceptance ? "Sim" : "Não"}</span></TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => { setViewContent(ver.content); setViewerOpen(true); }}><Eye className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Publicar Nova Versão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Conteúdo</Label><Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={12} /></div>
            <div className="flex items-center justify-between"><Label>Aceite obrigatório</Label><Switch checked={requiresAcceptance} onCheckedChange={setRequiresAcceptance} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button><Button onClick={publishVersion}>Publicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Visualizar Documento</DialogTitle></DialogHeader><div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">{viewContent}</div></DialogContent>
      </Dialog>
    </div>
  );
}
