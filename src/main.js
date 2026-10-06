import './style.css';
import {Repo} from './lib/repo.js';

const $=s=>document.querySelector(s),el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
const rnd=(a,b)=>a+Math.random()*(b-a);

/* ---------- Central services (swap Store internals for a backend later) ---------- */
const Store={K:'kds_halloween_v1',mem:{name:'',scores:[]},
 load(){let d;try{d=JSON.parse(localStorage.getItem(this.K))}catch(e){}d=d||this.mem;if(d.v!==3){d.scores=(d.scores||[]).filter(x=>x.game==='run'||x.game==='hunt');d.v=3;this.save(d)}return d},
 save(d){this.mem=d;try{localStorage.setItem(this.K,JSON.stringify(d))}catch(e){}},
 getName(){return this.load().name||''},setName(n){const d=this.load();d.name=n;this.save(d)},
 addScore(n,score,game){const d=this.load(),e=d.scores.find(x=>x.playerName===n&&x.game===game);let hi=false;
  if(!e){d.scores.push({playerName:n,score,game,timestamp:Date.now()});hi=score>0}else if(score>e.score){e.score=score;e.timestamp=Date.now();hi=true}this.save(d);return hi},
 board(game){const b={};this.load().scores.filter(x=>x.game===game).forEach(x=>{if(!b[x.playerName]||x.score>b[x.playerName].score)b[x.playerName]=x});return Object.values(b).sort((a,c)=>c.score-a.score||a.timestamp-c.timestamp)},
 scores(game){return this.load().scores.filter(s=>!game||s.game===game).sort((a,b)=>b.score-a.score||a.timestamp-b.timestamp)}};

const Sound={on:false,ctx:null,
 toggle(){this.on=!this.on;if(this.on&&!this.ctx)try{this.ctx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){this.on=false}$('#snd').textContent=this.on?'🔊 Sound On':'🔇 Sound Off';this.play('ok')},
 tone(f,d,t='sine',at=0){if(!this.on||!this.ctx)return;const c=this.ctx,o=c.createOscillator(),g=c.createGain(),s=c.currentTime+at;o.type=t;o.frequency.value=f;g.gain.setValueAtTime(.15,s);g.gain.exponentialRampToValueAtTime(.001,s+d);o.connect(g).connect(c.destination);o.start(s);o.stop(s+d)},
 play(n){({click:()=>this.tone(500,.08),ok:()=>{this.tone(660,.1);this.tone(880,.12,'sine',.08)},bad:()=>this.tone(150,.3,'sawtooth'),tick:()=>this.tone(440,.08,'square'),jump:()=>this.tone(420,.1,'square'),over:()=>[400,300,200].forEach((f,i)=>this.tone(f,.25,'triangle',i*.2)),jackpot:()=>[523,659,784,1047].forEach((f,i)=>this.tone(f,.2,'triangle',i*.1))})[n]?.()}};

/* ---------- Games: pure logic, talk to UI through `api` ---------- */
const GAMES={
 run:{name:'Vampire Run',em:'🧛',tag:'RUN. JUMP. CROUCH.',desc:'คุณคือแวมไพร์ที่กำลังวิ่งกลับคฤหาสน์ก่อนรุ่งสางมาถึง จงวิ่งไปจนชีวิตจะหาไม่!',
  intro:'🧛 วิ่งให้ไกลที่สุด!<br>↑ Space = กระโดด · ↓ S = ก้ม',hint:'Space/↑ กระโดด · ↓/S กดค้างเพื่อก้ม · มือถือ: ปุ่ม JUMP / CROUCH',
  start(api){const A=api.arena;A.style.height='auto';A.style.touchAction='none';
   A.innerHTML='<canvas width="640" height="300" style="width:100%;aspect-ratio:32/15;display:block;image-rendering:pixelated;touch-action:none"></canvas><div class="ctl"><button id="bc">CROUCH ↓</button><button id="bj">JUMP ↑</button></div>';
   const cv=A.firstChild,c=cv.getContext('2d'),W=640,H=300,GY=240,S=3;c.imageSmoothingEnabled=false;
   const C={ink:'#14081f',coat:'#2b1850',coatD:'#1f1040',hi:'#4a3085',lin:'#c4123e',linD:'#8f0c2e',skin:'#e4dcf2',sh:'#b9aed3',eye:'#ff3d6e',fang:'#ffffff',gold:'#ffd34a',boot:'#1a1026',shirt:'#f6f2ff',mouth:'#5a0a24'};
   const vspr=(pose,f)=>{const crouch=pose==='crouch',Hh=crouch?15:24,u=2,k=document.createElement('canvas');k.width=21*u;k.height=Hh*u;const g=k.getContext('2d');
    const px=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x*u,y*u,w*u,h*u)},ln=(x0,y0,x1,y1,c)=>{const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0))||1;for(let i=0;i<=n;i++)px(Math.round(x0+(x1-x0)*i/n),Math.round(y0+(y1-y0)*i/n),2,2,c)};
    const jm=pose==='jump';
    // cape: trails behind, wave per frame, billows up when jumping
    for(let x=1;x<=10;x++){const t=(10-x)/9,top=(crouch?7:11)+Math.round(t*(jm?-2:1)),bot=Math.min(Hh-1,Math.round((crouch?13:18)+(jm?-t*7:t*2)+Math.sin(f*1.57+t*4)*(1+t*1.6)));
     px(x,top,1,bot-top+1,C.coat);px(x,top,1,1,C.hi);px(x,bot-1,1,2,(x+f)%3?C.lin:C.linD);px(x,bot,1,1,C.ink)}
    const hair=(y0,m)=>{px(7+m,y0+1,3,2,C.ink);px(10,y0,6,1,C.ink);px(9,y0+1,8,1,C.ink);px(9,y0+2,2,1,C.ink);px(16,y0+2,2,1,C.ink);px(13,y0+2,1,1,C.ink);px(14,y0+1,1,1,C.hi)};
    const face=y0=>{const h=crouch?5:7;px(10,y0,7,h,C.skin);px(10,y0+h-3,1,3,C.sh);px(16,y0+h-3,1,3,C.sh);
     px(8,y0+1,1,2,C.skin);px(7,y0,1,2,C.skin);px(17,y0+1,1,2,C.skin);px(18,y0,1,2,C.skin);
     px(11,y0,2,1,C.ink);px(14,y0,2,1,C.ink);px(11,y0+1,2,2,C.eye);px(14,y0+1,2,2,C.eye);px(12,y0+2,1,1,C.linD);px(14,y0+2,1,1,C.linD);px(11,y0+1,1,1,C.fang);px(15,y0+1,1,1,C.fang);
     if(!crouch)px(13,y0+3,1,1,C.sh);px(12,y0+h-2,3,2,C.mouth);px(12,y0+h-2,1,2,C.fang);px(14,y0+h-2,1,2,C.fang)};
    const collar=y0=>{px(8,y0,2,1,C.ink);px(8,y0+1,3,2,C.ink);px(8,y0+3,4,1,C.ink);px(9,y0+1,1,2,C.lin);px(17,y0,2,1,C.ink);px(16,y0+1,3,2,C.ink);px(15,y0+3,4,1,C.ink);px(17,y0+1,1,2,C.lin)};
    if(!crouch){
     const A=[[[13,17],[18,15]],[[15,17],[14,17]],[[18,14],[11,17]],[[16,17],[13,17]]][f],LG=[[[15,21,16],[10,21,8]],[[13,21,13],[12,21,10]],[[10,21,8],[15,21,16]],[[12,21,10],[13,21,13]]][f];
     const arms=jm?[[19,10],[16,9]]:A,legs=jm?[[15,20,14],[10,20,9]]:LG;
     const leg=(L,hx)=>{const fy=jm?21:(L[2]!==undefined&&((f===1&&hx===12)||(f===3&&hx===12))?20:22);ln(hx,19,L[0],L[1],C.coat);ln(L[0],L[1],L[2],fy,C.coat);px(L[2]-1,fy,4,2,C.boot);px(L[2]-1,fy,3,1,C.lin);px(L[2]+2,fy+1,1,1,C.hi)};
     const arm=(sx,H,c)=>{ln(sx,12,H[0],H[1],c);px(H[0],H[1],2,2,C.skin);px(H[0]-1,H[1]-1,2,1,C.lin)};
     leg(legs[1],11);arm(11,arms[1],C.coatD);
     px(9,11,9,7,C.coat);px(9,11,1,7,C.hi);px(11,11,1,7,C.lin);px(15,11,1,7,C.lin);px(12,11,3,3,C.shirt);px(13,14,1,1,C.shirt);px(9,17,9,1,C.ink);px(13,17,1,1,C.gold);px(9,18,8,2,C.coat);px(9,19,8,1,C.lin);
     leg(legs[0],12);hair(0,[0,-1,0,1][f]);face(3);px(12,10,3,1,C.skin);collar(8);px(12,11,3,2,C.shirt);px(13,12,1,1,C.lin);arm(15,arms[0],C.coat)
    }else{
     hair(0,[0,-1,0,1][f]);face(2);px(12,7,3,1,C.skin);
     px(9,8,9,4,C.coat);px(9,8,1,4,C.hi);px(11,8,1,4,C.lin);px(12,8,3,2,C.shirt);px(13,10,1,1,C.lin);collar(6);
     ln(11,9,14,12,C.coatD);ln(12,11,16,12,C.coat);ln(16,12,15,13,C.coat);px(13,13,4,2,C.boot);px(13,13,3,1,C.lin);ln(11,11,9,13,C.coatD);px(8,13,4,2,C.boot);px(8,13,3,1,C.lin);
     ln(15,9,19,11,C.coat);px(19,11,2,2,C.skin);px(18,10,2,1,C.lin)}
    return k};
   const fr=[0,1,2,3].map(f=>vspr('run',f)),jumpS=vspr('jump',0),crS=vspr('crouch',0);
   const D={grave:[30,40],log:[46,22],pumpkins:[50,44],spider:[28,18],bat:[34,20],web:[56,GY-38],branch:[54,GY-37]},HANG={web:1,branch:1},stars=[...Array(36)].map(()=>[rnd(0,W),rnd(0,150),rnd(0,6)]);
   const sky=c.createLinearGradient(0,0,0,GY);sky.addColorStop(0,'#10062a');sky.addColorStop(1,'#4a1d5a');
   let px=60,py=GY-48,vy=0,air=false,buf=0,crouch=false,dist=0,t=0,anim=0,off=0,speed=5,obs=[],gap=620,dead=false,last=performance.now(),raf,dust=[],lastS=0;
   const jump=()=>{if(dead)return;if(!air&&!(crouch&&false)){vy=-11.2;air=true;Sound.play('jump')}else buf=8};
   const setC=v=>{crouch=v;$('#bc').classList.toggle('on',v)};
   const kd=e=>{if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){e.preventDefault();if(!e.repeat){jump();jOn()}}else if(e.code==='ArrowDown'||e.code==='KeyS'){e.preventDefault();setC(true)}};
   const ku=e=>{if(e.code==='ArrowDown'||e.code==='KeyS')setC(false);else if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')jOff()},bl=()=>setC(false);
   addEventListener('keydown',kd);addEventListener('keyup',ku);addEventListener('blur',bl);
   const bj=$('#bj'),bc=$('#bc');let jt;const jOn=ms=>{bj.classList.add('on');clearTimeout(jt);if(ms)jt=setTimeout(()=>bj.classList.remove('on'),ms)},jOff=()=>{clearTimeout(jt);jt=setTimeout(()=>bj.classList.remove('on'),120)};
   cv.onpointerdown=()=>{jump();jOn(150)};bj.onpointerdown=e=>{e.preventDefault();jump();jOn()};['onpointerup','onpointercancel','onpointerleave'].forEach(k=>bj[k]=jOff);
   bc.onpointerdown=e=>{e.preventDefault();setC(true);try{bc.setPointerCapture(e.pointerId)}catch(_){}};['onpointerup','onpointercancel','onlostpointercapture'].forEach(k=>bc[k]=()=>setC(false));bc.oncontextmenu=bj.oncontextmenu=e=>e.preventDefault();
   const GR=['grave','log'],CR=[];
   const trans=(a,b)=>HANG[a]||a==='bat'?(HANG[b]||b==='bat'?speed*14+100:speed*12+90):speed*28+70;
   const place=(type,x)=>{const[w,h]=D[type],o={type,x,w,h,y:HANG[type]?0:GY-h,v:type==='spider'?1.5:0};if(type==='bat')o.y=o.by=GY-54;obs.push(o);return w};
   const spawn=()=>{const gs=['grave','log'];if(t>8)gs.push('pumpkins');if(t>20)gs.push('spider');const cs=[];if(t>10)cs.push('web','branch');if(t>18)cs.push('bat');
    const pick=a=>a[Math.floor(Math.random()*a.length)];let seq;const pr=t>45?.5:t>20?.3:0;
    if(Math.random()<pr&&cs.length){const pats=[['grave','bat','pumpkins'],['log','web'],['web','grave'],['bat','log'],['grave','branch','log']];if(t>40)pats.push(['log','web','pumpkins','bat']);seq=pick(pats).map(x=>x==='spider'?'grave':x)}
    else seq=[Math.random()<(cs.length?.35:0)?pick(cs):pick(gs)];
    let x=W+10,len=0;seq.forEach((ty,i)=>{const w=place(ty,x);let d=w+(i<seq.length-1?trans(ty,seq[i+1]):0);x+=d;len+=d});gap=len+speed*34+rnd(150,420-Math.min(180,t*3))};
   const layer=(sp,g,fn)=>{const b=Math.floor(off*sp/g);for(let j=-1;j<=W/g+1;j++)fn(j*g-(off*sp)%g,b+j)};
   const rc=(x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(x),Math.round(y),w,h)};
   const die=()=>{dead=true;Sound.play('over');A.classList.add('shake');api.title='🧛 GAME OVER';api.extra=`คุณชนสิ่งกีดขวาง! · 🏃 ระยะทาง ${Math.floor(dist/40)} m`;setTimeout(api.end,900)};
   const hbP=()=>crouch&&!air?{x:px+10,y:GY-25,w:22,h:24}:{x:px+12,y:py+4,w:20,h:42};
   const hbO=o=>HANG[o.type]?{x:o.x+6,y:0,w:o.w-12,h:o.h}:o.type==='bat'?{x:o.x+4,y:o.y+4,w:o.w-8,h:o.h-7}:{x:o.x+4,y:o.y+4,w:o.w-8,h:o.h-6};
   const update=dt=>{t+=dt/60;speed=Math.min(12,5+t*.05);dist+=speed*dt;off+=speed*dt;anim+=dt*speed/36;
    if(air){vy+=.75*dt*(crouch?1.8:1);py+=vy*dt;if(py>=GY-48){py=GY-48;vy=0;air=false;if(buf>0){buf=0;jump()}}}buf=Math.max(0,buf-dt);
    if(!air&&!crouch&&Math.random()<.15*dt)dust.push({x:px+6,y:GY-3,l:1});dust.forEach(d=>{d.x-=speed*dt;d.l-=.05*dt});dust=dust.filter(d=>d.l>0);
    gap-=speed*dt;if(gap<=0)spawn();
    obs.forEach(o=>{o.x-=(speed+o.v)*dt;if(o.type==='bat')o.y=o.by+Math.sin(t*6+o.x/50)*3});obs=obs.filter(o=>o.x>-80);
    const a=hbP();for(const o of obs){const b=hbO(o);if(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y){die();break}}
    score=Math.floor(dist/10);if(score!==lastS){lastS=score;$('#sc').textContent=score;api.timer('🏃 '+Math.floor(dist/40)+' m');if(score%100===0)Sound.play('ok')}};
   const drawObs=o=>{const{x,y,w,h}=o;switch(o.type){
    case'grave':rc(x,y+8,w,h-8,'#7b7f99');rc(x+4,y,w-8,8,'#7b7f99');rc(x+13,y+12,4,16,'#c3c8e0');rc(x+8,y+17,14,4,'#c3c8e0');rc(x,y+h-4,w,4,'#3d6b4a');break;
    case'log':rc(x,y,w,h,'#7a4a25');rc(x,y+6,w,3,'#5a3418');rc(x,y+14,w,3,'#5a3418');rc(x+w-6,y+2,6,h-4,'#d9a066');break;
    case'pumpkins':for(const[i,j,s]of[[0,20,24],[26,20,24],[13,0,24]]){rc(x+i,y+j,s,s,'#ff8a2b');rc(x+i+8,y+j,8,s,'#ffb15e');rc(x+i+10,y+j-4,4,5,'#3fa34d');rc(x+i+5,y+j+8,4,4,'#2b1200');rc(x+i+15,y+j+8,4,4,'#2b1200')}break;
    case'spider':c.strokeStyle='#1a1030';c.lineWidth=2;c.beginPath();for(const d of[-1,1])for(const k of[0,5,10]){c.moveTo(x+14,y+10);c.lineTo(x+14+d*(10+k/2),y+2+k*.8)}c.stroke();rc(x+7,y+3,14,11,'#1a1030');rc(x+10,y+6,3,3,'#ff3d6e');rc(x+16,y+6,3,3,'#ff3d6e');break;
    case'web':{c.strokeStyle='#d9d4ea';c.lineWidth=1;c.beginPath();for(let k=-3;k<=3;k++){c.moveTo(x+28,0);c.lineTo(x+28+k*9,h-14)}for(let r=1;r<=4;r++){c.moveTo(x+28-r*7,r*(h-14)/4);c.lineTo(x+28+r*7,r*(h-14)/4)}c.stroke();
     rc(x+27,h-30,2,16,'#d9d4ea');rc(x+21,h-16,14,10,'#14081f');rc(x+24,h-13,3,3,'#ff3d6e');rc(x+30,h-13,3,3,'#ff3d6e');rc(x+17,h-12,4,2,'#14081f');rc(x+35,h-12,4,2,'#14081f');break}
    case'branch':rc(x+w/2-5,0,10,h-22,'#4b2f1a');rc(x,h-24,w,16,'#6b4423');rc(x+4,h-8,w-8,6,'#4b2f1a');rc(x+6,h-30,10,8,'#3f7a3a');rc(x+34,h-30,12,8,'#3f7a3a');rc(x+14,h-4,8,4,'#3f7a3a');rc(x+34,h-4,8,4,'#3f7a3a');break;
    case'bat':{const f=Math.floor(t*10)%2;rc(x+13,y+6,8,10,'#2a1650');rc(x+13,y+2,2,4,'#2a1650');rc(x+19,y+2,2,4,'#2a1650');rc(x+15,y+8,2,2,'#ff3d6e');rc(x+19,y+8,2,2,'#ff3d6e');
     rc(x,y+(f?0:8),13,8,'#6d3fe0');rc(x+21,y+(f?0:8),13,8,'#6d3fe0');rc(x+4,y+(f?6:10),9,6,'#2a1650');rc(x+21,y+(f?6:10),9,6,'#2a1650')}}};
   const draw=()=>{c.fillStyle=sky;c.fillRect(0,0,W,H);stars.forEach(([x,y,p])=>{if(Math.sin(t*3+p)>-.5)rc((x-off*.02+W*5)%W,y,2,2,'#f6f2ff')});
    c.fillStyle='#fff6d6';c.beginPath();c.arc(540,55,24,0,7);c.fill();rc(530,48,6,6,'#e8d9a8');rc(546,62,8,8,'#e8d9a8');
    for(let i=0;i<3;i++){const bx=W-((off*.25+i*260)%(W+60)),by=40+i*28+Math.sin(t*3+i)*8,f=Math.floor(t*8+i)%2;rc(bx,by+f*3,6,2,'#14081f');rc(bx+6,by,4,4,'#14081f');rc(bx+10,by+f*3,6,2,'#14081f')}
    layer(.15,80,(x,k)=>{const h=40+(((k*7)%4)+4)%4*14;c.fillStyle='#2a1650';c.beginPath();c.moveTo(x,GY);c.lineTo(x+40,GY-h-30);c.lineTo(x+80,GY);c.fill()});
    layer(.4,130,(x,k)=>{const m=((k%3)+3)%3;if(m===0){rc(x,GY-34,24,34,'#3a2466');rc(x+3,GY-38,18,6,'#3a2466')}else if(m===1){rc(x+8,GY-20,6,20,'#f6f2ff');rc(x+9,GY-27+Math.floor(Math.sin(t*14+k)*1.5),4,6,'#ffd34a')}});
    for(let i=0;i<4;i++)rc(((i*210-off*.1-t*14)%(W+200)+W+200)%(W+200)-100,GY-26+i%2*6,170,9,'rgba(200,180,255,.09)');
    rc(0,GY,W,H-GY,'#1d0f3a');rc(0,GY,W,4,'#6d3fe0');layer(1,46,(x,k)=>rc(x,GY+16+(((k%3)+3)%3)*14,20,3,'#2f1a5a'));
    dust.forEach(d=>rc(d.x,d.y-(1-d.l)*8,4,4,`rgba(200,180,255,${d.l*.6})`));
    obs.forEach(drawObs);const cr=crouch&&!air;rc(px+6,GY-3,32,4,'rgba(0,0,0,.35)');
    c.drawImage(air?jumpS:cr?crS:fr[Math.max(0,Math.floor(anim))%4],Math.round(px),Math.round(cr?GY-30:py));if(dead)rc(0,0,W,H,'rgba(225,29,72,.3)')};
   const loop=now=>{const dt=Math.max(0,Math.min(2.5,(now-last)/16.667));last=now;if(!dead)update(dt);draw();raf=requestAnimationFrame(loop)};raf=requestAnimationFrame(loop);
   if(import.meta.env.DEV&&window.__KDS_QA)window.__run={spr:[...fr,jumpS,crS],get obs(){return obs},get st(){return{dead,crouch,air,dist,speed,score}},jump,setC,hbP,hbO,force(ty){obs=[];place(ty,px+200)},tick(n){for(let i=0;i<n;i++)if(!dead)update(1)}};
   return()=>{dead=true;clearTimeout(jt);cancelAnimationFrame(raf);removeEventListener('keydown',kd);removeEventListener('keyup',ku);removeEventListener('blur',bl);A.style.height='';A.style.touchAction=''}}},
 hunt:{name:'Ghost Hunt',em:'👻',tag:'CATCH THE GHOSTS.',desc:'เจ้าผีน้อยเป็นเพื่อนกับแมงมุุมและฟักทอง แต่เจ้าหัวกระโหลกดูเหมือนจะไม่ใช่?!',
  intro:'👻 +10 · 🎃 +30 · 🕷️ +15<br>💀 อย่ากด! (−20)',hint:'กด: 👻 +10 · 🎃 +30 · 🕷️ +15   |   ห้ามกด: 💀 −20',
  start(api){const T=30,A=api.arena,types=[{e:'👻',v:10,w:45},{e:'🎃',v:30,w:18},{e:'🕷️',v:15,w:15},{e:'💀',v:-20,w:22}];let left=T,sp,tk,dead=false;
   const pick=()=>{let r=rnd(0,100);for(const t of types){if((r-=t.w)<0)return t}return types[0]};
   const spawn=()=>{if(dead)return;const el_=T-left,t=pick(),b=el('button','obj'+(t.v<0?' bad':' good'),t.e);b.style.left=rnd(3,80)+'%';b.style.top=rnd(3,78)+'%';A.append(b);
    b.onpointerdown=e=>{e.preventDefault();b.remove();api.add(t.v,b.style.left,b.style.top);Sound.play(t.v>0?'ok':'bad')};setTimeout(()=>b.remove(),Math.max(650,1600-el_*30));
    sp=setTimeout(spawn,Math.max(260,820-el_*20))};
   tk=setInterval(()=>{left=Math.max(0,+(left-.1).toFixed(1));api.timer(`⏱️ ${Math.ceil(left)}`,left<=5);if(left<=0){dead=true;stop();api.end()}},100);spawn();
   function stop(){clearTimeout(sp);clearInterval(tk)}return()=>{dead=true;stop()}}},
 memory:{name:'Memory Match',em:'🃏',tag:'FIND THE PAIRS.',desc:'จับคู่ไพ่ที่เหมือนกันภายใน 30 วินาที สะสมคอมโบต่อเนื่องเพื่อเป็นหัวแถวได้แล้ววันนี้ สู้เขานะไอต้าว~!',
  intro:'🃏 แต่ละ STAGE มี 30 วินาที<br>จับคู่ให้ครบเพื่อไปด่านต่อไป!',hint:'จับคู่ +100 · ต่อเนื่อง Combo +25 · เปิดผิด −15 · คะแนนสะสมข้ามด่าน',
  start(api){const A=api.arena,EM=['👻','🎃','🧙‍♀️','🧛','🕷️','🦇','💀','🔮','🕸️','🧟','🍬','🌙','🪦','🕯️','🦉','🍭'];
   let stage=0,stageStart=0,pairs=0,open=[],lock=false,pause=false,matched=0,combo=0,moves=0,left=30,done=false,t1;
   A.style.height='auto';A.style.minHeight='min(62vh,520px)';
   const bar=el('div','mi','<span class="mst"></span><span class="mt2"></span><span class="mco"></span>'),g=el('div','mg');A.append(bar,g);const q=x=>bar.querySelector(x);
   const upd=()=>{const m=q('.mt2');m.textContent='⏱ '+Math.ceil(left);m.classList.toggle('warn',left<=5);q('.mco').textContent=combo>1?'COMBO x'+combo:'';api.timer('STAGE '+stage,left<=5)};
   const ov=h=>{const o=el('div','cd',`<small style="font-size:30px;line-height:1.5">${h}</small>`);A.append(o);return o};
   const clearStage=()=>{lock=pause=true;const earned=score-stageStart,b=Math.round(left*3);if(b)api.add(b,'45%','20%');Sound.play('jackpot');
    const ps=[...Array(12)].map((_,i)=>`<u style="--x:${Math.round(Math.cos(i*.52)*150)}px;--y:${Math.round(Math.sin(i*.52)*110)}px;animation-delay:${i*.04}s">${['✨','⭐','🎃','👻'][i%4]}</u>`).join('');
    const o=el('div','cd',`<div class="clr">${ps}<div class="ct">✨ STAGE CLEAR! ✨</div><div class="cs">ผ่านด่านแล้ว!</div><div class="cn2">STAGE ${stage}</div><div class="crow"><span>คะแนนด่านนี้</span><b>+${earned}</b></div><div class="crow"><span>Clear Bonus</span><b>+${b}</b></div><div class="crow tot"><span>คะแนนรวม</span><b>${score.toLocaleString()}</b></div><div class="cgo">กำลังเข้าสู่ STAGE ${stage+1}...<div class="bar"><i></i></div></div></div>`);
    o.style.animation='none';A.append(o);t1=setTimeout(()=>{o.remove();next()},1800)};
   const next=()=>{stage++;stageStart=score;pairs=Math.min(stage+2,16);matched=0;combo=0;left=30;open=[];lock=pause=false;g.innerHTML='';q('.mst').textContent='STAGE '+stage;
    const n=pairs*2,cols=n<=6?3:n<=8?4:n===10||n===14?5:n<=16?4:n<=20?5:6;g.classList.toggle('dense',n>=20);g.style.gridTemplateColumns=`repeat(${cols},1fr)`;g.style.maxWidth=cols*104+'px';
    const set=EM.slice().sort(()=>Math.random()-.5).slice(0,pairs);[...set,...set].sort(()=>Math.random()-.5).forEach(e=>{const c=el('div','mc','<div class="a">🃏</div><div class="b">'+e+'</div>');c.e=e;g.append(c);
     c.onpointerdown=()=>{if(lock||done||c.classList.contains('f'))return;c.classList.add('f');Sound.play('click');open.push(c);if(open.length<2)return;moves++;const[a,b]=open;open=[];
      if(a.e===b.e){combo++;matched++;a.classList.add('ok');b.classList.add('ok');api.add(100+25*(combo-1),'45%','30%');if(combo>1)api.pop('🔥 COMBO x'+combo,'g','28%','14%');Sound.play('ok');upd();if(matched===pairs)clearStage()}
      else{combo=0;lock=true;a.classList.add('bad');b.classList.add('bad');api.add(Math.max(-score,-15),'45%','30%');Sound.play('bad');upd();
       t1=setTimeout(()=>{a.classList.remove('f','bad');b.classList.remove('f','bad');lock=false},400)}}});upd()};
   const tk=setInterval(()=>{if(done||pause)return;left=Math.max(0,+(left-.1).toFixed(1));upd();
    if(left<=0){done=true;clearInterval(tk);Sound.play('over');api.title='💀 GAME OVER';api.extra=`ถึง STAGE ${stage} · 🎯 ${moves} ครั้ง`;ov(`💀 Game Over<br>STAGE ${stage} · 🏆 ${score}`);t1=setTimeout(api.end,1600)}},100);
   next();return()=>{done=true;clearInterval(tk);clearTimeout(t1);A.style.height='';A.style.minHeight=''}}}
};

/* ---------- Theme system (separate from game state) ---------- */
const PROJECT_NAME='Halloween Mini Games — KDS';document.title=PROJECT_NAME;
const clone=o=>JSON.parse(JSON.stringify(o));
const FD={spooky:['Spooky',"'Creepster','Itim',cursive"],pixel:['Pixel',"'Pixelify Sans','Itim',monospace"],arcade:['Arcade',"'Bungee','Kanit',sans-serif"],rounded:['Rounded',"'Itim','Mali',sans-serif"],modern:['Modern / Clean',"'Prompt','Noto Sans Thai',sans-serif"]};
const FB={itim:['Itim',"'Itim','Noto Sans Thai',sans-serif"],mali:['Mali',"'Mali','Noto Sans Thai',sans-serif"],prompt:['Prompt',"'Prompt','Noto Sans Thai',sans-serif"],noto:['Noto Sans Thai',"'Noto Sans Thai',system-ui,sans-serif"]};
const BGS={halloween:'Halloween Gradient',night:'Night Sky',gradient:'Gradient',solid:'Solid',cemetery:'Cemetery',abstract:'Abstract Halloween'};
const DEC={moon:'🌙 Moon',stars:'✨ Stars',fog:'🌫️ Fog',bats:'🦇 Bats',pumpkins:'🎃 Pumpkins',web:'🕸️ Spider Web'};
const LBS={podium:'🥇 Podium',arcade:'🎮 Arcade',cards:'🎃 Halloween Cards',goth:'👻 Gothic',minimal:'✨ Minimal'};
const CK={bg:'Background',pri:'Primary',sec:'Secondary',acc:'Accent',txt:'Text',card:'Card',bd:'Border'};
const PRE={
 classic:{em:'🎃',name:'Classic Halloween',c:{bg:'#140a24',pri:'#ff8a2b',sec:'#9d6bff',acc:'#b6ff3b',txt:'#f6f2ff',card:'#231240',bd:'#4a2a7a'},bg:'halloween',fd:'rounded',fb:'itim',lb:'podium',deco:{moon:1,stars:0,fog:1,bats:1,pumpkins:1,web:0}},
 vampire:{em:'🩸',name:'Vampire Night',c:{bg:'#12040a',pri:'#e11d48',sec:'#8a1c3c',acc:'#ff8fa8',txt:'#fbeff2',card:'#2a0b14',bd:'#6b1a2c'},bg:'night',fd:'spooky',fb:'itim',lb:'goth',deco:{moon:1,stars:1,fog:1,bats:1,pumpkins:0,web:1}},
 ghost:{em:'👻',name:'Haunted Ghost',c:{bg:'#0d1b2e',pri:'#8ecbff',sec:'#5b7fa8',acc:'#e8f4ff',txt:'#eef4fa',card:'#16304a',bd:'#3d6a94'},bg:'cemetery',fd:'modern',fb:'prompt',lb:'podium',deco:{moon:1,stars:0,fog:1,bats:0,pumpkins:0,web:0}},
 midnight:{em:'🌙',name:'Midnight',c:{bg:'#0b1030',pri:'#c0c8e6',sec:'#7c5cff',acc:'#ffe9a0',txt:'#f2f4ff',card:'#161d4a',bd:'#3a4590'},bg:'night',fd:'modern',fb:'prompt',lb:'minimal',deco:{moon:1,stars:1,fog:0,bats:0,pumpkins:0,web:0}},
 witch:{em:'🧙',name:'Witch Magic',c:{bg:'#12072a',pri:'#d946ef',sec:'#7c3aed',acc:'#4ade80',txt:'#f7f0ff',card:'#26104a',bd:'#5b2d9a'},bg:'abstract',fd:'arcade',fb:'mali',lb:'arcade',deco:{moon:0,stars:1,fog:1,bats:1,pumpkins:0,web:0}}};
const DEF={preset:'classic',...clone(PRE.classic)};
const h2r=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),r2h=a=>'#'+a.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,p)=>{const x=h2r(a),y=h2r(b);return r2h(x.map((v,i)=>v*(1-p)+y[i]*p))};
const lum=h=>{const[r,g,b]=h2r(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*b};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)},hexA=(h,a)=>{const[r,g,b]=h2r(h);return`rgba(${r},${g},${b},${a})`},onC=h=>lum(h)>.4?'#1a0a00':'#ffffff';
function bgCss(t){const c=t.c;switch(t.bg){
 case'solid':return c.bg;
 case'gradient':return`linear-gradient(160deg,${c.bg},${mix(c.bg,c.sec,.4)})`;
 case'night':return`linear-gradient(180deg,${mix(c.bg,'#000000',.3)},${c.bg} 55%,${mix(c.bg,c.sec,.35)})`;
 case'cemetery':return`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='120'%3E%3Cg fill='%2308020f' fill-opacity='.85'%3E%3Cpath d='M0 120V90l30-60 30 60v30zM100 120V70h30v50zM150 70a15 15 0 0 1 30 0v50h-30zM240 120l35-80 35 80zM360 120V80h40v40zM420 85a20 20 0 0 1 40 0v35h-40zM520 120l30-70 30 70z'/%3E%3C/g%3E%3C/svg%3E") bottom/600px 120px repeat-x,linear-gradient(180deg,${mix(c.bg,'#000000',.25)},${c.bg} 60%,${mix(c.bg,c.sec,.3)})`;
 case'abstract':return`radial-gradient(circle at 15% 20%,${hexA(c.pri,.28)},transparent 45%),radial-gradient(circle at 85% 30%,${hexA(c.sec,.4)},transparent 50%),radial-gradient(circle at 50% 100%,${hexA(c.acc,.2)},transparent 50%),${c.bg}`;
 default:return`radial-gradient(ellipse at 80% 0,${mix(c.bg,c.sec,.45)},transparent 55%),radial-gradient(ellipse at 0 100%,${mix(c.bg,c.pri,.3)},transparent 50%),${c.bg}`}}
function buildDeco(t){const b=$('#bg'),d=t.deco;let h='';if(d.moon)h+='<div class="moon"></div>';
 if(d.stars)h+='<div class="stars">'+[...Array(40)].map((_,i)=>`<i style="left:${(i*37.7)%100}%;top:${(i*53.3)%70}%;animation-delay:${(i%7)*.4}s"></i>`).join('')+'</div>';
 if(d.fog)h+='<div class="fog"></div>';
 if(d.web){const w='<svg class="web %s" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1" style="color:var(--ghost)"><path d="M0 0L100 100M0 0L100 55M0 0L55 100M0 0L100 20M0 0L20 100M0 24Q24 24 24 0M0 50Q50 50 50 0M0 76Q76 76 76 0"/></svg>';h+=w.replace('%s','l')+w.replace('%s','r')}
 b.innerHTML=h;const em=[];if(d.bats)em.push('🦇','🦇','🕸️');if(d.pumpkins)em.push('🎃','👻','🎃');
 em.forEach((e,i)=>{const f=el('span','fl',e);f.style.left=(i*17+8)%92+'%';f.style.fontSize=rnd(24,42)+'px';f.style.animationDuration=rnd(16,28)+'s';f.style.animationDelay=-rnd(0,20)+'s';b.append(f)})}
const TM={KEY:'kds_theme_v1',saved:null,cur:null,
 norm(t){t=t||{};const d=clone(DEF),ok=h=>/^#[0-9a-f]{6}$/i.test(h),c={};for(const k in d.c)c[k]=ok((t.c||{})[k])?t.c[k]:d.c[k];
  return{preset:t.preset||'custom',c,bg:BGS[t.bg]?t.bg:d.bg,fd:FD[t.fd]?t.fd:d.fd,fb:FB[t.fb]?t.fb:d.fb,lb:LBS[t.lb]?t.lb:d.lb,deco:{...d.deco,...(t.deco||{})}}},
 getTheme(){return this.cur},
 applyTheme(t){const c=t.c,R=document.documentElement.style;let txt=c.txt;if(cr(txt,c.bg)<3)txt=lum(c.bg)>.5?'#111111':'#ffffff';
  const v={'--bg':c.bg,'--bg2':mix(c.bg,'#000000',.35),'--card':c.card,'--card2':mix(c.card,'#ffffff',.1),'--line':c.bd,'--pump':c.pri,'--pur':c.sec,'--neon':c.acc,'--ghost':txt,'--mut':mix(txt,c.bg,.3),'--crim':mix(c.pri,'#ff2d55',.5),'--on':onC(c.pri),'--onsec':onC(c.sec),'--onacc':onC(c.acc),'--fd':FD[t.fd][1],'--fb':FB[t.fb][1]};
  for(const k in v)R.setProperty(k,v[k]);document.body.style.background=bgCss(t);document.body.style.backgroundAttachment='fixed';buildDeco(t);this.cur=t},
 setTheme(t){this.applyTheme(this.norm(t))},
 async saveTheme(t){const n=this.norm(t);this.saved=n;try{localStorage.setItem(this.KEY,JSON.stringify(n))}catch(e){}return Cloud.pushTheme(n)},
 async resetTheme(){this.saved=this.norm(DEF);try{localStorage.removeItem(this.KEY)}catch(e){}const r=await Cloud.deleteTheme();this.applyTheme(this.saved);return r},
 remote(t){this.saved=this.norm(t);try{localStorage.setItem(this.KEY,JSON.stringify(this.saved))}catch(e){}if(!Studio.on){this.applyTheme(this.saved);LB.refresh()}},
 init(){let t;try{t=JSON.parse(localStorage.getItem(this.KEY))}catch(e){}this.saved=this.norm(t||DEF);this.applyTheme(this.saved)}};

/* ---------- Sync status (data layer lives in src/lib/repo.js; Supabase is the source of truth) ---------- */
const SY={conn:'☁️ Connecting...',ok:'☁️ Synced',saving:'☁️ Saving...',local:'💾 Local only',unconfigured:'💾 Local only (Supabase not configured)',off:'⚠️ Unable to sync'};let syncState='local';
function setSync(k){syncState=k;['#sync','#sync2'].forEach(q=>{const e=$(q);if(e)e.textContent=SY[k]})}
const Cloud=Repo;Cloud.onStatus=setSync;
addEventListener('online',()=>Cloud.refreshAll());document.addEventListener('visibilitychange',()=>{if(!document.hidden)Cloud.refreshAll()});
setInterval(()=>{if(!document.hidden&&$('#v-home').classList.contains('on'))Cloud.refreshAll()},30000);

/* ---------- Leaderboard renderer (games only send {game, player, score}) ---------- */
function boardRows(g){const rows=(Cloud.B[g]||[]).map((d,i)=>({id:d.playerId,name:d.name,score:d.score,rank:i+1,me:!!Cloud.id&&d.playerId===Cloud.id})),m=Cloud.ME[g];
 if(m&&!rows.some(r=>r.me))rows.push({id:Cloud.id,name:m.name,score:m.score,rank:m.rank,me:true});return rows}
const myBest=g=>{const r=boardRows(g).find(x=>x.me),l=Store.scores(g).find(x=>x.playerName===player);return Math.max(r?r.score:0,l?l.score:0)};
const nm=r=>esc(r.name||'?')+(r.me?'<b class="you">✨ YOU</b>':''),sc=r=>(r.score||0).toLocaleString(),RN=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
const LBR={
 podium(rows){const t=rows.slice(0,3),o=[1,0,2].filter(i=>t[i]);return`<div class="pods">${o.map(i=>`<div class="pd p${i+1}${t[i].me?' meC':''}">${i===0?'<div class="cw">👑</div>':''}<div class="pm">${medal(i)}</div><div class="pn">${nm(t[i])}</div><div class="ps">${sc(t[i])}</div><div class="pb">${i+1}</div></div>`).join('')}</div>`+
  (rows.length>3?'<ol class="rest">'+rows.slice(3).map((r,i)=>`<li class="${r.me?'meC':''}"><i>${i+4}</i><span>${nm(r)}</span><em>${sc(r)}</em></li>`).join('')+'</ol>':'')},
 arcade(rows){return`<div class="arc"><div class="at">★ HIGH SCORES ★</div>${rows.map((r,i)=>`<div class="al${r.me?' meC':''}"><span>${String(i+1).padStart(2,'0')}</span><span class="an">${nm(r)}</span><span class="ad"></span><span>${sc(r)}</span></div>`).join('')}</div>`},
 cards(rows){return`<div class="crds">${rows.map((r,i)=>`<div class="ck k${Math.min(i+1,4)}${r.me?' meC':''}"><div class="kr">${i<3?medal(i):i+1}</div><div class="kn">${nm(r)}</div><div class="ks">${sc(r)}</div>${i===0?'<div class="kc">👑</div>':''}</div>`).join('')}</div>`},
 goth(rows){return`<div class="gth"><div class="gt">❦ HALL OF SHADOWS ❦</div>${rows.map((r,i)=>`<div class="gl g${Math.min(i+1,4)}${r.me?' meC':''}"><span class="gr">${RN[i]||i+1}</span><span class="gn">${nm(r)}</span><span class="gs">${sc(r)}</span></div>`).join('')}</div>`},
 minimal(rows){const m=Math.max(1,rows[0]?rows[0].score:1);return`<div class="mn">${rows.map((r,i)=>`<div class="ml${r.me?' meC':''}"><span class="mr">${i+1}</span><span class="mm">${nm(r)}</span><span>${sc(r)}</span><i style="width:${Math.max(4,r.score/m*100)}%"></i></div>`).join('')}</div>`}};
const LB={game:'run',
 html(lim){lim=lim||10;const all=boardRows(this.game),rows=all.slice(0,lim),mi=all.findIndex(r=>r.me);let h=rows.length?LBR[TM.cur.lb](rows):(Cloud.mode==='cloud'?'<div class="empty">ยังไม่มีคะแนน — เป็นคนแรกเลย! 🎃</div>':'<div class="empty">ยังเชื่อมต่อกระดานคะแนนกลางไม่ได้<br>จะแสดงอีกครั้งเมื่อออนไลน์</div>');
  if(mi>=lim&&lim>=10)h+=`<div class="youbox"><b class="you">✨ YOU</b><span>#${all[mi].rank} ${esc(all[mi].name)}</span><em>${sc(all[mi])}</em></div>`;return h},
 drawSel(){const b=$('#gsel');b.innerHTML='';Object.entries(GAMES).forEach(([k,g])=>{const e=el('button',k===this.game?'on':'',g.em+' '+g.name.replace('Halloween ',''));e.onclick=()=>{this.game=k;this.drawSel();this.refresh()};b.append(e)})},
 refresh(){const b=$('#lb');if(b&&TM.cur)b.innerHTML=this.html(10);const p=$('#pv');if(p)p.innerHTML=this.html(3)}};

/* ---------- Theme Studio UI ---------- */
const sel=(k,map,cur)=>`<select data-a="sel" data-k="${k}">${Object.entries(map).map(([v,l])=>`<option value="${v}" ${v===cur?'selected':''}>${Array.isArray(l)?l[0]:l}</option>`).join('')}</select>`;
const Studio={on:false,draft:null,
 html(){const d=this.draft;return`<div class="sh"><b>🎨 My Theme</b><span class="chip sy" id="sync2">${SY[syncState]}</span><button class="chip" data-a="close">✕</button></div><div class="sb"><div class="warn" style="color:var(--mut)">Theme นี้มีผลกับคุณเท่านั้น ไม่กระทบผู้เล่นคนอื่น</div>
 <h4>Presets</h4><div class="prs">${Object.entries(PRE).map(([k,p])=>`<button class="pr ${d.preset===k?'on':''}" data-a="pre" data-k="${k}"><span>${p.em}</span><small>${p.name}</small></button>`).join('')}</div>
 <h4>Colors</h4><div class="cols">${Object.entries(CK).map(([k,l])=>`<label>${l}<input type="color" data-a="col" data-k="${k}" value="${d.c[k]}"></label>`).join('')}</div><div class="warn" id="cw"></div>
 <h4>Background</h4>${sel('bg',BGS,d.bg)}<div class="decs">${Object.entries(DEC).map(([k,l])=>`<label>${l}<input type="checkbox" data-a="dec" data-k="${k}" ${d.deco[k]?'checked':''}></label>`).join('')}</div>
 <h4>Font</h4>Display ${sel('fd',FD,d.fd)}Body ${sel('fb',FB,d.fb)}
 <h4>Leaderboard</h4>${sel('lb',LBS,d.lb)}
 <h4>Preview</h4><div class="prev"><div class="gc"><span class="em">🧛</span><b>Vampire Run</b><u>RUN. JUMP. CROUCH.</u><small>ตัวอย่างการ์ดเกม · ภาษาไทยอ่านง่าย</small></div><div class="row"><button class="btn">PLAY</button><button class="btn alt">SCORE 1,250</button></div><div id="pv"></div></div>
 <div id="note" class="warn"></div></div><div class="sf"><button class="chip" data-a="reset">Reset Theme</button><span style="flex:1"></span><button class="btn" data-a="save">💾 Save My Theme</button></div>`},
 open(){this.on=true;this.draft=clone(TM.saved);const p=$('#studio');p.hidden=false;this.render();requestAnimationFrame(()=>p.classList.add('on'))},
 render(){const p=$('#studio'),o=p.querySelector('.sb'),y=o?o.scrollTop:0;p.innerHTML=this.html();p.querySelector('.sb').scrollTop=y;this.warn();LB.refresh()},
 close(){this.on=false;this.draft=null;TM.applyTheme(TM.saved);const p=$('#studio');p.classList.remove('on');setTimeout(()=>{if(!this.on)p.hidden=true},300);LB.refresh()},
 warn(){const c=this.draft.c,a=Math.min(cr(c.txt,c.bg),cr(c.txt,c.card));$('#cw').textContent=a<4.5?`⚠️ สีตัวอักษรอ่านยาก (contrast ${a.toFixed(1)}:1)${a<3?' — ระบบปรับสีตัวอักษรให้อัตโนมัติ':''}`:''},
 change(){this.draft.preset='custom';TM.applyTheme(TM.norm(this.draft));this.warn();LB.refresh();document.querySelectorAll('.pr.on').forEach(e=>e.classList.remove('on'))},
 async act(a,k){const note=()=>$('#note');
  if(a==='close')this.close();
  else if(a==='pre'){this.draft=TM.norm({preset:k,...clone(PRE[k])});TM.applyTheme(this.draft);this.render()}
  else if(a==='save'||a==='reset2'){note().textContent='กำลังบันทึก...';const r=await(a==='save'?TM.saveTheme(this.draft):TM.resetTheme());
   if(a==='reset2'){this.draft=clone(TM.saved);TM.applyTheme(TM.saved);this.render()}
   $('#note').textContent=r==='ok'?'✅ บันทึก Theme ของคุณแล้ว (เก็บบน Supabase ผูกกับผู้เล่นนี้)':r==='local'?'💾 บันทึกในเครื่องนี้ (ยังไม่ได้เชื่อม Supabase)':'⚠️ ส่งขึ้น Supabase ไม่สำเร็จ — บันทึกในเครื่องนี้แล้ว'}
  else if(a==='reset')note().innerHTML='รีเซ็ต Theme ของคุณกลับเป็นค่าเริ่มต้นหรือไม่? (ชื่อและคะแนนไม่ถูกลบ) <button class="chip" data-a="rno">ยกเลิก</button> <button class="chip" data-a="reset2">รีเซ็ต</button>'
  else if(a==='rno')note().textContent=''}};
document.addEventListener('click',e=>{const t=e.target.closest('#studio [data-a]');if(t&&t.tagName!=='SELECT'&&t.tagName!=='INPUT')Studio.act(t.dataset.a,t.dataset.k,e)});
document.addEventListener('input',e=>{const t=e.target;if(!t.closest||!t.closest('#studio')||!Studio.draft)return;const a=t.dataset.a,k=t.dataset.k;
 if(a==='col'){Studio.draft.c[k]=t.value;Studio.change()}else if(a==='dec'){Studio.draft.deco[k]=t.checked?1:0;Studio.change()}else if(a==='sel'){Studio.draft[k]=t.value;Studio.change()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&Studio.on)Studio.close()});

/* ---------- UI / flow ---------- */
let player=Store.getName(),cur=null,stopFn=null,score=0,lbFilter='';
const show=id=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+id))};
const medal=i=>['🥇','🥈','🥉'][i]||i+1;
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function home(){show('home');$('#who').textContent='👤 '+player;
 $('#gl').innerHTML='';Object.entries(GAMES).forEach(([id,g])=>{const best=myBest(id);const c=el('button','gc',`<span class="em">${g.em}</span><b>${g.name}</b><u>${g.tag}</u><small>${g.desc}</small><i>${best?'⭐ Best: '+best.toLocaleString():'PLAY!'}</i>`);c.onclick=()=>{Sound.play('click');play(id)};$('#gl').append(c)});
 
 LB.drawSel();LB.refresh()}
function play(id){cur=id;score=0;const g=GAMES[id];show('game');$('#gt').textContent=g.em+' '+g.name;$('#sc').textContent=0;$('#tm').textContent='';$('#tm').classList.remove('warn');$('#hint').textContent=g.hint;
 const A=$('#arena');A.innerHTML='';A.onpointerdown=null;A.style.height='';A.style.minHeight='';A.style.touchAction='';let n=3;const cd=el('div','cd',`<div class="cn">3</div><small>${g.intro}</small>`);A.append(cd);Sound.play('tick');
 const iv=setInterval(()=>{n--;if(n>0){cd.firstChild.textContent=n;Sound.play('tick')}else{clearInterval(iv);cd.remove();begin(id)}},800);stopFn=()=>clearInterval(iv)}
function begin(id){let over=false;const A=$('#arena');
 const api={arena:A,timer:(t,w)=>{$('#tm').textContent=t;$('#tm').classList.toggle('warn',!!w)},
  pop(t,c,x,y){const p=el('div','pp '+c,t);p.style.left=x;p.style.top=y;A.append(p);setTimeout(()=>p.remove(),800)},
  add(v,x,y){score+=v;$('#sc').textContent=score;if(x!=null)this.pop((v>0?'+':'')+v,v>0?'g':'b',x,y)},
  end(){if(over)return;over=true;finish(id,api.extra,api.title)}};
 const s=GAMES[id].start(api);stopFn=()=>{over=true;s&&s()}}
function finish(id,ex,title){stopFn&&stopFn();const f=Math.max(0,score),prev=Store.scores(id).filter(s=>s.playerName===player)[0];Store.addScore(player,f,id);Sound.play('over');   // Store = personal UI cache only, never the leaderboard
 const best=b=>{$('#ox').textContent=(ex?ex+' · ':'')+'Best '+b.toLocaleString()};
 $('#oh').textContent=title||'GAME OVER';$('#os').textContent=f.toLocaleString();$('#orank').textContent='';best(Math.max(f,prev?prev.score:0));
 $('#ost').textContent='☁️ กำลังบันทึก...';setSync('saving');
 Cloud.submit(id,f,player).then(r=>{$('#ost').textContent=r.isHigh?'🏆 NEW HIGH SCORE!':'⭐ SCORE SAVED';best(r.best);setSync('ok');const m=Cloud.ME[id];if(m)$('#orank').textContent=`อันดับของคุณใน ${GAMES[id].name}: #${m.rank}`})
  .catch(e=>{const c=e&&e.code;$('#ost').textContent=c==='unconfigured'?'⚠️ ยังไม่ได้ตั้งค่า Supabase — คะแนนนี้ยังไม่ขึ้นกระดานกลาง':c==='42501'?'⚠️ ไม่มีสิทธิ์บันทึกคะแนน':c==='offline'||!c||c==='verify'?'⚠️ เชื่อมต่อ Supabase ไม่ได้ — เก็บคะแนนไว้และจะลองส่งใหม่เมื่อออนไลน์ (ยังไม่ขึ้นกระดานกลาง)':'⚠️ บันทึกคะแนนไม่สำเร็จ';setSync(c==='unconfigured'?'unconfigured':'off')});
 show('over')}
function exit(){stopFn&&stopFn();home()}

$('#go').onclick=()=>{const n=$('#ni').value.trim();if(!n){$('#ni').classList.add('shake');setTimeout(()=>$('#ni').classList.remove('shake'),400);return}player=n;Store.setName(n);Cloud.setName(n);Sound.play('ok');home()};
$('#ni').onkeydown=e=>{if(e.key==='Enter')$('#go').click()};
$('#who').onclick=()=>{stopFn&&stopFn();$('#ni').value=player;show('name')};
$('#snd').onclick=()=>Sound.toggle();
$('#back').onclick=exit;$('#other').onclick=home;$('#tolb').onclick=()=>{LB.game=cur;home();$('#lb').scrollIntoView({behavior:'smooth'})};
$('#again').onclick=()=>play(cur);

$('#thm').onclick=()=>Studio.open();
TM.init();Cloud.onTheme=t=>TM.remote(t);Cloud.onBoards=()=>{if(!player){const m=Object.values(Cloud.ME).find(x=>x&&x.name);if(m){player=m.name;Store.setName(m.name);if($('#v-name').classList.contains('on'))home()}}LB.refresh()};Cloud.init();
player?home():show('name');
if(import.meta.env.DEV&&window.__KDS_QA)window.__kds={finish:(id,sc)=>{score=sc;cur=id;finish(id,'',null)},Cloud,TM,LB,boardRows,home,get player(){return player},get sync(){return syncState}};
