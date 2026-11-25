/* Projected landmark visualization. All visible geometry derives from input.
   Stroke width and decorative joint rings are glyphs, not body measurements. */
globalThis.VimoPose=(function(){
 const bodyEdges=[[11,12],[11,23],[12,24],[23,24],[11,13],[13,15],[12,14],[14,16],[23,25],[25,27],[24,26],[26,28],[15,17],[15,19],[15,21],[17,19],[16,18],[16,20],[16,22],[18,20],[27,29],[29,31],[27,31],[28,30],[30,32],[28,32]];
 const faceEdges=[[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10]];
 const joints={left_knee_deg:[23,25,27],right_knee_deg:[24,26,28],left_hip_deg:[11,23,25],right_hip_deg:[12,24,26],left_elbow_deg:[11,13,15],right_elbow_deg:[12,14,16]};
 // One common viewport for the whole recording; no frame-by-frame scale changes.
 function bounds(frames){
   let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
   for(const frame of frames)for(const p of frame.points.values())if(p&&p[2]>0&&Number.isFinite(p[0])&&Number.isFinite(p[1])){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1])}
   return Number.isFinite(x0)?{x0,x1,y0,y1}:null;
 }
 function render(canvas,frame,extent,threshold,key){
   const w=canvas.width,h=canvas.height,ctx=canvas.getContext("2d");
   ctx.clearRect(0,0,w,h);
   const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,"#f7fbff");bg.addColorStop(1,"#e6f1f9");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
   const grad=ctx.createRadialGradient(w*.49,h*.44,20,w*.49,h*.44,w*.57);grad.addColorStop(0,"rgba(255,255,255,.95)");grad.addColorStop(1,"rgba(255,255,255,0)");ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
   ctx.strokeStyle="#b5cbdc";ctx.lineWidth=.7;ctx.globalAlpha=.42;
   for(let x=28;x<w;x+=28){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
   for(let y=28;y<h;y+=28){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
   ctx.globalAlpha=1;
   ctx.strokeStyle="#94b4ca";ctx.lineWidth=1;for(const [x,y,dx,dy] of [[17,17,1,1],[w-17,17,-1,1],[17,h-17,1,-1],[w-17,h-17,-1,-1]]){ctx.beginPath();ctx.moveTo(x+dx*13,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*13);ctx.stroke()}
   ctx.font="11px monospace";ctx.fillStyle="#6d8ca3";ctx.fillText("XY / IMAGE PLANE",27,37);
   ctx.textAlign="right";ctx.fillText(frame?"FRAME "+String(frame.frame).padStart(4,"0"):"NO DATA",w-27,37);ctx.textAlign="left";
   if(!frame||!extent){ctx.font="17px system-ui";ctx.fillStyle="#62829c";ctx.textAlign="center";ctx.fillText("导入骨骼数据，开始观察",w/2,h/2);ctx.textAlign="left";return}
   const spanX=Math.max(1,extent.x1-extent.x0),spanY=Math.max(1,extent.y1-extent.y0),s=Math.min((w-108)/spanX,(h-112)/spanY);
   const xy=p=>[w/2+(p[0]-(extent.x0+extent.x1)/2)*s,h/2+(p[1]-(extent.y0+extent.y1)/2)*s+4];
   const pts=new Map([...frame.points].filter(([,p])=>p&&p[2]>=threshold).map(([j,p])=>[j,xy(p)]));
   const selected=joints[key]||[],focus=new Set(selected);
   const edge=(a,b,color,width,alpha=1)=>{if(!pts.has(a)||!pts.has(b))return;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(...pts.get(a));ctx.lineTo(...pts.get(b));ctx.stroke();ctx.globalAlpha=1};
   if(!pts.size){ctx.fillStyle="#62829c";ctx.font="17px system-ui";ctx.textAlign="center";ctx.fillText("当前帧没有有效关键点",w/2,h/2);ctx.textAlign="left";return}
   // Torso panel uses only the measured shoulder/hip quadrilateral.
   if([11,12,24,23].every(j=>pts.has(j))){ctx.beginPath();[11,12,24,23].forEach((j,i)=>i?ctx.lineTo(...pts.get(j)):ctx.moveTo(...pts.get(j)));ctx.closePath();ctx.fillStyle="rgba(8,119,201,.065)";ctx.fill()}
   for(const [a,b] of bodyEdges){const major=a>=11&&b<=28;edge(a,b,major?"#c0daed":"#b4cbdd",major?11:3,major?.6:.6)}
   for(const [a,b] of bodyEdges){const right=[12,14,16,24,26,28,18,20,22,30,32].includes(a)&&[12,14,16,24,26,28,18,20,22,30,32].includes(b);edge(a,b,right?"#668da9":"#0877c9",a>=11&&b<=28?3.4:1.5,right?.9:1)}
   for(const [a,b] of faceEdges)edge(a,b,"#668da9",1.2,.85);
   for(const [j,p] of pts){const major=[11,12,13,14,15,16,23,24,25,26,27,28].includes(j);ctx.beginPath();ctx.arc(p[0],p[1],major?4.2:2.1,0,2*Math.PI);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle=major?"#0877c9":"#87abc3";ctx.lineWidth=major?1.7:.9;ctx.stroke()}
   if(selected.length===3&&selected.every(j=>pts.has(j))){
     const [a,b,c]=selected.map(j=>pts.get(j)),u=Math.atan2(a[1]-b[1],a[0]-b[0]),v=Math.atan2(c[1]-b[1],c[0]-b[0]),d=Math.atan2(Math.sin(v-u),Math.cos(v-u)),r=Math.min(36,Math.hypot(a[0]-b[0],a[1]-b[1])*.32,Math.hypot(c[0]-b[0],c[1]-b[1])*.32);
     edge(selected[0],selected[1],"#0877c9",5);edge(selected[1],selected[2],"#0877c9",5);
     if(r>2){ctx.beginPath();ctx.moveTo(...b);ctx.arc(b[0],b[1],r,u,u+d,d<0);ctx.closePath();ctx.fillStyle="rgba(8,119,201,.14)";ctx.fill();ctx.beginPath();ctx.arc(b[0],b[1],r,u,u+d,d<0);ctx.strokeStyle="#0877c9";ctx.lineWidth=2;ctx.stroke()}
     ctx.beginPath();ctx.arc(b[0],b[1],8,0,2*Math.PI);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#0877c9";ctx.lineWidth=2.6;ctx.stroke();ctx.beginPath();ctx.arc(b[0],b[1],3.2,0,2*Math.PI);ctx.fillStyle="#0877c9";ctx.fill();
   }else if(key==="trunk_tilt_deg"&&[11,12,23,24].every(j=>pts.has(j))){
     const a=pts.get(11),b=pts.get(12),c=pts.get(23),d=pts.get(24),top=[(a[0]+b[0])/2,(a[1]+b[1])/2],bottom=[(c[0]+d[0])/2,(c[1]+d[1])/2];ctx.strokeStyle="#0877c9";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(...bottom);ctx.lineTo(...top);ctx.stroke();ctx.setLineDash([5,5]);ctx.strokeStyle="#829eb1";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(...bottom);ctx.lineTo(bottom[0],bottom[1]-Math.hypot(top[0]-bottom[0],top[1]-bottom[1]));ctx.stroke();ctx.setLineDash([]);
   }
   ctx.fillStyle="#6d8ca3";ctx.font="11px monospace";ctx.fillText(pts.size+" / 33 LANDMARKS",27,h-26);ctx.textAlign="right";ctx.fillText("FIXED VIEW",w-27,h-26);ctx.textAlign="left";
 }
 // Stylized 3/4-view synthetic gait. Segment endpoints are generated by
 // articulated 2D rotations; not measured or a physiologically validated gait.
 function demo(){
   const lines=["frame,time_s,landmark,x,y,visibility"],rad=d=>d*Math.PI/180;
   const add=(p,L,a)=>[p[0]+L*Math.sin(rad(a)),p[1]+L*Math.cos(rad(a))];
   for(let f=0;f<90;f++){
     const t=2*Math.PI*f/30,bob=3*Math.sin(2*t),shift=5*Math.sin(t),P={};
     const hip=[170+shift,167+bob],shoulder=[188+shift,92+bob],head=[199+shift,57+bob];
     // Facial landmarks are present only in this explicitly synthetic sample.
     const headOffsets={0:[12,0],1:[4,-5],2:[7,-6],3:[10,-5],4:[-8,-5],5:[-5,-6],6:[-2,-5],7:[-14,0],8:[14,0],9:[0,10],10:[9,10]};
     for(const [j,[x,y]] of Object.entries(headOffsets))P[j]=[head[0]+x,head[1]+y];
     for(const side of [0,1]){
       const phase=t+side*Math.PI,sgn=side?1:-1,near=side===0;
       const H=[hip[0]+sgn*11,hip[1]+sgn*3],S=[shoulder[0]+sgn*19,shoulder[1]+sgn*4];
       const thigh=18+34*Math.sin(phase),shin=thigh-30-36*Math.max(0,-Math.sin(phase)),upper=-18-37*Math.sin(phase),fore=upper+72+12*Math.cos(phase);
       const K=add(H,68,thigh),A=add(K,65,shin),E=add(S,43,upper),W=add(E,40,fore);
       P[11+side]=S;P[13+side]=E;P[15+side]=W;P[23+side]=H;P[25+side]=K;P[27+side]=A;
       P[17+side]=add(W,9,fore-8);P[19+side]=add(W,12,fore+8);P[21+side]=add(W,7,fore+35);
       P[29+side]=[A[0]-9,A[1]+6];P[31+side]=[A[0]+22,A[1]+10];
     }
     for(const [j,p] of Object.entries(P))lines.push([f,f/30,j,p[0].toFixed(4),p[1].toFixed(4),j==="27"&&f>=40&&f<50?.2:1].join(","));
   }
   return lines.join("\n");
 }
 return {bounds,render,demo};
})();
