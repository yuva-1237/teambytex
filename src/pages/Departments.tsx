import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Department { id: string; name: string; is_active: boolean; created_at: string }

export default function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [editDept, setEditDept] = useState<Department | null>(null);

  useEffect(() => { fetchDepartments(); }, []);

  const fetchDepartments = async () => {
    const { data } = await supabase.from("departments").select("*").order("name");
    if (data) setDepartments(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("departments").insert({ name });
    if (error) toast.error(error.message);
    else { toast.success("Department created"); setOpen(false); setName(""); fetchDepartments(); }
  };

  const toggleActive = async (dept: Department) => {
    const { error } = await supabase.from("departments").update({ is_active: !dept.is_active }).eq("id", dept.id);
    if (error) toast.error(error.message);
    else fetchDepartments();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDept) return;
    const { error } = await supabase.from("departments").update({ name }).eq("id", editDept.id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); setEditDept(null); setName(""); fetchDepartments(); }
  };

  // Count users per department
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    supabase.from("profiles").select("department_id").then(({ data }) => {
      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((p: any) => { if (p.department_id) counts[p.department_id] = (counts[p.department_id] || 0) + 1; });
        setUserCounts(counts);
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-sm text-muted-foreground">{departments.length} departments</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Department</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <Button type="submit" className="w-full">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{userCounts[d.id] || 0}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? "default" : "secondary"}>{d.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setEditDept(d); setName(d.name); }}>Edit</Button>
                    <Switch checked={d.is_active} onCheckedChange={() => toggleActive(d)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editDept} onOpenChange={(o) => { if (!o) { setEditDept(null); setName(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <Button type="submit" className="w-full">Update</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
