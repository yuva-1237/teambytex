import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

interface UserRow {
  user_id: string;
  full_name: string | null;
  department_id: string | null;
  is_active: boolean;
  role: string;
  email?: string;
}

interface Department { id: string; name: string }

export default function Users() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [profilesRes, rolesRes, deptsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, department_id, is_active"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("departments").select("id, name").eq("is_active", true),
    ]);

    if (deptsRes.data) setDepartments(deptsRes.data);

    if (profilesRes.data && rolesRes.data) {
      const roleMap = new Map(rolesRes.data.map((r: any) => [r.user_id, r.role]));
      const merged = profilesRes.data.map((p: any) => ({
        ...p,
        role: roleMap.get(p.user_id) || "staff",
      }));
      setUsers(merged);
    }
  };

  const updateRole = async (userId: string, newRole: string) => {
    // Upsert: delete old + insert new
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    if (error) toast.error(error.message);
    else { toast.success("Role updated"); fetchData(); }
  };

  const updateDepartment = async (userId: string, deptId: string) => {
    const { error } = await supabase.from("profiles").update({ department_id: deptId }).eq("user_id", userId);
    if (error) toast.error(error.message);
    else { toast.success("Department updated"); fetchData(); }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_active: !currentActive }).eq("user_id", userId);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "Unassigned";

  const filteredUsers = users.filter((u) =>
    (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{filteredUsers.length} users</p>
        </div>
        <div className="w-full sm:w-72">
          <Input 
            placeholder="Search users by name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">{u.full_name || "Unnamed"}</TableCell>
                  <TableCell>
                    <Select value={u.department_id || ""} onValueChange={(v) => updateDepartment(u.user_id, v)}>
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assign..." /></SelectTrigger>
                      <SelectContent>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => updateRole(u.user_id, v)}>
                      <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "secondary"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u.user_id, u.is_active)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
