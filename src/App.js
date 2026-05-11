import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fpjzzewsxdtgacrwsklf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Hss73Qd8Ut2hdNHv9xuFQA_Nhvn0357";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const T = {
  bg:         "#0F1A13",
  bg2:        "#162018",
  card:       "#1C2B21",
  card2:      "#243228",
  border:     "#2A3D2F",
  green:      "#2ECC71",
  greenDark:  "#1A7A42",
  greenGlow:  "#2ECC7133",
  text:       "#F0FFF4",
  textMuted:  "#7DAA88",
  textLight:  "#4A6B52",
  red:        "#E05555",
  redDark:    "#7A1A1A",
  redPale:    "#2A1010",
  orange:     "#E8914A",
  orangeDark: "#7A4010",
  orangePale: "#2A1A08",
  yellow:     "#D4A520",
  yellowDark: "#7A5A10",
  yellowPale: "#201808",
  blue:       "#4A9ED4",
  blueDark:   "#1A4A7A",
  bluePale:   "#0A1A2A",
};

const USERS = [
  { id:"anderson", name:"Anderson", role:"Gerente",         avatar:"A", color:T.green,  isManager:true  },
  { id:"coord1",   name:"Davi",     role:"Coord. de Campo", avatar:"D", color:T.blue,   isManager:false },
  { id:"coord2",   name:"Carol",    role:"Coord. de Campo", avatar:"C", color:T.orange, isManager:false },
];

const PRIORITIES = [
  { value:"alta",  label:"Alta",  color:T.red,    bg:T.redPale    },
  { value:"media", label:"Média", color:T.orange, bg:T.orangePale },
  { value:"baixa", label:"Baixa", color:T.green,  bg:T.greenGlow  },
];

const STATUSES = [
  { value:"pendente",     label:"Pendente",     icon:"⏳", color:T.yellow, bg:T.yellowPale },
  { value:"em_andamento", label:"Em Andamento", icon:"🔄", color:T.blue,   bg:T.bluePale   },
  { value:"concluida",    label:"Concluída",    icon:"✅", color:T.green,  bg:T.greenGlow  },
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
  return new Date(ts).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

export default function SpotTasks() {
  const [currentUser,       setCurrentUser]      = useState(() => load("spot_user", "anderson"));
  const [tasks,             setTasks]            = useState([]);
  const [log,               setLog]              = useState([]);
  const [loading,           setLoading]          = useState(true);
  const [view,              setView]             = useState("home");
  const [selectedTask,      setSelectedTask]     = useState(null);
  const [showNewTask,       setShowNewTask]      = useState(false);
  const [showEditTask,      setShowEditTask]     = useState(false);
  const [showUserPicker,    setShowUserPicker]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [editForm,          setEditForm]         = useState(null);
  const [filterStatus,      setFilterStatus]     = useState("todas");
  const [filterAssignee,    setFilterAssignee]   = useState("todos");
  const [searchQuery,       setSearchQuery]      = useState("");
  const [newComment,        setNewComment]       = useState("");
  const [newForm,           setNewForm]          = useState({ title:"", description:"", internal_note:"", assignee:"anderson", priority:"media", due_date:"", reminder:false });

  useEffect(() => { save("spot_user", currentUser); }, [currentUser]);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("spot-rt")
      .on("postgres_changes", { event:"*", schema:"public", table:"tasks" },        () => fetchAll())
      .on("postgres_changes", { event:"*", schema:"public", table:"comments" },     () => fetchAll())
      .on("postgres_changes", { event:"*", schema:"public", table:"history" },      () => fetchAll())
      .on("postgres_changes", { event:"*", schema:"public", table:"activity_log" }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  async function fetchAll() {
    const [{ data:td }, { data:cd }, { data:hd }, { data:ld }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending:false }),
      supabase.from("comments").select("*").order("created_at", { ascending:true }),
      supabase.from("history").select("*").order("created_at", { ascending:true }),
      supabase.from("activity_log").select("*").order("created_at", { ascending:false }).limit(100),
    ]);
    setTasks((td||[]).map(t => ({ ...t, comments:(cd||[]).filter(c=>c.task_id===t.id), history:(hd||[]).filter(h=>h.task_id===t.id) })));
    setLog(ld||[]);
    setLoading(false);
  }

  const user = getUser(currentUser);

  async function addLog(type, userId, detail) {
    await supabase.from("activity_log").insert({ type, user_id:userId, detail });
  }

  async function createTask() {
    if (!newForm.title.trim()) return;
    await supabase.from("tasks").insert({ title:newForm.title, description:newForm.description, internal_note:newForm.internal_note, assignee:newForm.assignee, priority:newForm.priority, status:"pendente", due_date:newForm.due_date||null, reminder:newForm.reminder });
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
    if (orig.priority !== editForm.priority) changes.push(`prior. → ${getPriority(editForm.priority)?.label}`);
    if (orig.due_date !== editForm.due_date) changes.push(`prazo → ${fmtDate(editForm.due_date)}`);
    await supabase.from("tasks").update({ title:editForm.title, description:editForm.description, internal_note:editForm.internal_note, assignee:editForm.assignee, priority:editForm.priority, due_date:editForm.due_date||null, reminder:editForm.reminder, updated_at:new Date().toISOString() }).eq("id", editForm.id);
    await supabase.from("history").insert({ task_id:editForm.id, user_id:currentUser, user_name:user?.name, action:`Editou: ${changes.join(", ")||"campos"}` });
    await addLog("task_edited", currentUser, `Editou "${editForm.title}"`);
    setShowEditTask(false); setEditForm(null);
  }

  async function changeStatus(id, status) {
    const task = tasks.find(t => t.id === id);
    const oldL = getStatus(task.status)?.label;
    const newL = getStatus(status)?.label;
    await supabase.from("tasks").update({ status, updated_at:new Date().toISOString() }).eq("id", id);
    await supabase.from("history").insert({ task_id:id, user_id:currentUser, user_name:user?.name, action:`Status: ${oldL} → ${newL}` });
    await addLog("status_changed", currentUser, `"${task.title}": ${oldL} → ${newL}`);
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
    await supabase.from("comments").insert({ task_id:taskId, user_id:currentUser, user_name:user?.name, text:newComment });
    await addLog("comment_added", currentUser, `Comentou em "${task.title}"`);
    setNewComment("");
  }

  async function handleUserSwitch(uid) {
    if (uid !== currentUser) { setCurrentUser(uid); await addLog("login", uid, "Sessão iniciada"); }
    setShowUserPicker(false);
  }

  const total      = tasks.length;
  const pendentes  = tasks.filter(t => t.status==="pendente").length;
  const andamento  = tasks.filter(t => t.status==="em_andamento").length;
  const concluidas = tasks.filter(t => t.status==="concluida").length;
  const atrasadas  = tasks.filter(t => isOverdue(t.due_date, t.status)).length;

  const filteredTasks = tasks.filter(t =>
    (filterStatus==="todas"||t.status===filterStatus) &&
    (filterAssignee==="todos"||t.assignee===filterAssignee) &&
    (!searchQuery||t.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return (
    <Shell><GS />
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:16 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:48, fontWeight:800, color:T.green, letterSpacing:-2 }}>SPOT</div>
        <div style={{ fontSize:14, color:T.textMuted }}>Carregando...</div>
        <div style={{ width:48, height:3, background:T.card2, borderRadius:2, overflow:"hidden" }}>
          <div className="lbar" />
        </div>
      </div>
    </Shell>
  );

  // ── DETAIL ────────────────────────────────────────────────────
  if (selectedTask) {
    const task     = tasks.find(t=>t.id===selectedTask.id)||selectedTask;
    const priority = getPriority(task.priority);
    const status   = getStatus(task.status);
    const assignee = getUser(task.assignee);
    const overdue  = isOverdue(task.due_date, task.status);
    const days     = daysLeft(task.due_date);
    return (
      <Shell><GS />
        <div style={{ background:T.bg2, padding:"0 16px", height:60, display:"flex", alignItems:"center", gap:10, flexShrink:0, borderBottom:`1px solid ${T.border}` }}>
          <B onClick={()=>setSelectedTask(null)} style={{ width:38, height:38, borderRadius:12, background:T.card, color:T.text, fontSize:22, display:"flex", alignItems:"center", justifyContent:"center" }}>‹</B>
          <div style={{ flex:1, color:T.text, fontSize:15, fontWeight:700, fontFamily:"'Syne',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.title}</div>
          {user?.isManager&&<B onClick={()=>setShowDeleteConfirm(task.id)} style={{ background:T.redPale, color:T.red, padding:"8px 12px", borderRadius:10, fontSize:13, border:`1px solid ${T.redDark}` }}>🗑️</B>}
          <B onClick={()=>{ setEditForm({...task,due_date:task.due_date||""}); setShowEditTask(true); }} style={{ background:T.card, color:T.textMuted, padding:"8px 12px", borderRadius:10, fontSize:13 }}>✏️</B>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 24px" }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            <Chip color={status.color} bg={status.bg}>{status.icon} {status.label}</Chip>
            <Chip color={priority.color} bg={priority.bg}>{priority.label}</Chip>
            {overdue&&<Chip color={T.red} bg={T.redPale}>🔴 Atrasada</Chip>}
          </div>
          {task.description&&<DCard mb={12}><SL>Descrição</SL><p style={{ fontSize:14,color:T.textMuted,lineHeight:1.7,margin:0 }}>{task.description}</p></DCard>}
          {task.internal_note&&user?.isManager&&(
            <DCard mb={12} style={{ background:T.yellowPale, border:`1px solid ${T.yellowDark}` }}>
              <SL color={T.yellow}>📝 Nota Interna</SL>
              <p style={{ fontSize:13,color:T.yellow,margin:0,opacity:0.9 }}>{task.internal_note}</p>
            </DCard>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <DCard>
              <SL>Responsável</SL>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <Av user={assignee} size={34} />
                <div><div style={{ fontSize:14,fontWeight:700,color:T.text }}>{assignee?.name}</div><div style={{ fontSize:11,color:T.textMuted }}>{assignee?.role}</div></div>
              </div>
            </DCard>
            <DCard>
              <SL>Prazo</SL>
              <div style={{ fontSize:17,fontWeight:800,color:overdue?T.red:T.text,fontFamily:"'Syne',sans-serif" }}>{fmtDate(task.due_date)}</div>
              {!overdue&&days!==null&&days<=3&&days>=0&&<div style={{ fontSize:12,color:days===0?T.red:T.orange,marginTop:2,fontWeight:600 }}>{days===0?"Hoje!":days===1?"Amanhã":`${days} dias`}</div>}
              {overdue&&<div style={{ fontSize:12,color:T.red,marginTop:2,fontWeight:600 }}>Atrasada!</div>}
            </DCard>
          </div>
          <DCard mb={12}>
            <SL>Alterar Status</SL>
            <div style={{ display:"flex", gap:8 }}>
              {STATUSES.map(s=>(
                <B key={s.value} onClick={()=>changeStatus(task.id,s.value)}
                  style={{ flex:1,padding:"12px 4px",borderRadius:12,fontSize:10,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                    background:task.status===s.value?s.color+"22":T.bg, color:task.status===s.value?s.color:T.textMuted,
                    border:`2px solid ${task.status===s.value?s.color:T.border}`, fontWeight:task.status===s.value?700:500 }}>
                  <span style={{ fontSize:20 }}>{s.icon}</span><span>{s.label}</span>
                </B>
              ))}
            </div>
          </DCard>
          {task.history?.length>0&&(
            <DCard mb={12}><SL>Histórico</SL>
              {[...task.history].reverse().map((h,i)=>{
                const hu=getUser(h.user_id);
                return(<div key={h.id||i} style={{ display:"flex",gap:10,marginBottom:10,alignItems:"flex-start" }}>
                  <Av user={hu} size={26} fontSize={10} />
                  <div><div style={{ fontSize:12,color:T.text }}><span style={{ fontWeight:700,color:hu?.color }}>{h.user_name}</span> — {h.action}</div><div style={{ fontSize:10,color:T.textLight }}>{fmtTs(h.created_at)}</div></div>
                </div>);
              })}
            </DCard>
          )}
          <DCard>
            <SL>Comentários ({task.comments?.length||0})</SL>
            {task.comments?.length===0&&<p style={{ fontSize:13,color:T.textLight,margin:"0 0 12px" }}>Sem comentários ainda.</p>}
            {task.comments?.map(c=>{
              const cu=getUser(c.user_id);
              return(<div key={c.id} style={{ marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${T.border}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:12,fontWeight:700,color:cu?.color||T.green }}>{c.user_name}</span>
                  <span style={{ fontSize:10,color:T.textLight }}>{fmtTs(c.created_at)}</span>
                </div>
                <p style={{ fontSize:13,color:T.textMuted,margin:0 }}>{c.text}</p>
              </div>);
            })}
            <div style={{ display:"flex",gap:8,marginTop:8 }}>
              <input placeholder="Escrever comentário..." value={newComment} onChange={e=>setNewComment(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addComment(task.id)}
                style={{ flex:1,background:T.bg,border:`1.5px solid ${T.border}`,color:T.text,borderRadius:12,padding:"12px 14px",fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif" }} />
              <B onClick={()=>addComment(task.id)} style={{ background:T.green,color:T.bg,width:46,borderRadius:12,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800 }}>↑</B>
            </div>
          </DCard>
        </div>
        {showEditTask&&editForm&&<Modal title="Editar" accent={T.orange} form={editForm} setForm={setEditForm} onCancel={()=>{setShowEditTask(false);setEditForm(null);}} onConfirm={saveEdit} confirmLabel="Salvar" isManager={user?.isManager} />}
        {showDeleteConfirm&&<DelModal onCancel={()=>setShowDeleteConfirm(null)} onConfirm={()=>deleteTask(showDeleteConfirm)} />}
      </Shell>
    );
  }

  // ── MAIN ──────────────────────────────────────────────────────
  return (
    <Shell><GS />
      {/* HEADER */}
      <div style={{ padding:"16px 16px 12px", background:T.bg2, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:2 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:T.green, boxShadow:`0 0 6px ${T.green}` }} />
              <span style={{ fontSize:12, color:T.green, fontWeight:600 }}>Conectado</span>
            </div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.text, marginTop:2 }}>
              Olá, {user?.name} {user?.isManager?"🧑‍💼":"👋"}
            </div>
          </div>
          <B onClick={()=>setShowUserPicker(true)}
            style={{ width:44, height:44, borderRadius:14, background:T.card, border:`1.5px solid ${T.border}`, color:T.text, fontSize:18, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:1 }}>
            <Av user={user} size={44} fontSize={17} style={{ borderRadius:14 }} />
          </B>
        </div>
      </div>

      {/* SCROLLABLE */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 80px" }}>

        {/* HOME */}
        {view==="home"&&(
          <div>
            {/* STAT CARDS */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"Total",        value:total,      color:T.green,  bg:T.greenGlow,   filter:null,           icon:"📋" },
                { label:"Pendentes",    value:pendentes,  color:T.yellow, bg:T.yellowPale,  filter:"pendente",     icon:"⏳" },
                { label:"Em Andamento", value:andamento,  color:T.blue,   bg:T.bluePale,    filter:"em_andamento", icon:"🔄" },
                { label:"Concluídas",   value:concluidas, color:T.green,  bg:T.greenGlow,   filter:"concluida",    icon:"✅" },
              ].map((s,i)=>(
                <B key={i} onClick={()=>{ setFilterStatus(s.filter||"todas"); setFilterAssignee("todos"); setSearchQuery(""); setView("tasks"); }}
                  style={{ background:T.card, borderRadius:18, padding:"16px", border:`1px solid ${T.border}`, textAlign:"left", display:"block", width:"100%", borderLeft:`4px solid ${s.color}` }} className="scard">
                  <div style={{ fontSize:13, color:s.color, fontWeight:600, marginBottom:8 }}>{s.icon} {s.label}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:T.textLight, marginTop:6 }}>Toque para ver →</div>
                </B>
              ))}
            </div>

            {/* ATRASADAS */}
            {atrasadas>0&&(
              <B onClick={()=>{ setFilterStatus("todas"); setFilterAssignee("todos"); setSearchQuery(""); setView("tasks"); }}
                style={{ width:"100%", background:T.redPale, borderRadius:16, padding:"16px", marginBottom:14, display:"flex", alignItems:"center", gap:14, border:`1px solid ${T.redDark}`, textAlign:"left" }}>
                <div style={{ fontSize:36 }}>🔥</div>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.red }}>{atrasadas} atrasada{atrasadas>1?"s":""}</div>
                  <div style={{ fontSize:12, color:T.red, opacity:0.8, marginTop:2 }}>Toque para ver</div>
                </div>
                <div style={{ marginLeft:"auto", color:T.red, fontSize:20 }}>›</div>
              </B>
            )}

            {/* PROGRESSO */}
            <DCard mb={14}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <span style={{ fontSize:14, fontWeight:700, color:T.text }}>Progresso do Time</span>
                <span style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.green }}>{total>0?Math.round((concluidas/total)*100):0}%</span>
              </div>
              <div style={{ height:8, background:T.card2, borderRadius:6, overflow:"hidden", marginBottom:14 }}>
                <div style={{ height:"100%", width:`${total>0?(concluidas/total)*100:0}%`, background:`linear-gradient(90deg,${T.greenDark},${T.green})`, borderRadius:6, transition:"width 0.6s" }} />
              </div>
              {USERS.map(u=>{
                const done=tasks.filter(t=>t.assignee===u.id&&t.status==="concluida").length;
                const tot=tasks.filter(t=>t.assignee===u.id).length;
                const pct=tot>0?Math.round((done/tot)*100):0;
                return(
                  <B key={u.id} onClick={()=>{ setFilterAssignee(u.id); setFilterStatus("todas"); setSearchQuery(""); setView("tasks"); }}
                    style={{ width:"100%", display:"block", marginBottom:12, textAlign:"left", background:"transparent" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Av user={u} size={28} fontSize={11} />
                        <span style={{ fontSize:14, color:T.text, fontWeight:600 }}>{u.name}</span>
                        <span style={{ fontSize:11, color:T.textLight }}>{u.role}</span>
                      </div>
                      <span style={{ fontSize:13, color:u.color, fontWeight:700 }}>{done}/{tot}</span>
                    </div>
                    <div style={{ height:6, background:T.card2, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, background:u.color, borderRadius:4, transition:"width 0.5s" }} />
                    </div>
                  </B>
                );
              })}
            </DCard>

            {/* MINHAS TAREFAS */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:800, color:T.text }}>Minhas Tarefas</div>
              <B onClick={()=>{ setFilterAssignee(currentUser); setFilterStatus("todas"); setSearchQuery(""); setView("tasks"); }} style={{ fontSize:13, color:T.green, fontWeight:700, background:"transparent" }}>Ver todas →</B>
            </div>

            {tasks.filter(t=>t.assignee===currentUser&&t.status!=="concluida").length===0
              ?<div style={{ background:T.card, borderRadius:16, padding:"28px 20px", textAlign:"center", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🎉</div>
                <div style={{ fontSize:15, color:T.textMuted, fontWeight:600 }}>Nenhuma tarefa pendente!</div>
              </div>
              :tasks.filter(t=>t.assignee===currentUser&&t.status!=="concluida").map(t=>
                <TCard key={t.id} task={t} onClick={()=>setSelectedTask(t)} onStatusChange={changeStatus}
                  onEdit={t=>{ setEditForm({...t,due_date:t.due_date||""}); setShowEditTask(true); }}
                  isManager={user?.isManager} onDelete={id=>setShowDeleteConfirm(id)} />
              )
            }
          </div>
        )}

        {/* TASKS */}
        {view==="tasks"&&(
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:T.text, marginBottom:14 }}>Tarefas</div>
            <div style={{ position:"relative", marginBottom:12 }}>
              <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:T.textLight, fontSize:16 }}>🔍</span>
              <input placeholder="Buscar tarefas..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                style={{ width:"100%", background:T.card, border:`1px solid ${T.border}`, color:T.text, borderRadius:14, padding:"13px 14px 13px 44px", fontSize:14, outline:"none", fontFamily:"'DM Sans',sans-serif" }} />
            </div>
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:8, scrollbarWidth:"none" }}>
              {[["todas","Todos"],["pendente","⏳ Pendente"],["em_andamento","🔄 Andamento"],["concluida","✅ Concluída"]].map(([v,l])=>(
                <FP key={v} active={filterStatus===v} onClick={()=>setFilterStatus(v)}>{l}</FP>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8, marginBottom:12, scrollbarWidth:"none" }}>
              {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l])=>(
                <FP key={v} active={filterAssignee===v} onClick={()=>setFilterAssignee(v)}>{l}</FP>
              ))}
            </div>
            <div style={{ fontSize:12, color:T.textLight, marginBottom:12, fontWeight:600 }}>{filteredTasks.length} tarefa(s)</div>
            {filteredTasks.length===0
              ?<div style={{ background:T.card, borderRadius:16, padding:"28px 20px", textAlign:"center", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:14, color:T.textMuted }}>Nenhuma tarefa encontrada.</div>
              </div>
              :filteredTasks.map(t=>
                <TCard key={t.id} task={t} onClick={()=>setSelectedTask(t)} onStatusChange={changeStatus}
                  onEdit={t=>{ setEditForm({...t,due_date:t.due_date||""}); setShowEditTask(true); }}
                  isManager={user?.isManager} onDelete={id=>setShowDeleteConfirm(id)} />
              )
            }
          </div>
        )}

        {/* LOG */}
        {view==="log"&&<ALog log={log} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ background:T.bg2, borderTop:`1px solid ${T.border}`, display:"flex", flexShrink:0, paddingBottom:"env(safe-area-inset-bottom)", position:"relative" }}>
        {[
          { key:"home",  icon:"⊞", label:"Início" },
          { key:"tasks", icon:"☰", label:"Tarefas", badge:tasks.filter(t=>t.status!=="concluida").length },
          { key:"log",   icon:"📋", label:"Log" },
        ].map(item=>(
          <B key={item.key} onClick={()=>setView(item.key)}
            style={{ flex:1, padding:"12px 0 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:3, background:"transparent", borderTop:`2px solid ${view===item.key?T.green:"transparent"}`, position:"relative" }}>
            <span style={{ fontSize:22 }}>{item.icon}</span>
            <span style={{ fontSize:10, fontWeight:view===item.key?700:500, color:view===item.key?T.green:T.textLight }}>{item.label}</span>
            {item.badge>0&&<div style={{ position:"absolute", top:8, right:"calc(50% - 20px)", background:T.red, color:"#fff", borderRadius:20, minWidth:18, height:18, padding:"0 5px", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{item.badge}</div>}
          </B>
        ))}
        <B onClick={()=>setShowNewTask(true)} style={{ position:"absolute", right:16, bottom:14, width:52, height:52, borderRadius:16, background:T.green, color:T.bg, fontSize:28, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:`0 4px 20px ${T.green}66`, fontWeight:800 }}>+</B>
      </div>

      {/* USER PICKER */}
      {showUserPicker&&(
        <Ov onClick={()=>setShowUserPicker(false)}>
          <div style={{ background:T.bg2, borderRadius:"22px 22px 0 0", padding:"20px 16px 40px", border:`1px solid ${T.border}` }} onClick={e=>e.stopPropagation()}>
            <Handle />
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800, color:T.text, marginBottom:4 }}>Trocar Usuário</div>
            <div style={{ fontSize:13, color:T.textMuted, marginBottom:18 }}>Selecione seu perfil</div>
            {USERS.map(u=>(
              <B key={u.id} onClick={()=>handleUserSwitch(u.id)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"16px", borderRadius:14, marginBottom:10, background:currentUser===u.id?T.card2:T.card, border:`1.5px solid ${currentUser===u.id?u.color:T.border}`, textAlign:"left" }}>
                <Av user={u} size={48} fontSize={18} />
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:currentUser===u.id?u.color:T.text }}>{u.name}</div>
                  <div style={{ fontSize:12, color:T.textMuted }}>{u.role}{u.isManager?" · Gerente":""}</div>
                </div>
                {currentUser===u.id&&<span style={{ marginLeft:"auto", color:u.color, fontSize:24 }}>✓</span>}
              </B>
            ))}
          </div>
        </Ov>
      )}

      {showNewTask&&<Modal title="Nova Tarefa" accent={T.green} form={newForm} setForm={setNewForm} onCancel={()=>setShowNewTask(false)} onConfirm={createTask} confirmLabel="Criar Tarefa" isManager={user?.isManager} />}
      {showEditTask&&editForm&&<Modal title="Editar Tarefa" accent={T.orange} form={editForm} setForm={setEditForm} onCancel={()=>{setShowEditTask(false);setEditForm(null);}} onConfirm={saveEdit} confirmLabel="Salvar" isManager={user?.isManager} />}
      {showDeleteConfirm&&<DelModal onCancel={()=>setShowDeleteConfirm(null)} onConfirm={()=>deleteTask(showDeleteConfirm)} />}
    </Shell>
  );
}

function TCard({ task, onClick, onStatusChange, onEdit, isManager, onDelete }) {
  const assignee = getUser(task.assignee);
  const priority = getPriority(task.priority);
  const status   = getStatus(task.status);
  const overdue  = isOverdue(task.due_date, task.status);
  const days     = daysLeft(task.due_date);
  return (
    <div className="tcard" onClick={onClick}
      style={{ background:T.card, borderRadius:16, marginBottom:10, overflow:"hidden", border:`1px solid ${overdue?T.redDark:T.border}` }}>
      <div style={{ height:3, background:priority.color, opacity:0.8 }} />
      <div style={{ padding:"14px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
          <B onClick={e=>{ e.stopPropagation(); const next=task.status==="pendente"?"em_andamento":task.status==="em_andamento"?"concluida":"pendente"; onStatusChange(task.id,next); }}
            style={{ width:30, height:30, borderRadius:8, background:task.status==="concluida"?T.greenGlow:T.card2, border:`1.5px solid ${task.status==="concluida"?T.green:T.border}`, color:T.green, fontSize:14, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {task.status==="concluida"?"✓":""}
          </B>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:600, color:task.status==="concluida"?T.textLight:T.text, textDecoration:task.status==="concluida"?"line-through":"none", lineHeight:1.3, marginBottom:8 }}>{task.title}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              <Chip color={status.color} bg={status.bg} sm>{status.icon} {status.label}</Chip>
              {overdue&&<Chip color={T.red} bg={T.redPale} sm>Atrasada</Chip>}
              {!overdue&&days===0&&<Chip color={T.red} bg={T.redPale} sm>Hoje</Chip>}
              {!overdue&&days===1&&<Chip color={T.orange} bg={T.orangePale} sm>Amanhã</Chip>}
              {task.comments?.length>0&&<span style={{ fontSize:11, color:T.textLight }}>💬 {task.comments.length}</span>}
              {task.reminder&&<span style={{ fontSize:11 }}>🔔</span>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:12, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <Av user={assignee} size={24} fontSize={10} />
            <span style={{ fontSize:12, color:assignee?.color, fontWeight:600 }}>{assignee?.name}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {task.due_date&&<span style={{ fontSize:11, color:overdue?T.red:T.textLight }}>{fmtDate(task.due_date)}</span>}
            <B onClick={e=>{ e.stopPropagation(); onEdit(task); }} style={{ padding:"6px 10px", borderRadius:8, fontSize:12, background:T.card2, color:T.textMuted, border:`1px solid ${T.border}` }}>✏️</B>
            {isManager&&<B onClick={e=>{ e.stopPropagation(); onDelete(task.id); }} style={{ padding:"6px 10px", borderRadius:8, fontSize:12, background:T.redPale, color:T.red, border:`1px solid ${T.redDark}` }}>🗑️</B>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, accent, form, setForm, onCancel, onConfirm, confirmLabel, isManager }) {
  return (
    <Ov onClick={onCancel}>
      <div style={{ background:T.bg2, borderRadius:"22px 22px 0 0", padding:"20px 16px 40px", maxHeight:"92vh", overflowY:"auto", border:`1px solid ${T.border}` }} onClick={e=>e.stopPropagation()}>
        <Handle />
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
          <div style={{ width:4, height:28, background:accent, borderRadius:2 }} />
          <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, color:T.text }}>{title}</div>
        </div>
        <FL>Título *</FL>
        <input placeholder="Ex: Verificar SLA de São Paulo" value={form.title||""} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={IS()} />
        <FL>Descrição</FL>
        <textarea placeholder="Detalhes (opcional)" value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} style={{ ...IS(), resize:"vertical" }} />
        {isManager&&(<>
          <FL>📝 Nota Interna (só você vê)</FL>
          <textarea placeholder="Impedimentos, contexto..." value={form.internal_note||""} onChange={e=>setForm(f=>({...f,internal_note:e.target.value}))} rows={2} style={{ ...IS(), background:T.yellowPale, borderColor:T.yellowDark, resize:"vertical" }} />
        </>)}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div><FL>Responsável</FL>
            <select value={form.assignee||""} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))} style={IS()}>
              {USERS.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div><FL>Prioridade</FL>
            <select value={form.priority||""} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={IS()}>
              {PRIORITIES.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <FL>Prazo</FL>
        <input type="date" value={form.due_date||""} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={IS()} />
        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", fontSize:14, color:T.textMuted, marginBottom:24, padding:"14px", background:T.greenGlow, borderRadius:12, marginTop:12, border:`1px solid ${T.greenDark}` }}>
          <input type="checkbox" checked={form.reminder||false} onChange={e=>setForm(f=>({...f,reminder:e.target.checked}))} style={{ width:20, height:20 }} />
          🔔 Ativar lembrete
        </label>
        <div style={{ display:"flex", gap:10 }}>
          <B onClick={onCancel} style={{ flex:1, padding:16, borderRadius:12, background:T.card, border:`1px solid ${T.border}`, color:T.textMuted, fontSize:15 }}>Cancelar</B>
          <B onClick={onConfirm} style={{ flex:2, padding:16, borderRadius:12, background:accent, color:accent===T.green?T.bg:"#fff", fontSize:15, fontWeight:700 }}>{confirmLabel}</B>
        </div>
      </div>
    </Ov>
  );
}

function DelModal({ onCancel, onConfirm }) {
  return (
    <Ov onClick={onCancel}>
      <div style={{ background:T.bg2, borderRadius:"22px 22px 0 0", padding:"32px 20px 44px", border:`1px solid ${T.border}` }} onClick={e=>e.stopPropagation()}>
        <Handle />
        <div style={{ fontSize:52, textAlign:"center", marginBottom:12 }}>🗑️</div>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:800, textAlign:"center", color:T.text, marginBottom:8 }}>Apagar tarefa?</div>
        <p style={{ fontSize:14, color:T.textMuted, textAlign:"center", marginBottom:28 }}>Essa ação não pode ser desfeita.</p>
        <div style={{ display:"flex", gap:10 }}>
          <B onClick={onCancel} style={{ flex:1, padding:16, borderRadius:12, background:T.card, color:T.textMuted, border:`1px solid ${T.border}`, fontSize:15 }}>Cancelar</B>
          <B onClick={onConfirm} style={{ flex:1, padding:16, borderRadius:12, background:T.red, color:"#fff", fontSize:15 }}>Apagar</B>
        </div>
      </div>
    </Ov>
  );
}

function ALog({ log }) {
  const [fu, setFu] = useState("todos");
  const [ft, setFt] = useState("todos");
  const filtered = log.filter(e=>(fu==="todos"||e.user_id===fu)&&(ft==="todos"||e.type===ft));
  return (
    <div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:24, fontWeight:800, color:T.text, marginBottom:4 }}>Log</div>
      <div style={{ fontSize:13, color:T.textMuted, marginBottom:14 }}>Registro de ações</div>
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:8, scrollbarWidth:"none" }}>
        {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l])=><FP key={v} active={fu===v} onClick={()=>setFu(v)}>{l}</FP>)}
      </div>
      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8, marginBottom:12, scrollbarWidth:"none" }}>
        {[["todos","Todas"],["login","🔑"],["task_created","➕"],["task_edited","✏️"],["status_changed","🔄"],["comment_added","💬"],["task_deleted","🗑️"]].map(([v,l])=><FP key={v} active={ft===v} onClick={()=>setFt(v)}>{l} {TYPE_LABELS[v]||"Todas"}</FP>)}
      </div>
      <div style={{ fontSize:12, color:T.textLight, marginBottom:12, fontWeight:600 }}>{filtered.length} registro(s)</div>
      {filtered.length===0
        ?<DCard><div style={{ fontSize:14, color:T.textMuted, textAlign:"center", padding:"20px 0" }}>Nenhum registro.</div></DCard>
        :filtered.map(entry=>{
          const u=getUser(entry.user_id);
          return(
            <div key={entry.id} style={{ background:T.card, borderRadius:14, padding:"14px", marginBottom:10, border:`1px solid ${T.border}`, display:"flex", gap:12, alignItems:"flex-start" }}>
              <Av user={u} size={40} fontSize={14} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4, flexWrap:"wrap", gap:4 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:u?.color }}>{u?.name}</span>
                  <span style={{ fontSize:11, fontWeight:700, background:T.greenGlow, color:T.green, padding:"2px 8px", borderRadius:20 }}>{LOG_ICONS[entry.type]} {TYPE_LABELS[entry.type]}</span>
                </div>
                <div style={{ fontSize:13, color:T.textMuted, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{entry.detail}</div>
                <div style={{ fontSize:10, color:T.textLight, fontFamily:"monospace" }}>{fmtTs(entry.created_at)}</div>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

const Shell  = ({children}) => <div style={{ fontFamily:"'DM Sans',sans-serif", background:T.bg, height:"100dvh", display:"flex", flexDirection:"column", color:T.text, maxWidth:480, margin:"0 auto", overflow:"hidden" }}>{children}</div>;
const B      = ({children,onClick,style,className}) => <button onClick={onClick} style={{ cursor:"pointer",border:"none",fontFamily:"'DM Sans',sans-serif",fontWeight:600,...style }} className={className}>{children}</button>;
const DCard  = ({children,mb=0,style={}}) => <div style={{ background:T.card,borderRadius:16,padding:"16px",marginBottom:mb,border:`1px solid ${T.border}`,...style }}>{children}</div>;
const Chip   = ({children,color,bg,sm}) => <span style={{ display:"inline-flex",alignItems:"center",gap:3,padding:sm?"3px 8px":"5px 11px",borderRadius:20,fontSize:sm?11:12,fontWeight:700,color,background:bg }}>{children}</span>;
const FP     = ({children,active,onClick}) => <B onClick={onClick} style={{ padding:"8px 16px",borderRadius:20,fontSize:13,whiteSpace:"nowrap",flexShrink:0,background:active?T.green:T.card,color:active?T.bg:T.textMuted,border:`1px solid ${active?T.green:T.border}`,fontWeight:active?700:500 }}>{children}</B>;
const Av     = ({user,size=28,fontSize=11}) => user?<div style={{ width:size,height:size,borderRadius:"50%",background:user.color+"33",border:`2px solid ${user.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize,fontWeight:800,color:user.color,flexShrink:0 }}>{user.avatar}</div>:null;
const Ov     = ({children,onClick}) => <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",backdropFilter:"blur(4px)" }} onClick={onClick}>{children}</div>;
const Handle = () => <div style={{ width:44,height:4,background:T.border,borderRadius:2,margin:"0 auto 22px" }} />;
const SL     = ({children,color}) => <div style={{ fontSize:10,color:color||T.textLight,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:8 }}>{children}</div>;
const FL     = ({children}) => <div style={{ fontSize:12,color:T.textMuted,fontWeight:700,marginBottom:6,marginTop:14 }}>{children}</div>;
function IS() { return { width:"100%",background:T.bg,border:`1.5px solid ${T.border}`,color:T.text,borderRadius:12,padding:"14px",fontSize:15,outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box",display:"block" }; }

function GS() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
      *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
      ::-webkit-scrollbar { display:none; }
      html, body, #root { height:100%; height:100dvh; overflow:hidden; background:#0F1A13; }
      input, textarea, select { font-family:'DM Sans',sans-serif; color-scheme:dark; }
      input[type="checkbox"] { accent-color:#2ECC71; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter:invert(1); opacity:0.5; }
      select { appearance:none; }
      .tcard { cursor:pointer; -webkit-tap-highlight-color:transparent; transition:transform 0.1s,opacity 0.1s; }
      .tcard:active { transform:scale(0.98); opacity:0.85; }
      .scard:active { transform:scale(0.97) !important; opacity:0.85; }
      @keyframes lbar { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
      .lbar { height:100%; width:40%; background:#2ECC71; border-radius:2px; animation:lbar 1.2s ease infinite; }
    `}</style>
  );
}
