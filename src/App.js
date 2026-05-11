import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fpjzzewsxdtgacrwsklf.supabase.co";
const SUPABASE_KEY = "sb_publishable_Hss73Qd8Ut2hdNHv9xuFQA_Nhvn0357";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const T = {
  bg:       "#0D1810", bg2:"#131F15", bg3:"#192B1C",
  card:     "#1A2B1D", card2:"#202E23", border:"#253529",
  green:    "#3DD68C", greenD:"#1A6B3C", greenG:"#3DD68C22",
  text:     "#F0FFF4", textM:"#6B9A78", textL:"#3A5A42",
  red:      "#E05555", redD:"#5A1A1A", redP:"#200D0D",
  orange:   "#E8914A", orangeD:"#5A3010", orangeP:"#1E1208",
  yellow:   "#D4A520", yellowD:"#5A4010", yellowP:"#1A1408",
  blue:     "#4AA8E0", blueD:"#1A3A5A", blueP:"#0A1520",
};

const USERS = [
  { id:"anderson", name:"Anderson", role:"Gerente",   avatar:"A", color:T.green,  isManager:true  },
  { id:"coord1",   name:"Davi",     role:"Campo",     avatar:"D", color:T.blue,   isManager:false },
  { id:"coord2",   name:"Carol",    role:"Campo",     avatar:"C", color:T.orange, isManager:false },
];
const PRIOS = [
  { value:"alta",  label:"Alta",  color:T.red,    bg:T.redP    },
  { value:"media", label:"Média", color:T.orange, bg:T.orangeP },
  { value:"baixa", label:"Baixa", color:T.green,  bg:T.greenG  },
];
const STATS = [
  { value:"pendente",     label:"Pendente",  icon:"⏳", color:T.yellow, bg:T.yellowP },
  { value:"em_andamento", label:"Andamento", icon:"🔄", color:T.blue,   bg:T.blueP   },
  { value:"concluida",    label:"Concluída", icon:"✅", color:T.green,  bg:T.greenG  },
];
const LICONS = { login:"🔑", task_created:"➕", status_changed:"🔄", comment_added:"💬", task_edited:"✏️", task_deleted:"🗑️" };
const LLABELS = { login:"Login", task_created:"Criada", status_changed:"Status", comment_added:"Comentário", task_edited:"Editada", task_deleted:"Apagada" };

const gU = id  => USERS.find(u=>u.id===id);
const gP = val => PRIOS.find(p=>p.value===val);
const gS = val => STATS.find(s=>s.value===val);

function fd(d) { if(!d)return"—"; return new Date(d+"T00:00:00").toLocaleDateString("pt-BR",{day:"2-digit",month:"short"}); }
function dl(d) { if(!d)return null; return Math.ceil((new Date(d+"T00:00:00")-new Date())/86400000); }
function ov(d,s) { if(!d||s==="concluida")return false; return new Date(d+"T00:00:00")<new Date(); }
function ld(k,fb) { try{const v=localStorage.getItem(k);return v?JSON.parse(v):fb;}catch{return fb;} }
function sv(k,v) { try{localStorage.setItem(k,JSON.stringify(v));}catch{} }
function ft(ts) { return new Date(ts).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}); }

export default function App() {
  const [me,      setMe]      = useState(()=>ld("spot_u","anderson"));
  const [tasks,   setTasks]   = useState([]);
  const [log,     setLog]     = useState([]);
  const [busy,    setBusy]    = useState(true);
  const [page,    setPage]    = useState("home"); // home | tasks | log
  const [detail,  setDetail]  = useState(null);
  const [newTask, setNewTask] = useState(false);
  const [editT,   setEditT]   = useState(null);
  const [delId,   setDelId]   = useState(null);
  const [picker,  setPicker]  = useState(false);
  const [fSt,     setFSt]     = useState("todas");
  const [fAs,     setFAs]     = useState("todos");
  const [q,       setQ]       = useState("");
  const [cmt,     setCmt]     = useState("");
  const [form,    setForm]    = useState({title:"",description:"",internal_note:"",assignee:"anderson",priority:"media",due_date:"",reminder:false});

  useEffect(()=>{sv("spot_u",me);},[me]);

  useEffect(()=>{
    load();
    const ch=supabase.channel("sp")
      .on("postgres_changes",{event:"*",schema:"public",table:"tasks"},     ()=>load())
      .on("postgres_changes",{event:"*",schema:"public",table:"comments"},  ()=>load())
      .on("postgres_changes",{event:"*",schema:"public",table:"history"},   ()=>load())
      .on("postgres_changes",{event:"*",schema:"public",table:"activity_log"},()=>load())
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[]);

  async function load() {
    const [{data:td},{data:cd},{data:hd},{data:ld2}]=await Promise.all([
      supabase.from("tasks").select("*").order("created_at",{ascending:false}),
      supabase.from("comments").select("*").order("created_at",{ascending:true}),
      supabase.from("history").select("*").order("created_at",{ascending:true}),
      supabase.from("activity_log").select("*").order("created_at",{ascending:false}).limit(100),
    ]);
    setTasks((td||[]).map(t=>({...t,comments:(cd||[]).filter(c=>c.task_id===t.id),history:(hd||[]).filter(h=>h.task_id===t.id)})));
    setLog(ld2||[]);
    setBusy(false);
  }

  const user=gU(me);

  async function aLog(type,uid,detail){await supabase.from("activity_log").insert({type,user_id:uid,detail});}

  async function doCreate(){
    if(!form.title.trim())return;
    await supabase.from("tasks").insert({title:form.title,description:form.description,internal_note:form.internal_note,assignee:form.assignee,priority:form.priority,status:"pendente",due_date:form.due_date||null,reminder:form.reminder});
    await aLog("task_created",me,`Criou "${form.title}" → ${gU(form.assignee)?.name}`);
    setForm({title:"",description:"",internal_note:"",assignee:"anderson",priority:"media",due_date:"",reminder:false});
    setNewTask(false);
  }

  async function doEdit(){
    if(!editT?.title.trim())return;
    const orig=tasks.find(t=>t.id===editT.id);
    const ch=[];
    if(orig.title!==editT.title)ch.push("título");
    if(orig.assignee!==editT.assignee)ch.push(`resp→${gU(editT.assignee)?.name}`);
    if(orig.priority!==editT.priority)ch.push(`prior.→${gP(editT.priority)?.label}`);
    if(orig.due_date!==editT.due_date)ch.push(`prazo→${fd(editT.due_date)}`);
    await supabase.from("tasks").update({title:editT.title,description:editT.description,internal_note:editT.internal_note,assignee:editT.assignee,priority:editT.priority,due_date:editT.due_date||null,reminder:editT.reminder,updated_at:new Date().toISOString()}).eq("id",editT.id);
    await supabase.from("history").insert({task_id:editT.id,user_id:me,user_name:user?.name,action:`Editou: ${ch.join(", ")||"campos"}`});
    await aLog("task_edited",me,`Editou "${editT.title}"`);
    setEditT(null);
  }

  async function doStatus(id,status){
    const task=tasks.find(t=>t.id===id);
    const oL=gS(task.status)?.label, nL=gS(status)?.label;
    await supabase.from("tasks").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    await supabase.from("history").insert({task_id:id,user_id:me,user_name:user?.name,action:`${oL}→${nL}`});
    await aLog("status_changed",me,`"${task.title}": ${oL}→${nL}`);
  }

  async function doDel(id){
    const task=tasks.find(t=>t.id===id);
    await supabase.from("tasks").delete().eq("id",id);
    await aLog("task_deleted",me,`Apagou "${task?.title}"`);
    setDelId(null);
    if(detail?.id===id)setDetail(null);
  }

  async function doCmt(tid){
    if(!cmt.trim())return;
    const task=tasks.find(t=>t.id===tid);
    await supabase.from("comments").insert({task_id:tid,user_id:me,user_name:user?.name,text:cmt});
    await aLog("comment_added",me,`Comentou em "${task.title}"`);
    setCmt("");
  }

  async function doSwitch(uid){
    if(uid!==me){setMe(uid);await aLog("login",uid,"Sessão iniciada");}
    setPicker(false);
  }

  const total=tasks.length;
  const pend=tasks.filter(t=>t.status==="pendente").length;
  const prog=tasks.filter(t=>t.status==="em_andamento").length;
  const conc=tasks.filter(t=>t.status==="concluida").length;
  const atras=tasks.filter(t=>ov(t.due_date,t.status)).length;

  const filtered=tasks.filter(t=>
    (fSt==="todas"||t.status===fSt)&&
    (fAs==="todos"||t.assignee===fAs)&&
    (!q||t.title.toLowerCase().includes(q.toLowerCase()))
  );

  // ── LOADING ──────────────────────────────────────────────────
  if(busy) return(
    <Shell><GS/>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,gap:12}}>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:52,fontWeight:800,color:T.green,letterSpacing:-2}}>SPOT</div>
        <div style={{width:48,height:3,background:T.card2,borderRadius:2,overflow:"hidden"}}><div className="lb"/></div>
      </div>
    </Shell>
  );

  // ── DETAIL ───────────────────────────────────────────────────
  if(detail){
    const task=tasks.find(t=>t.id===detail.id)||detail;
    const pr=gP(task.priority),st=gS(task.status),as=gU(task.assignee);
    const over=ov(task.due_date,task.status),days=dl(task.due_date);
    return(
      <Shell><GS/>
        <TopBar>
          <Btn onClick={()=>setDetail(null)} style={{width:38,height:38,borderRadius:10,background:T.card2,color:T.text,fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</Btn>
          <div style={{flex:1,color:T.text,fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",margin:"0 8px"}}>{task.title}</div>
          {user?.isManager&&<Btn onClick={()=>setDelId(task.id)} style={{background:T.redP,color:T.red,padding:"8px 10px",borderRadius:10,fontSize:13,border:`1px solid ${T.redD}`}}>🗑️</Btn>}
          <Btn onClick={()=>setEditT({...task,due_date:task.due_date||""})} style={{background:T.card2,color:T.textM,padding:"8px 10px",borderRadius:10,fontSize:13,marginLeft:6}}>✏️</Btn>
        </TopBar>
        <div style={{flex:1,overflowY:"auto",padding:"14px 14px 20px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
            <Ch color={st.color} bg={st.bg}>{st.icon} {st.label}</Ch>
            <Ch color={pr.color} bg={pr.bg}>{pr.label}</Ch>
            {over&&<Ch color={T.red} bg={T.redP}>🔴 Atrasada</Ch>}
          </div>
          {task.description&&<C mb={10}><SL>Descrição</SL><p style={{fontSize:14,color:T.textM,lineHeight:1.7,margin:0}}>{task.description}</p></C>}
          {task.internal_note&&user?.isManager&&<C mb={10} style={{background:T.yellowP,border:`1px solid ${T.yellowD}`}}><SL color={T.yellow}>📝 Nota Interna</SL><p style={{fontSize:13,color:T.yellow,margin:0,opacity:0.9}}>{task.internal_note}</p></C>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
            <C><SL>Responsável</SL><div style={{display:"flex",alignItems:"center",gap:8}}><Av user={as} size={32}/><div><div style={{fontSize:13,fontWeight:700,color:T.text}}>{as?.name}</div><div style={{fontSize:11,color:T.textM}}>{as?.role}</div></div></div></C>
            <C><SL>Prazo</SL><div style={{fontSize:16,fontWeight:800,color:over?T.red:T.text,fontFamily:"'Syne',sans-serif"}}>{fd(task.due_date)}</div>{!over&&days!==null&&days<=3&&days>=0&&<div style={{fontSize:11,color:days===0?T.red:T.orange,marginTop:2,fontWeight:600}}>{days===0?"Hoje!":days===1?"Amanhã":`${days}d`}</div>}{over&&<div style={{fontSize:11,color:T.red,marginTop:2,fontWeight:600}}>Atrasada!</div>}</C>
          </div>
          <C mb={10}><SL>Alterar Status</SL>
            <div style={{display:"flex",gap:8}}>
              {STATS.map(s=>(
                <Btn key={s.value} onClick={()=>doStatus(task.id,s.value)}
                  style={{flex:1,padding:"10px 4px",borderRadius:10,fontSize:10,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                    background:task.status===s.value?s.color+"22":T.bg,color:task.status===s.value?s.color:T.textM,
                    border:`2px solid ${task.status===s.value?s.color:T.border}`,fontWeight:task.status===s.value?700:500}}>
                  <span style={{fontSize:18}}>{s.icon}</span><span>{s.label}</span>
                </Btn>
              ))}
            </div>
          </C>
          {task.history?.length>0&&<C mb={10}><SL>Histórico</SL>{[...task.history].reverse().map((h,i)=>{const hu=gU(h.user_id);return(<div key={h.id||i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}><Av user={hu} size={24} fontSize={9}/><div><div style={{fontSize:12,color:T.text}}><span style={{fontWeight:700,color:hu?.color}}>{h.user_name}</span> — {h.action}</div><div style={{fontSize:10,color:T.textL}}>{ft(h.created_at)}</div></div></div>);})}</C>}
          <C><SL>Comentários ({task.comments?.length||0})</SL>
            {task.comments?.length===0&&<p style={{fontSize:13,color:T.textL,margin:"0 0 10px"}}>Sem comentários.</p>}
            {task.comments?.map(c=>{const cu=gU(c.user_id);return(<div key={c.id} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${T.border}`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:700,color:cu?.color||T.green}}>{c.user_name}</span><span style={{fontSize:10,color:T.textL}}>{ft(c.created_at)}</span></div><p style={{fontSize:13,color:T.textM,margin:0}}>{c.text}</p></div>);})}
            <div style={{display:"flex",gap:8,marginTop:6}}>
              <input placeholder="Comentário..." value={cmt} onChange={e=>setCmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doCmt(task.id)} style={{flex:1,background:T.bg,border:`1px solid ${T.border}`,color:T.text,borderRadius:10,padding:"11px 12px",fontSize:13,outline:"none",fontFamily:"'DM Sans',sans-serif"}}/>
              <Btn onClick={()=>doCmt(task.id)} style={{background:T.green,color:T.bg,width:44,borderRadius:10,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800}}>↑</Btn>
            </div>
          </C>
        </div>
        {editT&&<Modal title="Editar" accent={T.orange} form={editT} setForm={setEditT} onCancel={()=>setEditT(null)} onConfirm={doEdit} confirmLabel="Salvar" isManager={user?.isManager}/>}
        {delId&&<DelModal onCancel={()=>setDelId(null)} onConfirm={()=>doDel(delId)}/>}
      </Shell>
    );
  }

  // ── MAIN ─────────────────────────────────────────────────────
  return(
    <Shell><GS/>

      {/* HEADER compacto */}
      <div style={{background:T.bg2,padding:"12px 16px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:T.green,boxShadow:`0 0 6px ${T.green}`}}/>
              <span style={{fontSize:11,color:T.green,fontWeight:600,letterSpacing:0.5}}>AO VIVO</span>
            </div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:T.text,lineHeight:1}}>
              {user?.name} {user?.isManager?"🧑‍💼":"👋"}
            </div>
          </div>
          <Btn onClick={()=>setPicker(true)} style={{background:"transparent",padding:0,border:"none"}}>
            <Av user={user} size={42} fontSize={16}/>
          </Btn>
        </div>

        {/* STATS em linha */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:12}}>
          {[
            {label:"Total",   value:total, color:T.green,  filter:null},
            {label:"Pendente",value:pend,  color:T.yellow, filter:"pendente"},
            {label:"Fazendo", value:prog,  color:T.blue,   filter:"em_andamento"},
            {label:"Feitas",  value:conc,  color:T.green,  filter:"concluida"},
          ].map((s,i)=>(
            <Btn key={i} onClick={()=>{setFSt(s.filter||"todas");setFAs("todos");setQ("");setPage("tasks");}}
              style={{background:T.bg3,borderRadius:12,padding:"10px 6px",border:`1px solid ${T.border}`,display:"block",width:"100%",textAlign:"center",borderTop:`3px solid ${s.color}`}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
              <div style={{fontSize:10,color:T.textM,marginTop:3,fontWeight:600}}>{s.label}</div>
            </Btn>
          ))}
        </div>
      </div>

      {/* CONTENT — sempre preenchido */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>

        {page==="home"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column"}}>
            {/* Progresso compacto */}
            <div style={{padding:"10px 14px 6px",background:T.bg2,borderBottom:`1px solid ${T.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:12,color:T.textM,fontWeight:600}}>Progresso do Time</span>
                <span style={{fontSize:14,color:T.green,fontWeight:800,fontFamily:"'Syne',sans-serif"}}>{total>0?Math.round((conc/total)*100):0}%</span>
              </div>
              <div style={{height:5,background:T.bg3,borderRadius:3,overflow:"hidden",marginBottom:8}}>
                <div style={{height:"100%",width:`${total>0?(conc/total)*100:0}%`,background:`linear-gradient(90deg,${T.greenD},${T.green})`,borderRadius:3}}/>
              </div>
              <div style={{display:"flex",gap:10}}>
                {USERS.map(u=>{
                  const d=tasks.filter(t=>t.assignee===u.id&&t.status==="concluida").length;
                  const tot=tasks.filter(t=>t.assignee===u.id).length;
                  return(
                    <Btn key={u.id} onClick={()=>{setFAs(u.id);setFSt("todas");setQ("");setPage("tasks");}}
                      style={{flex:1,background:T.bg3,borderRadius:10,padding:"8px 4px",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
                      <Av user={u} size={22} fontSize={9}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,color:T.text,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.name}</div>
                        <div style={{fontSize:10,color:u.color,fontWeight:600}}>{d}/{tot}</div>
                      </div>
                    </Btn>
                  );
                })}
              </div>
            </div>

            {/* LISTA DE TODAS AS TAREFAS — preenche o resto */}
            <div style={{padding:"10px 14px 4px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:T.text}}>
                {atras>0?`🔥 ${atras} atrasada${atras>1?"s":""}  •  `:""}Todas as Tarefas
              </span>
              <span style={{fontSize:11,color:T.textM}}>{tasks.length} total</span>
            </div>

            {tasks.length===0
              ?(
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,padding:20}}>
                  <div style={{fontSize:48}}>📋</div>
                  <div style={{fontSize:16,fontWeight:700,color:T.textM}}>Nenhuma tarefa ainda</div>
                  <div style={{fontSize:13,color:T.textL,textAlign:"center"}}>Toque no + para criar a primeira tarefa</div>
                </div>
              )
              :(
                <div style={{padding:"0 14px 14px"}}>
                  {tasks.map(t=>(
                    <TC key={t.id} task={t} onClick={()=>setDetail(t)} onStatus={doStatus}
                      onEdit={t=>setEditT({...t,due_date:t.due_date||""})}
                      isManager={user?.isManager} onDel={id=>setDelId(id)}/>
                  ))}
                </div>
              )
            }
          </div>
        )}

        {page==="tasks"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",padding:"12px 14px"}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:T.text,marginBottom:10}}>Tarefas</div>
            <div style={{position:"relative",marginBottom:10}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:T.textL,fontSize:15}}>🔍</span>
              <input placeholder="Buscar..." value={q} onChange={e=>setQ(e.target.value)}
                style={{width:"100%",background:T.card,border:`1px solid ${T.border}`,color:T.text,borderRadius:12,padding:"11px 12px 11px 38px",fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif"}}/>
            </div>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:6,scrollbarWidth:"none"}}>
              {[["todas","Todos"],["pendente","⏳"],["em_andamento","🔄"],["concluida","✅"]].map(([v,l])=>(
                <FP key={v} active={fSt===v} onClick={()=>setFSt(v)}>{l} {v==="todas"?"Todos":gS(v)?.label||""}</FP>
              ))}
            </div>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:8,scrollbarWidth:"none"}}>
              {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l])=>(
                <FP key={v} active={fAs===v} onClick={()=>setFAs(v)}>{l}</FP>
              ))}
            </div>
            <div style={{fontSize:11,color:T.textL,marginBottom:8,fontWeight:600}}>{filtered.length} tarefa(s)</div>
            {filtered.length===0
              ?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:13,color:T.textM}}>Nenhuma tarefa encontrada.</div></div>
              :filtered.map(t=><TC key={t.id} task={t} onClick={()=>setDetail(t)} onStatus={doStatus} onEdit={t=>setEditT({...t,due_date:t.due_date||""})} isManager={user?.isManager} onDel={id=>setDelId(id)}/>)
            }
          </div>
        )}

        {page==="log"&&<LogView log={log}/>}
      </div>

      {/* BOTTOM NAV */}
      <div style={{background:T.bg2,borderTop:`1px solid ${T.border}`,display:"flex",flexShrink:0,paddingBottom:"env(safe-area-inset-bottom)",position:"relative"}}>
        {[
          {key:"home", icon:"⊞", label:"Início"},
          {key:"tasks",icon:"☰", label:"Tarefas", badge:tasks.filter(t=>t.status!=="concluida").length},
          {key:"log",  icon:"📋",label:"Log"},
        ].map(item=>(
          <Btn key={item.key} onClick={()=>setPage(item.key)}
            style={{flex:1,padding:"11px 0 9px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"transparent",borderTop:`2px solid ${page===item.key?T.green:"transparent"}`,position:"relative"}}>
            <span style={{fontSize:22}}>{item.icon}</span>
            <span style={{fontSize:10,fontWeight:page===item.key?700:500,color:page===item.key?T.green:T.textL}}>{item.label}</span>
            {item.badge>0&&<div style={{position:"absolute",top:8,right:"calc(50% - 18px)",background:T.red,color:"#fff",borderRadius:20,minWidth:17,height:17,padding:"0 4px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{item.badge}</div>}
          </Btn>
        ))}
        <Btn onClick={()=>setNewTask(true)} style={{position:"absolute",right:14,bottom:12,width:50,height:50,borderRadius:14,background:T.green,color:T.bg,fontSize:26,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 18px ${T.green}55`,fontWeight:800}}>+</Btn>
      </div>

      {/* MODALS */}
      {picker&&(
        <Ov onClick={()=>setPicker(false)}>
          <div style={{background:T.bg2,borderRadius:"20px 20px 0 0",padding:"18px 14px 36px",border:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
            <Handle/>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:T.text,marginBottom:4}}>Trocar Usuário</div>
            <div style={{fontSize:12,color:T.textM,marginBottom:14}}>Selecione seu perfil</div>
            {USERS.map(u=>(
              <Btn key={u.id} onClick={()=>doSwitch(u.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px",borderRadius:12,marginBottom:8,background:me===u.id?T.card2:T.card,border:`1.5px solid ${me===u.id?u.color:T.border}`,textAlign:"left"}}>
                <Av user={u} size={44} fontSize={16}/>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:me===u.id?u.color:T.text}}>{u.name}</div>
                  <div style={{fontSize:11,color:T.textM}}>{u.role}{u.isManager?" · Gerente":""}</div>
                </div>
                {me===u.id&&<span style={{marginLeft:"auto",color:u.color,fontSize:22}}>✓</span>}
              </Btn>
            ))}
          </div>
        </Ov>
      )}

      {newTask&&<Modal title="Nova Tarefa" accent={T.green} form={form} setForm={setForm} onCancel={()=>setNewTask(false)} onConfirm={doCreate} confirmLabel="Criar" isManager={user?.isManager}/>}
      {editT&&!detail&&<Modal title="Editar Tarefa" accent={T.orange} form={editT} setForm={setEditT} onCancel={()=>setEditT(null)} onConfirm={doEdit} confirmLabel="Salvar" isManager={user?.isManager}/>}
      {delId&&<DelModal onCancel={()=>setDelId(null)} onConfirm={()=>doDel(delId)}/>}
    </Shell>
  );
}

// ── TASK CARD ─────────────────────────────────────────────────
function TC({task,onClick,onStatus,onEdit,isManager,onDel}){
  const as=gU(task.assignee),pr=gP(task.priority),st=gS(task.status);
  const over=ov(task.due_date,task.status),days=dl(task.due_date);
  return(
    <div className="tc" onClick={onClick}
      style={{background:T.card,borderRadius:14,marginBottom:8,overflow:"hidden",border:`1px solid ${over?T.redD:T.border}`}}>
      <div style={{height:3,background:pr.color,opacity:0.9}}/>
      <div style={{padding:"12px"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
          <Btn onClick={e=>{e.stopPropagation();const nx=task.status==="pendente"?"em_andamento":task.status==="em_andamento"?"concluida":"pendente";onStatus(task.id,nx);}}
            style={{width:28,height:28,borderRadius:8,background:task.status==="concluida"?T.greenG:T.bg,border:`1.5px solid ${task.status==="concluida"?T.green:T.border}`,color:T.green,fontSize:13,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {task.status==="concluida"?"✓":""}
          </Btn>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14,fontWeight:600,color:task.status==="concluida"?T.textL:T.text,textDecoration:task.status==="concluida"?"line-through":"none",lineHeight:1.3,marginBottom:6}}>{task.title}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              <Ch color={st.color} bg={st.bg} sm>{st.icon} {st.label}</Ch>
              {over&&<Ch color={T.red} bg={T.redP} sm>Atrasada</Ch>}
              {!over&&days===0&&<Ch color={T.red} bg={T.redP} sm>Hoje</Ch>}
              {!over&&days===1&&<Ch color={T.orange} bg={T.orangeP} sm>Amanhã</Ch>}
              {task.comments?.length>0&&<span style={{fontSize:11,color:T.textL}}>💬{task.comments.length}</span>}
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,paddingTop:8,borderTop:`1px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Av user={as} size={22} fontSize={9}/>
            <span style={{fontSize:12,color:as?.color,fontWeight:600}}>{as?.name}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {task.due_date&&<span style={{fontSize:11,color:over?T.red:T.textL}}>{fd(task.due_date)}</span>}
            <Btn onClick={e=>{e.stopPropagation();onEdit(task);}} style={{padding:"5px 9px",borderRadius:7,fontSize:11,background:T.bg,color:T.textM,border:`1px solid ${T.border}`}}>✏️</Btn>
            {isManager&&<Btn onClick={e=>{e.stopPropagation();onDel(task.id);}} style={{padding:"5px 9px",borderRadius:7,fontSize:11,background:T.redP,color:T.red,border:`1px solid ${T.redD}`}}>🗑️</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Modal({title,accent,form,setForm,onCancel,onConfirm,confirmLabel,isManager}){
  return(
    <Ov onClick={onCancel}>
      <div style={{background:T.bg2,borderRadius:"20px 20px 0 0",padding:"18px 14px 36px",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
        <Handle/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{width:4,height:26,background:accent,borderRadius:2}}/>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:T.text}}>{title}</div>
        </div>
        <FL>Título *</FL><input placeholder="Ex: Verificar SLA" value={form.title||""} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={IS()}/>
        <FL>Descrição</FL><textarea placeholder="Detalhes (opcional)" value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{...IS(),resize:"vertical"}}/>
        {isManager&&(<><FL>📝 Nota Interna</FL><textarea placeholder="Privado..." value={form.internal_note||""} onChange={e=>setForm(f=>({...f,internal_note:e.target.value}))} rows={2} style={{...IS(),background:T.yellowP,borderColor:T.yellowD,resize:"vertical"}}/></>)}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><FL>Responsável</FL><select value={form.assignee||""} onChange={e=>setForm(f=>({...f,assignee:e.target.value}))} style={IS()}>{USERS.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div><FL>Prioridade</FL><select value={form.priority||""} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={IS()}>{PRIOS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
        </div>
        <FL>Prazo</FL><input type="date" value={form.due_date||""} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={IS()}/>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,color:T.textM,marginBottom:20,padding:"12px",background:T.greenG,borderRadius:10,marginTop:10,border:`1px solid ${T.greenD}`}}>
          <input type="checkbox" checked={form.reminder||false} onChange={e=>setForm(f=>({...f,reminder:e.target.checked}))} style={{width:18,height:18}}/>
          🔔 Ativar lembrete
        </label>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={onCancel} style={{flex:1,padding:14,borderRadius:12,background:T.card,border:`1px solid ${T.border}`,color:T.textM,fontSize:14}}>Cancelar</Btn>
          <Btn onClick={onConfirm} style={{flex:2,padding:14,borderRadius:12,background:accent,color:accent===T.green?T.bg:"#fff",fontSize:14,fontWeight:700}}>{confirmLabel}</Btn>
        </div>
      </div>
    </Ov>
  );
}

function DelModal({onCancel,onConfirm}){
  return(
    <Ov onClick={onCancel}>
      <div style={{background:T.bg2,borderRadius:"20px 20px 0 0",padding:"28px 16px 40px",border:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
        <Handle/>
        <div style={{fontSize:48,textAlign:"center",marginBottom:10}}>🗑️</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,textAlign:"center",color:T.text,marginBottom:6}}>Apagar tarefa?</div>
        <p style={{fontSize:13,color:T.textM,textAlign:"center",marginBottom:24}}>Essa ação não pode ser desfeita.</p>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={onCancel} style={{flex:1,padding:14,borderRadius:12,background:T.card,color:T.textM,border:`1px solid ${T.border}`,fontSize:14}}>Cancelar</Btn>
          <Btn onClick={onConfirm} style={{flex:1,padding:14,borderRadius:12,background:T.red,color:"#fff",fontSize:14}}>Apagar</Btn>
        </div>
      </div>
    </Ov>
  );
}

function LogView({log}){
  const [fu,setFu]=useState("todos");
  const [ft,setFt]=useState("todos");
  const f=log.filter(e=>(fu==="todos"||e.user_id===fu)&&(ft==="todos"||e.type===ft));
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",padding:"12px 14px"}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:T.text,marginBottom:10}}>Log</div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:6,scrollbarWidth:"none"}}>
        {[["todos","Todos"],...USERS.map(u=>[u.id,u.name])].map(([v,l])=><FP key={v} active={fu===v} onClick={()=>setFu(v)}>{l}</FP>)}
      </div>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:8,scrollbarWidth:"none"}}>
        {[["todos","Todas"],["login","🔑"],["task_created","➕"],["task_edited","✏️"],["status_changed","🔄"],["comment_added","💬"],["task_deleted","🗑️"]].map(([v,l])=><FP key={v} active={ft===v} onClick={()=>setFt(v)}>{l}</FP>)}
      </div>
      <div style={{fontSize:11,color:T.textL,marginBottom:8}}>{f.length} registro(s)</div>
      {f.length===0?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{fontSize:13,color:T.textM}}>Nenhum registro.</div></div>
        :f.map(e=>{
          const u=gU(e.user_id);
          return(<div key={e.id} style={{background:T.card,borderRadius:12,padding:"12px",marginBottom:8,border:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
            <Av user={u} size={36} fontSize={13}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3,flexWrap:"wrap",gap:3}}>
                <span style={{fontSize:12,fontWeight:700,color:u?.color}}>{u?.name}</span>
                <span style={{fontSize:10,fontWeight:700,background:T.greenG,color:T.green,padding:"2px 7px",borderRadius:20}}>{LICONS[e.type]} {LLABELS[e.type]}</span>
              </div>
              <div style={{fontSize:12,color:T.textM,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.detail}</div>
              <div style={{fontSize:10,color:T.textL,fontFamily:"monospace"}}>{ft(e.created_at)}</div>
            </div>
          </div>);
        })
      }
    </div>
  );
}

const Shell  = ({children})=><div style={{fontFamily:"'DM Sans',sans-serif",background:T.bg,height:"100dvh",display:"flex",flexDirection:"column",color:T.text,maxWidth:480,margin:"0 auto",overflow:"hidden"}}>{children}</div>;
const TopBar = ({children})=><div style={{background:T.bg2,padding:"0 12px",height:56,display:"flex",alignItems:"center",flexShrink:0,borderBottom:`1px solid ${T.border}`}}>{children}</div>;
const Btn    = ({children,onClick,style,className})=><button onClick={onClick} style={{cursor:"pointer",border:"none",fontFamily:"'DM Sans',sans-serif",fontWeight:600,...style}} className={className}>{children}</button>;
const C      = ({children,mb=0,style={}})=><div style={{background:T.card,borderRadius:14,padding:"14px",marginBottom:mb,border:`1px solid ${T.border}`,...style}}>{children}</div>;
const Ch     = ({children,color,bg,sm})=><span style={{display:"inline-flex",alignItems:"center",gap:3,padding:sm?"2px 7px":"4px 10px",borderRadius:20,fontSize:sm?10:12,fontWeight:700,color,background:bg}}>{children}</span>;
const FP     = ({children,active,onClick})=><Btn onClick={onClick} style={{padding:"7px 14px",borderRadius:20,fontSize:12,whiteSpace:"nowrap",flexShrink:0,background:active?T.green:T.card,color:active?T.bg:T.textM,border:`1px solid ${active?T.green:T.border}`,fontWeight:active?700:500}}>{children}</Btn>;
const Av     = ({user,size=28,fontSize=11})=>user?<div style={{width:size,height:size,borderRadius:"50%",background:user.color+"22",border:`2px solid ${user.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize,fontWeight:800,color:user.color,flexShrink:0}}>{user.avatar}</div>:null;
const Ov     = ({children,onClick})=><div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end",backdropFilter:"blur(4px)"}} onClick={onClick}>{children}</div>;
const Handle = ()=><div style={{width:40,height:4,background:T.border,borderRadius:2,margin:"0 auto 18px"}}/>;
const SL     = ({children,color})=><div style={{fontSize:10,color:color||T.textL,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:6}}>{children}</div>;
const FL     = ({children})=><div style={{fontSize:11,color:T.textM,fontWeight:700,marginBottom:5,marginTop:12}}>{children}</div>;
function IS(){return{width:"100%",background:T.bg,border:`1.5px solid ${T.border}`,color:T.text,borderRadius:10,padding:"12px",fontSize:14,outline:"none",fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box",display:"block"};}

function GS(){return(<style>{`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  ::-webkit-scrollbar{display:none;}
  html,body,#root{height:100%;height:100dvh;overflow:hidden;background:#0D1810;}
  input,textarea,select{font-family:'DM Sans',sans-serif;color-scheme:dark;}
  input[type="checkbox"]{accent-color:#3DD68C;}
  input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:0.5;}
  select{appearance:none;}
  .tc{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform 0.1s,opacity 0.1s;}
  .tc:active{transform:scale(0.98);opacity:0.85;}
  @keyframes lb{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
  .lb{height:100%;width:40%;background:#3DD68C;border-radius:2px;animation:lb 1.2s ease infinite;}
`}</style>);}
