import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseReady } from "./lib/supabase";
import { ShieldCheck, House, ClipboardList, UserRound, LockKeyhole, LogOut, ArrowRight, Clock3, Target, Trophy, CircleHelp, Check, X, ChevronRight, Settings, Plus, Menu } from "lucide-react";

const DEMO_QUESTIONS = [
  { id:"q1", rule:"Правило 83", text:"Когда фиксируется положение «вне игры»?", options:["Когда игрок атакующей команды пересекает синюю линию раньше шайбы","Когда шайба полностью пересекает линию ворот","Когда игрок касается шайбы клюшкой"], correct:0, seconds:20 },
  { id:"q2", rule:"Правило  icing", text:"Какое действие обычно приводит к пробросу?", options:["Команда бросает шайбу из своей половины за линию ворот соперника без касания","Игрок входит в зону атаки с шайбой","Шайба касается судьи"], correct:0, seconds:20 },
  { id:"q3", rule:"Работа линейного судьи", text:"Что входит в основные обязанности линейного судьи?", options:["Фиксация положения вне игры и проброса","Назначение любого штрафа вместо главного","Ведение официального протокола вместо секретаря"], correct:0, seconds:20 },
  { id:"q4", rule:"Правило 41", text:"Что оценивают при нарушении, связанном с толчком на борт?", options:["Характер контакта и опасность действия","Только номер игрока","Только счёт матча"], correct:0, seconds:25 },
  { id:"q5", rule:"Судейская механика", text:"Что важнее при спорной ситуации?", options:["Соблюдать механику, видеть эпизод и взаимодействовать с бригадой","Сразу соглашаться с игроками","Менять решение из-за реакции зрителей"], correct:0, seconds:20 }
];
const MODES = {
  main:{title:"Основной тест",subtitle:"30 вопросов из общей базы",count:30,cooldown:24},
  review:{title:"Закрепление",subtitle:"10 вопросов по слабым темам",count:10,cooldown:12},
  easy:{title:"Простой тест",subtitle:"Вопросы из отдельного набора",count:10,cooldown:3}
};
function fmtTime(n){return `${Math.floor(n/60).toString().padStart(2,"0")}:${(n%60).toString().padStart(2,"0")}`;}
function percent(a,b){return b?Math.round(a/b*100):0;}

export default function App(){
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [authMode,setAuthMode]=useState("login");
  const [auth,setAuth]=useState({last_name:"",first_name:"",email:"",password:""});
  const [authError,setAuthError]=useState("");
  const [busy,setBusy]=useState(false);
  const [tab,setTab]=useState("home");
  const [test,setTest]=useState(null);
  const [questionIndex,setQuestionIndex]=useState(0);
  const [selected,setSelected]=useState(null);
  const [answers,setAnswers]=useState([]);
  const [seconds,setSeconds]=useState(20);
  const [startedAt,setStartedAt]=useState(0);
  const [results,setResults]=useState([]);
  const [notice,setNotice]=useState("");
  const [adminPanel,setAdminPanel]=useState("questions");
  const [sections,setSections]=useState([]);
  const [rules,setRules]=useState([]);
  const [questions,setQuestions]=useState([]);
  const [draft,setDraft]=useState({section:"",rule_number:"",rule_title:"",question:"",a:"",b:"",c:"",correct:"0",pool_type:"main",time_limit_seconds:20});
  const [support,setSupport]=useState({email:"",phone:"",telegram:"",text:""});
  const [userList,setUserList]=useState([]);

  useEffect(()=>{
    if(!supabaseReady) return;
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!session?.user) {
      setProfile(null);
      setResults([]);
      return;
    }
    loadProfile(session.user.id);
    loadSupport();
    loadHistory(session.user.id);
  },[session]);
  async function loadProfile(id){
    if(!supabaseReady)return;
    const {data,error}=await supabase.from("profiles").select("*").eq("id",id).maybeSingle();
    if(error){console.error(error);return;} setProfile(data);
  }
  async function loadSupport(){
    if(!supabaseReady)return;
    const {data}=await supabase.from("site_settings").select("value").eq("key","support").maybeSingle();
    if(data?.value)setSupport(data.value);
  }
  async function loadHistory(userId=session?.user?.id){
    if(!supabaseReady || !userId){setResults([]);return;}
    const {data,error}=await supabase.from("test_attempts").select("*").eq("user_id",userId).eq("status","completed").order("finished_at",{ascending:false}).limit(50);
    if(error){
      console.error("Не удалось загрузить историю тестов:",error);
      setResults([]);
      setNotice("Не удалось загрузить историю тестов. Проверь политики доступа Supabase.");
      return;
    }
    setResults(data||[]);
  }
  async function submitAuth(e){
    e.preventDefault();setAuthError("");setBusy(true);
    try{
      if(!supabaseReady)throw new Error("Сначала добавь URL и Publishable Key Supabase в настройки проекта.");
      if(authMode==="signup"){
        const {data,error}=await supabase.auth.signUp({email:auth.email,password:auth.password,options:{data:{first_name:auth.first_name.trim(),last_name:auth.last_name.trim()}}});
        if(error)throw error;
        if(data.session){setNotice("Аккаунт создан.");}
        else {setNotice("Регистрация отправлена. Проверь почту и подтверди адрес.");}
      }else{
        const {error}=await supabase.auth.signInWithPassword({email:auth.email,password:auth.password});
        if(error)throw error;
      }
    }catch(err){setAuthError(err.message||"Не удалось выполнить запрос.");}
    finally{setBusy(false);}
  }
  async function signOut(){
    if(supabaseReady) await supabase.auth.signOut();
    setResults([]);
    setProfile(null);
    setTest(null);
    setAnswers([]);
    setTab("home");
    setNotice("");
  }
  async function startTest(type){
    const mode=MODES[type];
    if(supabaseReady && !session){setNotice("Чтобы начать тест, войди в аккаунт.");return;}
    if(supabaseReady){
      const since=new Date(Date.now()-mode.cooldown*3600000).toISOString();
      const {data}=await supabase.from("test_attempts").select("id,started_at").eq("user_id",session.user.id).eq("test_type",type).eq("status","completed").gte("finished_at",since).order("finished_at",{ascending:false}).limit(1);
      if(data?.length){setNotice(`Этот тест уже пройден. Следующее прохождение доступно после окончания интервала ${mode.cooldown} ч.`);return;}
      const pool=type==="easy"?"easy":"main";
      const {data:qs,error}=await supabase.from("questions").select("id,rule_id,text,time_limit_seconds,rules(rule_number,title),question_options(id,option_text,sort_order)").eq("is_active",true).eq("pool_type",pool).limit(150);
      if(error){setNotice("Не удалось загрузить вопросы. Проверь SQL и политики Supabase.");return;}
      if(!qs?.length){setNotice("В базе пока нет вопросов. Добавь их через админ-панель.");return;}
      const mapped=qs.map(q=>({...q,rule:q.rules?.rule_number?`Правило ${q.rules.rule_number}`:"Общее",options:(q.question_options||[]).sort((a,b)=>a.sort_order-b.sort_order).map(o=>({id:o.id,text:o.option_text})),seconds:q.time_limit_seconds}));
      let chosen=shuffle(mapped);
      if(type==="review")chosen=chosen.slice(0,mode.count);
      else chosen=chosen.slice(0,mode.count);
      if(type==="main" && chosen.length<mode.count){setNotice(`В базе только ${chosen.length} активных вопросов. Для основного теста нужно минимум 30.`);return;}
      if(type!=="main" && chosen.length===0){setNotice("В выбранном наборе пока нет вопросов.");return;}
      launch(type,chosen);
    }else{
      const qs=shuffle(DEMO_QUESTIONS).slice(0,Math.min(mode.count,DEMO_QUESTIONS.length)).map(q=>({...q,options:q.options.map((text,i)=>({id:`${q.id}-${i}`,text}))}));
      launch(type,qs);
    }
  }
  function shuffle(arr){return [...arr].sort(()=>Math.random()-.5);}
  function launch(type,qs){
    setTest({type,questions:qs});setQuestionIndex(0);setSelected(null);setAnswers([]);setStartedAt(Date.now());setSeconds(qs[0]?.seconds||20);setTab("taking");setNotice("");
  }
  useEffect(()=>{
    if(!test || tab!=="taking")return;
    if(seconds<=0){advance(null,true);return;}
    const id=setTimeout(()=>setSeconds(s=>s-1),1000);
    return ()=>clearTimeout(id);
  },[test,tab,seconds]);
  function choose(optionIndex){if(selected!==null)return;setSelected(optionIndex);setTimeout(()=>advance(optionIndex,false),180);}
  async function advance(optionIndex,timedOut){
    if(!test)return;
    const q=test.questions[questionIndex];
    const isCorrect=optionIndex!==null && (q.options[optionIndex]?.id ? q.options[optionIndex].id===q.options.find(o=>o.is_correct)?.id : optionIndex===q.correct);
    const answer={question_id:q.id,selected_option_id:optionIndex===null?null:q.options[optionIndex]?.id,is_correct:isCorrect,rule:q.rule,text:q.text,selected_text:optionIndex===null?"Время истекло":q.options[optionIndex]?.text,correct_text:q.options.find(o=>o.is_correct)?.option_text || (q.correct!==undefined?q.options[q.correct]?.text:"Правильный вариант проверяется сервером")};
    const nextAnswers=[...answers,answer];setAnswers(nextAnswers);
    if(questionIndex+1<test.questions.length){
      setQuestionIndex(i=>i+1);setSelected(null);setSeconds(test.questions[questionIndex+1]?.seconds||20);
    }else{
      const score=nextAnswers.filter(a=>a.is_correct).length;
      const result={type:test.type,score,total:test.questions.length,duration:Math.round((Date.now()-startedAt)/1000),date:new Date().toLocaleString("ru-RU"),answers:nextAnswers};
      let savedSuccessfully = !supabaseReady;
      if(supabaseReady && session?.user){
        const {data:attempt,error}=await supabase.from("test_attempts").insert({user_id:session.user.id,test_type:test.type,finished_at:new Date().toISOString(),score,total_questions:test.questions.length,duration_seconds:result.duration,status:"completed"}).select().single();
        if(error){
          console.error("Не удалось сохранить результат:",error);
          setNotice("Тест завершён, но результат не сохранился. Проверь SQL-политики Supabase и попробуй позже.");
        }else if(attempt){
          const answerRows=nextAnswers.map((a,i)=>({attempt_id:attempt.id,question_id:a.question_id,selected_option_id:a.selected_option_id,is_correct:a.is_correct,time_spent_seconds:null,question_order:i+1})).filter(a=>a.question_id && !String(a.question_id).startsWith("q"));
          if(answerRows.length){
            const {error:answersError}=await supabase.from("attempt_answers").insert(answerRows);
            if(answersError){
              console.error("Не удалось сохранить ответы:",answersError);
              setNotice("Результат сохранён, но подробный разбор ответов сохранить не удалось.");
            }
          }
          savedSuccessfully=true;
          await loadHistory(session.user.id);
        }
      }
      if(savedSuccessfully && !supabaseReady)setResults(prev=>[result,...prev].slice(0,50));
      setTest({type:test.type,questions:test.questions,result});setTab("result");
    }
  }
  async function loadAdminData(){
    if(!supabaseReady)return;
    const [s,r,q,u]=await Promise.all([
      supabase.from("sections").select("*").order("sort_order"),
      supabase.from("rules").select("*,sections(title)").order("sort_order"),
      supabase.from("questions").select("*,rules(rule_number,title),question_options(*)").order("created_at",{ascending:false}).limit(100),
      supabase.from("profiles").select("id,first_name,last_name,created_at").order("created_at",{ascending:false}).limit(200)
    ]);
    if(!s.error)setSections(s.data||[]);if(!r.error)setRules(r.data||[]);if(!q.error)setQuestions(q.data||[]);if(!u.error)setUserList(u.data||[]);
  }
  async function saveQuestion(e){
    e.preventDefault();
    if(!supabaseReady||profile?.role!=="admin"){setNotice("Администраторский доступ не подтверждён.");return;}
    try{
      let sectionId=draft.section;
      if(!sectionId){const {data,error}=await supabase.from("sections").insert({title:"Основные правила"}).select().single();if(error)throw error;sectionId=data.id;}
      let rule=rules.find(r=>r.section_id===sectionId&&r.rule_number===draft.rule_number);
      if(!rule){const {data,error}=await supabase.from("rules").insert({section_id:sectionId,rule_number:draft.rule_number||"Общее",title:draft.rule_title||"Без названия"}).select().single();if(error)throw error;rule=data;}
      const {data:q,error:qerr}=await supabase.from("questions").insert({rule_id:rule.id,text:draft.question,pool_type:draft.pool_type,time_limit_seconds:Number(draft.time_limit_seconds)}).select().single();if(qerr)throw qerr;
      const opts=[draft.a,draft.b,draft.c].map((option_text,i)=>({question_id:q.id,option_text,is_correct:String(i)===String(draft.correct),sort_order:i}));
      const {error:oerr}=await supabase.from("question_options").insert(opts);if(oerr)throw oerr;
      setNotice("Вопрос добавлен.");setDraft(d=>({...d,question:"",a:"",b:"",c:""}));loadAdminData();
    }catch(err){setNotice(`Ошибка сохранения: ${err.message}`);}
  }
  async function saveSupport(e){
    e.preventDefault();if(profile?.role!=="admin")return;
    const {error}=await supabase.from("site_settings").upsert({key:"support",value:support,updated_at:new Date().toISOString()});
    setNotice(error?`Ошибка: ${error.message}`:"Контакты поддержки сохранены.");
  }
  const current=test?.questions?.[questionIndex];
  const history=results;
  const weakRules=useMemo(()=>{
    const map={};for(const r of history){for(const a of (r.answers||[])){if(!map[a.rule])map[a.rule]={right:0,total:0};map[a.rule].total++;if(a.is_correct)map[a.rule].right++;}}
    return Object.entries(map).map(([name,v])=>({name,pct:percent(v.right,v.total),total:v.total})).sort((a,b)=>a.pct-b.pct);
  },[history]);
  const admin=profile?.role==="admin";
  useEffect(()=>{if(tab==="admin"&&admin)loadAdminData();},[tab,admin]);

  if(!session && supabaseReady) return <div className="auth-shell"><div className="auth-card"><Brand/><p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p><h1>{authMode==="login"?"С возвращением":"Создать аккаунт"}</h1><p className="muted">Тренируй знания хоккейного арбитра.</p><form onSubmit={submitAuth} className="stack">
    {authMode==="signup"&&<><label>Фамилия<input required value={auth.last_name} onChange={e=>setAuth({...auth,last_name:e.target.value})} autoComplete="family-name"/></label><label>Имя<input required value={auth.first_name} onChange={e=>setAuth({...auth,first_name:e.target.value})} autoComplete="given-name"/></label></>}
    <label>Электронная почта<input type="email" required value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})} autoComplete="email"/></label>
    <label>Пароль<input type="password" minLength="8" required value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})} autoComplete={authMode==="login"?"current-password":"new-password"}/></label>
    {authError&&<p className="error">{authError}</p>}<button className="btn primary full" disabled={busy}>{busy?"Подожди…":authMode==="login"?"Войти":"Зарегистрироваться"}<ArrowRight size={17}/></button>
  </form><button className="link-button" onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setAuthError("");}}>{authMode==="login"?"Нет аккаунта? Зарегистрироваться":"Уже есть аккаунт? Войти"}</button></div></div>;

  return <div className="app">
    <header className="topbar"><Brand/><div className="top-actions">{session&&<span className="user-pill">{profile?.first_name||session.user.email?.split("@")[0]}</span>}<button className="icon-button" title="Выйти" onClick={signOut}><LogOut size={18}/></button></div></header>
    <main className="main">
      {notice&&<div className="notice" role="status"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Закрыть"><X size={16}/></button></div>}
      {tab==="home"&&<><section className="hero"><div className="eyebrow"><span className="live-dot"/> ПЛАТФОРМА ПОДГОТОВКИ АРБИТРОВ</div><h1>ТВОЙ УРОВЕНЬ.<br/><span>ТВОЁ РЕШЕНИЕ.</span></h1><p>Проверяй знания правил. Находи слабые места. Расти как судья.</p><div className="hero-stats"><div><strong>03</strong><small>режима тестирования</small></div><div><strong>24/7</strong><small>доступ к прогрессу</small></div><div><strong>01</strong><small>цель — точность</small></div></div></section>
      <section className="section-heading"><div><p className="eyebrow">ВЫБЕРИ РЕЖИМ</p><h2>Тренировка знаний</h2></div><span className="muted small">Сохраняй концентрацию</span></section>
      <div className="test-grid"><article className="test-card featured"><div className="card-top"><span className="tag orange">ОСНОВНОЙ</span><Target size={21}/></div><h3>Основной тест</h3><p>Проверь знание правил в случайной выборке из общей базы.</p><div className="card-meta"><span><CircleHelp size={15}/> 30 вопросов</span><span><Clock3 size={15}/> 24 часа</span></div><button className="btn dark full" onClick={()=>startTest("main")}>Начать тест <ArrowRight size={17}/></button></article>
      <article className="test-card"><div className="card-top"><span className="tag">ПОВТОРЕНИЕ</span><Target size={21}/></div><h3>Закрепление</h3><p>Дополнительная практика по темам, которые стоит подтянуть.</p><div className="card-meta"><span><CircleHelp size={15}/> 10 вопросов</span><span><Clock3 size={15}/> 12 часов</span></div><button className="btn outline full" onClick={()=>startTest("review")}>Повторить <ArrowRight size={17}/></button></article>
      <article className="test-card"><div className="card-top"><span className="tag">БАЗА</span><Target size={21}/></div><h3>Простой тест</h3><p>Короткая тренировка на отдельном наборе вопросов.</p><div className="card-meta"><span><CircleHelp size={15}/> до 10 вопросов</span><span><Clock3 size={15}/> 3 часа</span></div><button className="btn outline full" onClick={()=>startTest("easy")}>Тренироваться <ArrowRight size={17}/></button></article></div>
      <section className="progress-panel"><div className="section-heading"><div><p className="eyebrow">АНАЛИТИКА</p><h2>Знание правил</h2></div><span className="muted small">{weakRules.length} тем в статистике</span></div>{weakRules.length===0?<div className="empty"><Target size={22}/><p>Пройди первый тест — здесь появится прогресс по правилам.</p></div>:<div className="mastery-list">{weakRules.map(r=><div className="mastery-row" key={r.name}><div className="mastery-label"><span>{r.name}</span><b>{r.pct}%</b></div><div className="bar"><span style={{width:`${r.pct}%`}}/></div></div>)}</div>}</section>
      </>}
      {tab==="taking"&&test&&current&&<section className="quiz-wrap"><button className="back-button" onClick={()=>{setTest(null);setTab("home");}}>← Выйти из теста</button><div className="quiz-head"><span className="tag orange">{MODES[test.type].title.toUpperCase()}</span><span className="muted">Вопрос {questionIndex+1} из {test.questions.length}</span></div><div className="bar quiz-progress"><span style={{width:`${(questionIndex/test.questions.length)*100}%`}}/></div><div className="quiz-timer"><Clock3 size={17}/><span>Осталось</span><strong className={seconds<=5?"danger":""}>{fmtTime(seconds)}</strong></div><p className="eyebrow">{current.rule||"ПРАВИЛА ХОККЕЯ"}</p><h1 className="question-title">{current.text}</h1><div className="answer-list">{current.options.map((o,i)=><button key={o.id||i} className={`answer-option ${selected===i?"selected":""}`} disabled={selected!==null} onClick={()=>choose(i)}><span className="answer-letter">{String.fromCharCode(65+i)}</span><span>{o.text||o.option_text}</span><ChevronRight size={18}/></button>)}</div><p className="quiz-footnote">Ответ будет проверен после завершения теста.</p></section>}
      {tab==="result"&&test?.result&&<section className="result-wrap"><div className="result-icon"><Trophy size={30}/></div><p className="eyebrow">ТЕСТ ЗАВЕРШЁН</p><h1>Результат</h1><div className="score-card"><strong>{percent(test.result.score,test.result.total)}<small>%</small></strong><span>{test.result.score} из {test.result.total} правильных ответов</span><div className="bar"><span style={{width:`${percent(test.result.score,test.result.total)}%`}}/></div><div className="result-meta"><span><Clock3 size={15}/> {fmtTime(test.result.duration)}</span><span><CircleHelp size={15}/> {test.result.total} вопросов</span></div></div><h2>Разбор ответов</h2><div className="review-list">{test.result.answers.map((a,i)=><article className="review-item" key={i}><div className="review-title"><span className={`status ${a.is_correct?"ok":"bad"}`}>{a.is_correct?<Check size={15}/>:<X size={15}/>}</span><div><b>{i+1}. {a.text}</b><small>{a.rule}</small></div></div><p className="answer-given">Твой ответ: {a.selected_text}</p>{!a.is_correct&&<p className="answer-correct">Правильный ответ: {a.correct_text}</p>}</article>)}</div><button className="btn primary full" onClick={()=>{setTest(null);setTab("home");}}>Вернуться на главную <ArrowRight size={17}/></button></section>}
      {tab==="tests"&&<><div className="page-intro"><p className="eyebrow">ТВОЯ СТАТИСТИКА</p><h1>История тестов</h1><p className="muted">Последние результаты и архив попыток.</p></div><div className="history-list">{history.length===0?<div className="empty">Результатов пока нет.</div>:history.map((r,i)=><article className="history-item" key={r.id||i}><div className="history-icon"><ClipboardList size={20}/></div><div className="history-content"><b>{r.type==="main"?"Основной тест":r.type==="review"?"Закрепление":r.type==="easy"?"Простой тест":r.type}</b><small>{r.date||new Date(r.finished_at||r.started_at).toLocaleString("ru-RU")}</small></div><div className="history-score"><strong>{percent(r.score,r.total_questions||r.total)}%</strong><small>{r.score}/{r.total_questions||r.total}</small></div></article>)}</div></>}
      {tab==="profile"&&<><div className="page-intro"><p className="eyebrow">АККАУНТ</p><h1>Личный кабинет</h1><p className="muted">Твои результаты, цели и поддержка.</p></div><section className="profile-card"><div className="avatar"><UserRound size={27}/></div><div><h2>{profile?`${profile.last_name||""} ${profile.first_name||""}`.trim():"Демо-профиль"}</h2><p className="muted">{session?.user?.email||"Подключи Supabase для аккаунта"}</p><span className="tag">{admin?"АДМИНИСТРАТОР":"УЧАСТНИК"}</span></div></section><div className="profile-stats"><div><span>Тестов</span><strong>{history.length}</strong></div><div><span>Лучший результат</span><strong>{history.length?Math.max(...history.map(r=>percent(r.score,r.total_questions||r.total)))+"%":"—"}</strong></div></div><section className="progress-panel"><h2>Слабые темы</h2>{weakRules.length?weakRules.map(r=><div className="mastery-row" key={r.name}><div className="mastery-label"><span>{r.name}</span><b>{r.pct}%</b></div><div className="bar"><span style={{width:`${r.pct}%`}}/></div></div>):<p className="muted">Пройди тест, чтобы собрать статистику по темам.</p>}</section><section className="support-card"><h2>Техническая поддержка</h2><p>{support.text||"Если возникла проблема с сайтом, напиши в поддержку."}</p>{support.email&&<p>Почта: <a href={`mailto:${support.email}`}>{support.email}</a></p>}{support.phone&&<p>Телефон: <a href={`tel:${support.phone}`}>{support.phone}</a></p>}{support.telegram&&<p>Telegram: <a href={`https://t.me/${support.telegram.replace("@","")}`} target="_blank" rel="noreferrer">@{support.telegram.replace("@","")}</a></p>}</section>{admin&&<button className="btn outline full" onClick={()=>setTab("admin")}><Settings size={17}/> Открыть админ-панель</button>}</>}
      {tab==="admin"&&admin&&<><div className="page-intro"><p className="eyebrow">УПРАВЛЕНИЕ</p><h1>Админ-панель</h1><p className="muted">Управляй вопросами и поддержкой.</p></div><div className="admin-tabs"><button className={adminPanel==="questions"?"active":""} onClick={()=>setAdminPanel("questions")}>Вопросы</button><button className={adminPanel==="users"?"active":""} onClick={()=>setAdminPanel("users")}>Пользователи</button><button className={adminPanel==="support"?"active":""} onClick={()=>setAdminPanel("support")}>Поддержка</button></div>{adminPanel==="questions"&&<><form className="admin-form" onSubmit={saveQuestion}><h2><Plus size={19}/> Новый вопрос</h2><label>Раздел<select value={draft.section} onChange={e=>setDraft({...draft,section:e.target.value})}><option value="">Создать «Основные правила»</option>{sections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><div className="form-row"><label>Номер правила<input value={draft.rule_number} onChange={e=>setDraft({...draft,rule_number:e.target.value})} placeholder="Например, 83"/></label><label>Название правила<input value={draft.rule_title} onChange={e=>setDraft({...draft,rule_title:e.target.value})} placeholder="Вне игры"/></label></div><label>Текст вопроса<textarea required value={draft.question} onChange={e=>setDraft({...draft,question:e.target.value})}/></label><label>Вариант A<input required value={draft.a} onChange={e=>setDraft({...draft,a:e.target.value})}/></label><label>Вариант B<input required value={draft.b} onChange={e=>setDraft({...draft,b:e.target.value})}/></label><label>Вариант C<input required value={draft.c} onChange={e=>setDraft({...draft,c:e.target.value})}/></label><div className="form-row"><label>Правильный ответ<select value={draft.correct} onChange={e=>setDraft({...draft,correct:e.target.value})}><option value="0">A</option><option value="1">B</option><option value="2">C</option></select></label><label>Время (сек.)<input type="number" min="5" max="300" value={draft.time_limit_seconds} onChange={e=>setDraft({...draft,time_limit_seconds:e.target.value})}/></label></div><label>Набор вопросов<select value={draft.pool_type} onChange={e=>setDraft({...draft,pool_type:e.target.value})}><option value="main">Основной / закрепление</option><option value="easy">Простой тест</option></select></label><button className="btn primary full">Сохранить вопрос</button></form><div className="admin-list"><h2>Вопросы в базе: {questions.length}</h2>{questions.map(q=><div className="admin-list-item" key={q.id}><b>{q.text}</b><small>{q.rules?.rule_number||"Без правила"} · {q.pool_type} · {q.time_limit_seconds} сек.</small></div>)}</div></>}{adminPanel==="users"&&<div className="admin-list"><h2>Зарегистрированные пользователи</h2>{userList.map(u=><div className="admin-list-item" key={u.id}><b>{u.last_name} {u.first_name}</b><small>{new Date(u.created_at).toLocaleDateString("ru-RU")}</small></div>)}</div>}{adminPanel==="support"&&<form className="admin-form" onSubmit={saveSupport}><h2>Контакты поддержки</h2><label>Текст<input value={support.text} onChange={e=>setSupport({...support,text:e.target.value})}/></label><label>Электронная почта<input type="email" value={support.email} onChange={e=>setSupport({...support,email:e.target.value})}/></label><label>Телефон<input value={support.phone} onChange={e=>setSupport({...support,phone:e.target.value})}/></label><label>Telegram без @<input value={support.telegram} onChange={e=>setSupport({...support,telegram:e.target.value})}/></label><button className="btn primary full">Сохранить контакты</button></form>}</>}
    </main>
    <nav className="bottom-nav"><button className={tab==="home"?"active":""} onClick={()=>setTab("home")}><House size={19}/><span>Главная</span></button><button className={tab==="tests"?"active":""} onClick={()=>setTab("tests")}><ClipboardList size={19}/><span>Тесты</span></button><button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><UserRound size={19}/><span>Профиль</span></button></nav>
    {!supabaseReady&&<div className="demo-banner"><LockKeyhole size={15}/> Демо-режим: подключи Supabase, чтобы включить аккаунты и сохранение данных.</div>}
  </div>;
}
function Brand(){return <div className="brand"><div className="brand-mark">R<span>.</span></div><div><b>REFTEST</b><small>HOCKEY OFFICIATING</small></div></div>;}