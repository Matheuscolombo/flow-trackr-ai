import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  workspaceId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Guard to prevent concurrent ensureWorkspace calls (race condition fix)
  const ensureRunning = useRef(false);

  useEffect(() => {
    // Load session first, THEN subscribe to changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        ensureWorkspace(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Only run on explicit auth events (sign in/out), not on initial session load
          if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            ensureWorkspace(session.user.id);
          }
        } else {
          setWorkspaceId(null);
        }
        if (event !== "INITIAL_SESSION") setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function ensureWorkspace(userId: string) {
    // Guard: prevent concurrent calls (race condition fix)
    if (ensureRunning.current) return;
    ensureRunning.current = true;
    try {
      const { data: existing } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();

      let wsId: string;

      if (existing) {
        wsId = existing.id;
        setWorkspaceId(wsId);
      } else {
        const { data: created } = await supabase
          .from("workspaces")
          .insert({
            name: "Meu Workspace",
            slug: `ws-${userId.slice(0, 8)}`,
            owner_id: userId,
          })
          .select("id")
          .single();

        if (!created) return;
        wsId = created.id;
        setWorkspaceId(wsId);
      }

      await ensureBaseHistorica(wsId);
    } finally {
      ensureRunning.current = false;
    }
  }

  async function ensureBaseHistorica(wsId: string) {
    // Check if new funnel already exists
    const { data: newFunnel } = await supabase
      .from("funnels")
      .select("id")
      .eq("workspace_id", wsId)
      .eq("name", "Base de Compradores")
      .maybeSingle();

    if (newFunnel) return; // Already created with new name — skip

    // Check if old funnel exists → rename it (migration suave)
    const { data: oldFunnel } = await supabase
      .from("funnels")
      .select("id, funnel_stages(id, name)")
      .eq("workspace_id", wsId)
      .eq("name", "Importações Eduzz & Hotmart")
      .maybeSingle();

    if (oldFunnel) {
      // Rename funnel to new name
      await supabase
        .from("funnels")
        .update({ name: "Base de Compradores", description: "Funil universal de compradores importados" })
        .eq("id", oldFunnel.id);

      // Rename / consolidate stages
      const stages = (oldFunnel.funnel_stages || []) as { id: string; name: string }[];
      const stageEduzz = stages.find((s) => s.name === "Comprador Eduzz");
      const stageHotmart = stages.find((s) => s.name === "Comprador Hotmart");
      const stageAmbas = stages.find((s) => s.name === "Ambas Plataformas");

      if (stageEduzz) {
        await supabase.from("funnel_stages").update({ name: "Compradores", color: "#22C55E", order_index: 0 }).eq("id", stageEduzz.id);
      }
      if (stageHotmart) {
        // Re-assign its leads to Compradores stage, then delete it
        if (stageEduzz) {
          await supabase.from("lead_funnel_stages").update({ stage_id: stageEduzz.id }).eq("stage_id", stageHotmart.id);
        }
        await supabase.from("funnel_stages").delete().eq("id", stageHotmart.id);
      }
      if (stageAmbas) {
        await supabase.from("funnel_stages").update({ name: "Multi-compradores", color: "#EAB308", order_index: 1 }).eq("id", stageAmbas.id);
      }

      console.log("[useAuth] Funil antigo migrado para 'Base de Compradores':", oldFunnel.id);
      return;
    }

    // Neither exists — create fresh

    // 1. Create campaign
    const { data: campaign } = await supabase
      .from("campaigns")
      .insert({
        workspace_id: wsId,
        name: "Base Histórica de Compradores",
        description: "Compradores importados de qualquer plataforma",
        is_active: true,
      })
      .select("id")
      .single();

    if (!campaign) return;

    // 2. Create funnel
    const { data: funnel } = await supabase
      .from("funnels")
      .insert({
        workspace_id: wsId,
        campaign_id: campaign.id,
        name: "Base de Compradores",
        description: "Funil universal — compradores importados de Eduzz, Hotmart, Ticto, Guru, Kiwify e outros",
        is_active: true,
      })
      .select("id")
      .single();

    if (!funnel) return;

    // 3. Create stages
    await supabase.from("funnel_stages").insert([
      { funnel_id: funnel.id, name: "Compradores",      color: "#22C55E", order_index: 0 },
      { funnel_id: funnel.id, name: "Multi-compradores", color: "#EAB308", order_index: 1 },
    ]);

    console.log("[useAuth] Base de Compradores criada:", funnel.id);
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, workspaceId, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Return safe defaults during hot reload / provider remount
    return {
      user: null,
      session: null,
      loading: true,
      workspaceId: null,
      signIn: async () => ({ error: null }),
      signOut: async () => {},
    } as AuthContextType;
  }
  return ctx;
}
