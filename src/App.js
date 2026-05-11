import React from 'react';
import { useState, useEffect, useCallback } from "react";

const T = {
  green:      "#1E7D4B",
  greenLight: "#25A05E",
  greenPale:  "#E8F5EE",
  greenMid:   "#C6E8D6",
  white:      "#FFFFFF",
  bg:         "#F4F6F5",
  border:     "#DDE8E3",
  text:       "#1A2E24",
  textMuted:  "#6B8A78",
  textLight:  "#A3BDB0",
  red:        "#D94F4F",
  orange:     "#E07B39",
  yellow:     "#C9A227",
};

const USERS = [
  { id: "anderson", name: "Anderson", role: "Gerente",         avatar: "A", color: T.green   },
  { id: "coord1",   name: "Davi",     role: "Coord. de Campo", avatar: "D", color: "#1A6B8A" },
  { id: "coord2",   name: "Carol",    role: "Coord. de Campo", avatar: "C", color: "#8A4A1A" },
];

const PRIORITIES = [
  { value: "alta",  label: "Alta",  color: T.red    },
  { value: "media", label: "Média", color: T.orange },
  { value: "baixa", label: "Baixa", color: T.green  },
];

const STATUS_OPTIONS = [
  { value: "pendente",     label: "Pendente",     icon: "⏳" },
  { value: "em_andamento", label: "Em Andamento", icon: "🔄" },
  { value: "concluida",    label: "Concluída",    icon: "✅" },
];

const LOG_ICONS   = { login: "🔑", task_created: "➕", status_changed: "🔄", comment_added: "💬", task_edited: "✏️" };
const TYPE_LABELS = { login: "Login", task_created: "Criada", status_changed: "Status", comment_added: "Comentário", task_edited: "Editada" };
const TYPE_BG     = { login: "#FFF8E7", task_created: T.greenPale, status_changed: "#E6F4FA", comment_added: "#F3EEF9", task_edited: "#FFF0E6" };
const TYPE_COLOR  = { login: T.yellow, task_created: T.green, status_changed: "#1A6B8A", comment_added: "#6B3A8A", task_edited: T.orange };

const INITIAL_TASKS = [
  { id: 1, title: "Revisar SLA Lactalis DPA",         description: "Verificar indicadores do mês e preparar relatório",           assignee: "anderson", priority: "alta",  status: "em_andamento", dueDate: "2026-05-10", reminder: true,  createdAt: "2026-05-01", comments: [], history: [], internalNote: "" },
  { id: 2, title: "Escalar equipe SP - domingo",       description: "Confirmar atendimentos aos domingos para o estado de SP",     assignee: "coord1",   priority: "alta",  status: "pendente",     dueDate: "2026-05-08", reminder: true,  createdAt: "2026-05-03", comments: [], history: [], internalNote: "" },
  { id: 3, title: "Cadastrar colaboradores no Premia", description: "Inclusão dos 12 novos contratados no sistema de recompensas", assignee: "coord2",   priority: "media", status: "pendente",     dueDate: "2026-05-12", reminder: false, createdAt: "2026-05-04", comments: [], history: [], internalNote: "" },
];

function getUserById(id)      { return USERS.find(u => u.id === id); }
function getPriorityData(val) { return PRIORITIES.find(p => p.value === val); }
function nowTimestamp() {
  return new Date().toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}
function isOverdue(dueDate, status) {
  if (!dueDate || status === "concluida") return false;
  return new Date(dueDate + "T00:00:00") < new Date();
}
function formatDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
}
function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d + "T00:00:00") - new Date()) / 86400000);
}
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function SpotTasks() {
  const [currentUser,    setCurrentUser]    = useState(() => load("spot_user", "anderson"));
  const [tasks,          setTasks]          = useState(() => load("spot_tasks", INITIAL_TASKS));
  const [activityLog,    setActivityLog]    = useState(() => load("spot_log", [{ id: 1, type: "login", user: "anderson", timestamp: nowTimestamp(), detail: "Sessão iniciada" }]));
  const [view,           setView]           = useState("dashboard");
  const [selectedTask,   setSelectedTask]   = useState(null);
  const [showNewTask,    setShowNewTask]    = useState(false);
  const [showEditTask,   setShowEditTask]   = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [editForm,       setEditForm]       = useState(null);
  const [filterStatus,   setFilterStatus]   = useState("todas");
  const [filterAssignee, setFilterAssignee] = useState("todos");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [newComment,     setNewComment]     = useState("");
  const [notifications,  setNotifications]  = useState([]);
  const [form, setForm] = useState({ title:"", description:"", internalNote:"", assignee:"anderson", priority:"media", dueDate:"", reminder:false });

  useEffect(() => { save("spot_tasks", tasks);      }, [tasks]);
  useEffect(() => { save("spot_log",   activityLog);}, [activityLog]);
  useEffect(() => { save("spot_user",  currentUser);}, [currentUser]);

  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [tasks]);

  const addLog = (type, userId, detail) =>
    setActivityLog(prev => [{ id: Date.now(), type, user: userId, timestamp: nowTimestamp(), detail }, ...prev]);

  const handleUserSwitch = (uid) => {
    if (uid !== currentUser) { setCurrentUser(uid); addLog("login", uid, "Sessão iniciada"); }
    setShowUserPicker(false);
  };

  useEffect(() => {
    const notifs = [];
    tasks.forEach(t => {
      if (isOverdue(t.dueDate, t.status)) notifs.push({ id: t.id, msg: `"${t.title}" atrasada!`, type: "overdue" });
      else if (t.reminder && t.dueDate) {
        const diff = daysUntil(t.dueDate);
        if (diff !== null && diff >= 0 && diff <= 2) notifs.push({ id: t.id, msg: `"${t.title}" vence em breve`, type: "reminder" });
      }
    });
    setNotifications(notifs);
  }, [tasks]);

  const addTask = () => {
    if (!form.title.trim()) return;
    const newTask = { ...form, id: Date.now(), status: "pendente", createdAt: new Date().toISOString().split("T")[0], comments: [], history: [] };
    setTasks(prev => [newTask, ...prev]);
    addLog("task_created", currentUser, `Criou "${form.title}" → ${getUserById(form.assignee)?.name}`);
    setForm({ title:"", description:"", internalNote:"", assignee:"anderson", priority:"media", dueDate:"", reminder:false });
    setShowNewTask(false);
  };

  const saveEditTask = () => {
    if (!editForm.title.trim()) return;
    const original = tasks.find(t => t.id === editForm.id);
    const changes  = [];
    if (original.title       !== editForm.title)       changes.push("título");
    if (original.assignee    !== editForm.assignee)    changes.push(`responsável → ${getUserById(editForm.assignee)?.name}`);
    if (original.priority    !== editForm.priority)    changes.push(`prioridade → ${getPriorityData(editForm.priority)?.label}`);
    if (original.dueDate     !== editForm.dueDate)     changes.push(`prazo → ${formatDate(editForm.dueDate)}`);
    const histEntry = { id: Date.now(), user: getUserById(currentUser)?.name, userId: currentUser, action: `Editou: ${changes.join(", ") || "campos"}`, timestamp: nowTimestamp() };
    setTasks(prev => prev.map(t => t.id === editForm.id ? { ...editForm, history: [...(t.history||[]), histEntry] } : t));
    addLog("task_edited", currentUser, `Editou "${editForm.title}"`);
    setShowEditTask(false); setEditForm(null);
  };

  const updateTaskStatus = (id, status) => {
    const task     = tasks.find(t => t.id === id);
    const oldLabel = STATUS_OPTIONS.find(s => s.value === task.status)?.label;
    const newLabel = STATUS_OPTIONS.find(s => s.value === status)?.label;
    const histEntry = { id: Date.now(), user: getUserById(currentUser)?.name, userId: currentUser, action: `Status: ${oldLabel} → ${newLabel}`, timestamp: nowTimestamp() };
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status, history: [...(t.history||[]), histEntry] } : t));
    addLog("status_changed", currentUser, `"${task.title}": ${oldLabel} → ${newLabel}`);
  };

  const addComment = (taskId) => {
    if (!newComment.trim()) return;
    const u    = getUserById(currentUser);
    const task = tasks.find(t => t.id === taskId);
    const comment = { id: Date.now(), user: u.name, userId: currentUser, text: newComment, time: nowTimestamp() };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t));
    addLog("comment_added", currentUser, `Comentou em "${task.title}"`);
    setNewComment("");
  };

  const openEdit = (task) => { setEditForm({...task}); setShowEditTask(true); };

  const totalDone      = tasks.filter(t => t.status === "concluida").length;
  const totalPending   = tasks.filter(t => t.status === "pendente").length;
  const totalProgress  = tasks.filter(t => t.status === "em_andamento").length;
  const today          = tasks.filter(t => t.status !== "concluida" && daysUntil(t.dueDate) === 0).length;
  const myTasks        = tasks.filter(t => t.assignee === currentUser);
  const filteredTasks  = tasks.filter(t =>
    (filterStatus   === "todas" || t.status   === filterStatus)   &&
    (filterAssignee === "todos" || t.assignee === filterAssignee) &&
    (searchQuery === "" || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const user = getUserById(currentUser);

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (selectedTask) {
    const task     = tasks.find(t => t.id === selectedTask.id) || selectedTask;
    const priority = getPriorityData(task.priority);
    const overdue  = isOverdue(task.dueDate, task.status);
    const assignee = getUserById(task.assignee);
    const days     = daysUntil(task.dueDate);
    const statusObj = STATUS_OPTIONS.find(s => s.value === task.status);

    return (
      <div style={{ fontFamily:"'DM Sans',sans-serif", background:T.bg, minHeight:"100vh", color:T.text, maxWidth:680, margin:"0 auto" }}>
        <GlobalStyles />
        <div style={{ background:T.green, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:50, boxShadow:"0 2px 10px rgba(30,125,75,0.2)" }}>
          <button className="btn" onClick={() => setSelectedTask(null)}
            style={{ background:"rgba(255,255,255,0.2)", color:T.white, width:38, height:38, borderRadius:"50%", fontSize:20, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</button>
          <div style={{ flex:1, fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, color:T.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</div>
          <button className="btn" onClick={() => openEdit(task)}
            style={{ background:"rgba(255,255,255,0.2)", color:T.white, padding:"8px 14px", borderRadius:20, fontSize:13, whiteSpace:"nowrap" }}>✏️ Editar</button>
        </div>

        <div style={{ padding:"16px" }}>
          {/* Pills */}
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            <span className="pill" style={{ background:priority.color+"18", color:priority.color, fontSize:12, padding:"5px 12px" }}>{priority.label}</span>
            <span className="pill" style={{ background: task.status==="concluida"?"#E8F5E9":task.status==="em_andamento"?"#E6F4FA":T.greenPale, color: task.status==="concluida"?"#2E7D32":task.status==="em_andamento"?"#1A6B8A":T.green, fontSize:12, padding:"5px 12px" }}>
              {statusObj?.icon} {statusObj?.label}
            </span>
            {overdue && <span className="pill" style={{ background:T.red+"18", color:T.red, fontSize:12, padding:"5px 12px" }}>Atrasada</span>}
          </div>

          {/* Description */}
          {task.description && (
            <div style={{ background:T.white, borderRadius:14, padding:"16px", marginBottom:12, border:`1px solid ${T.border}` }}>
              <Label>Descrição</Label>
              <div style={{ fontSize:14, color:T.textMuted, lineHeight:1.7 }}>{task.description}</div>
            </div>
          )}

          {/* Internal note */}
          {task.internalNote && (
            <div style={{ background:"#FFF8E7", borderRadius:14, padding:"16px", marginBottom:12, border:"1px solid #F0D98B" }}>
              <Label color={T.yellow}>📝 Nota Interna</Label>
              <div style={{ fontSize:14, color:"#7A6020" }}>{task.internalNote}</div>
            </div>
          )}

          {/* Meta */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div style={{ background:T.white, borderRadius:14, padding:"14px", border:`1px solid ${T.border}` }}>
              <Label>Responsável</Label>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Avatar user={assignee} size={28} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700 }}>{assignee.name}</div>
                  <div style={{ fontSize:11, color:T.textMuted }}>{assignee.role}</div>
                </div>
              </div>
            </div>
            <div style={{ background:T.white, borderRadius:14, padding:"14px", border:`1px solid ${T.border}` }}>
              <Label>Prazo</Label>
              <div style={{ fontSize:14, fontWeight:700, color:overdue?T.red:T.text }}>{task.dueDate ? formatDate(task.dueDate) : "—"}</div>
              {task.dueDate && !overdue && days !== null && days <= 3 && (
                <div style={{ fontSize:11, color:T.orange, marginTop:2 }}>{days===0?"Hoje!":days===1?"Amanhã":`${days} dias`}</div>
              )}
              {task.reminder && <div style={{ fontSize:11, color:T.green, marginTop:2 }}>🔔 Lembrete ativo</div>}
            </div>
          </div>

          {/* Status change */}
          <div style={{ background:T.white, borderRadius:14, padding:"16px", marginBottom:12, border:`1px solid ${T.border}` }}>
            <Label>Alterar Status</Label>
            <div style={{ display:"flex", gap:8 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} className="btn" onClick={() => updateTaskStatus(task.id, s.value)}
                  style={{ flex:1, padding:"10px 4px", borderRadius:10, fontSize:11, textAlign:"center",
                    background: task.status===s.value ? T.green  : T.bg,
                    color:      task.status===s.value ? T.white  : T.textMuted,
                    border:     `1.5px solid ${task.status===s.value ? T.green : T.border}`,
                    fontWeight: task.status===s.value ? 700 : 500 }}>
                  <div style={{ fontSize:16, marginBottom:2 }}>{s.icon}</div>
                  <div style={{ fontSize:10, lineHeight:1.2 }}>{s.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          {task.history?.length > 0 && (
            <div style={{ background:T.white, borderRadius:14, padding:"16px", marginBottom:12, border:`1px solid ${T.border}` }}>
              <Label>Histórico de Alterações</Label>
              {[...task.history].reverse().map((h, i) => {
                const hu = getUserById(h.userId);
                return (
                  <div key={h.id||i} style={{ display:"flex", gap:10, marginBottom:10 }}>
                    <Avatar user={hu} size={26} fontSize={9} />
                    <div>
                      <div style={{ fontSize:12, color:T.text }}><span style={{ fontWeight:700, color:hu?.color }}>{h.user}</span> — {h.action}</div>
                      <div style={{ fontSize:10, color:T.textLight }}>{h.timestamp}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comments */}
          <div style={{ background:T.white, borderRadius:14, padding:"16px", border:`1px solid ${T.border}`, marginBottom:80 }}>
            <Label>Comentários ({task.comments?.length||0})</Label>
            {(!task.comments||task.comments.length===0) && <div style={{ fontSize:13, color:T.textLight, marginBottom:12 }}>Sem comentários ainda.</div>}
            {task.comments?.map(c => {
              const cu = getUserById(c.userId);
              return (
                <div key={c.id} style={{ marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:cu?.color||T.green }}>{c.user}</span>
                    <span style={{ fontSize:10, color:T.textLight }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize:13, color:T.textMuted }}>{c.text}</div>
                </div>
              );
            })}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <input placeholder="Comentar..." value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key==="Enter" && addComment(task.id)}
                style={{ flex:1, background:T.bg, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:"10px 14px", fontSize:13, outline:"none" }} />
              <button className="btn" onClick={() => addComment(task.id)}
                style={{ background:T.green, color:T.white, padding:"10px 18px", borderRadius:10, fontSize:15 }}>→</button>
            </div>
          </div>
        </div>

        {showEditTask && editForm && (
          <TaskModal title="Editar Tarefa" accentColor={T.orange} form={editForm} setForm={setEditForm}
            onCancel={() => { setShowEditTask(false); setEditForm(null); }} onConfirm={saveEditTask} confirmLabel="Salvar" />
        )}
      </div>
    );
  }

  // ── MAIN VIEWS ───────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:T.bg, minHeight:"100vh", color:T.text, maxWidth:680, margin:"0 auto" }}>
      <GlobalStyles />

      {/* TOP BAR */}
      <div style={{ background:T.green, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 12px rgba(30,125,75,0.2)" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.white }}>SPOT</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {notifications.length > 0 && (
            <div style={{ background:T.red, color:T.white, borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{notifications.length}</div>
          )}
          <button className="btn" onClick={() => setShowUserPicker(true)}
            style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.25)", border:"2px solid rgba(255,255,255,0.5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:T.white }}>
            {user.avatar}
          </button>
        </div>
      </div>

      {/* NOTIFICATION BANNER */}
      {notifications.length > 0 && (
        <div style={{ padding:"10px 16px", background:"#FFF8E7", borderBottom:"1px solid #F0D98B" }}>
          {notifications.map((n,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:n.type==="overdue"?T.red:T.yellow, fontWeight:600, marginBottom:i<notifications.length-1?4:0 }}>
              {n.type==="overdue"?"🔴":"🔔"} {n.msg}
            </div>
          ))}
        </div>
      )}

      {/* PAGE */}
      <div style={{ padding:"16px 16px 88px" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800 }}>Olá, {user.name} 👋</div>
              <div style={{ fontSize:13, color:T.textMuted }}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>
            </div>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"Total",        value:tasks.length,  color:T.green,   bg:T.greenPale, icon:"📋" },
                { label:"Em Andamento", value:totalProgress, color:"#1A6B8A", bg:"#E6F4FA",  icon:"🔄" },
                { label:"Pendentes",    value:totalPending,  color:T.red,     bg:"#FDEAEA",  icon:"⏳" },
                { label:"Concluídas",   value:totalDone,     color:"#2E7D32", bg:"#E8F5E9",  icon:"✅" },
              ].map((s,i) => (
                <div key={i} style={{ background:s.bg, borderRadius:16, padding:"16px", borderTop:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:30, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:11, color:s.color, fontWeight:600, opacity:0.85 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Urgency */}
            {today > 0 && (
              <div style={{ background:"#FDEAEA", borderRadius:14, padding:"14px 16px", marginBottom:14, display:"flex", alignItems:"center", gap:12, border:`1px solid ${T.red}33` }}>
                <div style={{ fontSize:28 }}>🔥</div>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.red }}>{today}</div>
                  <div style={{ fontSize:12, color:T.red, fontWeight:600 }}>Tarefa(s) vencem hoje</div>
                </div>
              </div>
            )}

            {/* Progress */}
            <div style={{ background:T.white, borderRadius:16, padding:"16px", marginBottom:20, border:`1px solid ${T.border}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:700 }}>Progresso do Time</span>
                <span style={{ fontSize:14, color:T.green, fontWeight:800 }}>{tasks.length>0?Math.round((totalDone/tasks.length)*100):0}%</span>
              </div>
              <div style={{ height:10, background:T.greenMid, borderRadius:6, overflow:"hidden", marginBottom:14 }}>
                <div style={{ height:"100%", width:`${tasks.length>0?(totalDone/tasks.length)*100:0}%`, background:`linear-gradient(90deg,${T.green},${T.greenLight})`, borderRadius:6, transition:"width 0.5s" }} />
              </div>
              {USERS.map(u => {
                const done  = tasks.filter(t => t.assignee===u.id && t.status==="concluida").length;
                const total = tasks.filter(t => t.assignee===u.id).length;
                const pct   = total>0?Math.round((done/total)*100):0;
                return (
                  <div key={u.id} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:u.color }} />
                        <span style={{ fontSize:12, color:T.textMuted, fontWeight:600 }}>{u.name}</span>
                      </div>
                      <span style={{ fontSize:12, color:u.color, fontWeight:700 }}>{done}/{total}</span>
                    </div>
                    <div style={{ height:5, background:T.greenMid, borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:u.color, borderRadius:3 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, marginBottom:12 }}>Minhas Tarefas</div>
            {myTasks.length===0
              ? <Empty text="Nenhuma tarefa atribuída a você." />
              : myTasks.map(t => <TaskCard key={t.id} task={t} onClick={() => setSelectedTask(t)} onStatusChange={updateTaskStatus} onEdit={openEdit} />)
            }
          </div>
        )}

        {/* LIST */}
        {view === "list" && (
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, marginBottom:16 }}>Tarefas</div>

            <div style={{ position:"relative", marginBottom:12 }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:15, color:T.textLight }}>🔍</span>
              <input placeholder="Buscar tarefas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ width:"100%", background:T.white, border:`1px solid ${T.border}`, color:T.text, borderRadius:12, padding:"11px 14px 11px 38px", fontSize:14, outline:"none" }} />
            </div>

            {/* Filter pills */}
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6, marginBottom:10, scrollbarWidth:"none" }}>
              {[["todas","Todos"],["pendente","⏳ Pendente"],["em_andamento","🔄 Andamento"],["concluida","✅ Concluído"]].map(([v,l]) => (
                <button key={v} className="btn" onClick={() => setFilterStatus(v)}
                  style={{ padding:"7px 14px", borderRadius:20, fontSize:12, whiteSpace:"nowrap", flexShrink:0,
                    background:filterStatus===v?T.green:T.white, color:filterStatus===v?T.white:T.textMuted,
                    border:`1px solid ${filterStatus===v?T.green:T.border}` }}>{l}</button>
              ))}
              <div style={{ width:1, background:T.border, flexShrink:0, margin:"0 2px" }} />
              {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l]) => (
                <button key={v} className="btn" onClick={() => setFilterAssignee(v)}
                  style={{ padding:"7px 14px", borderRadius:20, fontSize:12, whiteSpace:"nowrap", flexShrink:0,
                    background:filterAssignee===v?T.green:T.white, color:filterAssignee===v?T.white:T.textMuted,
                    border:`1px solid ${filterAssignee===v?T.green:T.border}` }}>{l}</button>
              ))}
            </div>

            <div style={{ fontSize:12, color:T.textMuted, marginBottom:10 }}>{filteredTasks.length} tarefa(s)</div>
            {filteredTasks.length===0
              ? <Empty text="Nenhuma tarefa encontrada." />
              : filteredTasks.map(t => <TaskCard key={t.id} task={t} onClick={() => setSelectedTask(t)} onStatusChange={updateTaskStatus} onEdit={openEdit} />)
            }
          </div>
        )}

        {/* LOG */}
        {view==="log" && <ActivityLog log={activityLog} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:680, background:T.white, borderTop:`1px solid ${T.border}`, display:"flex", zIndex:100, boxShadow:"0 -4px 20px rgba(30,125,75,0.1)" }}>
        {[
          { key:"dashboard", icon:"⊞", label:"Início" },
          { key:"list",      icon:"☰", label:"Tarefas", badge:tasks.filter(t=>t.status!=="concluida").length },
          { key:"log",       icon:"📋", label:"Log",    badge:activityLog.length },
        ].map(item => (
          <button key={item.key} className="btn" onClick={() => setView(item.key)}
            style={{ flex:1, padding:"10px 0 12px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"transparent", borderTop:`3px solid ${view===item.key?T.green:"transparent"}`, position:"relative" }}>
            <span style={{ fontSize:20 }}>{item.icon}</span>
            <span style={{ fontSize:10, fontWeight:view===item.key?700:500, color:view===item.key?T.green:T.textLight }}>{item.label}</span>
            {item.badge>0 && (
              <div style={{ position:"absolute", top:6, right:"calc(50% - 16px)", background:T.red, color:T.white, borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {item.badge>99?"99+":item.badge}
              </div>
            )}
          </button>
        ))}
        <button className="btn" onClick={() => setShowNewTask(true)}
          style={{ position:"absolute", right:16, bottom:16, width:52, height:52, borderRadius:"50%", background:T.green, color:T.white, fontSize:26, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(30,125,75,0.4)" }}>+</button>
      </div>

      {/* USER PICKER */}
      {showUserPicker && (
        <div style={{ position:"fixed", inset:0, background:"rgba(20,50,35,0.5)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={() => setShowUserPicker(false)}>
          <div style={{ background:T.white, borderRadius:"20px 20px 0 0", padding:"20px 16px 40px", boxShadow:"0 -8px 40px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, background:T.border, borderRadius:2, margin:"0 auto 20px" }} />
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:800, marginBottom:6 }}>Trocar Usuário</div>
            <div style={{ fontSize:12, color:T.textMuted, marginBottom:16 }}>Selecione seu perfil para continuar</div>
            {USERS.map(u => (
              <button key={u.id} className="btn" onClick={() => handleUserSwitch(u.id)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:14, marginBottom:8, background:currentUser===u.id?T.greenPale:T.bg, border:`1.5px solid ${currentUser===u.id?T.green:T.border}`, textAlign:"left" }}>
                <Avatar user={u} size={42} fontSize={16} />
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:currentUser===u.id?T.green:T.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:T.textMuted }}>{u.role}</div>
                </div>
                {currentUser===u.id && <div style={{ marginLeft:"auto", color:T.green, fontSize:20 }}>✓</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {showNewTask && (
        <TaskModal title="Nova Tarefa" accentColor={T.green} form={form} setForm={setForm}
          onCancel={() => setShowNewTask(false)} onConfirm={addTask} confirmLabel="Criar Tarefa" />
      )}
      {showEditTask && editForm && (
        <TaskModal title="Editar Tarefa" accentColor={T.orange} form={editForm} setForm={setEditForm}
          onCancel={() => { setShowEditTask(false); setEditForm(null); }} onConfirm={saveEditTask} confirmLabel="Salvar" />
      )}
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────

function Avatar({ user, size=28, fontSize=11 }) {
  if (!user) return null;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:user.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize, fontWeight:700, color:T.white, flexShrink:0 }}>
      {user.avatar}
    </div>
  );
}

function Label({ children, color }) {
  return <div style={{ fontSize:10, color:color||T.textLight, fontWeight:700, textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>{children}</div>;
}

function Empty({ text }) {
  return <div style={{ color:T.textLight, fontSize:13, textAlign:"center", padding:"32px 0" }}>{text}</div>;
}

// ── TASK CARD ─────────────────────────────────────────────────

function TaskCard({ task, onClick, onStatusChange, onEdit }) {
  const user     = getUserById(task.assignee);
  const priority = getPriorityData(task.priority);
  const overdue  = isOverdue(task.dueDate, task.status);
  const days     = daysUntil(task.dueDate);

  return (
    <div className="task-card" onClick={onClick}
      style={{ background:T.white, border:`1px solid ${overdue?T.red+"44":T.border}`, borderLeft:`4px solid ${priority.color}`, borderRadius:14, padding:"14px 14px 14px 16px", marginBottom:10, boxShadow:"0 1px 4px rgba(30,125,75,0.06)" }}>

      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <button className="btn" onClick={e => { e.stopPropagation(); const next=task.status==="pendente"?"em_andamento":task.status==="em_andamento"?"concluida":"pendente"; onStatusChange(task.id,next); }}
          style={{ width:28, height:28, borderRadius:"50%", background:task.status==="concluida"?T.green:T.bg, border:`2px solid ${task.status==="concluida"?T.green:T.greenMid}`, fontSize:13, color:T.white, flexShrink:0, marginTop:1 }}>
          {task.status==="concluida"?"✓":""}
        </button>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6, textDecoration:task.status==="concluida"?"line-through":"none", color:task.status==="concluida"?T.textLight:T.text, lineHeight:1.3 }}>
            {task.title}
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span className="pill" style={{ background:priority.color+"18", color:priority.color }}>{priority.label}</span>
            {task.status==="em_andamento" && <span className="pill" style={{ background:"#E6F4FA", color:"#1A6B8A" }}>Andamento</span>}
            {overdue && <span className="pill" style={{ background:T.red+"18", color:T.red }}>Atrasada</span>}
            {!overdue && days===0 && <span className="pill" style={{ background:"#FDEAEA", color:T.red }}>Hoje</span>}
            {!overdue && days===1 && <span className="pill" style={{ background:"#FFF0E6", color:T.orange }}>Amanhã</span>}
            {task.internalNote && <span style={{ fontSize:12 }}>📝</span>}
            {task.comments?.length>0 && <span style={{ fontSize:11, color:T.textLight }}>💬 {task.comments.length}</span>}
            {task.reminder && <span style={{ fontSize:11 }}>🔔</span>}
          </div>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <Avatar user={user} size={22} fontSize={9} />
          <span style={{ fontSize:12, color:user.color, fontWeight:600 }}>{user.name}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {task.dueDate && <span style={{ fontSize:11, color:overdue?T.red:T.textLight }}>{formatDate(task.dueDate)}</span>}
          <button className="btn" onClick={e => { e.stopPropagation(); onEdit(task); }}
            style={{ padding:"4px 10px", borderRadius:8, fontSize:11, background:T.greenPale, color:T.green, border:`1px solid ${T.greenMid}` }}>✏️</button>
        </div>
      </div>
    </div>
  );
}

// ── TASK MODAL ────────────────────────────────────────────────

function TaskModal({ title, accentColor, form, setForm, onCancel, onConfirm, confirmLabel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(20,50,35,0.45)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      <div style={{ background:T.white, borderRadius:"20px 20px 0 0", padding:"20px 16px 40px", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 -8px 40px rgba(0,0,0,0.15)" }}>
        <div style={{ width:40, height:4, background:T.border, borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:4, height:22, background:accentColor, borderRadius:2 }} />
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800 }}>{title}</div>
        </div>

        {[
          { label:"Título *",     key:"title",        type:"input",    ph:"Ex: Verificar SLA de São Paulo" },
          { label:"Descrição",    key:"description",  type:"textarea", ph:"Detalhes da tarefa (opcional)", rows:3 },
          { label:"Nota Interna", key:"internalNote", type:"textarea", ph:"Impedimentos, contexto...",     rows:2, note:true },
        ].map(({ label, key, type, ph, rows, note }) => (
          <div key={key} style={{ marginBottom:14 }}>
            <Label>{label}</Label>
            {type==="input"
              ? <input placeholder={ph} value={form[key]||""} onChange={e => setForm(f=>({...f,[key]:e.target.value}))}
                  style={{ width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:"12px 14px", fontSize:14, outline:"none" }} />
              : <textarea placeholder={ph} value={form[key]||""} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} rows={rows}
                  style={{ width:"100%", background:note?"#FFFDF0":T.bg, border:`1.5px solid ${note?"#F0D98B":T.border}`, color:T.text, borderRadius:10, padding:"12px 14px", fontSize:13, outline:"none", resize:"vertical", fontFamily:"'DM Sans',sans-serif" }} />
            }
          </div>
        ))}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          {[
            { label:"Responsável", key:"assignee", opts:USERS.map(u=>({v:u.id,l:u.name})) },
            { label:"Prioridade",  key:"priority", opts:PRIORITIES.map(p=>({v:p.value,l:p.label})) },
          ].map(({ label, key, opts }) => (
            <div key={key}>
              <Label>{label}</Label>
              <select value={form[key]||""} onChange={e => setForm(f=>({...f,[key]:e.target.value}))}
                style={{ width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:"12px", fontSize:13, outline:"none", cursor:"pointer", appearance:"none" }}>
                {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:14 }}>
          <Label>Prazo</Label>
          <input type="date" value={form.dueDate||""} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))}
            style={{ width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:"12px 14px", fontSize:13, outline:"none" }} />
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", fontSize:14, color:T.textMuted, userSelect:"none", marginBottom:24, padding:"12px 14px", background:T.greenPale, borderRadius:10 }}>
          <input type="checkbox" checked={form.reminder||false} onChange={e => setForm(f=>({...f,reminder:e.target.checked}))} style={{ width:18, height:18 }} />
          🔔 Ativar lembrete para este prazo
        </label>

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn" onClick={onCancel}  style={{ flex:1, padding:"14px", borderRadius:12, background:T.bg, border:`1px solid ${T.border}`, color:T.textMuted, fontSize:14 }}>Cancelar</button>
          <button className="btn" onClick={onConfirm} style={{ flex:2, padding:"14px", borderRadius:12, background:accentColor, color:T.white, fontSize:14 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── ACTIVITY LOG ──────────────────────────────────────────────

function ActivityLog({ log }) {
  const [filterUser, setFilterUser] = useState("todos");
  const [filterType, setFilterType] = useState("todos");
  const filtered = log.filter(e => (filterUser==="todos"||e.user===filterUser) && (filterType==="todos"||e.type===filterType));

  return (
    <div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, marginBottom:4 }}>Log de Atividades</div>
      <div style={{ fontSize:13, color:T.textMuted, marginBottom:16 }}>Registro de acessos e alterações</div>

      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6, marginBottom:10, scrollbarWidth:"none" }}>
        {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l]) => (
          <button key={v} className="btn" onClick={() => setFilterUser(v)}
            style={{ padding:"7px 14px", borderRadius:20, fontSize:12, whiteSpace:"nowrap", flexShrink:0, background:filterUser===v?T.green:T.white, color:filterUser===v?T.white:T.textMuted, border:`1px solid ${filterUser===v?T.green:T.border}` }}>{l}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:6, marginBottom:16, scrollbarWidth:"none" }}>
        {[["todos","Todas"],["login","🔑 Login"],["task_created","➕ Criada"],["task_edited","✏️ Editada"],["status_changed","🔄 Status"],["comment_added","💬 Comentário"]].map(([v,l]) => (
          <button key={v} className="btn" onClick={() => setFilterType(v)}
            style={{ padding:"7px 14px", borderRadius:20, fontSize:12, whiteSpace:"nowrap", flexShrink:0, background:filterType===v?T.green:T.white, color:filterType===v?T.white:T.textMuted, border:`1px solid ${filterType===v?T.green:T.border}` }}>{l}</button>
        ))}
      </div>

      <div style={{ fontSize:12, color:T.textMuted, marginBottom:10 }}>{filtered.length} registro(s)</div>
      {filtered.length===0 ? <Empty text="Nenhum registro encontrado." /> : filtered.map(entry => {
        const u = getUserById(entry.user);
        return (
          <div key={entry.id} style={{ background:T.white, borderRadius:14, padding:"14px", marginBottom:8, border:`1px solid ${T.border}`, display:"flex", gap:12, alignItems:"flex-start" }}>
            <Avatar user={u} size={36} fontSize={12} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:4 }}>
                <span style={{ fontSize:13, fontWeight:700, color:u?.color }}>{u?.name}</span>
                <span style={{ fontSize:11, fontWeight:700, background:TYPE_BG[entry.type], color:TYPE_COLOR[entry.type], padding:"2px 8px", borderRadius:20 }}>
                  {LOG_ICONS[entry.type]} {TYPE_LABELS[entry.type]}
                </span>
              </div>
              <div style={{ fontSize:13, color:T.textMuted, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.detail}</div>
              <div style={{ fontSize:11, color:T.textLight, fontFamily:"monospace" }}>{entry.timestamp}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── GLOBAL STYLES ─────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      ::-webkit-scrollbar { display: none; }
      input, textarea, select { font-family: 'DM Sans', sans-serif; }
      .btn { cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; font-weight: 600; transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
      .btn:active { transform: scale(0.96); }
      .task-card { transition: box-shadow 0.18s; cursor: pointer; -webkit-tap-highlight-color: transparent; }
      .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
      input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; }
      input[type="checkbox"] { accent-color: #1E7D4B; }
    `}</style>
  );
}
