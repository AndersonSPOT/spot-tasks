import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────────
const SUPABASE_URL = "https://fpjzzewsxdtgacrwsklf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Hss73Qd8Ut2hdNHv9xuFQA_Nhvn0357";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── THEME ─────────────────────────────────────────────────────
const T = {
  green:      "#1A6B3C",
  greenLight: "#22A05A",
  greenPale:  "#EAF5EE",
  greenMid:   "#C2DFD0",
  greenDark:  "#0F4526",
  bg:         "#F2F5F3",
  card:       "#FFFFFF",
  border:     "#E0EBE5",
  text:       "#111D16",
  textMuted:  "#5A7A68",
  textLight:  "#9DB8AA",
  red:        "#C94040",
  redPale:    "#FDEAEA",
  orange:     "#D97B2F",
  orangePale: "#FEF0E4",
  yellow:     "#B8921A",
  yellowPale: "#FDF6E3",
  blue:       "#1A5C8A",
  bluePale:   "#E4F0FA",
};

const USERS = [
  { id: "anderson", name: "Anderson", role: "Gerente",         avatar: "A", color: T.green,  isManager: true  },
  { id: "coord1",   name: "Davi",     role: "Coord. de Campo", avatar: "D", color: T.blue,   isManager: false },
  { id: "coord2",   name: "Carol",    role: "Coord. de Campo", avatar: "C", color: T.orange, isManager: false },
];

const PRIORITIES = [
  { value: "alta",  label: "Alta",  color: T.red,    bg: "#FDEAEA" },
  { value: "media", label: "Média", color: T.orange, bg: "#FEF0E4" },
  { value: "baixa", label: "Baixa", color: T.green,  bg: "#EAF5EE" },
];

const STATUSES = [
  { value: "pendente",     label: "Pendente",     icon: "⏳", color: T.yellow, bg: T.yellowPale },
  { value: "em_andamento", label: "Em Andamento", icon: "🔄", color: T.blue,   bg: T.bluePale   },
  { value: "concluida",    label: "Concluída",    icon: "✅", color: T.green,  bg: T.greenPale  },
];

const LOG_ICONS   = { login:"🔑", task_created:"➕", status_changed:"🔄", comment_added:"💬", task_edited:"✏️", task_deleted:"🗑️" };
const TYPE_LABELS = { login:"Login", task_created:"Criada", status_changed:"Status", comment_added:"Comentário", task_edited:"Editada", task_deleted:"Apagada" };

const getUser     = id  => USERS.find(u => u.id === id);
const getPriority = val => PRIORITIES.find(p => p.value === val);
const getStatus   = val => STATUSES.find(s => s.value === val);

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short" });
}
function daysLeft(d) {
  if (!d) return null;
  return Math.ceil((new Date(d + "T00:00:00") - new Date()) / 86400000);
}
function isOverdue(dueDate, status) {
  if (!dueDate || status === "concluida") return false;
  return new Date(dueDate + "T00:00:00") < new Date();
}
function load(key, fb) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fb; } catch { return fb; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}
function fmtTs(ts) {
  return new Date(ts).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

export default function SpotTasks() {
  const [currentUser,       setCurrentUser]       = useState(() => load("spot_user", "anderson"));
  const [tasks,             setTasks]             = useState([]);
  const [log,               setLog]               = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [view,              setView]              = useState("home");
  const [selectedTask,      setSelectedTask]      = useState(null);
  const [showNewTask,       setShowNewTask]        = useState(false);
  const [showEditTask,      setShowEditTask]       = useState(false);
  const [showUserPicker,    setShowUserPicker]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editForm,          setEditForm]          = useState(null);
  const [filterStatus,      setFilterStatus]      = useState("todas");
  const [filterAssignee,    setFilterAssignee]    = useState("todos");
  const [searchQuery,       setSearchQuery]       = useState("");
  const [newComment,        setNewComment]        = useState("");
  const [newForm,           setNewForm]           = useState({ title:"", description:"", internal_note:"", assignee:"anderson", priority:"media", due_date:"", reminder:false });

  useEffect(() => { save("spot_user", currentUser); }, [currentUser]);

  useEffect(() => {
    fetchAll();
    const channel = supabase.channel("spot-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" },        () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" },     () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "history" },      () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_log" }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchAll() {
    const [{ data: tasksData }, { data: commentsData }, { data: historyData }, { data: logData }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("comments").select("*").order("created_at", { ascending: true }),
      supabase.from("history").select("*").order("created_at", { ascending: true }),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    const enriched = (tasksData || []).map(t => ({
      ...t,
      comments: (commentsData || []).filter(c => c.task_id === t.id),
      history:  (historyData  || []).filter(h => h.task_id === t.id),
    }));
    setTasks(enriched);
    setLog(logData || []);
    setLoading(false);
  }

  const user = getUser(currentUser);

  async function addLog(type, userId, detail) {
    await supabase.from("activity_log").insert({ type, user_id: userId, detail });
  }

  async function createTask() {
    if (!newForm.title.trim()) return;
    await supabase.from("tasks").insert({
      title: newForm.title, description: newForm.description, internal_note: newForm.internal_note,
      assignee: newForm.assignee, priority: newForm.priority, status: "pendente",
      due_date: newForm.due_date || null, reminder: newForm.reminder,
    });
    await addLog("task_created", currentUser, `Criou "${newForm.title}" → ${getUser(newForm.assignee)?.name}`);
    setNewForm({ title:"", description:"", internal_note:"", assignee:"anderson", priority:"media", due_date:"", reminder:false });
    setShowNewTask(false);
  }

  async function saveEdit() {
    if (!editForm?.title.trim()) return;
    const orig = tasks.find(t => t.id === editForm.id);
    const changes = [];
    if (orig.title    !== editForm.title)    changes.push("título");
    if (orig.assignee !== editForm.assignee) changes.push(`resp → ${getUser(editForm.assignee)?.name}`);
    if (orig.priority !== editForm.priority) changes.push(`prioridade → ${getPriority(editForm.priority)?.label}`);
    if (orig.due_date !== editForm.due_date) changes.push(`prazo → ${fmtDate(editForm.due_date)}`);
    await supabase.from("tasks").update({
      title: editForm.title, description: editForm.description, internal_note: editForm.internal_note,
      assignee: editForm.assignee, priority: editForm.priority, due_date: editForm.due_date || null,
      reminder: editForm.reminder, updated_at: new Date().toISOString(),
    }).eq("id", editForm.id);
    await supabase.from("history").insert({ task_id: editForm.id, user_id: currentUser, user_name: user?.name, action: `Editou: ${changes.join(", ") || "campos"}` });
    await addLog("task_edited", currentUser, `Editou "${editForm.title}"`);
    setShowEditTask(false); setEditForm(null);
  }

  async function changeStatus(id, status) {
    const task = tasks.find(t => t.id === id);
    const oldLabel = getStatus(task.status)?.label;
    const newLabel = getStatus(status)?.label;
    await supabase.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("history").insert({ task_id: id, user_id: currentUser, user_name: user?.name, action: `Status: ${oldLabel} → ${newLabel}` });
    await addLog("status_changed", currentUser, `"${task.title}": ${oldLabel} → ${newLabel}`);
  }

  async function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    await supabase.from("tasks").delete().eq("id", id);
    await addLog("task_deleted", currentUser, `Apagou "${task?.title}"`);
    setShowDeleteConfirm(null);
    if (selectedTask?.id === id) setSelectedTask(null);
  }

  async function addComment(taskId) {
    if (!newComment.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    await supabase.from("comments").insert({ task_id: taskId, user_id: currentUser, user_name: user?.name, text: newComment });
    await addLog("comment_added", currentUser, `Comentou em "${task.title}"`);
    setNewComment("");
  }

  async function handleUserSwitch(uid) {
    if (uid !== currentUser) { setCurrentUser(uid); await addLog("login", uid, "Sessão iniciada"); }
    setShowUserPicker(false);
  }

  const total      = tasks.length;
  const pendentes  = tasks.filter(t => t.status === "pendente").length;
  const andamento  = tasks.filter(t => t.status === "em_andamento").length;
  const concluidas = tasks.filter(t => t.status === "concluida").length;
  const atrasadas  = tasks.filter(t => isOverdue(t.due_date, t.status)).length;

  const filteredTasks = tasks.filter(t =>
    (filterStatus   === "todas" || t.status   === filterStatus) &&
    (filterAssignee === "todos" || t.assignee === filterAssignee) &&
    (!searchQuery   || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return (
    <Wrapper><GS />
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:800, color:T.green }}>SPOT</div>
        <div style={{ fontSize:14, color:T.textMuted }}>Carregando...</div>
        <div style={{ width:48, height:4, background:T.greenMid, borderRadius:2, overflow:"hidden" }}>
          <div className="loading-bar" />
        </div>
      </div>
    </Wrapper>
  );

  // ── DETAIL VIEW ───────────────────────────────────────────────
  if (selectedTask) {
    const task     = tasks.find(t => t.id === selectedTask.id) || selectedTask;
    const priority = getPriority(task.priority);
    const status   = getStatus(task.status);
    const assignee = getUser(task.assignee);
    const overdue  = isOverdue(task.due_date, task.status);
    const days     = daysLeft(task.due_date);
    return (
      <Wrapper><GS />
        <div style={{ background:T.green, padding:"0 16px", height:56, display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:50, boxShadow:`0 2px 12px ${T.greenDark}33` }}>
          <Btn onClick={() => setSelectedTask(null)} style={{ width:36, height:36, borderRadius:"50%", background:"rgba(255,255,255,0.15)", color:"#fff", fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</Btn>
          <div style={{ flex:1, color:"#fff", fontSize:15, fontWeight:700, fontFamily:"'Syne',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</div>
          {user?.isManager && <Btn onClick={() => setShowDeleteConfirm(task.id)} style={{ background:"rgba(201,64,64,0.25)", color:"#ffaaaa", padding:"6px 12px", borderRadius:20, fontSize:12 }}>🗑️</Btn>}
          <Btn onClick={() => { setEditForm({...task, due_date:task.due_date||""}); setShowEditTask(true); }} style={{ background:"rgba(255,255,255,0.15)", color:"#fff", padding:"6px 12px", borderRadius:20, fontSize:12 }}>✏️ Editar</Btn>
        </div>
        <div style={{ padding:"16px 16px 100px" }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            <Badge color={status.color} bg={status.bg}>{status.icon} {status.label}</Badge>
            <Badge color={priority.color} bg={priority.bg}>{priority.label}</Badge>
            {overdue && <Badge color={T.red} bg={T.redPale}>🔴 Atrasada</Badge>}
          </div>
          {task.description && <Card mb={12}><SectionLabel>Descrição</SectionLabel><p style={{ fontSize:14, color:T.textMuted, lineHeight:1.75, margin:0 }}>{task.description}</p></Card>}
          {task.internal_note && user?.isManager && (
            <Card mb={12} style={{ background:T.yellowPale, border:`1px solid #E8D080` }}>
              <SectionLabel color={T.yellow}>📝 Nota Interna (só você vê)</SectionLabel>
              <p style={{ fontSize:13, color:"#7A6010", margin:0 }}>{task.internal_note}</p>
            </Card>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <Card>
              <SectionLabel>Responsável</SectionLabel>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <AvatarBadge user={assignee} size={32} />
                <div><div style={{ fontSize:13, fontWeight:700 }}>{assignee?.name}</div><div style={{ fontSize:11, color:T.textMuted }}>{assignee?.role}</div></div>
              </div>
            </Card>
            <Card>
              <SectionLabel>Prazo</SectionLabel>
              <div style={{ fontSize:16, fontWeight:800, color:overdue?T.red:T.text, fontFamily:"'Syne',sans-serif" }}>{fmtDate(task.due_date)}</div>
              {!overdue && days !== null && days <= 3 && days >= 0 && <div style={{ fontSize:11, color:days===0?T.red:T.orange, marginTop:2, fontWeight:600 }}>{days===0?"Hoje!":days===1?"Amanhã":`${days} dias`}</div>}
              {overdue && <div style={{ fontSize:11, color:T.red, marginTop:2, fontWeight:600 }}>Atrasada!</div>}
            </Card>
          </div>
          <Card mb={12}>
            <SectionLabel>Alterar Status</SectionLabel>
            <div style={{ display:"flex", gap:8 }}>
              {STATUSES.map(s => (
                <Btn key={s.value} onClick={() => changeStatus(task.id, s.value)}
                  style={{ flex:1, padding:"10px 4px", borderRadius:12, fontSize:10, textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                    background:task.status===s.value?s.color:T.bg, color:task.status===s.value?"#fff":T.textMuted,
                    border:`2px solid ${task.status===s.value?s.color:T.border}`, fontWeight:task.status===s.value?700:500 }}>
                  <span style={{ fontSize:18 }}>{s.icon}</span><span style={{ lineHeight:1.2 }}>{s.label}</span>
                </Btn>
              ))}
            </div>
          </Card>
          {task.history?.length > 0 && (
            <Card mb={12}>
              <SectionLabel>Histórico</SectionLabel>
              {[...task.history].reverse().map((h, i) => {
                const hu = getUser(h.user_id);
                return (
                  <div key={h.id||i} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
                    <AvatarBadge user={hu} size={24} fontSize={9} />
                    <div><div style={{ fontSize:12, color:T.text }}><span style={{ fontWeight:700, color:hu?.color }}>{h.user_name}</span> — {h.action}</div><div style={{ fontSize:10, color:T.textLight }}>{fmtTs(h.created_at)}</div></div>
                  </div>
                );
              })}
            </Card>
          )}
          <Card mb={12}>
            <SectionLabel>Comentários ({task.comments?.length||0})</SectionLabel>
            {task.comments?.length === 0 && <p style={{ fontSize:13, color:T.textLight, margin:"0 0 12px" }}>Sem comentários ainda.</p>}
            {task.comments?.map(c => {
              const cu = getUser(c.user_id);
              return (
                <div key={c.id} style={{ marginBottom:12, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:cu?.color||T.green }}>{c.user_name}</span>
                    <span style={{ fontSize:10, color:T.textLight }}>{fmtTs(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize:13, color:T.textMuted, margin:0 }}>{c.text}</p>
                </div>
              );
            })}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <input placeholder="Escrever comentário..." value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key==="Enter" && addComment(task.id)}
                style={{ flex:1, background:T.bg, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:12, padding:"10px 14px", fontSize:13, outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
              <Btn onClick={() => addComment(task.id)} style={{ background:T.green, color:"#fff", width:44, borderRadius:12, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>↑</Btn>
            </div>
          </Card>
        </div>
        {showEditTask && editForm && <TaskModal title="Editar Tarefa" accent={T.orange} form={editForm} setForm={setEditForm} onCancel={() => { setShowEditTask(false); setEditForm(null); }} onConfirm={saveEdit} confirmLabel="Salvar" isManager={user?.isManager} />}
        {showDeleteConfirm && <DeleteModal onCancel={() => setShowDeleteConfirm(null)} onConfirm={() => deleteTask(showDeleteConfirm)} />}
      </Wrapper>
    );
  }

  // ── MAIN VIEWS ────────────────────────────────────────────────
  return (
    <Wrapper><GS />
      <div style={{ background:T.green, height:56, padding:"0 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:`0 2px 12px ${T.greenDark}33` }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:"#fff" }}>SPOT</div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {atrasadas > 0 && <div style={{ background:T.red, color:"#fff", borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>🔴 {atrasadas}</div>}
          <Btn onClick={() => setShowUserPicker(true)} style={{ width:38, height:38, borderRadius:"50%", background:"rgba(255,255,255,0.2)", border:"2px solid rgba(255,255,255,0.4)", color:"#fff", fontSize:15, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{user?.avatar}</Btn>
        </div>
      </div>

      <div style={{ padding:"16px 16px 90px" }}>
        {view === "home" && (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:T.text }}>Olá, {user?.name} 👋</div>
              <div style={{ fontSize:13, color:T.textMuted, marginTop:2 }}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
              {[
                { label:"Total",        value:total,      color:T.green,  bg:T.greenPale,  filter:null,           icon:"📋" },
                { label:"Pendentes",    value:pendentes,  color:T.yellow, bg:T.yellowPale, filter:"pendente",     icon:"⏳" },
                { label:"Em Andamento", value:andamento,  color:T.blue,   bg:T.bluePale,   filter:"em_andamento", icon:"🔄" },
                { label:"Concluídas",   value:concluidas, color:T.green,  bg:"#D6F0E2",    filter:"concluida",    icon:"✅" },
              ].map((s, i) => (
                <Btn key={i} onClick={() => { setFilterStatus(s.filter||"todas"); setFilterAssignee("todos"); setSearchQuery(""); setView("tasks"); }}
                  style={{ background:s.bg, borderRadius:20, padding:"20px 16px", borderTop:`4px solid ${s.color}`, textAlign:"left", display:"block", width:"100%", boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }} className="stat-card">
                  <div style={{ fontSize:26, marginBottom:10 }}>{s.icon}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:40, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:12, color:s.color, fontWeight:700, marginTop:6, opacity:0.85 }}>{s.label}</div>
                  <div style={{ fontSize:11, color:s.color, marginTop:4, opacity:0.55 }}>Toque para ver →</div>
                </Btn>
              ))}
            </div>

            {atrasadas > 0 && (
              <Btn onClick={() => { setFilterStatus("todas"); setFilterAssignee("todos"); setSearchQuery(""); setView("tasks"); }}
                style={{ width:"100%", background:T.redPale, borderRadius:16, padding:"16px", marginBottom:16, display:"flex", alignItems:"center", gap:14, border:`1.5px solid ${T.red}44`, textAlign:"left" }}>
                <div style={{ fontSize:36 }}>🔥</div>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.red }}>{atrasadas} atrasada{atrasadas>1?"s":""}</div>
                  <div style={{ fontSize:12, color:T.red, fontWeight:600, marginTop:2 }}>Toque para ver as tarefas</div>
                </div>
              </Btn>
            )}

            <Card mb={20}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:14, fontWeight:700, color:T.text }}>Progresso do Time</span>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.green }}>{total>0?Math.round((concluidas/total)*100):0}%</span>
              </div>
              <div style={{ height:10, background:T.greenMid, borderRadius:6, overflow:"hidden", marginBottom:16 }}>
                <div style={{ height:"100%", width:`${total>0?(concluidas/total)*100:0}%`, background:`linear-gradient(90deg,${T.green},${T.greenLight})`, borderRadius:6, transition:"width 0.6s ease" }} />
              </div>
              {USERS.map(u => {
                const done = tasks.filter(t => t.assignee===u.id && t.status==="concluida").length;
                const tot  = tasks.filter(t => t.assignee===u.id).length;
                const pct  = tot>0?Math.round((done/tot)*100):0;
                return (
                  <Btn key={u.id} onClick={() => { setFilterAssignee(u.id); setFilterStatus("todas"); setSearchQuery(""); setView("tasks"); }}
                    style={{ width:"100%", display:"block", marginBottom:12, textAlign:"left", background:"transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <AvatarBadge user={u} size={26} fontSize={10} />
                        <span style={{ fontSize:13, color:T.text, fontWeight:600 }}>{u.name}</span>
                        <span style={{ fontSize:11, color:T.textLight }}>{u.role}</span>
                      </div>
                      <span style={{ fontSize:12, color:u.color, fontWeight:700 }}>{done}/{tot}</span>
                    </div>
                    <div style={{ height:7, background:T.border, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:u.color, borderRadius:4, transition:"width 0.5s" }} />
                    </div>
                  </Btn>
                );
              })}
            </Card>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, color:T.text }}>Minhas Tarefas</div>
              <Btn onClick={() => { setFilterAssignee(currentUser); setFilterStatus("todas"); setSearchQuery(""); setView("tasks"); }} style={{ fontSize:12, color:T.green, fontWeight:700, background:"transparent" }}>Ver todas →</Btn>
            </div>
            {tasks.filter(t => t.assignee===currentUser && t.status!=="concluida").length === 0
              ? <Empty text="Nenhuma tarefa pendente 🎉" />
              : tasks.filter(t => t.assignee===currentUser && t.status!=="concluida").map(t =>
                  <TaskCard key={t.id} task={t} onClick={() => setSelectedTask(t)} onStatusChange={changeStatus}
                    onEdit={t => { setEditForm({...t, due_date:t.due_date||""}); setShowEditTask(true); }}
                    isManager={user?.isManager} onDelete={id => setShowDeleteConfirm(id)} />
                )
            }
          </div>
        )}

        {view === "tasks" && (
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:T.text, marginBottom:16 }}>Tarefas</div>
            <div style={{ position:"relative", marginBottom:12 }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:T.textLight, fontSize:16 }}>🔍</span>
              <input placeholder="Buscar tarefas..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                style={{ width:"100%", background:T.card, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:14, padding:"13px 14px 13px 42px", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
            </div>
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:8, scrollbarWidth:"none" }}>
              {[["todas","Todos"],["pendente","⏳ Pendente"],["em_andamento","🔄 Andamento"],["concluida","✅ Concluída"]].map(([v,l]) => (
                <FilterPill key={v} active={filterStatus===v} onClick={() => setFilterStatus(v)}>{l}</FilterPill>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8, marginBottom:14, scrollbarWidth:"none" }}>
              {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l]) => (
                <FilterPill key={v} active={filterAssignee===v} onClick={() => setFilterAssignee(v)}>{l}</FilterPill>
              ))}
            </div>
            <div style={{ fontSize:12, color:T.textMuted, marginBottom:12, fontWeight:600 }}>{filteredTasks.length} tarefa(s)</div>
            {filteredTasks.length === 0 ? <Empty text="Nenhuma tarefa encontrada." /> : filteredTasks.map(t =>
              <TaskCard key={t.id} task={t} onClick={() => setSelectedTask(t)} onStatusChange={changeStatus}
                onEdit={t => { setEditForm({...t, due_date:t.due_date||""}); setShowEditTask(true); }}
                isManager={user?.isManager} onDelete={id => setShowDeleteConfirm(id)} />
            )}
          </div>
        )}

        {view === "log" && <ActivityLog log={log} />}
      </div>

      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:680, background:T.card, borderTop:`1px solid ${T.border}`, display:"flex", zIndex:100, boxShadow:"0 -4px 24px rgba(0,0,0,0.08)" }}>
        {[
          { key:"home",  icon:"⊞", label:"Início" },
          { key:"tasks", icon:"☰", label:"Tarefas", badge: tasks.filter(t=>t.status!=="concluida").length },
          { key:"log",   icon:"📋", label:"Log" },
        ].map(item => (
          <Btn key={item.key} onClick={() => setView(item.key)}
            style={{ flex:1, padding:"10px 0 14px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"transparent", borderTop:`3px solid ${view===item.key?T.green:"transparent"}`, position:"relative" }}>
            <span style={{ fontSize:22 }}>{item.icon}</span>
            <span style={{ fontSize:10, fontWeight:view===item.key?700:500, color:view===item.key?T.green:T.textLight }}>{item.label}</span>
            {item.badge > 0 && <div style={{ position:"absolute", top:6, right:"calc(50% - 18px)", background:T.red, color:"#fff", borderRadius:20, minWidth:16, height:16, padding:"0 4px", fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{item.badge}</div>}
          </Btn>
        ))}
        <Btn onClick={() => setShowNewTask(true)} style={{ position:"absolute", right:16, bottom:14, width:54, height:54, borderRadius:"50%", background:T.green, color:"#fff", fontSize:30, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 4px 20px ${T.green}77` }}>+</Btn>
      </div>

      {showUserPicker && (
        <Overlay onClick={() => setShowUserPicker(false)}>
          <div style={{ background:T.card, borderRadius:"22px 22px 0 0", padding:"20px 16px 44px" }} onClick={e => e.stopPropagation()}>
            <Handle />
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:800, marginBottom:4 }}>Trocar Usuário</div>
            <div style={{ fontSize:13, color:T.textMuted, marginBottom:18 }}>Selecione seu perfil</div>
            {USERS.map(u => (
              <Btn key={u.id} onClick={() => handleUserSwitch(u.id)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px", borderRadius:14, marginBottom:10, background:currentUser===u.id?T.greenPale:T.bg, border:`1.5px solid ${currentUser===u.id?T.green:T.border}`, textAlign:"left" }}>
                <AvatarBadge user={u} size={46} fontSize={17} />
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:currentUser===u.id?T.green:T.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:T.textMuted }}>{u.role}{u.isManager?" · Gerente":""}</div>
                </div>
                {currentUser===u.id && <span style={{ marginLeft:"auto", color:T.green, fontSize:24 }}>✓</span>}
              </Btn>
            ))}
          </div>
        </Overlay>
      )}

      {showNewTask && <TaskModal title="Nova Tarefa" accent={T.green} form={newForm} setForm={setNewForm} onCancel={() => setShowNewTask(false)} onConfirm={createTask} confirmLabel="Criar Tarefa" isManager={user?.isManager} />}
      {showEditTask && editForm && <TaskModal title="Editar Tarefa" accent={T.orange} form={editForm} setForm={setEditForm} onCancel={() => { setShowEditTask(false); setEditForm(null); }} onConfirm={saveEdit} confirmLabel="Salvar" isManager={user?.isManager} />}
      {showDeleteConfirm && <DeleteModal onCancel={() => setShowDeleteConfirm(null)} onConfirm={() => deleteTask(showDeleteConfirm)} />}
    </Wrapper>
  );
}

function TaskCard({ task, onClick, onStatusChange, onEdit, isManager, onDelete }) {
  const assignee = getUser(task.assignee);
  const priority = getPriority(task.priority);
  const status   = getStatus(task.status);
  const overdue  = isOverdue(task.due_date, task.status);
  const days     = daysLeft(task.due_date);
  return (
    <div className="task-card" onClick={onClick}
      style={{ background:T.card, borderRadius:18, marginBottom:12, overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.06)", border:`1px solid ${overdue?T.red+"55":T.border}` }}>
      <div style={{ height:5, background:priority.color }} />
      <div style={{ padding:"14px 14px 12px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
          <Btn onClick={e => { e.stopPropagation(); const next=task.status==="pendente"?"em_andamento":task.status==="em_andamento"?"concluida":"pendente"; onStatusChange(task.id,next); }}
            style={{ width:30, height:30, borderRadius:"50%", background:task.status==="concluida"?T.green:T.bg, border:`2px solid ${task.status==="concluida"?T.green:T.greenMid}`, color:"#fff", fontSize:15, flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {task.status==="concluida"?"✓":""}
          </Btn>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:700, color:task.status==="concluida"?T.textLight:T.text, textDecoration:task.status==="concluida"?"line-through":"none", lineHeight:1.35, marginBottom:8 }}>{task.title}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
              <Badge color={status.color} bg={status.bg} size="sm">{status.icon} {status.label}</Badge>
              {overdue && <Badge color={T.red} bg={T.redPale} size="sm">Atrasada</Badge>}
              {!overdue && days===0 && <Badge color={T.red} bg={T.redPale} size="sm">Hoje</Badge>}
              {!overdue && days===1 && <Badge color={T.orange} bg={T.orangePale} size="sm">Amanhã</Badge>}
              {task.comments?.length > 0 && <span style={{ fontSize:11, color:T.textLight }}>💬 {task.comments.length}</span>}
              {task.reminder && <span style={{ fontSize:12 }}>🔔</span>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <AvatarBadge user={assignee} size={24} fontSize={10} />
            <span style={{ fontSize:13, color:assignee?.color, fontWeight:600 }}>{assignee?.name}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {task.due_date && <span style={{ fontSize:12, color:overdue?T.red:T.textLight }}>{fmtDate(task.due_date)}</span>}
            <Btn onClick={e => { e.stopPropagation(); onEdit(task); }} style={{ padding:"6px 12px", borderRadius:10, fontSize:12, background:T.greenPale, color:T.green, border:`1px solid ${T.greenMid}` }}>✏️</Btn>
            {isManager && <Btn onClick={e => { e.stopPropagation(); onDelete(task.id); }} style={{ padding:"6px 12px", borderRadius:10, fontSize:12, background:T.redPale, color:T.red, border:`1px solid ${T.red}33` }}>🗑️</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskModal({ title, accent, form, setForm, onCancel, onConfirm, confirmLabel, isManager }) {
  return (
    <Overlay onClick={onCancel}>
      <div style={{ background:T.card, borderRadius:"22px 22px 0 0", padding:"20px 16px 44px", maxHeight:"92vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
        <Handle />
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:4, height:26, background:accent, borderRadius:2 }} />
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800 }}>{title}</div>
        </div>
        <FieldLabel>Título *</FieldLabel>
        <input placeholder="Ex: Verificar SLA de São Paulo" value={form.title||""} onChange={e => setForm(f=>({...f,title:e.target.value}))} style={inputStyle()} />
        <FieldLabel>Descrição</FieldLabel>
        <textarea placeholder="Detalhes da tarefa (opcional)" value={form.description||""} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={3} style={{ ...inputStyle(), resize:"vertical" }} />
        {isManager && (<>
          <FieldLabel>📝 Nota Interna (só você vê)</FieldLabel>
          <textarea placeholder="Impedimentos, contexto privado..." value={form.internal_note||""} onChange={e => setForm(f=>({...f,internal_note:e.target.value}))} rows={2} style={{ ...inputStyle(), background:T.yellowPale, borderColor:"#E8D080", resize:"vertical" }} />
        </>)}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:4 }}>
          <div>
            <FieldLabel>Responsável</FieldLabel>
            <select value={form.assignee||""} onChange={e => setForm(f=>({...f,assignee:e.target.value}))} style={inputStyle()}>
              {USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Prioridade</FieldLabel>
            <select value={form.priority||""} onChange={e => setForm(f=>({...f,priority:e.target.value}))} style={inputStyle()}>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <FieldLabel>Prazo</FieldLabel>
        <input type="date" value={form.due_date||""} onChange={e => setForm(f=>({...f,due_date:e.target.value}))} style={inputStyle()} />
        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", fontSize:14, color:T.textMuted, marginBottom:24, padding:"13px 14px", background:T.greenPale, borderRadius:12, marginTop:12 }}>
          <input type="checkbox" checked={form.reminder||false} onChange={e => setForm(f=>({...f,reminder:e.target.checked}))} style={{ width:18, height:18 }} />
          🔔 Ativar lembrete para este prazo
        </label>
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={onCancel} style={{ flex:1, padding:15, borderRadius:12, background:T.bg, border:`1px solid ${T.border}`, color:T.textMuted, fontSize:14 }}>Cancelar</Btn>
          <Btn onClick={onConfirm} style={{ flex:2, padding:15, borderRadius:12, background:accent, color:"#fff", fontSize:14, fontWeight:700 }}>{confirmLabel}</Btn>
        </div>
      </div>
    </Overlay>
  );
}

function DeleteModal({ onCancel, onConfirm }) {
  return (
    <Overlay onClick={onCancel}>
      <div style={{ background:T.card, borderRadius:"22px 22px 0 0", padding:"28px 20px 44px" }} onClick={e => e.stopPropagation()}>
        <Handle />
        <div style={{ fontSize:48, textAlign:"center", marginBottom:12 }}>🗑️</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, textAlign:"center", marginBottom:8 }}>Apagar tarefa?</div>
        <p style={{ fontSize:14, color:T.textMuted, textAlign:"center", marginBottom:28 }}>Essa ação não pode ser desfeita.</p>
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={onCancel} style={{ flex:1, padding:15, borderRadius:12, background:T.bg, color:T.textMuted, border:`1px solid ${T.border}`, fontSize:14 }}>Cancelar</Btn>
          <Btn onClick={onConfirm} style={{ flex:1, padding:15, borderRadius:12, background:T.red, color:"#fff", fontSize:14 }}>Apagar</Btn>
        </div>
      </div>
    </Overlay>
  );
}

function ActivityLog({ log }) {
  const [fu, setFu] = useState("todos");
  const [ft, setFt] = useState("todos");
  const filtered = log.filter(e => (fu==="todos"||e.user_id===fu) && (ft==="todos"||e.type===ft));
  return (
    <div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, marginBottom:4 }}>Log de Atividades</div>
      <div style={{ fontSize:13, color:T.textMuted, marginBottom:16 }}>Registro completo de ações</div>
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:8, scrollbarWidth:"none" }}>
        {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l]) => <FilterPill key={v} active={fu===v} onClick={() => setFu(v)}>{l}</FilterPill>)}
      </div>
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8, marginBottom:14, scrollbarWidth:"none" }}>
        {[["todos","Todas"],["login","🔑 Login"],["task_created","➕ Criada"],["task_edited","✏️ Editada"],["status_changed","🔄 Status"],["comment_added","💬 Comentário"],["task_deleted","🗑️ Apagada"]].map(([v,l]) => <FilterPill key={v} active={ft===v} onClick={() => setFt(v)}>{l}</FilterPill>)}
      </div>
      <div style={{ fontSize:12, color:T.textMuted, marginBottom:12, fontWeight:600 }}>{filtered.length} registro(s)</div>
      {filtered.length === 0 ? <Empty text="Nenhum registro." /> : filtered.map(entry => {
        const u = getUser(entry.user_id);
        return (
          <div key={entry.id} style={{ background:T.card, borderRadius:14, padding:"14px", marginBottom:10, border:`1px solid ${T.border}`, display:"flex", gap:12, alignItems:"flex-start" }}>
            <AvatarBadge user={u} size={38} fontSize={13} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:4 }}>
                <span style={{ fontSize:13, fontWeight:700, color:u?.color }}>{u?.name}</span>
                <span style={{ fontSize:11, fontWeight:700, background:T.greenPale, color:T.green, padding:"2px 8px", borderRadius:20 }}>{LOG_ICONS[entry.type]} {TYPE_LABELS[entry.type]}</span>
              </div>
              <div style={{ fontSize:13, color:T.textMuted, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.detail}</div>
              <div style={{ fontSize:10, color:T.textLight, fontFamily:"monospace" }}>{fmtTs(entry.created_at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const Wrapper     = ({ children }) => <div style={{ fontFamily:"'DM Sans',sans-serif", background:T.bg, minHeight:"100vh", color:T.text, maxWidth:680, margin:"0 auto" }}>{children}</div>;
const Btn         = ({ children, onClick, style, className }) => <button onClick={onClick} style={{ cursor:"pointer", border:"none", fontFamily:"'DM Sans',sans-serif", fontWeight:600, ...style }} className={className}>{children}</button>;
const Card        = ({ children, mb=0, style={} }) => <div style={{ background:T.card, borderRadius:18, padding:"18px", marginBottom:mb, border:`1px solid ${T.border}`, ...style }}>{children}</div>;
const Badge       = ({ children, color, bg, size }) => <span style={{ display:"inline-flex", alignItems:"center", gap:3, padding:size==="sm"?"3px 9px":"5px 12px", borderRadius:20, fontSize:11, fontWeight:700, color, background:bg }}>{children}</span>;
const FilterPill  = ({ children, active, onClick }) => <Btn onClick={onClick} style={{ padding:"8px 16px", borderRadius:20, fontSize:12, whiteSpace:"nowrap", flexShrink:0, background:active?T.green:T.card, color:active?"#fff":T.textMuted, border:`1px solid ${active?T.green:T.border}` }}>{children}</Btn>;
const AvatarBadge = ({ user, size=28, fontSize=11 }) => user ? <div style={{ width:size, height:size, borderRadius:"50%", background:user.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize, fontWeight:800, color:"#fff", flexShrink:0 }}>{user.avatar}</div> : null;
const Overlay     = ({ children, onClick }) => <div style={{ position:"fixed", inset:0, background:"rgba(10,30,20,0.6)", zIndex:200, display:"flex", flexDirection:"column", justifyContent:"flex-end", backdropFilter:"blur(3px)" }} onClick={onClick}>{children}</div>;
const Handle      = () => <div style={{ width:44, height:4, background:T.border, borderRadius:2, margin:"0 auto 22px" }} />;
const SectionLabel = ({ children, color }) => <div style={{ fontSize:10, color:color||T.textLight, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>{children}</div>;
const FieldLabel  = ({ children }) => <div style={{ fontSize:11, color:T.textMuted, fontWeight:700, marginBottom:6, marginTop:14 }}>{children}</div>;
const Empty       = ({ text }) => <div style={{ color:T.textLight, fontSize:14, textAlign:"center", padding:"40px 0" }}>{text}</div>;
function inputStyle() { return { width:"100%", background:T.bg, border:`1.5px solid ${T.border}`, color:T.text, borderRadius:12, padding:"13px 14px", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box", display:"block" }; }

function GS() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      ::-webkit-scrollbar { display: none; }
      body { background: #F2F5F3; }
      input, textarea, select { font-family: 'DM Sans', sans-serif; }
      input[type="checkbox"] { accent-color: #1A6B3C; }
      input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.4; }
      select { appearance: none; }
      .task-card { cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 0.12s; }
      .task-card:active { transform: scale(0.98); }
      .stat-card:active { transform: scale(0.97) !important; }
      @keyframes loadbar { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
      .loading-bar { height:100%; width:40%; background:#1A6B3C; border-radius:2px; animation:loadbar 1.2s ease infinite; }
    `}</style>
  );
}
