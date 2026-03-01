import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Upload, Paperclip, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  created_by: string;
  assigned_to_user: string | null;
  assigned_to_department: string | null;
  source_department: string | null;
  created_at: string;
}

interface Department { id: string; name: string }
interface Profile { user_id: string; full_name: string | null; department_id: string | null }

export default function Tasks() {
  const { user, departmentId, role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedDept, setAssignedDept] = useState("");
  const [assignedUser, setAssignedUser] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [tasksRes, deptsRes, usersRes] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("departments").select("*").eq("is_active", true),
      supabase.from("profiles").select("user_id, full_name, department_id"),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (deptsRes.data) setDepartments(deptsRes.data);
    if (usersRes.data) setUsers(usersRes.data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { data: task, error } = await supabase.from("tasks").insert({
      title,
      description: description || null,
      priority: priority as any,
      due_date: dueDate || null,
      created_by: user.id,
      assigned_to_user: assignedUser || null,
      assigned_to_department: assignedDept || null,
      source_department: departmentId,
    }).select().single();

    if (error) { toast.error(error.message); return; }

    // Upload files
    if (task && files.length > 0) {
      for (const file of files) {
        const path = `${task.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("task-files").upload(path, file);
        if (!uploadError) {
          await supabase.from("task_attachments").insert({
            task_id: task.id,
            file_name: file.name,
            storage_path: path,
            file_size: file.size,
            content_type: file.type,
            uploaded_by: user.id,
          });
        }
      }
    }

    toast.success("Task created!");
    setOpen(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setPriority("medium"); setDueDate(""); setAssignedDept(""); setAssignedUser(""); setFiles([]);
  };

  const updateStatus = async (taskId: string, newStatus: string) => {
    const { error } = await supabase.from("tasks").update({ status: newStatus as any }).eq("id", taskId);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); fetchData(); }
  };

  const handleDelete = async (taskId: string) => {
    if (role !== "admin") {
      toast.error("Unauthorized: Only admins can delete tasks");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Task deleted successfully");
      fetchData();
      if (detailTask?.id === taskId) setDetailTask(null);
    }
  };

  const filtered = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name || "—";
  const userName = (id: string | null) => users.find((u) => u.user_id === id)?.full_name || "—";

  const priorityColor = (p: string) => {
    switch (p) { case "urgent": return "destructive"; case "high": return "default"; case "medium": return "secondary"; default: return "outline"; }
  };

  const statusColor = (s: string) => {
    switch (s) { case "completed": return "default"; case "in_progress": return "secondary"; default: return "outline"; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} tasks</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Input 
            placeholder="Search tasks by title..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-72"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Task</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Task</DialogTitle>
              </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Assign to Department</Label>
                  <Select value={assignedDept} onValueChange={setAssignedDept}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assign to User</Label>
                  <Select value={assignedUser} onValueChange={setAssignedUser}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex items-center gap-2">
                  <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="flex-1" />
                  {files.length > 0 && <span className="text-xs text-muted-foreground">{files.length} file(s)</span>}
                </div>
              </div>
              <Button type="submit" className="w-full">Create Task</Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No tasks found</TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailTask(t)}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell><Badge variant={priorityColor(t.priority)} className="capitalize text-xs">{t.priority}</Badge></TableCell>
                    <TableCell><Badge variant={statusColor(t.status)} className="capitalize text-xs">{t.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{deptName(t.assigned_to_department)}</TableCell>
                    <TableCell className="text-sm">{userName(t.assigned_to_user)}</TableCell>
                    <TableCell className="text-sm">{t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        {role === "admin" && (
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                            title="Delete Task"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Task detail dialog */}
      <Dialog open={!!detailTask} onOpenChange={(o) => !o && setDetailTask(null)}>
        <DialogContent className="max-w-lg">
          {detailTask && (
            <>
              <DialogHeader>
                <DialogTitle>{detailTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant={priorityColor(detailTask.priority)} className="capitalize">{detailTask.priority}</Badge>
                  <Badge variant={statusColor(detailTask.status)} className="capitalize">{detailTask.status.replace("_", " ")}</Badge>
                </div>
                {detailTask.description && <p className="text-sm text-muted-foreground">{detailTask.description}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Department:</span> {deptName(detailTask.assigned_to_department)}</div>
                  <div><span className="text-muted-foreground">Assigned to:</span> {userName(detailTask.assigned_to_user)}</div>
                  <div><span className="text-muted-foreground">Created by:</span> {userName(detailTask.created_by)}</div>
                  <div><span className="text-muted-foreground">Due:</span> {detailTask.due_date ? format(new Date(detailTask.due_date), "MMM d, yyyy") : "—"}</div>
                  <div><span className="text-muted-foreground">From Dept:</span> {deptName(detailTask.source_department)}</div>
                  <div><span className="text-muted-foreground">Created:</span> {format(new Date(detailTask.created_at), "MMM d, yyyy")}</div>
                </div>
                <TaskAttachments taskId={detailTask.id} />
                <TaskHistory taskId={detailTask.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskAttachments({ taskId }: { taskId: string }) {
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("task_attachments").select("*").eq("task_id", taskId).then(({ data }) => {
      if (data) setAttachments(data);
    });
  }, [taskId]);

  const download = async (path: string, name: string) => {
    const { data } = await supabase.storage.from("task-files").download(path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Attachments</h4>
      <div className="space-y-1">
        {attachments.map((a) => (
          <button key={a.id} onClick={() => download(a.storage_path, a.file_name)} className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Upload className="h-3 w-3" /> {a.file_name}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskHistory({ taskId }: { taskId: string }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("task_history").select("*").eq("task_id", taskId).order("changed_at", { ascending: false }).then(({ data }) => {
      if (data) setHistory(data);
    });
  }, [taskId]);

  if (history.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">History</h4>
      <div className="space-y-1 text-xs text-muted-foreground">
        {history.map((h) => (
          <div key={h.id} className="flex gap-2">
            <span>{format(new Date(h.changed_at), "MMM d, HH:mm")}</span>
            <span>{h.field_changed}: <span className="line-through">{h.old_value}</span> → <span className="font-medium text-foreground">{h.new_value}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
