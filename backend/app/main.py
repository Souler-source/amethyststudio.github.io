from __future__ import annotations

import hashlib
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import jwt
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from PIL import Image, ImageEnhance, ImageFilter
from dotenv import load_dotenv
from pydantic import BaseModel
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, create_engine, select, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

load_dotenv()

APP_VERSION = "1.0.0"
APP_SECRET = os.getenv("APP_SECRET", "CHANGE-ME-IN-PRODUCTION")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "khangyukimaru@gmail.com").lower().strip()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/amethyst.db")
JOB_DIR = Path(os.getenv("JOB_DIR", "./data/jobs")).resolve()
JOB_TTL_HOURS = int(os.getenv("JOB_TTL_HOURS", "24"))
FREE_DAILY_LIMIT = int(os.getenv("FREE_DAILY_LIMIT", "10"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "500"))
CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]

JOB_DIR.mkdir(parents=True, exist_ok=True)
Path("./data").mkdir(exist_ok=True)

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    google_sub: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), default="Amethyst User")
    picture: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    premium_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class PremiumKey(Base):
    __tablename__ = "premium_keys"
    id: Mapped[int] = mapped_column(primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="UNUSED")
    days: Mapped[int] = mapped_column(Integer, default=7)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    redeemed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    redeemed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

class Usage(Base):
    __tablename__ = "usage"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[str] = mapped_column(String(10), index=True)
    count: Mapped[int] = mapped_column(Integer, default=0)

class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String(500), default="Queued")
    input_name: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    output_path: Mapped[Optional[str]] = mapped_column(String(1200), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(String(1500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base.metadata.create_all(engine)

app = FastAPI(title="Amethyst Studio API", version=APP_VERSION)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=False, allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Amethyst-Filename","Content-Disposition"])


def cleanup_loop():
    while True:
        try:
            cutoff = now() - timedelta(hours=JOB_TTL_HOURS)
            for path in JOB_DIR.iterdir():
                try:
                    mtime = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc)
                    if mtime < cutoff:
                        shutil.rmtree(path, ignore_errors=True) if path.is_dir() else path.unlink(missing_ok=True)
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(3600)

@app.on_event("startup")
def start_cleanup_worker():
    threading.Thread(target=cleanup_loop, name="amethyst-cleanup", daemon=True).start()

class GoogleAuthIn(BaseModel): credential: str
class RedeemIn(BaseModel): key: str
class GenerateKeysIn(BaseModel): count: int = 1
class DownloadIn(BaseModel):
    url: str
    mode: str = "video"

def now() -> datetime: return datetime.now(timezone.utc)
def premium_active(u: User) -> bool:
    if u.is_admin: return True
    if not u.premium_until: return False
    dt = u.premium_until
    if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
    return dt > now()

def jwt_for(u: User) -> str:
    return jwt.encode({"sub":str(u.id),"email":u.email,"exp":now()+timedelta(days=14)}, APP_SECRET, algorithm="HS256")

def db_session():
    db = SessionLocal()
    try: yield db
    finally: db.close()

def token_user(authorization: Optional[str], token: Optional[str], db: Session) -> User:
    raw = token
    if authorization and authorization.lower().startswith("bearer "): raw = authorization.split(" ",1)[1].strip()
    if not raw: raise HTTPException(401,"Authentication required")
    try: payload = jwt.decode(raw, APP_SECRET, algorithms=["HS256"]); uid = int(payload["sub"])
    except Exception: raise HTTPException(401,"Invalid or expired session")
    u = db.get(User, uid)
    if not u: raise HTTPException(401,"Unknown account")
    return u

def current_user(authorization: Optional[str]=Header(None), db:Session=Depends(db_session)) -> User:
    return token_user(authorization, None, db)

def user_view(u: User, db: Session) -> dict:
    day = now().date().isoformat()
    row = db.scalar(select(Usage).where(Usage.user_id==u.id, Usage.day==day))
    return {"id":u.id,"email":u.email,"name":u.name,"picture":u.picture,"is_admin":u.is_admin,"is_premium":premium_active(u),"premium_until":u.premium_until,"daily_used":row.count if row else 0}

def check_and_charge(db:Session,u:User):
    if premium_active(u): return
    day=now().date().isoformat(); row=db.scalar(select(Usage).where(Usage.user_id==u.id,Usage.day==day).with_for_update())
    if not row: row=Usage(user_id=u.id,day=day,count=0); db.add(row); db.flush()
    if row.count>=FREE_DAILY_LIMIT: raise HTTPException(429,f"Daily free limit reached ({FREE_DAILY_LIMIT}).")
    row.count+=1; db.commit()

def safe_name(name:str)->str:
    name = Path(name or "file").name
    return re.sub(r"[^A-Za-z0-9._ -]+","_",name)[:180] or "file"

def create_job(db:Session,u:User,kind:str,input_name:Optional[str]=None)->Job:
    j=Job(id=str(uuid.uuid4()),user_id=u.id,kind=kind,input_name=input_name,status="queued",progress=0,message="Queued")
    db.add(j);db.commit();return j

def job_dict(j:Job)->dict:
    return {"id":j.id,"kind":j.kind,"status":j.status,"progress":j.progress,"message":j.message,"error":j.error,"created_at":j.created_at}

def set_job(job_id:str, **kwargs):
    with SessionLocal() as db:
        j=db.get(Job,job_id)
        if not j:return
        for k,v in kwargs.items(): setattr(j,k,v)
        j.updated_at=now();db.commit()

def run(cmd:list[str], timeout:int=7200):
    p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=timeout)
    if p.returncode!=0: raise RuntimeError((p.stderr or p.stdout or "Process failed")[-1400:])
    return p

def require_bin(name:str):
    if not shutil.which(name): raise RuntimeError(f"Required server dependency is missing: {name}")

def save_upload(file:UploadFile, dest:Path):
    dest.parent.mkdir(parents=True,exist_ok=True)
    total=0
    with dest.open("wb") as f:
        while True:
            chunk=file.file.read(1024*1024)
            if not chunk:break
            total+=len(chunk)
            if total>MAX_UPLOAD_MB*1024*1024:
                f.close();dest.unlink(missing_ok=True);raise HTTPException(413,f"File exceeds {MAX_UPLOAD_MB} MB upload limit")
            f.write(chunk)

def process_download(job_id:str,url:str,mode:str):
    try:
        import yt_dlp
        set_job(job_id,status="processing",progress=8,message="Inspecting authorized source")
        outdir=JOB_DIR/job_id;outdir.mkdir(parents=True,exist_ok=True)
        def hook(d):
            if d.get("status")=="downloading":
                pct=d.get("_percent_str","0%").strip().replace("%","")
                try:set_job(job_id,progress=max(10,min(82,int(float(pct)))) ,message="Downloading best available source")
                except:pass
        if mode == "audio":
            opts={"format":"bestaudio/best","outtmpl":str(outdir/"%(title).120s.%(ext)s"),"noplaylist":True,"quiet":True,"progress_hooks":[hook],"restrictfilenames":True,"postprocessors":[{"key":"FFmpegExtractAudio","preferredcodec":"flac"}]}
        else:
            opts={"format":"bv*+ba/b","merge_output_format":"mp4","outtmpl":str(outdir/"%(title).120s.%(ext)s"),"noplaylist":True,"quiet":True,"progress_hooks":[hook],"restrictfilenames":True}
        with yt_dlp.YoutubeDL(opts) as ydl:
            info=ydl.extract_info(url,download=True)
            candidate=Path(ydl.prepare_filename(info))
        files=[p for p in outdir.iterdir() if p.is_file()]
        output=max(files,key=lambda p:p.stat().st_mtime) if files else candidate
        set_job(job_id,status="ready",progress=100,message="Best available source is ready",output_path=str(output))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Download failed",error=str(e))

def process_audio(job_id:str,input_path:str,fmt:str):
    try:
        require_bin("ffmpeg");set_job(job_id,status="processing",progress=15,message="Decoding source audio")
        inp=Path(input_path);out=inp.parent/f"output.{fmt}"
        if fmt=="flac": cmd=["ffmpeg","-y","-i",str(inp),"-vn","-c:a","flac",str(out)]
        elif fmt=="wav": cmd=["ffmpeg","-y","-i",str(inp),"-vn","-c:a","pcm_s24le",str(out)]
        elif fmt=="opus": cmd=["ffmpeg","-y","-i",str(inp),"-vn","-c:a","libopus","-b:a","256k",str(out)]
        else: cmd=["ffmpeg","-y","-i",str(inp),"-vn","-c:a","libmp3lame","-b:a","320k",str(out)]
        set_job(job_id,progress=50,message="Encoding audio");run(cmd);set_job(job_id,status="ready",progress=100,message="Audio ready",output_path=str(out))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Audio processing failed",error=str(e))

def process_video_enhance(job_id:str,input_path:str,width:int,fps:int):
    try:
        require_bin("ffmpeg");inp=Path(input_path);out=inp.parent/f"enhanced_{width}px_{fps}fps.mp4"
        set_job(job_id,status="processing",progress=12,message="Analyzing video")
        vf=f"scale={width}:-2:flags=lanczos"
        if fps>0: vf+=f",minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
        set_job(job_id,progress=28,message=f"Enhancing toward {width}px / {fps} FPS")
        run(["ffmpeg","-y","-i",str(inp),"-vf",vf,"-c:v","libx264","-preset","slow","-crf","16","-c:a","aac","-b:a","256k",str(out)],timeout=14400)
        set_job(job_id,status="ready",progress=100,message="Enhanced derivative ready",output_path=str(out))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Video enhancement failed",error=str(e))

def process_image_enhance(job_id:str,input_path:str,scale:int):
    try:
        set_job(job_id,status="processing",progress=18,message="Opening image")
        inp=Path(input_path);out=inp.parent/"enhanced.png"
        im=Image.open(inp).convert("RGBA"); target=(im.width*scale,im.height*scale)
        set_job(job_id,progress=48,message=f"Upscaling {scale}× with Lanczos")
        im=im.resize(target,Image.Resampling.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.3,percent=115,threshold=3));im=ImageEnhance.Contrast(im).enhance(1.02);im.save(out,"PNG",optimize=True)
        set_job(job_id,status="ready",progress=100,message="Enhanced image ready",output_path=str(out))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Image enhancement failed",error=str(e))

def process_image_bg(job_id:str,input_path:str):
    try:
        set_job(job_id,status="processing",progress=20,message="Loading background-removal model")
        try: from rembg import remove
        except Exception: raise RuntimeError("AI image cutout requires optional server package: pip install rembg onnxruntime")
        inp=Path(input_path);out=inp.parent/"cutout.png"; data=inp.read_bytes();set_job(job_id,progress=48,message="Separating foreground")
        out.write_bytes(remove(data));set_job(job_id,status="ready",progress=100,message="Transparent cutout ready",output_path=str(out))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Background removal failed",error=str(e))

def process_chromakey(job_id:str,input_path:str):
    try:
        require_bin("ffmpeg");inp=Path(input_path);out=inp.parent/"green_removed.webm";set_job(job_id,status="processing",progress=22,message="Keying green background")
        run(["ffmpeg","-y","-i",str(inp),"-vf","chromakey=0x00FF00:0.18:0.10,format=yuva420p","-c:v","libvpx-vp9","-pix_fmt","yuva420p","-auto-alt-ref","0","-b:v","0","-crf","25","-an",str(out)])
        set_job(job_id,status="ready",progress=100,message="Transparent WebM ready",output_path=str(out))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Chroma key failed",error=str(e))

def process_document(job_id:str,input_path:str,fmt:str):
    try:
        require_bin("libreoffice");inp=Path(input_path);outdir=inp.parent;set_job(job_id,status="processing",progress=25,message="Opening document converter")
        run(["libreoffice","--headless","--convert-to",fmt,"--outdir",str(outdir),str(inp)],timeout=300)
        candidates=[p for p in outdir.iterdir() if p.is_file() and p!=inp and p.suffix.lower()==f".{fmt.lower()}"]
        if not candidates: raise RuntimeError(f"LibreOffice did not produce .{fmt}. This source/output pair may not be supported.")
        out=max(candidates,key=lambda p:p.stat().st_mtime);set_job(job_id,status="ready",progress=100,message="Converted document ready",output_path=str(out))
    except Exception as e:set_job(job_id,status="failed",progress=100,message="Document conversion failed",error=str(e))

@app.get("/")
def root(): return {"name":"Amethyst Studio API","version":APP_VERSION,"status":"online"}

@app.post("/auth/google")
def auth_google(body:GoogleAuthIn,db:Session=Depends(db_session)):
    if not GOOGLE_CLIENT_ID: raise HTTPException(503,"GOOGLE_CLIENT_ID is not configured")
    try: info=id_token.verify_oauth2_token(body.credential,google_requests.Request(),GOOGLE_CLIENT_ID)
    except Exception: raise HTTPException(401,"Google credential verification failed")
    if not info.get("email_verified"): raise HTTPException(401,"Google email is not verified")
    email=info["email"].lower().strip(); sub=info["sub"]
    u=db.scalar(select(User).where(User.google_sub==sub)) or db.scalar(select(User).where(User.email==email))
    if not u: u=User(google_sub=sub,email=email,name=info.get("name") or "Amethyst User",picture=info.get("picture"),is_admin=email==ADMIN_EMAIL);db.add(u)
    else:
        u.google_sub=sub;u.email=email;u.name=info.get("name") or u.name;u.picture=info.get("picture") or u.picture;u.is_admin=(email==ADMIN_EMAIL)
    db.commit();db.refresh(u);return {"token":jwt_for(u),"user":user_view(u,db)}

@app.get("/me")
def me(u:User=Depends(current_user),db:Session=Depends(db_session)): return user_view(u,db)

@app.post("/premium/redeem")
def redeem(body:RedeemIn,u:User=Depends(current_user),db:Session=Depends(db_session)):
    normalized=body.key.upper().strip(); h=hashlib.sha256(normalized.encode()).hexdigest(); k=db.scalar(select(PremiumKey).where(PremiumKey.key_hash==h).with_for_update())
    if not k: raise HTTPException(404,"Invalid Premium key")
    if k.status!="UNUSED": raise HTTPException(409,"This key has already been redeemed")
    start=max(now(), (u.premium_until.replace(tzinfo=timezone.utc) if u.premium_until and u.premium_until.tzinfo is None else u.premium_until) or now())
    u.premium_until=start+timedelta(days=k.days);k.status="USED";k.redeemed_at=now();k.redeemed_by_user_id=u.id;db.commit();return {"ok":True,"premium_until":u.premium_until}

@app.post("/admin/keys")
def create_keys(body:GenerateKeysIn,u:User=Depends(current_user),db:Session=Depends(db_session)):
    if not u.is_admin: raise HTTPException(403,"Admin only")
    count=max(1,min(100,body.count));plain=[]
    for _ in range(count):
        key=f"AMETHYST-7D-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"
        db.add(PremiumKey(key_hash=hashlib.sha256(key.encode()).hexdigest(),status="UNUSED",days=7));plain.append(key)
    db.commit();return {"keys":plain}

@app.get("/admin/keys")
def list_keys(u:User=Depends(current_user),db:Session=Depends(db_session)):
    if not u.is_admin: raise HTTPException(403,"Admin only")
    rows=db.scalars(select(PremiumKey).order_by(PremiumKey.created_at.desc()).limit(250)).all();out=[]
    for k in rows:
        ru=db.get(User,k.redeemed_by_user_id) if k.redeemed_by_user_id else None
        out.append({"id":k.id,"status":k.status,"created_at":k.created_at,"redeemed_at":k.redeemed_at,"redeemed_by":ru.email if ru else None})
    return out

@app.post("/jobs/download")
def download_job(body:DownloadIn,bg:BackgroundTasks,u:User=Depends(current_user),db:Session=Depends(db_session)):
    if not re.match(r"^https?://",body.url,re.I): raise HTTPException(400,"A valid http(s) URL is required")
    host=(urlparse(body.url).hostname or "").lower().removeprefix("www.")
    allowed=(host=="youtube.com" or host.endswith(".youtube.com") or host=="youtu.be" or host=="tiktok.com" or host.endswith(".tiktok.com"))
    if not allowed: raise HTTPException(400,"Version 1.0.0 accepts YouTube and TikTok URLs only")
    mode=body.mode.lower()
    if mode not in {"video","audio"}: raise HTTPException(400,"Mode must be video or audio")
    check_and_charge(db,u);j=create_job(db,u,"Authorized media download" if mode=="video" else "Authorized audio download",body.url);bg.add_task(process_download,j.id,body.url,mode);return job_dict(j)

def upload_job(file:UploadFile,u:User,db:Session,kind:str)->tuple[Job,Path]:
    check_and_charge(db,u);j=create_job(db,u,kind,safe_name(file.filename));d=JOB_DIR/j.id;d.mkdir(parents=True,exist_ok=True);path=d/safe_name(file.filename);save_upload(file,path);return j,path

@app.post("/jobs/audio")
def audio_job(bg:BackgroundTasks,file:UploadFile=File(...),format:str=Form("mp3"),u:User=Depends(current_user),db:Session=Depends(db_session)):
    fmt=format.lower();
    if fmt not in {"mp3","flac","wav","opus"}: raise HTTPException(400,"Unsupported audio format")
    j,p=upload_job(file,u,db,"Audio conversion");bg.add_task(process_audio,j.id,str(p),fmt);return job_dict(j)

@app.post("/jobs/video-enhance")
def video_enhance(bg:BackgroundTasks,file:UploadFile=File(...),fps:int=Form(60),width:int=Form(3840),u:User=Depends(current_user),db:Session=Depends(db_session)):
    fps=max(1,min(600,fps));width=max(320,min(10240,width))
    if (fps>120 or width>3840) and not premium_active(u): raise HTTPException(403,"8K/10K or >120 FPS enhancement requires Premium")
    j,p=upload_job(file,u,db,"Video enhancement");bg.add_task(process_video_enhance,j.id,str(p),width,fps);return job_dict(j)

@app.post("/jobs/image-enhance")
def image_enhance(bg:BackgroundTasks,file:UploadFile=File(...),scale:int=Form(4),u:User=Depends(current_user),db:Session=Depends(db_session)):
    scale=max(2,min(8,scale));j,p=upload_job(file,u,db,"Image enhancement");bg.add_task(process_image_enhance,j.id,str(p),scale);return job_dict(j)

@app.post("/jobs/image-background")
def image_background(bg:BackgroundTasks,file:UploadFile=File(...),u:User=Depends(current_user),db:Session=Depends(db_session)):
    j,p=upload_job(file,u,db,"Image background removal");bg.add_task(process_image_bg,j.id,str(p));return job_dict(j)

@app.post("/jobs/video-chromakey")
def chroma(bg:BackgroundTasks,file:UploadFile=File(...),u:User=Depends(current_user),db:Session=Depends(db_session)):
    j,p=upload_job(file,u,db,"Green-screen removal");bg.add_task(process_chromakey,j.id,str(p));return job_dict(j)

@app.post("/jobs/document")
def document(bg:BackgroundTasks,file:UploadFile=File(...),format:str=Form("pdf"),u:User=Depends(current_user),db:Session=Depends(db_session)):
    fmt=format.lower();
    if fmt not in {"pdf","docx","xlsx","pptx","txt","html"}: raise HTTPException(400,"Unsupported document output")
    j,p=upload_job(file,u,db,"Document conversion");bg.add_task(process_document,j.id,str(p),fmt);return job_dict(j)

@app.get("/jobs")
def jobs(u:User=Depends(current_user),db:Session=Depends(db_session)):
    rows=db.scalars(select(Job).where(Job.user_id==u.id).order_by(Job.created_at.desc()).limit(50)).all();return [job_dict(j) for j in rows]

@app.get("/jobs/{job_id}")
def get_job(job_id:str,u:User=Depends(current_user),db:Session=Depends(db_session)):
    j=db.get(Job,job_id)
    if not j or (j.user_id!=u.id and not u.is_admin): raise HTTPException(404,"Job not found")
    return job_dict(j)

@app.get("/jobs/{job_id}/download")
def download_result(job_id:str,u:User=Depends(current_user),db:Session=Depends(db_session)):
    j=db.get(Job,job_id)
    if not j or (j.user_id!=u.id and not u.is_admin): raise HTTPException(404,"Job not found")
    if j.status!="ready" or not j.output_path: raise HTTPException(409,"Job is not ready")
    path=Path(j.output_path)
    if not path.exists(): raise HTTPException(410,"Result expired")
    return FileResponse(path,filename=path.name,media_type="application/octet-stream",headers={"X-Amethyst-Filename":path.name})

@app.post("/viewer")
def viewer(file:UploadFile=File(...),u:User=Depends(current_user)):
    name=safe_name(file.filename);suffix=Path(name).suffix.lower();tmp=JOB_DIR/f"viewer-{uuid.uuid4()}";tmp.mkdir(parents=True,exist_ok=True);inp=tmp/name;save_upload(file,inp)
    if suffix==".pdf": return FileResponse(inp,media_type="application/pdf",filename=name)
    if suffix in {".png",".jpg",".jpeg",".gif",".webp"}: return FileResponse(inp,filename=name)
    require_bin("libreoffice");run(["libreoffice","--headless","--convert-to","pdf","--outdir",str(tmp),str(inp)],timeout=180);pdfs=list(tmp.glob("*.pdf"))
    if not pdfs: raise HTTPException(415,"This file cannot be previewed")
    return FileResponse(pdfs[0],media_type="application/pdf",filename=pdfs[0].name)
