/* Reference comparison for matched 2D angle definitions and timestamps. */
globalThis.VimoValidation=(function validation(){
  function parse(raw){
    const lines=raw.replace(/^\uFEFF/,"").trim().split(/\r?\n/),h=(lines.shift()||"").split(",").map(v=>v.trim());
    if(new Set(h).size!==h.length||!h.includes("time_s")||!h.includes("angle_deg"))throw Error("需要 time_s,angle_deg 两列");
    const number=s=>{if(!s||!Number.isFinite(Number(s)))throw Error("无效数字");return Number(s)};
    const rows=lines.filter(s=>s.trim()).map((line,i)=>{const cells=line.split(",").map(s=>s.trim());if(cells.length!==h.length)throw Error("第 "+(i+2)+" 行列数错误");const t=number(cells[h.indexOf("time_s")]),v=cells[h.indexOf("angle_deg")];const a=v===""?null:number(v);if(t<0||(a!==null&&(a<0||a>180)))throw Error("时间或夹角超出范围");return {time_s:t,angle_deg:a}});
    if(!rows.length||rows.some((r,i)=>i&&r.time_s<=rows[i-1].time_s))throw Error("时间必须严格递增且数据非空");
    return rows
  }
  function compare(pred,ref,offset=0,maxGap=.05){
    if(!Number.isFinite(offset)||!Number.isFinite(maxGap)||maxGap<=0)throw Error("无效的时间参数");
    if(!pred.length||!ref.length)throw Error("需要两组数据");
    let j=0,paired=0,sum=0,abs=0,sq=0,available=0,refAvailable=0;
    const rows=pred.map(p=>{
      const t=p.time_s+offset;let r=null;
      while(j+1<ref.length&&ref[j+1].time_s<=t)j++;
      const left=ref[j],right=ref[j+1];
      if(Math.abs(t-left.time_s)<1e-9)r=left.angle_deg;
      else if(right&&t>left.time_s&&t<right.time_s&&right.time_s-left.time_s<=maxGap+1e-9&&left.angle_deg!==null&&right.angle_deg!==null)r=left.angle_deg+(right.angle_deg-left.angle_deg)*(t-left.time_s)/(right.time_s-left.time_s);
      if(p.angle_deg!==null)available++;
      if(r!==null)refAvailable++;
      const e=p.angle_deg!==null&&r!==null?p.angle_deg-r:null;
      if(e!==null){paired++;sum+=e;abs+=Math.abs(e);sq+=e*e}
      return {time_s:p.time_s,predicted_deg:p.angle_deg,reference_deg:r,error_deg:e}
    });
    return {schema_version:1,offset_s:offset,max_reference_gap_s:maxGap,recorded_frames:pred.length,predicted_valid:available,reference_available:refAvailable,paired_frames:paired,coverage:paired/pred.length,mae_deg:paired?abs/paired:null,rmse_deg:paired?Math.sqrt(sq/paired):null,bias_deg:paired?sum/paired:null,rows};
  }
  function demo(){const ref=Array.from({length:121},(_,i)=>({time_s:i/60,angle_deg:90+25*Math.sin(2*Math.PI*i/60)}));const pred=ref.filter((_,i)=>i%2===0).map((r,i)=>({time_s:r.time_s,angle_deg:i>=20&&i<24?null:r.angle_deg+2}));return {pred,ref}}
  return {parse,compare,demo}
})();
