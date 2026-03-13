import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Search,
  Phone,
  User,
  Loader2,
  ChevronLeft,
  RefreshCw,
  Paperclip,
  Image,
  FileText,
  Download,
  X,
  Play,
  Pause,
  Volume2,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface Chat {
  phone: string;
  remote_jid: string;
  last_message: string;
  last_message_type: string;
  last_direction: string;
  last_timestamp: string;
  instance_id: string | null;
  lead_id: string | null;
  contact_name: string | null;
  message_count: number;
}

interface Message {
  id: string;
  phone: string;
  remote_jid: string;
  body: string | null;
  direction: string;
  message_type: string;
  timestamp_msg: string;
  status: string;
  media_url: string | null;
  media_mime_type: string | null;
  lead_id: string | null;
  instance_id: string | null;
  message_id: string;
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM", { locale: ptBR });
}

function formatMessageTime(ts: string) {
  return format(new Date(ts), "HH:mm");
}

function formatDateSeparator(ts: string) {
  const d = new Date(ts);
  if (isToday(d)) return "Hoje";
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd 'de' MMMM", { locale: ptBR });
}

function mediaTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    image: "📷 Foto",
    audio: "🎤 Áudio",
    video: "🎬 Vídeo",
    document: "📄 Documento",
    sticker: "🩷 Sticker",
    media: "📎 Mídia",
  };
  return labels[type] || `[${type}]`;
}

function detectMediaType(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

async function fetchApi(path: string, token: string) {
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/${path}`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function postApi(path: string, token: string, body: unknown) {
  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Render media content inside message bubble */
function MediaContent({ msg }: { msg: Message }) {
  const { message_type, media_url, media_mime_type, body, direction } = msg;
  const isOutbound = direction === "outbound";

  if (!media_url) {
    // No URL available — show type label
    return (
      <p className="text-[10px] italic opacity-70">
        {mediaTypeLabel(message_type)}
        {body && <span className="not-italic block mt-1 text-xs">{body}</span>}
      </p>
    );
  }

  const captionEl = body ? (
    <p className="text-xs whitespace-pre-wrap break-words mt-1">{body}</p>
  ) : null;

  if (message_type === "image" || message_type === "sticker") {
    return (
      <div>
        <a href={media_url} target="_blank" rel="noopener noreferrer">
          <img
            src={media_url}
            alt="Imagem"
            className="rounded max-w-full max-h-60 object-contain cursor-pointer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div className="hidden items-center gap-1.5 py-2 text-[10px] opacity-70">
            <Image className="w-3.5 h-3.5" />
            <span>Imagem expirada</span>
          </div>
        </a>
        {captionEl}
      </div>
    );
  }

  if (message_type === "audio") {
    return (
      <div>
        <audio controls className="max-w-full h-10" preload="none">
          <source src={media_url} type={media_mime_type || "audio/ogg"} />
          Áudio não suportado
        </audio>
        {captionEl}
      </div>
    );
  }

  if (message_type === "video") {
    return (
      <div>
        <video
          controls
          className="rounded max-w-full max-h-60"
          preload="none"
        >
          <source src={media_url} type={media_mime_type || "video/mp4"} />
          Vídeo não suportado
        </video>
        {captionEl}
      </div>
    );
  }

  // document / other
  return (
    <div>
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 py-1.5 px-2 rounded text-xs ${
          isOutbound ? "bg-primary-foreground/10" : "bg-foreground/5"
        }`}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate flex-1">{body || "Documento"}</span>
        <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </a>
      {body && captionEl}
    </div>
  );
}

const WhatsAppChatPage = () => {
  const { session, workspaceId } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accessToken = session?.access_token || "";

  // Load chat list
  const loadChats = useCallback(async () => {
    if (!accessToken) return;
    try {
      setLoadingChats(true);
      const data = await fetchApi("whatsapp-chats?action=list_chats", accessToken);
      setChats(data.chats || []);
    } catch (e) {
      console.error("[loadChats] error:", e);
    } finally {
      setLoadingChats(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Load messages for selected chat
  const loadMessages = useCallback(async (phone: string) => {
    if (!accessToken) return;
    try {
      setLoadingMessages(true);
      const data = await fetchApi(
        `whatsapp-chats?action=messages&phone=${encodeURIComponent(phone)}`,
        accessToken
      );
      setMessages(data.messages || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (e) {
      console.error("[loadMessages] error:", e);
    } finally {
      setLoadingMessages(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.phone);
    }
  }, [selectedChat, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!workspaceId) return;

    const channel = supabase
      .channel("whatsapp-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;

          // Update chat list
          setChats((prev) => {
            const preview = newMsg.message_type === "text"
              ? (newMsg.body || "")
              : (newMsg.body ? `${mediaTypeLabel(newMsg.message_type)} ${newMsg.body}` : mediaTypeLabel(newMsg.message_type));

            const existing = prev.find((c) => c.phone === newMsg.phone);
            if (existing) {
              const updated = prev.map((c) =>
                c.phone === newMsg.phone
                  ? {
                      ...c,
                      last_message: preview,
                      last_message_type: newMsg.message_type,
                      last_direction: newMsg.direction,
                      last_timestamp: newMsg.timestamp_msg,
                      message_count: c.message_count + 1,
                    }
                  : c
              );
              return updated.sort(
                (a, b) =>
                  new Date(b.last_timestamp).getTime() -
                  new Date(a.last_timestamp).getTime()
              );
            } else {
              return [
                {
                  phone: newMsg.phone,
                  remote_jid: newMsg.remote_jid,
                  last_message: preview,
                  last_message_type: newMsg.message_type,
                  last_direction: newMsg.direction,
                  last_timestamp: newMsg.timestamp_msg,
                  instance_id: newMsg.instance_id,
                  lead_id: newMsg.lead_id,
                  contact_name: null,
                  message_count: 1,
                },
                ...prev,
              ];
            }
          });

          // If this chat is selected, add message
          setSelectedChat((current) => {
            if (current && current.phone === newMsg.phone) {
              setMessages((prev) => {
                if (prev.some((m) => m.message_id === newMsg.message_id)) return prev;
                const updated = [...prev, newMsg];
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                return updated;
              });
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  // Polling
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(() => { loadChats(); }, 10000);
    return () => clearInterval(interval);
  }, [accessToken, loadChats]);

  useEffect(() => {
    if (!accessToken || !selectedChat) return;
    const interval = setInterval(() => { loadMessages(selectedChat.phone); }, 10000);
    return () => clearInterval(interval);
  }, [accessToken, selectedChat, loadMessages]);

  const fallbackInstanceId = chats.find(c => c.instance_id)?.instance_id || null;

  // Send text message
  const handleSend = async () => {
    if (!messageText.trim() || !selectedChat || sending) return;
    const text = messageText.trim();
    const instanceId = selectedChat.instance_id || fallbackInstanceId;
    if (!instanceId) return;
    setSending(true);

    try {
      const res = await postApi("whatsapp-send", accessToken, {
        instance_id: instanceId,
        remote_jid: selectedChat.remote_jid,
        text,
      });
      if (res && res.ok) {
        setMessageText("");
        await loadMessages(selectedChat.phone);
      } else {
        const detail = res?.attempts?.map((a: any) => `${a.label}: ${a.status}`).join(", ") || res?.error || "Erro desconhecido";
        alert(`Falha ao enviar mensagem. Detalhes: ${detail}`);
      }
    } catch (err) {
      console.error("[handleSend] send failed:", err);
      alert("Erro ao enviar mensagem. Verifique sua conexão.");
    } finally {
      setSending(false);
    }
  };

  // Send file
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || uploading) return;

    const instanceId = selectedChat.instance_id || fallbackInstanceId;
    if (!instanceId) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    setUploading(true);
    try {
      // Upload to storage
      const ext = file.name.split(".").pop() || "bin";
      const path = `${workspaceId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { contentType: file.type });

      if (uploadErr) throw new Error(uploadErr.message);

      // Get public URL
      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      if (!publicUrl) throw new Error("Não foi possível gerar URL pública");

      const mediaType = detectMediaType(file);

      const res = await postApi("whatsapp-send", accessToken, {
        instance_id: instanceId,
        remote_jid: selectedChat.remote_jid,
        mediaUrl: publicUrl,
        mediaType,
        caption: messageText.trim() || undefined,
        fileName: file.name,
      });

      if (res && res.ok) {
        setMessageText("");
        await loadMessages(selectedChat.phone);
      } else {
        const detail = res?.error || "Erro ao enviar arquivo";
        alert(`Falha ao enviar arquivo: ${detail}`);
      }
    } catch (err) {
      console.error("[handleFileSelect] error:", err);
      alert("Erro ao enviar arquivo. Verifique sua conexão.");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Sync historical messages
  const handleSync = async () => {
    if (syncing || !accessToken) return;
    try {
      const instData = await fetchApi("uazapi-manage?action=list", accessToken);
      const instances = instData.instances || [];
      if (instances.length === 0) return;
      const connected = instances.find((i: { status: string }) => i.status === "connected") || instances[0];
      await runSync(connected.id);
    } catch (e) {
      console.error("[sync] handleSync error:", e);
      setSyncing(false);
      setSyncProgress("");
    }
  };

  const runSync = async (instanceId: string) => {
    setSyncing(true);
    setSyncProgress("Buscando conversas...");
    let totalSynced = 0;
    let hasMore = true;
    let chatCursor = 0;
    let chatList: unknown[] = [];

    while (hasMore) {
      try {
        const result = await postApi("uazapi-manage?action=sync_messages", accessToken, {
          instance_id: instanceId,
          chat_cursor: chatCursor,
          chat_list: chatList,
        });

        if (result.error && !result.hasMore) {
          setSyncProgress(`Erro: ${result.error}`);
          await new Promise(r => setTimeout(r, 2000));
          break;
        }

        totalSynced += result.synced || 0;
        hasMore = result.hasMore === true;
        chatCursor = result.chatCursor || chatCursor + 1;
        chatList = result.chat_list || chatList;
        setSyncProgress(`Sincronizando... ${chatCursor}/${result.totalChats || "?"} conversas (${totalSynced} msgs)`);

        if (hasMore) await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        setSyncProgress("Erro de conexão");
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    setSyncing(false);
    setSyncProgress(totalSynced > 0 ? `✓ ${totalSynced} mensagens sincronizadas` : "");
    if (totalSynced > 0) setTimeout(() => setSyncProgress(""), 3000);
    await loadChats();
    if (selectedChat) await loadMessages(selectedChat.phone);
  };

  const filteredChats = searchQuery
    ? chats.filter(
        (c) =>
          c.phone.includes(searchQuery) ||
          (c.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chats;

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = format(new Date(msg.timestamp_msg), "yyyy-MM-dd");
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: msg.timestamp_msg, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Chat List */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col shrink-0 ${
          selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground flex-1">Conversas</h2>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={handleSync}
            disabled={syncing}
            title="Sincronizar histórico"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Sync progress */}
        {syncing && syncProgress && (
          <div className="px-4 py-1.5 bg-primary/5 border-b border-border">
            <p className="text-[10px] text-primary animate-pulse">{syncProgress}</p>
          </div>
        )}

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Chat list */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {searchQuery ? "Nenhum contato encontrado" : "Nenhuma conversa ainda"}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredChats.map((chat) => (
                <button
                  key={chat.phone}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                    selectedChat?.phone === chat.phone ? "bg-muted" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground truncate">
                        {chat.contact_name || chat.phone}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatTimestamp(chat.last_timestamp)}
                      </span>
                    </div>
                    {chat.contact_name && (
                      <p className="text-[10px] text-muted-foreground truncate">{chat.phone}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {chat.last_direction === "outbound" && (
                        <span className="text-primary/60">Você: </span>
                      )}
                      {chat.last_message}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Center: Message Thread */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          !selectedChat ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedChat ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 md:hidden shrink-0"
                onClick={() => setSelectedChat(null)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {selectedChat.contact_name || selectedChat.phone}
                </h3>
                {selectedChat.contact_name && (
                  <p className="text-[10px] text-muted-foreground">{selectedChat.phone}</p>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma mensagem</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedMessages.map((group, gi) => (
                    <div key={gi}>
                      {/* Date separator */}
                      <div className="flex items-center justify-center my-3">
                        <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                          {formatDateSeparator(group.date)}
                        </span>
                      </div>
                      {group.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex mb-1 ${
                            msg.direction === "outbound" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-1.5 ${
                              msg.direction === "outbound"
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted text-foreground rounded-bl-sm"
                            }`}
                          >
                            {msg.message_type !== "text" ? (
                              <MediaContent msg={msg} />
                            ) : msg.body ? (
                              <p className="text-xs whitespace-pre-wrap break-words">
                                {msg.body}
                              </p>
                            ) : null}
                            {/* For text-only messages with no body */}
                            {msg.message_type === "text" && !msg.body && (
                              <p className="text-[10px] italic opacity-70">[mensagem vazia]</p>
                            )}
                            <p
                              className={`text-[9px] mt-0.5 text-right ${
                                msg.direction === "outbound"
                                  ? "text-primary-foreground/60"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {formatMessageTime(msg.timestamp_msg)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input bar */}
            <div className="px-4 py-3 border-t border-border flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
                onChange={handleFileSelect}
              />
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading}
                title="Enviar arquivo"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Paperclip className="w-4 h-4" />
                )}
              </Button>
              <Input
                placeholder="Digite uma mensagem..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 text-xs"
                disabled={sending || uploading}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!messageText.trim() || sending || uploading}
                className="shrink-0"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-primary/50" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">WhatsApp Chat</h3>
            <p className="text-xs text-muted-foreground">
              Selecione uma conversa para começar
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatsAppChatPage;
