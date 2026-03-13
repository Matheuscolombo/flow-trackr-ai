import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  RefreshCw,
  QrCode,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
  Phone,
  Copy,
  Check,
  Download,
  MessagesSquare,
  Pencil,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppInstance {
  id: string;
  workspace_id: string;
  instance_name: string;
  instance_display_name: string;
  phone: string | null;
  status: string;
  api_token: string | null;
  created_at: string;
  updated_at: string;
  profile_name: string | null;
  profile_pic_url: string | null;
  status_text: string | null;
}

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

async function callManage(action: string, params?: Record<string, string>, body?: unknown) {
  const queryStr = new URLSearchParams({ action, ...params }).toString();
  const session = (await supabase.auth.getSession()).data.session;
  const method = body ? "POST" : "GET";

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/uazapi-manage?${queryStr}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }
  );
  return res.json();
}

const WhatsAppPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<{ instanceId: string; qrcode: string | null; loading: boolean } | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importName, setImportName] = useState("");
  const [importDisplayName, setImportDisplayName] = useState("");
  const [importToken, setImportToken] = useState("");
  const [importServerUrl, setImportServerUrl] = useState("https://tracker1.uazapi.com");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPicFor, setUploadingPicFor] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    const data = await callManage("list");
    setInstances(data.instances || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const data = await callManage("create", {}, {
      name: newName.trim(),
      display_name: newDisplayName.trim() || newName.trim(),
    });
    setCreating(false);

    if (data.error) {
      toast({ title: "Erro ao criar instância", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Instância criada!", description: `"${newDisplayName || newName}" criada. Buscando QR Code...` });
      setDialogOpen(false);
      setNewName("");
      setNewDisplayName("");
      await fetchInstances();
      // Auto-fetch QR code after creation
      if (data.instance?.id) {
        setTimeout(() => handleConnect(data.instance.id), 2000);
      }
    }
  };

  const handleConnect = async (instanceId: string, phone?: string) => {
    setQrData({ instanceId, qrcode: null, loading: true });
    const body: Record<string, string> = { instance_id: instanceId };
    if (phone) body.phone = phone;
    const data = await callManage("connect", {}, body);
    console.log("[WhatsApp] connect response:", JSON.stringify(data));

    // Extract QR code or pairing code from response
    const rawQr =
      data.qrcode ||
      data.instance?.qrcode ||
      data.pairingCode ||
      data.paircode ||
      data.instance?.pairingCode ||
      data.instance?.paircode ||
      data.base64 ||
      data.instance?.base64 ||
      null;
    const qr = typeof rawQr === "string" && rawQr.trim().length > 0 ? rawQr : null;
    setQrData({ instanceId, qrcode: qr, loading: false });

    // Update local status to connecting
    setInstances((prev) =>
      prev.map((i) => (i.id === instanceId ? { ...i, status: "connecting" } : i))
    );
  };

  const handleCheckStatus = async (instanceId: string) => {
    setPollingId(instanceId);
    const data = await callManage("status", { instance_id: instanceId });
    setPollingId(null);

    if (data.status) {
      setInstances((prev) =>
        prev.map((i) => (i.id === instanceId ? {
          ...i,
          status: data.status,
          phone: data.detail?.instance?.owner || data.detail?.phoneNumber || i.phone,
          profile_name: data.detail?.instance?.profileName || i.profile_name,
          profile_pic_url: data.detail?.instance?.profilePicUrl || i.profile_pic_url,
        } : i))
      );
      if (data.status === "connected") {
        toast({ title: "Conectado!", description: "Instância WhatsApp conectada com sucesso." });
        setQrData(null);
      }
    }
  };

  const handleDelete = async (instanceId: string) => {
    const data = await callManage("delete", {}, { instance_id: instanceId });
    if (data.ok) {
      toast({ title: "Instância removida" });
      setInstances((prev) => prev.filter((i) => i.id !== instanceId));
    } else {
      toast({ title: "Erro ao remover", description: data.error, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!importName.trim() || !importToken.trim()) return;
    setImporting(true);
    const data = await callManage("import", {}, {
      name: importName.trim(),
      display_name: importDisplayName.trim() || importName.trim(),
      token: importToken.trim(),
      server_url: importServerUrl.trim() || undefined,
    });
    setImporting(false);

    if (data.error) {
      toast({ title: "Erro ao importar", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Instância importada!", description: `Status: ${data.status || "desconhecido"}` });
      setImportOpen(false);
      setImportName("");
      setImportDisplayName("");
      setImportToken("");
      setImportServerUrl("https://tracker1.uazapi.com");
      await fetchInstances();
    }
  };

  const handleUpdateProfile = async (instanceId: string, updates: { profile_name?: string; status_text?: string; profile_pic_base64?: string }) => {
    setUpdatingProfile(instanceId);
    const data = await callManage("update_profile", {}, { instance_id: instanceId, ...updates });
    setUpdatingProfile(null);

    if (data.ok) {
      setInstances((prev) =>
        prev.map((i) => {
          if (i.id !== instanceId) return i;
          return {
            ...i,
            ...(updates.profile_name !== undefined ? { profile_name: updates.profile_name } : {}),
            ...(updates.status_text !== undefined ? { status_text: updates.status_text } : {}),
            ...(data.updated?.profile_pic_url ? { profile_pic_url: data.updated.profile_pic_url } : {}),
          };
        })
      );
      toast({ title: "Perfil atualizado!" });
    } else {
      toast({ title: "Erro ao atualizar perfil", description: data.error, variant: "destructive" });
    }
  };

  const handlePhotoUpload = async (instanceId: string, file: File) => {
    setUploadingPicFor(instanceId);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await handleUpdateProfile(instanceId, { profile_pic_base64: base64 });
      setUploadingPicFor(null);
    };
    reader.readAsDataURL(file);
  };

  const handleNameSave = (instanceId: string) => {
    if (editingNameValue.trim()) {
      handleUpdateProfile(instanceId, { profile_name: editingNameValue.trim() });
    }
    setEditingName(null);
  };

  const handleStatusSave = (instanceId: string) => {
    handleUpdateProfile(instanceId, { status_text: editingStatusValue.trim() });
    setEditingStatus(null);
  };

  const copyToken = async (token: string, id: string) => {
    await navigator.clipboard.writeText(token);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]"><Wifi className="w-3 h-3 mr-1" />Conectado</Badge>;
      case "connecting":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Conectando</Badge>;
      default:
        return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px]"><WifiOff className="w-3 h-3 mr-1" />Desconectado</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-foreground">WhatsApp</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie suas instâncias WhatsApp via UAZAPI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate("/whatsapp/chat")}>
            <MessagesSquare className="w-3.5 h-3.5 mr-1.5" />
            Chat
          </Button>
          <Button size="sm" variant="outline" onClick={fetchInstances} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Importar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Importar Instância Existente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da Instância (slug)</Label>
                  <Input
                    placeholder="matheus-colombo-teste"
                    value={importName}
                    onChange={(e) => setImportName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome de Exibição</Label>
                  <Input
                    placeholder="Matheus Colombo Teste"
                    value={importDisplayName}
                    onChange={(e) => setImportDisplayName(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Token da Instância (UAZAPI)</Label>
                  <Input
                    placeholder="eec09ca7-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={importToken}
                    onChange={(e) => setImportToken(e.target.value)}
                    className="text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">Token gerado pela UAZAPI ao criar a instância</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Server URL</Label>
                  <Input
                    placeholder="https://tracker1.uazapi.com"
                    value={importServerUrl}
                    onChange={(e) => setImportServerUrl(e.target.value)}
                    className="text-sm font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">URL do servidor UAZAPI onde a instância está hospedada</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancelar</Button>
                </DialogClose>
                <Button size="sm" onClick={handleImport} disabled={importing || !importName.trim() || !importToken.trim()}>
                  {importing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                  Importar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Nova Instância
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Instância</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da Instância (slug)</Label>
                  <Input
                    placeholder="minha-instancia"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">Apenas letras minúsculas, números e hífens</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome de Exibição</Label>
                  <Input
                    placeholder="Minha Instância"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Cancelar</Button>
                </DialogClose>
                <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()}>
                  {creating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && instances.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">Nenhuma instância</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Crie uma instância WhatsApp para começar a receber mensagens
            </p>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nova Instância
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Hidden file input for photo upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                const targetId = fileInputRef.current?.dataset.instanceId;
                if (file && targetId) handlePhotoUpload(targetId, file);
                e.target.value = "";
              }}
            />
            {instances.map((inst) => (
              <Card key={inst.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Clickable photo */}
                      <button
                        className="relative group shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
                        disabled={inst.status !== "connected" || uploadingPicFor === inst.id}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.dataset.instanceId = inst.id;
                            fileInputRef.current.click();
                          }
                        }}
                        title={inst.status === "connected" ? "Clique para trocar a foto" : "Conecte a instância para trocar a foto"}
                      >
                        {uploadingPicFor === inst.id ? (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : inst.profile_pic_url ? (
                          <img
                            src={inst.profile_pic_url}
                            alt={inst.profile_name || inst.instance_display_name}
                            className="w-10 h-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        {inst.status === "connected" && uploadingPicFor !== inst.id && (
                          <div className="absolute inset-0 rounded-full bg-background/70 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="w-4 h-4 text-foreground" />
                          </div>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        {/* Editable name */}
                        {editingName === inst.id ? (
                          <Input
                            autoFocus
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => handleNameSave(inst.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(inst.id); if (e.key === "Escape") setEditingName(null); }}
                            className="h-6 text-sm font-semibold px-1 py-0"
                          />
                        ) : (
                          <button
                            className="flex items-center gap-1 group/name text-left max-w-full focus:outline-none"
                            onClick={() => {
                              if (inst.status !== "connected") return;
                              setEditingName(inst.id);
                              setEditingNameValue(inst.profile_name || inst.instance_display_name);
                            }}
                            disabled={inst.status !== "connected"}
                            title={inst.status === "connected" ? "Clique para editar o nome" : ""}
                          >
                            <CardTitle className="text-sm font-semibold truncate">
                              {inst.profile_name || inst.instance_display_name}
                            </CardTitle>
                            {inst.status === "connected" && (
                              <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/name:opacity-100 shrink-0 transition-opacity" />
                            )}
                          </button>
                        )}
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {inst.instance_name}
                        </p>
                        {inst.phone && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            +{inst.phone}
                          </p>
                        )}
                        {/* Editable status/about */}
                        {editingStatus === inst.id ? (
                          <Input
                            autoFocus
                            value={editingStatusValue}
                            onChange={(e) => setEditingStatusValue(e.target.value)}
                            onBlur={() => handleStatusSave(inst.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleStatusSave(inst.id); if (e.key === "Escape") setEditingStatus(null); }}
                            className="h-5 text-[10px] px-1 py-0 mt-0.5"
                            placeholder="Status / About"
                          />
                        ) : (
                          <button
                            className="flex items-center gap-1 group/status text-left max-w-full focus:outline-none mt-0.5"
                            onClick={() => {
                              if (inst.status !== "connected") return;
                              setEditingStatus(inst.id);
                              setEditingStatusValue(inst.status_text || "");
                            }}
                            disabled={inst.status !== "connected"}
                            title={inst.status === "connected" ? "Clique para editar o status" : ""}
                          >
                            <span className="text-[10px] text-muted-foreground italic truncate">
                              {inst.status_text || (inst.status === "connected" ? "Adicionar status..." : "")}
                            </span>
                            {inst.status === "connected" && (
                              <Pencil className="w-2 h-2 text-muted-foreground opacity-0 group-hover/status:opacity-100 shrink-0 transition-opacity" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {statusBadge(inst.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">

                  {inst.api_token && (
                    <div className="flex items-center gap-1.5">
                      <code className="text-[9px] text-muted-foreground bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                        {inst.api_token.slice(0, 20)}…
                      </code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => copyToken(inst.api_token!, inst.id)}
                      >
                        {copied === inst.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  )}

                  {/* QR Code display */}
                  {qrData?.instanceId === inst.id && (
                    <div className="border border-border rounded-md p-3 bg-background">
                      {qrData.loading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : qrData.qrcode ? (
                        <div className="space-y-2">
                          {qrData.qrcode.startsWith("data:") || qrData.qrcode.startsWith("http") ? (
                            <img
                              src={qrData.qrcode}
                              alt="QR Code"
                              className="w-full max-w-[200px] mx-auto rounded"
                            />
                          ) : (
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground mb-1">Código de pareamento:</p>
                              <code className="text-lg font-bold text-foreground tracking-widest">{qrData.qrcode}</code>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground text-center">
                            Escaneie com o WhatsApp no celular
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground text-center py-4">
                          QR Code não disponível. Tente novamente.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7 flex-1"
                      onClick={() => handleConnect(inst.id)}
                      disabled={inst.status === "connected"}
                    >
                      <QrCode className="w-3 h-3 mr-1" />
                      QR Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7 flex-1"
                      onClick={() => handleCheckStatus(inst.id)}
                      disabled={pollingId === inst.id}
                    >
                      {pollingId === inst.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      Status
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-[11px] h-7 text-destructive hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover instância?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso removerá "{inst.instance_display_name}" do Sentinel e da UAZAPI. Mensagens já salvas serão mantidas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(inst.id)}>
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppPage;
