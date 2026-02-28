import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "manager" | "staff";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  departmentId: string | null;
  profile: { full_name: string | null; department_id: string | null } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  departmentId: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; department_id: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserMeta = async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      supabase.from("profiles").select("full_name, department_id").eq("user_id", userId).single(),
    ]);
    if (roleRes.data) setRole(roleRes.data.role as AppRole);
    if (profileRes.data) {
      setProfile(profileRes.data);
      setDepartmentId(profileRes.data.department_id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserMeta(session.user.id), 0);
      } else {
        setRole(null);
        setProfile(null);
        setDepartmentId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserMeta(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, role, departmentId, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
