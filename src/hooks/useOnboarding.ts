import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingSettings {
  enabled: boolean;
  passing_score: number;
  total_questions: number;
  exempt_role_names: string[];
}

export function useOnboardingSettings() {
  return useQuery({
    queryKey: ["onboarding-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_settings")
        .select("enabled, passing_score, total_questions, exempt_role_names")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data as OnboardingSettings;
    },
    staleTime: 60_000,
  });
}

export function useOnboardingProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["onboarding-progress", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("onboarding_progress").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const ensureRow = useCallback(async () => {
    if (!user) return null;
    const existing = query.data;
    if (existing) return existing;
    const { data } = await supabase
      .from("onboarding_progress")
      .insert({ user_id: user.id, sections_viewed: [], current_section: "home" })
      .select()
      .single();
    qc.invalidateQueries({ queryKey: ["onboarding-progress", user.id] });
    return data;
  }, [user, query.data, qc]);

  const markSectionViewed = useCallback(
    async (sectionId: string) => {
      if (!user) return;
      const row = await ensureRow();
      const viewed: string[] = row?.sections_viewed || [];
      if (!viewed.includes(sectionId)) {
        const next = [...viewed, sectionId];
        await supabase
          .from("onboarding_progress")
          .update({ sections_viewed: next, current_section: sectionId })
          .eq("user_id", user.id);
        qc.invalidateQueries({ queryKey: ["onboarding-progress", user.id] });
      } else {
        await supabase.from("onboarding_progress").update({ current_section: sectionId }).eq("user_id", user.id);
      }
    },
    [user, ensureRow, qc],
  );

  const markCompleted = useCallback(
    async (score: number, total: number) => {
      if (!user) return;
      await ensureRow();
      await supabase
        .from("onboarding_progress")
        .update({
          completed_at: new Date().toISOString(),
          best_score: score,
          best_total: total,
        })
        .eq("user_id", user.id);
      qc.invalidateQueries({ queryKey: ["onboarding-progress", user.id] });
      qc.invalidateQueries({ queryKey: ["onboarding-required", user.id] });
    },
    [user, ensureRow, qc],
  );

  return { ...query, markSectionViewed, markCompleted, ensureRow };
}

export function useOnboardingRequired() {
  const { user, profile, isAdmin, roles } = useAuth();
  const { data: progress, isLoading: progressLoading, isFetching: progressFetching } = useOnboardingProgress();
  const { data: settings, isLoading: settingsLoading } = useOnboardingSettings();

  if (!user || !profile) return false;
  if (isAdmin) return false;
  // Aguarda dados carregarem antes de exigir onboarding (evita redirect indevido de quem já concluiu).
  if (progressLoading || progressFetching || settingsLoading) return false;
  if (!settings?.enabled) return false;

  // Respeita exempt_role_names configurado no painel admin
  const exemptNames = settings.exempt_role_names || [];
  if (exemptNames.length > 0 && roles.some((r) => exemptNames.includes(r.name))) {
    return false;
  }

  if (progress?.completed_at) return false;
  return true;
}

export function useElapsedTracker(enabled: boolean) {
  const { user } = useAuth();
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [enabled]);

  // Flush every ~30s
  useEffect(() => {
    if (!enabled || !user || seconds === 0 || seconds % 30 !== 0) return;
    supabase
      .from("onboarding_progress")
      .update({ time_spent_seconds: seconds })
      .eq("user_id", user.id)
      .then(() => {});
  }, [seconds, enabled, user]);
}
