import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Home, Download, Video, Music2, Image as ImageIcon, WandSparkles, FileText,
  Eye, History, Crown, ShieldCheck, LogOut, UploadCloud, Sparkles, KeyRound,
  CheckCircle2, AlertTriangle, LoaderCircle, Settings, Gem, Menu, X, ExternalLink,
  Scissors, FileOutput, Gauge, Copy, Trash2, RefreshCw, LockKeyhole, UserRound
} from 'lucide-react'
import './styles.css'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const APP_VERSION = '1.0.0'

const nav = [
  ['Home', Home], ['Downloader', Download], ['Video', Video], ['Audio', Music2],
  ['Images', ImageIcon], ['Background', WandSparkles], ['Documents', FileText],
  ['Viewer', Eye], ['History', History], ['Premium', Crown]
]

function CrystalParticles({ premium }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf = 0
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2)
    let mouse = { x: -9999, y: -9999 }
    const particles = []
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      particles.length = 0
      const count = Math.min(110, Math.max(45, Math.floor((w * h) / 17000)))
      for (let i = 0; i < count; i++) particles.push({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + .45,
        vx: (Math.random() - .5) * .13, vy: -(Math.random() * .22 + .035),
        a: Math.random() * .6 + .18, phase: Math.random() * Math.PI * 2,
        gold: Math.random() < .22
      })
    }
    const onMove = e => { mouse.x = e.clientX; mouse.y = e.clientY }
    const draw = t => {
      ctx.clearRect(0,0,w,h)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy
        if (p.y < -10) { p.y = h + 8; p.x = Math.random() * w }
        if (p.x < -10) p.x = w + 8; if (p.x > w + 10) p.x = -8
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dist2 = dx*dx + dy*dy
        if (dist2 < 17000 && dist2 > 1) { const f = .12 / Math.sqrt(dist2); p.x += dx*f; p.y += dy*f }
        const pulse = .55 + Math.sin(t * .001 + p.phase) * .35
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + pulse*.12), 0, Math.PI*2)
        const isGold = premium && p.gold
        ctx.fillStyle = isGold ? `rgba(255,207,90,${p.a*pulse})` : `rgba(193,112,255,${p.a*pulse})`
        ctx.shadowBlur = isGold ? 13 : 11; ctx.shadowColor = isGold ? '#ffd66a' : '#b45cff'; ctx.fill()
      }
      ctx.shadowBlur = 0
      raf = requestAnimationFrame(draw)
    }
    resize(); window.addEventListener('resize', resize); window.addEventListener('pointermove', onMove); raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove) }
  }, [premium])
  return <canvas className="particle-canvas" ref={canvasRef} aria-hidden="true" />
}

function Brand({ premium=false, compact=false }) {
  return <div className={`brand ${compact?'compact':''}`}>
    <div className="logo-wrap">
      <img src="./amethyst.svg" className="logo" />
      {premium && <Crown className="logo-crown" size={22}/>} 
    </div>
    {!compact && <div><div className="brand-name">AMETHYST <span>STUDIO</span></div><div className="brand-sub">ONE CRYSTAL. EVERY FORMAT.</div></div>}
  </div>
}

function Login({ onLogin }) {
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const existing = document.getElementById('google-gsi')
    const boot = () => {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            setStatus('Signing you in…')
            const r = await fetch(`${API}/auth/google`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({credential})})
            if (!r.ok) throw new Error((await r.json()).detail || 'Google sign-in failed')
            const data = await r.json(); localStorage.setItem('amethyst_token', data.token); onLogin(data.user)
          } catch (e) { setStatus(e.message) }
        }, theme:'filled_black', shape:'pill', text:'continue_with', size:'large'
      })
      window.google.accounts.id.renderButton(document.getElementById('google-button'), {theme:'filled_black', size:'large', shape:'pill', width:310})
    }
    if (existing) return boot()
    const s = document.createElement('script'); s.id='google-gsi'; s.src='https://accounts.google.com/gsi/client'; s.async=true; s.defer=true; s.onload=boot; document.head.appendChild(s)
  }, [onLogin])
  const ready = API && GOOGLE_CLIENT_ID
  return <main className="login-shell">
    <CrystalParticles premium={false}/><div className="aurora a1"/><div className="aurora a2"/>
    <section className="login-card glass">
      <Brand/>
      <div className="hero-crystal"><img src="./amethyst.svg"/><div className="orbit o1"/><div className="orbit o2"/></div>
      <div className="eyebrow"><Sparkles size={14}/> MEDIA · IMAGE · DOCUMENT WORKSPACE</div>
      <h1>Your universal creative toolkit.</h1>
      <p>Download authorized media, enhance visuals, remove backgrounds, convert documents and preview files in one luminous workspace.</p>
      {ready ? <div id="google-button" className="google-slot"/> : <div className="setup-required"><AlertTriangle size={18}/><div><strong>Setup required</strong><span>Add VITE_API_URL and VITE_GOOGLE_CLIENT_ID before publishing.</span></div></div>}
      {status && <div className="login-status">{status}</div>}
      <div className="login-pills"><span>10 free jobs/day</span><span>7-day Premium keys</span><span>Private temporary files</span></div>
    </section>
    <footer className="login-footer">AMETHYST STUDIO v{APP_VERSION} · <a href="./privacy.html">Privacy</a> · <a href="./terms.html">Terms</a></footer>
  </main>
}

function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('Home')
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState(null)
  const token = localStorage.getItem('amethyst_token')
  const auth = useMemo(() => ({'Authorization':`Bearer ${token}`}), [token])
  const notify = (message,type='ok') => { setToast({message,type}); setTimeout(()=>setToast(null),3500) }

  useEffect(() => {
    if (!token || !API) return
    fetch(`${API}/me`, {headers:auth}).then(async r => { if(!r.ok) throw 0; return r.json() }).then(setUser).catch(()=>localStorage.removeItem('amethyst_token'))
  }, [])

  if (!user) return <Login onLogin={setUser}/>
  const premium = user.is_premium
  const logout = () => { localStorage.removeItem('amethyst_token'); setUser(null) }
  const refreshMe = async () => { const r=await fetch(`${API}/me`,{headers:auth}); if(r.ok)setUser(await r.json()) }
  return <div className={`app ${premium?'premium':''}`}>
    <CrystalParticles premium={premium}/><div className="aurora a1"/><div className="aurora a2"/>
    <aside className={`sidebar glass ${mobileNav?'open':''}`}>
      <div className="side-top"><Brand premium={premium}/><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div>
      <nav>{nav.map(([label,Icon]) => <button key={label} onClick={()=>{setPage(label);setMobileNav(false)}} className={page===label?'active':''}><Icon size={18}/><span>{label}</span>{label==='Premium'&&premium?<Crown size={14} className="nav-gold"/>:null}</button>)}
      {user.is_admin && <button onClick={()=>{setPage('Admin Console');setMobileNav(false)}} className={page==='Admin Console'?'active admin-link':'admin-link'}><ShieldCheck size={18}/><span>Admin Console</span></button>}</nav>
      <div className="quota-card">
        <div className="quota-row"><span>{premium?'Premium':'Free Plan'}</span><strong>{premium?'∞':`${user.daily_used}/10`}</strong></div>
        <div className="quota-track"><i style={{width:premium?'100%':`${Math.min(100,user.daily_used*10)}%`}}/></div>
        <small>{premium?'Unlimited jobs · priority mode':`${Math.max(0,10-user.daily_used)} jobs remaining today`}</small>
      </div>
      <button className="profile-card" onClick={()=>setPage('Account')}><img src={user.picture || './amethyst.svg'}/><div><b>{user.name||'Amethyst User'}</b><span>{user.is_admin?'ADMIN · PREMIUM':premium?'PREMIUM':'FREE'}</span></div><Settings size={16}/></button>
    </aside>

    <div className="workspace">
      <header className="topbar glass"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div><span className="crumb">AMETHYST /</span> <b>{page.toUpperCase()}</b></div><div className="top-actions"><span className={`status-chip ${premium?'gold':''}`}><span className="live-dot"/>{premium?'ROYAL PREMIUM':'SYSTEM ONLINE'}</span><button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={18}/></button></div></header>
      <main className="content">
        {page==='Home' && <HomePage user={user} premium={premium} setPage={setPage}/>} 
        {page==='Downloader' && <Downloader api={API} auth={auth} notify={notify} refreshMe={refreshMe}/>} 
        {page==='Video' && <VideoTools api={API} auth={auth} notify={notify} refreshMe={refreshMe}/>} 
        {page==='Audio' && <AudioTools api={API} auth={auth} notify={notify} refreshMe={refreshMe}/>} 
        {page==='Images' && <ImageTools api={API} auth={auth} notify={notify} refreshMe={refreshMe}/>} 
        {page==='Background' && <BackgroundTools api={API} auth={auth} notify={notify} refreshMe={refreshMe}/>} 
        {page==='Documents' && <DocumentTools api={API} auth={auth} notify={notify} refreshMe={refreshMe}/>} 
        {page==='Viewer' && <Viewer api={API} auth={auth}/>} 
        {page==='History' && <HistoryPage api={API} auth={auth}/>} 
        {page==='Premium' && <PremiumPage api={API} auth={auth} user={user} refreshMe={refreshMe} notify={notify}/>} 
        {page==='Admin Console' && user.is_admin && <Admin api={API} auth={auth} notify={notify}/>} 
        {page==='Account' && <Account user={user} logout={logout}/>} 
      </main>
    </div>
    {toast && <div className={`toast ${toast.type}`}><CheckCircle2 size={18}/>{toast.message}</div>}
  </div>
}

function HomePage({user,premium,setPage}) {
  const tools = [
    ['Download Video','Authorized YouTube / TikTok links',Download,'Downloader'],['Extract Best Audio','MP3 · FLAC · WAV · OPUS',Music2,'Audio'],
    ['Enhance Image','Upscale · denoise · sharpen',Sparkles,'Images'],['Remove Background','Images + chroma key video',WandSparkles,'Background'],
    ['Convert Documents','PDF · DOCX · XLSX · PPTX',FileOutput,'Documents'],['Open Documents','Preview supported files safely',Eye,'Viewer']
  ]
  return <>
    <section className="hero-panel glass">
      <div className="hero-copy"><div className="eyebrow"><Gem size={14}/> AMETHYST PROCESSING CORE</div><h1>One crystal.<br/><span>Every format.</span></h1><p>Turn media and documents into exactly what you need—with a workspace built for clarity, speed and beautiful motion.</p><div className="hero-actions"><button className="primary" onClick={()=>setPage('Downloader')}><Download size={18}/>Paste a link</button><button className="secondary" onClick={()=>setPage('Documents')}><UploadCloud size={18}/>Drop a file</button></div></div>
      <div className="hero-art"><div className="crystal-stage"><div className="energy-ring r1"/><div className="energy-ring r2"/><img src="./amethyst.svg"/><div className="spark s1"/><div className="spark s2"/><div className="spark s3"/></div><div className="art-label"><span>PROCESSING MATRIX</span><b>{premium?'ROYAL CORE ACTIVE':'READY'}</b></div></div>
    </section>
    <section className="section-head"><div><span className="kicker">QUICK ACTIONS</span><h2>What do you want to create?</h2></div><span className="version">v{APP_VERSION}</span></section>
    <div className="tool-grid">{tools.map(([t,d,Icon,p])=><button className="tool-card glass" key={t} onClick={()=>setPage(p)}><div className="tool-icon"><Icon/></div><div><h3>{t}</h3><p>{d}</p></div><span className="arrow">↗</span></button>)}</div>
    <div className="dashboard-row"><div className="metric-card glass"><span>DAILY ACCESS</span><b>{premium?'Unlimited':`${Math.max(0,10-user.daily_used)} left`}</b><small>{premium?'Premium has no daily job cap':'Free plan resets daily'}</small></div><div className={`metric-card glass ${premium?'gold':''}`}><span>MEMBERSHIP</span><b>{premium?'Royal Premium':'Amethyst Free'}</b><small>{premium?(user.is_admin?'Admin Premium · never expires':`Active until ${new Date(user.premium_until).toLocaleDateString()}`):'Redeem a one-use 7-day key anytime'}</small></div><div className="metric-card glass"><span>PRIVACY</span><b>Temporary files</b><small>Jobs expire automatically on the server</small></div></div>
  </>
}

function LinkInput({onSubmit,busy}) {
  const [url,setUrl]=useState(''); const [agree,setAgree]=useState(false); const [mode,setMode]=useState('video')
  return <div className="input-stack"><div className="control-card glass download-mode"><label>Output <select value={mode} onChange={e=>setMode(e.target.value)}><option value="video">Best available video</option><option value="audio">Best available audio (FLAC)</option></select></label></div><div className="link-box glass"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a YouTube or TikTok link here"/><button className="primary" disabled={!url||!agree||busy} onClick={()=>onSubmit(url,mode)}>{busy?<LoaderCircle className="spin" size={18}/>:<Gauge size={18}/>}Analyze & Download</button></div><label className="permission"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>I own this media or have permission to download and process it.</span></label></div>
}

function Downloader({api,auth,notify,refreshMe}) {
  const [busy,setBusy]=useState(false); const [job,setJob]=useState(null)
  const go=async (url,mode)=>{setBusy(true);try{const r=await fetch(`${api}/jobs/download`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({url,mode})});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Download failed');setJob(d);notify('Download job created');refreshMe()}catch(e){notify(e.message,'err')}finally{setBusy(false)}}
  return <ToolPage title="Universal Downloader" kicker="AUTHORIZED MEDIA" desc="Download the best available source from supported links. Amethyst never labels enhanced output as original quality."><LinkInput onSubmit={go} busy={busy}/>{job&&<JobCard job={job} api={api} auth={auth}/>}</ToolPage>
}

function UploadTool({title,desc,accept='*/*',endpoint,api,auth,extra={},notify,refreshMe}) {
  const [file,setFile]=useState(null); const [busy,setBusy]=useState(false); const [job,setJob]=useState(null)
  const submit=async()=>{if(!file)return;setBusy(true);try{const fd=new FormData();fd.append('file',file);Object.entries(extra).forEach(([k,v])=>fd.append(k,v));const r=await fetch(`${api}${endpoint}`,{method:'POST',headers:auth,body:fd});const d=await r.json();if(!r.ok)throw new Error(d.detail||'Job failed');setJob(d);notify('Processing job created');refreshMe()}catch(e){notify(e.message,'err')}finally{setBusy(false)}}
  return <div className="mini-tool glass"><div className="mini-head"><div><h3>{title}</h3><p>{desc}</p></div><UploadCloud/></div><label className="drop-zone"><input type="file" accept={accept} onChange={e=>setFile(e.target.files?.[0]||null)}/><UploadCloud size={28}/><b>{file?file.name:'Drop a file or click to upload'}</b><span>{file?`${(file.size/1024/1024).toFixed(2)} MB`:'Your file is processed on the backend'}</span></label><button className="primary wide" onClick={submit} disabled={!file||busy}>{busy?<LoaderCircle className="spin" size={18}/>:<Sparkles size={18}/>}Process</button>{job&&<JobCard job={job} api={api} auth={auth}/>}</div>
}

function VideoTools(p){const [fps,setFps]=useState(60);const [width,setWidth]=useState(3840);return <ToolPage title="Video Lab" kicker="UPSCALE · INTERPOLATE" desc="Create enhanced derivatives with FFmpeg. 10K and 600 FPS are enhancement targets, not claims about the source."><div className="control-card glass"><label>Target width <select value={width} onChange={e=>setWidth(e.target.value)}><option value="1920">1080p-class</option><option value="3840">4K</option><option value="7680">8K</option><option value="10240">10K</option></select></label><label>Target FPS <select value={fps} onChange={e=>setFps(e.target.value)}><option>60</option><option>120</option><option>240</option><option>600</option></select></label></div><UploadTool {...p} title="Enhance video" desc="Scale and motion-interpolate a local video." accept="video/*" endpoint="/jobs/video-enhance" extra={{fps,width}}/></ToolPage>}
function AudioTools(p){return <ToolPage title="Audio Studio" kicker="EXTRACT · TRANSCODE" desc="Extract or convert audio with high-quality FFmpeg settings."><div className="two-col"><UploadTool {...p} title="Best-quality FLAC" desc="Lossless output container." accept="audio/*,video/*" endpoint="/jobs/audio" extra={{format:'flac'}}/><UploadTool {...p} title="Universal MP3" desc="High-bitrate compatibility output." accept="audio/*,video/*" endpoint="/jobs/audio" extra={{format:'mp3'}}/></div></ToolPage>}
function ImageTools(p){return <ToolPage title="Image Enhance" kicker="UPSCALE · RESTORE" desc="Upscale images, clean noise and restore detail without changing the original file."><UploadTool {...p} title="4× image enhancement" desc="High-quality Lanczos upscale + gentle sharpening." accept="image/*" endpoint="/jobs/image-enhance" extra={{scale:'4'}}/></ToolPage>}
function BackgroundTools(p){return <ToolPage title="Background Studio" kicker="CUTOUT · CHROMA KEY" desc="Remove image backgrounds or key out green-screen video."><div className="two-col"><UploadTool {...p} title="Image cutout" desc="AI background removal when rembg is installed." accept="image/*" endpoint="/jobs/image-background"/><UploadTool {...p} title="Green-screen video" desc="Chroma-key green into transparency." accept="video/*" endpoint="/jobs/video-chromakey"/></div></ToolPage>}
function DocumentTools(p){const [fmt,setFmt]=useState('pdf');return <ToolPage title="Document Universe" kicker="CONVERT · PRESERVE" desc="Convert supported office documents through LibreOffice headless on your server."><div className="control-card glass"><label>Output format <select value={fmt} onChange={e=>setFmt(e.target.value)}><option>pdf</option><option>docx</option><option>xlsx</option><option>pptx</option><option>txt</option><option>html</option></select></label></div><UploadTool {...p} title="Convert document" desc="PDF, Word, Excel, PowerPoint and compatible office formats." accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.html" endpoint="/jobs/document" extra={{format:fmt}}/></ToolPage>}

function Viewer({api,auth}) { const [file,setFile]=useState(null);const [src,setSrc]=useState('');const open=async()=>{if(!file)return;const fd=new FormData();fd.append('file',file);const r=await fetch(`${api}/viewer`,{method:'POST',headers:auth,body:fd});if(!r.ok)return;const b=await r.blob();setSrc(URL.createObjectURL(b))};return <ToolPage title="Document Viewer" kicker="OPEN IN BROWSER" desc="PDFs open directly. Office files are converted to a temporary PDF preview on the backend."><div className="viewer-upload glass"><input type="file" onChange={e=>setFile(e.target.files?.[0])}/><button className="primary" onClick={open} disabled={!file}><Eye size={18}/>Open document</button></div>{src&&<iframe className="viewer-frame" src={src}/>}</ToolPage>}

function JobCard({job,api,auth}) { const [data,setData]=useState(job); useEffect(()=>{if(!data?.id||['ready','failed'].includes(data.status))return;const id=setInterval(async()=>{const r=await fetch(`${api}/jobs/${data.id}`,{headers:auth});if(r.ok)setData(await r.json())},1400);return()=>clearInterval(id)},[data?.id,data?.status]); const download=async()=>{const r=await fetch(`${api}/jobs/${data.id}/download`,{headers:auth});if(!r.ok)return;const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=r.headers.get('x-amethyst-filename')||'amethyst-output';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000)}; return <div className="job glass"><div className="job-line"><div className={`job-state ${data.status}`}>{data.status==='ready'?<CheckCircle2/>:<LoaderCircle className={data.status==='failed'?'':'spin'}/>}<span>{data.status}</span></div><b>{data.kind}</b></div><div className="job-track"><i style={{width:`${data.progress||0}%`}}/></div><p>{data.message||'Processing…'}</p>{data.status==='ready'&&<button className="primary link-btn" onClick={download}><Download size={18}/>Download result</button>}{data.error&&<div className="error-box">{data.error}</div>}</div>}

function HistoryPage({api,auth}) { const [items,setItems]=useState([]);const load=()=>fetch(`${api}/jobs`,{headers:auth}).then(r=>r.ok?r.json():[]).then(setItems);useEffect(load,[]);return <ToolPage title="History" kicker="RECENT PROCESSING" desc="Your latest server-side jobs."><div className="history-list">{items.length?items.map(j=><div className="history-item glass" key={j.id}><div><b>{j.kind}</b><span>{new Date(j.created_at).toLocaleString()}</span></div><span className={`badge ${j.status}`}>{j.status}</span></div>):<Empty text="No processing jobs yet."/>}</div></ToolPage>}

function PremiumPage({api,auth,user,refreshMe,notify}) { const [key,setKey]=useState('');const redeem=async()=>{const r=await fetch(`${api}/premium/redeem`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({key})});const d=await r.json();if(!r.ok)return notify(d.detail||'Key rejected','err');notify('Royal Premium activated');await refreshMe();setKey('')};return <ToolPage title="Royal Premium" kicker="AMETHYST CROWN" desc="One-use keys grant seven days of unlimited access."><section className="premium-banner glass"><div className="premium-gem"><Brand premium/></div><div><span className="kicker gold-text">ROYAL AMETHYST</span><h2>{user.is_premium?'Premium is active':'Unlock the golden interface.'}</h2><p>Unlimited daily jobs, royal gold effects, priority-ready account flags and advanced processing controls.</p>{user.is_premium&&<b>{user.is_admin?'Admin Premium · never expires':`Active until ${new Date(user.premium_until).toLocaleString()}`}</b>}</div></section>{!user.is_premium&&<div className="redeem glass"><KeyRound/><input placeholder="AMETHYST-7D-XXXX-XXXX-XXXX" value={key} onChange={e=>setKey(e.target.value.toUpperCase())}/><button className="primary gold-button" onClick={redeem} disabled={!key}>Redeem one-use key</button></div>}<div className="feature-strip"><span>∞ Unlimited jobs</span><span>♛ Royal theme</span><span>10K / 600 FPS targets</span><span>7 days per key</span></div></ToolPage>}

function Admin({api,auth,notify}) { const [count,setCount]=useState(1);const [keys,setKeys]=useState([]);const [existing,setExisting]=useState([]);const load=()=>fetch(`${api}/admin/keys`,{headers:auth}).then(r=>r.ok?r.json():[]).then(setExisting);useEffect(load,[]);const gen=async()=>{const r=await fetch(`${api}/admin/keys`,{method:'POST',headers:{...auth,'Content-Type':'application/json'},body:JSON.stringify({count:Number(count)})});const d=await r.json();if(!r.ok)return notify(d.detail||'Failed','err');setKeys(d.keys);notify(`${d.keys.length} one-use key(s) created`);load()};const copy=s=>navigator.clipboard.writeText(s).then(()=>notify('Copied to clipboard'));return <ToolPage title="Admin Console" kicker="OWNER ACCESS" desc="Generate and audit one-use seven-day Premium keys. Plaintext keys are shown only when created."><div className="admin-create glass"><label>Generate <select value={count} onChange={e=>setCount(e.target.value)}>{[1,5,10,25,50,100].map(n=><option key={n}>{n}</option>)}</select></label><button className="primary gold-button" onClick={gen}><KeyRound size={18}/>Generate keys</button></div>{keys.length>0&&<div className="generated glass"><h3>New keys — copy now</h3>{keys.map(k=><div className="key-row" key={k}><code>{k}</code><button className="icon-btn" onClick={()=>copy(k)}><Copy size={16}/></button></div>)}</div>}<div className="table glass"><div className="tr th"><span>Status</span><span>Created</span><span>Redeemed by</span><span>Redeemed at</span></div>{existing.map(k=><div className="tr" key={k.id}><span><b className={`badge ${k.status==='USED'?'ready':'queued'}`}>{k.status}</b></span><span>{new Date(k.created_at).toLocaleDateString()}</span><span>{k.redeemed_by||'—'}</span><span>{k.redeemed_at?new Date(k.redeemed_at).toLocaleString():'—'}</span></div>)}</div></ToolPage>}

function Account({user,logout}){return <ToolPage title="Account" kicker="IDENTITY" desc="Your Google-authenticated Amethyst profile."><div className="account glass"><img src={user.picture||'./amethyst.svg'}/><div><h2>{user.name}</h2><p>{user.email}</p><div className="account-tags"><span>{user.is_admin?'ADMIN':'USER'}</span><span>{user.is_premium?'PREMIUM':'FREE'}</span></div></div><button className="secondary" onClick={logout}><LogOut size={18}/>Sign out</button></div></ToolPage>}
function ToolPage({title,kicker,desc,children}){return <><section className="page-title"><span className="kicker">{kicker}</span><h1>{title}</h1><p>{desc}</p></section>{children}</>}
function Empty({text}){return <div className="empty glass"><Gem/><b>{text}</b></div>}

createRoot(document.getElementById('root')).render(<App/>)
