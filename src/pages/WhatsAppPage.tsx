import { useState, useEffect, useCallback } from "react";
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
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<{ instanceId: string; qrcode: string | null; loading: boolean } | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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

  const handleGetQR = async (instanceId: string) => {
    setQrData({ instanceId, qrcode: null, loading: true });
    const data = await callManage("qrcode", { instance_id: instanceId });
    console.log("[WhatsApp] QR response:", JSON.stringify(data));
    const qrObj = data.qrcode || {};
    const rawQr = qrObj.qrcode || qrObj.base64 || qrObj.pairingCode || null;
    const qr = typeof rawQr === 'string' ? rawQr : null;
    setQrData({ instanceId, qrcode: qr, loading: false });
  };

  const handleCheckStatus = async (instanceId: string) => {
    setPollingId(instanceId);
    const data = await callManage("status", { instance_id: instanceId });
    setPollingId(null);

    if (data.status) {
      setInstances((prev) =>
        prev.map((i) => (i.id === instanceId ? { ...i, status: data.status, phone: data.detail?.phoneNumber || i.phone } : i))
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
          <Button size="sm" variant="outline" onClick={fetchInstances} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
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
            {instances.map((inst) => (
              <Card key={inst.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">
                        {inst.instance_display_name}
                      </CardTitle>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {inst.instance_name}
                      </p>
                    </div>
                    {statusBadge(inst.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {inst.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{inst.phone}</span>
                    </div>
                  )}

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
                      onClick={() => handleGetQR(inst.id)}
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
