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
  Clock,
  Check,
  CheckCheck,
  PanelRightOpen,
  PanelRightClose,
  Trash2,
  MoreVertical,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContactPanel } from "@/components/whatsapp/ContactPanel";

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
  profile_pic_url: string | null;
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
  if (file.type.startsWith("video/")) return "video";
  // .ogg audio files should be sent as PTT (voice note) via the API,
  // but stored as "audio" in DB for the player to work
  if (file.type.startsWith("audio/") || file.name.endsWith(".ogg")) return "audio";
  return "document";
}

/** Message status indicator (✓ ✓✓ blue ✓✓) */
function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Clock className="w-3 h-3" />;
    case "sent":
    case "SERVER_ACK":
      return <Check className="w-3 h-3" />;
    case "delivered":
    case "DELIVERY_ACK":
      return <CheckCheck className="w-3 h-3" />;
    case "read":
    case "READ":
    case "PLAYED":
      return <CheckCheck className="w-3 h-3 text-blue-400" />;
    case "failed":
    case "ERROR":
      return <span className="text-[9px]">!</span>;
    default:
      return <Check className="w-3 h-3" />;
  }
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

/** Image lightbox modal */
function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white z-50"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="Imagem"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      <a
        href={src}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-6 right-6 bg-white/20 hover:bg-white/30 text-white rounded-full p-3 backdrop-blur-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <Download className="w-5 h-5" />
      </a>
    </div>
  );
}

/** Audio player with speed controls and progress */
function AudioPlayer({ src, mime, isOutbound }: { src: string; mime: string | null; isOutbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState(false);

  // Normalize mime for <source> tag
  const sourceType = (mime || "audio/ogg").replace("; codecs=opus", "");

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => setError(true));
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * duration;
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 py-1 text-[10px] opacity-70">
        <Volume2 className="w-3.5 h-3.5" />
        <span>Áudio indisponível</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onTimeUpdate={() => {
          if (audioRef.current) setProgress(audioRef.current.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onError={() => setError(true)}
      >
        <source src={src} type={sourceType} />
      </audio>
      <button
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          isOutbound ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" : "bg-foreground/10 hover:bg-foreground/15"
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className={`h-1.5 rounded-full cursor-pointer ${
            isOutbound ? "bg-primary-foreground/20" : "bg-foreground/10"
          }`}
          onClick={handleSeek}
        >
          <div
            className={`h-full rounded-full transition-all ${
              isOutbound ? "bg-primary-foreground/60" : "bg-foreground/40"
            }`}
            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[9px] opacity-60">
            {formatTime(playing ? progress : duration)}
          </span>
          <button
            onClick={cycleSpeed}
            className="text-[9px] opacity-60 hover:opacity-100 font-medium"
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
}

/** Render media content inside message bubble */
function MediaContent({ msg, onImageClick }: { msg: Message; onImageClick: (url: string) => void }) {
  const { message_type, media_url, media_mime_type, body, direction } = msg;
  const isOutbound = direction === "outbound";
  const [imgError, setImgError] = useState(false);

  if (!media_url) {
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

    if (imgError) {
      return (
        <div>
          <div className="flex items-center gap-1.5 py-2 text-[10px] opacity-70">
            <Image className="w-3.5 h-3.5" />
            <span>Imagem indisponível</span>
            <a href={media_url} target="_blank" rel="noopener noreferrer" className="underline ml-1">
              <Download className="w-3 h-3 inline" />
            </a>
          </div>
          {captionEl}
        </div>
      );
    }

    return (
      <div>
        <div className="relative group cursor-pointer" onClick={() => onImageClick(media_url)}>
          <img
            src={media_url}
            alt="Imagem"
            className="rounded max-w-full max-h-60 object-contain"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg" />
          </div>
        </div>
        {captionEl}
      </div>
    );
  }

  if (message_type === "audio") {
    return (
      <div>
        <AudioPlayer src={media_url} mime={media_mime_type} isOutbound={isOutbound} />
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
          preload="metadata"
        >
          <source src={media_url} type={media_mime_type || "video/mp4"} />
          Vídeo não suportado
        </video>
        {captionEl}
      </div>
    );
  }

  // document / other
  const fileName = body || "Documento";
  const isPdf = (media_mime_type || "").includes("pdf");

  return (
    <div>
      <a
        href={media_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 py-2 px-3 rounded text-xs ${
          isOutbound ? "bg-primary-foreground/10 hover:bg-primary-foreground/15" : "bg-foreground/5 hover:bg-foreground/10"
        } transition-colors`}
      >
        <FileText className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="truncate block font-medium">{fileName}</span>
          {isPdf && <span className="text-[9px] opacity-60">PDF</span>}
        </div>
        <Download className="w-4 h-4 shrink-0 opacity-70" />
      </a>
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showContactPanel, setShowContactPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialChatsLoaded = useRef(false);
  const selectedChatRef = useRef<Chat | null>(null);
  const [deletingChat, setDeletingChat] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingOriginalText, setEditingOriginalText] = useState("");
  const lastPresenceSent = useRef(0);

  // Delete all messages for a chat (phone)
  const handleDeleteChat = async (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Excluir todas as mensagens de ${phone}?`)) return;
    setDeletingChat(phone);
    try {
      const { error } = await supabase
        .from("whatsapp_messages")
        .delete()
        .eq("phone", phone)
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      setChats((prev) => prev.filter((c) => c.phone !== phone));
      if (selectedChat?.phone === phone) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("[deleteChat]", err);
      alert("Erro ao excluir conversa.");
    } finally {
      setDeletingChat(null);
    }
  };

  const accessToken = session?.access_token || "";

  // Send presence (composing/recording) — debounced
  const sendPresence = useCallback(async (presence: "composing" | "recording") => {
    const now = Date.now();
    if (now - lastPresenceSent.current < 25000) return;
    const chat = selectedChatRef.current;
    const instanceId = chat?.instance_id || chats.find(c => c.instance_id)?.instance_id;
    if (!chat || !instanceId || !accessToken) return;
    lastPresenceSent.current = now;
    try {
      await postApi("whatsapp-presence", accessToken, {
        instance_id: instanceId,
        remote_jid: chat.remote_jid,
        presence,
        delay: 30000,
      });
    } catch (e) {
      console.error("[presence]", e);
    }
  }, [accessToken, chats]);

  // Handle typing → send composing presence (skip when editing)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (e.target.value.trim() && !editingMessageId) sendPresence("composing");
  };

  // Delete individual message
  const handleDeleteMessage = async (msg: Message) => {
    // Remove from UI immediately (optimistic), matching both local temp and server ids
    setMessages((prev) =>
      prev.filter((m) => m.id !== msg.id && m.message_id !== msg.message_id)
    );

    // If user is editing this same message, reset edit mode
    setEditingMessageId((prev) => (prev === msg.id ? null : prev));
    if (editingMessageId === msg.id) {
      setEditingOriginalText("");
      setMessageText("");
    }

    if (!workspaceId) return;

    let deleteQuery = supabase
      .from("whatsapp_messages")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("phone", msg.phone);

    // Temp local messages don't have a real DB id yet
    if (msg.id.startsWith("temp_")) {
      deleteQuery = deleteQuery.eq("message_id", msg.message_id);
    } else {
      deleteQuery = deleteQuery.eq("id", msg.id);
    }

    const { error } = await deleteQuery;
    if (error) {
      console.error("[deleteMsg]", error);
      // Reload messages on failure
      if (selectedChatRef.current) loadMessages(selectedChatRef.current.phone);
      return;
    }

    // Keep chat preview/count in sync after delete
    await loadChats();
    if (selectedChatRef.current?.phone === msg.phone) {
      await loadMessages(msg.phone);
    }
  };

  // Start editing message
  const startEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingOriginalText(msg.body || "");
    setMessageText(msg.body || "");
  };

  // Save edited message
  const saveEditMessage = async () => {
    if (!editingMessageId) return;
    const newBody = messageText.trim();
    if (!newBody) return;

    const editingMessage = messages.find((m) => m.id === editingMessageId);
    if (!editingMessage || !workspaceId) return;

    let updateQuery = supabase
      .from("whatsapp_messages")
      .update({ body: newBody })
      .eq("workspace_id", workspaceId)
      .eq("phone", editingMessage.phone);

    if (editingMessage.id.startsWith("temp_")) {
      updateQuery = updateQuery.eq("message_id", editingMessage.message_id);
    } else {
      updateQuery = updateQuery.eq("id", editingMessage.id);
    }

    const { error } = await updateQuery;
    if (error) {
      console.error("[editMsg]", error);
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === editingMessage.id || m.message_id === editingMessage.message_id
          ? { ...m, body: newBody }
          : m
      )
    );

    setEditingMessageId(null);
    setEditingOriginalText("");
    setMessageText("");

    // Keep chat preview synced after edit
    await loadChats();
    if (selectedChatRef.current?.phone === editingMessage.phone) {
      await loadMessages(editingMessage.phone);
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingOriginalText("");
    setMessageText("");
  };

  // Load chat list
  const loadChats = useCallback(async () => {
    if (!accessToken) return;
    try {
      // Only show spinner on first load, not on background polls
      if (!initialChatsLoaded.current) {
        setLoadingChats(true);
      }
      const data = await fetchApi("whatsapp-chats?action=list_chats", accessToken);
      setChats(data.chats || []);
      initialChatsLoaded.current = true;
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
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "instant" }), 100);
    } catch (e) {
      console.error("[loadMessages] error:", e);
    } finally {
      setLoadingMessages(false);
    }
  }, [accessToken]);

  // Keep ref in sync
  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

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
          const eventType = payload.eventType;
          const newMsg = payload.new as Message;

          // Handle UPDATE events (status/body edits)
          if (eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === newMsg.id || m.message_id === newMsg.message_id
                  ? { ...m, ...newMsg }
                  : m
              )
            );
            return;
          }

          // Handle DELETE events
          if (eventType === "DELETE") {
            const oldMsg = payload.old as Partial<Message>;
            setMessages((prev) =>
              prev.filter(
                (m) =>
                  m.id !== oldMsg.id &&
                  m.message_id !== oldMsg.message_id
              )
            );
            return;
          }

          // INSERT events below

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
                  profile_pic_url: null,
                  message_count: 1,
                },
                ...prev,
              ];
            }
          });

          // If this chat is selected, add message (smart scroll)
          const current = selectedChatRef.current;
          if (current && current.phone === newMsg.phone) {
            setMessages((prev) => {
              // Exact message_id match — skip duplicate
              if (prev.some((m) => m.message_id === newMsg.message_id)) return prev;
              // Dedup: if there's a pending outbound msg for same phone within 10s, replace it
              if (newMsg.direction === "outbound") {
                const newTs = new Date(newMsg.timestamp_msg).getTime();
                const pendingIdx = prev.findIndex(
                  (m) =>
                    m.status === "pending" &&
                    m.direction === "outbound" &&
                    m.message_id.startsWith("temp_") &&
                    m.phone === newMsg.phone &&
                    Math.abs(new Date(m.timestamp_msg).getTime() - newTs) < 10000
                );
                if (pendingIdx !== -1) {
                  const updated = [...prev];
                  updated[pendingIdx] = newMsg;
                  return updated;
                }
              }
              const updated = [...prev, newMsg];
              // Only auto-scroll if user is near the bottom
              setTimeout(() => {
                const el = messagesEndRef.current;
                if (!el) return;
                const container = el.closest('[data-radix-scroll-area-viewport]');
                if (!container) { el.scrollIntoView({ behavior: "smooth" }); return; }
                const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
                if (distFromBottom < 150) {
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }, 50);
              return updated;
            });
          }
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

  // Message polling removed — realtime handles new messages

  const fallbackInstanceId = chats.find(c => c.instance_id)?.instance_id || null;

  // Send text message (optimistic)
  const handleSend = async () => {
    if (!messageText.trim() || !selectedChat || sending) return;
    const text = messageText.trim();
    const instanceId = selectedChat.instance_id || fallbackInstanceId;
    if (!instanceId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMsg: Message = {
      id: tempId,
      phone: selectedChat.phone,
      remote_jid: selectedChat.remote_jid,
      body: text,
      direction: "outbound",
      message_type: "text",
      timestamp_msg: new Date().toISOString(),
      status: "pending",
      media_url: null,
      media_mime_type: null,
      lead_id: selectedChat.lead_id || null,
      instance_id: instanceId,
      message_id: tempId,
    };

    // Add optimistic message and clear input immediately
    setMessages((prev) => [...prev, optimisticMsg]);
    setMessageText("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await postApi("whatsapp-send", accessToken, {
        instance_id: instanceId,
        remote_jid: selectedChat.remote_jid,
        text,
      });
      if (res && res.ok) {
        // Update optimistic message with real message_id and status
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, message_id: res.message_id || tempId, status: "sent" }
              : m
          )
        );
      } else {
        // Mark as failed
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed" } : m
          )
        );
        const detail = res?.attempts?.map((a: any) => `${a.label}: ${a.status}`).join(", ") || res?.error || "Erro desconhecido";
        alert(`Falha ao enviar mensagem. Detalhes: ${detail}`);
      }
    } catch (err) {
      console.error("[handleSend] send failed:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m
        )
      );
      alert("Erro ao enviar mensagem. Verifique sua conexão.");
    }
  };

  // Send file (optimistic)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || uploading) return;

    const instanceId = selectedChat.instance_id || fallbackInstanceId;
    if (!instanceId) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const mediaType = detectMediaType(file);
    const lowerMime = (file.type || "").toLowerCase();
    const lowerName = (file.name || "").toLowerCase();
    const isVoiceNoteOgg = lowerMime.includes("audio/ogg") || lowerName.endsWith(".ogg");
    const sendMediaType = isVoiceNoteOgg ? "ptt" : mediaType;

    // Send "recording" presence for audio files
    if (mediaType === "audio") {
      lastPresenceSent.current = 0; // Force send
      sendPresence("recording");
    }

    const localPreviewUrl = URL.createObjectURL(file);

    const optimisticMsg: Message = {
      id: tempId,
      phone: selectedChat.phone,
      remote_jid: selectedChat.remote_jid,
      body: messageText.trim() || file.name,
      direction: "outbound",
      message_type: mediaType,
      timestamp_msg: new Date().toISOString(),
      status: "pending",
      media_url: mediaType === "image" ? localPreviewUrl : null,
      media_mime_type: file.type || null,
      lead_id: selectedChat.lead_id || null,
      instance_id: instanceId,
      message_id: tempId,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    const captionText = messageText.trim();
    setMessageText("");
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${workspaceId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      
      const { error: uploadErr } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { contentType: file.type });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data: urlData } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;
      if (!publicUrl) throw new Error("Não foi possível gerar URL pública");

      const res = await postApi("whatsapp-send", accessToken, {
        instance_id: instanceId,
        remote_jid: selectedChat.remote_jid,
        mediaUrl: publicUrl,
        mediaType: sendMediaType,
        mediaMimeType: file.type || undefined,
        caption: captionText || undefined,
        fileName: file.name,
      });

      if (res && res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? { ...m, message_id: res.message_id || tempId, status: "sent", media_url: publicUrl }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...m, status: "failed" } : m
          )
        );
        alert(`Falha ao enviar arquivo: ${res?.error || "Erro"}`);
      }
    } catch (err) {
      console.error("[handleFileSelect] error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: "failed" } : m
        )
      );
      alert("Erro ao enviar arquivo. Verifique sua conexão.");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessageId) {
        saveEditMessage();
      } else {
        handleSend();
      }
    }
    if (e.key === "Escape" && editingMessageId) {
      cancelEdit();
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
    <>
      {lightboxUrl && (
        <ImageModal src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
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
                <div
                  key={chat.phone}
                  className={`relative group flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer ${
                    selectedChat?.phone === chat.phone ? "bg-muted" : ""
                  }`}
                  onClick={() => setSelectedChat(chat)}
                >
                  {chat.profile_pic_url ? (
                    <img src={chat.profile_pic_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>'); }} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
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
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDeleteChat(chat.phone, e)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
                    title="Excluir conversa"
                    disabled={deletingChat === chat.phone}
                  >
                    {deletingChat === chat.phone ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-destructive/70 hover:text-destructive" />
                    )}
                  </button>
                </div>
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
              {selectedChat.profile_pic_url ? (
                <img src={selectedChat.profile_pic_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {selectedChat.contact_name || selectedChat.phone}
                </h3>
                {selectedChat.contact_name && (
                  <p className="text-[10px] text-muted-foreground">{selectedChat.phone}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 hidden lg:flex"
                onClick={() => setShowContactPanel(!showContactPanel)}
                title={showContactPanel ? "Fechar painel" : "Info do contato"}
              >
                {showContactPanel ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </Button>
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
                          className={`flex mb-1 group/msg ${
                            msg.direction === "outbound" ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div className="relative max-w-[75%]">
                            <div
                              className={`rounded-lg px-3 py-1.5 ${
                                msg.direction === "outbound"
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-muted text-foreground rounded-bl-sm"
                              }`}
                            >
                              {msg.message_type !== "text" ? (
                                <MediaContent msg={msg} onImageClick={(url) => setLightboxUrl(url)} />
                              ) : msg.body ? (
                                <p className="text-xs whitespace-pre-wrap break-words">
                                  {msg.body}
                                </p>
                              ) : null}
                              {msg.message_type === "text" && !msg.body && (
                                <p className="text-[10px] italic opacity-70">[mensagem vazia]</p>
                              )}
                              <div
                                className={`flex items-center justify-end gap-1 mt-0.5 ${
                                  msg.direction === "outbound"
                                    ? "text-primary-foreground/60"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <span className="text-[9px]">
                                  {formatMessageTime(msg.timestamp_msg)}
                                </span>
                                {msg.direction === "outbound" && (
                                  <MessageStatusIcon status={msg.status} />
                                )}
                              </div>
                            </div>
                            {/* Message context menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={`absolute top-1 opacity-0 group-hover/msg:opacity-100 transition-opacity p-0.5 rounded hover:bg-foreground/10 ${
                                    msg.direction === "outbound" ? "-left-6" : "-right-6"
                                  }`}
                                >
                                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="left" align="start" className="min-w-[120px]">
                                {msg.direction === "outbound" && msg.message_type === "text" && (
                                  <DropdownMenuItem onSelect={() => startEditMessage(msg)} className="text-xs gap-2">
                                    <Pencil className="w-3.5 h-3.5" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onSelect={() => handleDeleteMessage(msg)} className="text-xs gap-2 text-destructive focus:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
            <div className="px-4 py-3 border-t border-border">
              {editingMessageId && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-muted/50 rounded border border-border text-xs text-muted-foreground">
                  <Pencil className="w-3 h-3 shrink-0" />
                  <span className="flex-1 truncate">Editando mensagem</span>
                  <button onClick={cancelEdit} className="hover:text-foreground shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt"
                  onChange={handleFileSelect}
                />
                {!editingMessageId && (
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
                )}
                <Input
                  placeholder={editingMessageId ? "Edite a mensagem..." : "Digite uma mensagem..."}
                  value={messageText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className={`flex-1 text-xs ${editingMessageId ? "border-primary" : ""}`}
                  disabled={sending || uploading}
                />
                <Button
                  size="icon"
                  onClick={editingMessageId ? saveEditMessage : handleSend}
                  disabled={!messageText.trim() || sending || uploading}
                  className="shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingMessageId ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
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

      {/* Right: Contact Panel */}
      {selectedChat && showContactPanel && (
        <ContactPanel
          phone={selectedChat.phone}
          leadId={selectedChat.lead_id}
          contactName={selectedChat.contact_name}
          profilePicUrl={selectedChat.profile_pic_url}
          instanceId={selectedChat.instance_id}
          onClose={() => setShowContactPanel(false)}
        />
      )}
    </div>
    </>
  );
};

export default WhatsAppChatPage;
