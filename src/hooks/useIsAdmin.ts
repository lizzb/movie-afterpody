import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** True only for signed-in users holding the admin role (checked server-side). */
export function useIsAdmin(): boolean {
  const { userId } = useAuth();
  const query = useQuery({
    queryKey: ["is-admin", userId],
    enabled: Boolean(userId),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "admin",
      });
      if (error) return false;
      return Boolean(data);
    },
  });
  return query.data === true;
}
