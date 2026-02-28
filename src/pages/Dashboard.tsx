import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ClipboardList, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

const STATUS_COLORS = ["hsl(220, 70%, 50%)", "hsl(38, 92%, 50%)", "hsl(142, 71%, 45%)"];

interface Stats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

export default function Dashboard() {
  const { role, departmentId, user } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 });
  const [deptData, setDeptData] = useState<{ name: string; tasks: number }[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, [role, departmentId, user]);

  const fetchStats = async () => {
    if (!user) return;

    let query = supabase.from("tasks").select("id, status, due_date, title, priority, assigned_to_department, created_at");

    const { data: tasks } = await query;
    if (!tasks) return;

    const now = new Date().toISOString().split("T")[0];
    const s: Stats = { total: tasks.length, pending: 0, inProgress: 0, completed: 0, overdue: 0 };

    tasks.forEach((t: any) => {
      if (t.status === "pending") s.pending++;
      else if (t.status === "in_progress") s.inProgress++;
      else if (t.status === "completed") s.completed++;
      if (t.due_date && t.due_date < now && t.status !== "completed") s.overdue++;
    });
    setStats(s);
    setRecentTasks(tasks.slice(0, 8));

    // Department breakdown
    const { data: depts } = await supabase.from("departments").select("id, name");
    if (depts) {
      const deptMap = new Map(depts.map((d: any) => [d.id, d.name]));
      const counts: Record<string, number> = {};
      tasks.forEach((t: any) => {
        const name = deptMap.get(t.assigned_to_department) || "Unassigned";
        counts[name] = (counts[name] || 0) + 1;
      });
      setDeptData(Object.entries(counts).map(([name, tasks]) => ({ name, tasks })));
    }
  };

  const pieData = [
    { name: "Pending", value: stats.pending },
    { name: "In Progress", value: stats.inProgress },
    { name: "Completed", value: stats.completed },
  ].filter((d) => d.value > 0);

  const statCards = [
    { label: "Total Tasks", value: stats.total, icon: ClipboardList, color: "text-primary" },
    { label: "Pending", value: stats.pending, icon: Clock, color: "text-warning" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "text-success" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  const priorityColor = (p: string) => {
    switch (p) {
      case "urgent": return "destructive";
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {role === "admin" ? "Organization overview" : role === "manager" ? "Department overview" : "Your tasks"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-lg bg-muted p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tasks by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {deptData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Task Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTasks.length > 0 ? (
            <div className="space-y-2">
              {recentTasks.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between rounded-md border bg-card p-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={priorityColor(t.priority)} className="text-xs capitalize">{t.priority}</Badge>
                    <span className="font-medium">{t.title}</span>
                  </div>
                  <Badge variant="outline" className="capitalize">{t.status?.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tasks yet. Create your first task!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
