/* Shared browser pose schema and planar measurement core. */
globalThis.VimoCore=(function motionCore(){
  const joints={left_knee_deg:[23,25,27],right_knee_deg:[24,26,28],left_hip_deg:[11,23,25],right_hip_deg:[12,24,26],left_elbow_deg:[11,13,15],right_elbow_deg:[12,14,16]};
  const keys=[...Object.keys(joints),"trunk_tilt_deg"];
  const headers=["frame","time_s","landmark","x","y","visibility"];
  const num=s=>{if(s.trim()===""||!Number.isFinite(Number(s)))throw Error("数值缺失或无效");return Number(s)};
  function parse(raw){
    const lines=raw.replace(/^\uFEFF/,"").trim().split(/\r?\n/), split=s=>s.split(",").map(t=>t.trim().replace(/^"([^"]*)"$/,"$1"));
    const head=split(lines.shift()||""); if(headers.some(k=>!head.includes(k))||new Set(head).size!==head.length)throw Error("CSV 必须包含 "+headers.join(", "));
    const frames=new Map();
    for(let i=0;i<lines.length;i++){
      if(!lines[i].trim())continue;
      try{
        const cols=split(lines[i]);if(cols.length!==head.length)throw Error("列数不匹配");
        const r=Object.fromEntries(head.map((k,j)=>[k,cols[j]])),f=num(r.frame),t=num(r.time_s),j=num(r.landmark),v=num(r.visibility);
        if(!Number.isSafeInteger(f)||f<0||t<0||!Number.isInteger(j)||j<0||j>32||v<0||v>1)throw Error("数据超出允许范围");
        const point=r.x===""&&r.y===""&&v===0?null:[num(r.x),num(r.y),v];
        if(!frames.has(f))frames.set(f,{frame:f,time_s:t,points:new Map()});
        const row=frames.get(f);if(row.time_s!==t||row.points.has(j))throw Error("重复关键点或时间戳不一致");
        row.points.set(j,point);
      }catch(e){throw Error("第 "+(i+2)+" 行："+e.message)}
    }
    const seq=[...frames.values()].sort((a,b)=>a.frame-b.frame);
    if(!seq.length)throw Error("没有有效帧");
    if(seq.some((r,i)=>i&&r.time_s<=seq[i-1].time_s))throw Error("帧时间必须严格递增");
    return seq;
  }
  function angle(a,b,c){if(!a||!b||!c)return null;const u=[a[0]-b[0],a[1]-b[1]],v=[c[0]-b[0],c[1]-b[1]],nu=Math.hypot(...u),nv=Math.hypot(...v);if(!nu||!nv)return null;return Math.acos(Math.max(-1,Math.min(1,u[0]/nu*(v[0]/nv)+u[1]/nu*(v[1]/nv))))*180/Math.PI}
  function analyze(seq,threshold){
    if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw Error("阈值必须在 0–1 之间");
    const rows=seq.map(r=>{
      const p=i=>{const a=r.points.get(i);return a&&a[2]>=threshold?a:null};
      const result={frame:r.frame,time_s:r.time_s};
      for(const [k,ids] of Object.entries(joints))result[k]=angle(...ids.map(p));
      const a=[11,12,23,24].map(p);result.trunk_tilt_deg=null;
      if(a.every(Boolean)){const dx=(a[0][0]+a[1][0]-a[2][0]-a[3][0])/2,dy=(a[0][1]+a[1][1]-a[2][1]-a[3][1])/2;if(Math.hypot(dx,dy))result.trunk_tilt_deg=Math.atan2(Math.abs(dx),-dy)*180/Math.PI}
      return result;
    });
    const metrics=Object.fromEntries(keys.map(k=>{const a=rows.map(r=>r[k]).filter(v=>v!==null).sort((a,b)=>a-b),n=a.length;return [k,{valid_frames:n,coverage:n/rows.length,minimum:n?a[0]:null,median:n?(a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2:null,maximum:n?a[n-1]:null}]}));
    return {rows,report:{schema_version:1,frame_count:rows.length,visibility_threshold:threshold,coordinate_system:"image plane, equal x/y units, y down",limitations:"2D projected geometry only; visibility is not calibrated uncertainty; no quality or injury diagnosis.",metrics}};
  }
  function demo(){let out=[headers.join(",")];for(let frame=0;frame<90;frame++){const p=frame*2*Math.PI/30,coords={11:[90,40],12:[110,40],13:[75,65],14:[125,65],15:[80,90],16:[120,90],23:[90,100],24:[110,100],25:[90+15*Math.sin(p),145],26:[110-15*Math.sin(p),145],27:[90+30*Math.sin(p+.8),185],28:[110-30*Math.sin(p+.8),185]};for(const [j,[x,y]] of Object.entries(coords))out.push([frame,frame/30,j,x,y,j==="27"&&frame>=40&&frame<50?.2:1].join(","))}return out.join("\n")}
  return {keys,parse,angle,analyze,demo};
})(); 
