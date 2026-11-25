/* Descriptive phase-space and recurrence analysis; not a stability proof. */
globalThis.VimoDynamics=(function dynamics(){
  function uniform(rows,key,limit=4096){
    if(!Array.isArray(rows)||!rows.length)throw Error("No observations");
    let best=[],cur=[];
    for(const r of rows){
      if(!Number.isFinite(r[key])||!Number.isFinite(r.time_s)||(cur.length&&r.frame!==cur[cur.length-1].frame+1)){if(cur.length>best.length)best=cur;cur=[]}
      if(Number.isFinite(r[key])&&Number.isFinite(r.time_s))cur.push(r)
    }
    if(cur.length>best.length)best=cur;
    const a=best.slice(0,limit);if(a.length<8)throw Error("Need at least 8 consecutive valid frames");
    const dt=(a.at(-1).time_s-a[0].time_s)/(a.length-1);
    if(!(dt>0)||a.some((r,i)=>i&&Math.abs((r.time_s-a[i-1].time_s)/dt-1)>.02))throw Error("Sampling interval varies by more than 2%");
    return {values:a.map(r=>r[key]),times:a.map(r=>r.time_s),dt,first_frame:a[0].frame,last_frame:a.at(-1).frame}
  }
  function phase(values,dt,lag,level){
    if(!Array.isArray(values)||values.length<8||values.some(v=>!Number.isFinite(v))||!Number.isFinite(dt)||dt<=0||!Number.isInteger(lag)||lag<1||lag>=values.length-2||!Number.isFinite(level))throw Error("Invalid phase parameters");
    const n=values.length,delay=[],velocity=[],crossings=[];
    for(let i=0;i<n-lag;i++)delay.push([values[i],values[i+lag]]);
    for(let i=1;i<n-1;i++)velocity.push([values[i],(values[i+1]-values[i-1])/(2*dt)]);
    for(let i=0;i<n-1;i++){const a=values[i],b=values[i+1];if(a<level&&b>=level&&b>a){const f=(level-a)/(b-a);crossings.push({time_s:(i+f)*dt,velocity_deg_s:(b-a)/dt})}}
    const periods=crossings.slice(1).map((r,i)=>r.time_s-crossings[i].time_s),mean=periods.length?periods.reduce((s,v)=>s+v,0)/periods.length:null;
    const sd=mean===null?null:Math.sqrt(periods.reduce((s,v)=>s+(v-mean)**2,0)/periods.length);
    return {delay,velocity,crossings,periods,mean_period_s:mean,period_cv:mean===null||periods.length<2?null:sd/mean,lag_frames:lag,lag_s:lag*dt,section_level_deg:level}
  }
  function recurrence(values,lag,radius,minSeparation=1){
    if(!Array.isArray(values)||values.length<8||values.length>4096||values.some(v=>!Number.isFinite(v))||!Number.isInteger(lag)||lag<1||lag>=values.length-2||!Number.isFinite(radius)||radius<0||!Number.isInteger(minSeparation)||minSeparation<1)throw Error("Invalid recurrence parameters");
    const n=values.length-lag,step=Math.max(1,Math.ceil(n/360)),points=[];
    for(let i=0;i<n;i+=step)points.push([values[i],values[i+lag],i]);
    let pairs=0,hits=0,marks=[];
    for(let i=0;i<points.length;i++)for(let j=0;j<i;j++){const a=points[i],b=points[j];if(a[2]-b[2]<minSeparation)continue;pairs++;if(Math.hypot(a[0]-b[0],a[1]-b[1])<=radius){hits++;marks.push([i,j])}}
    return {points:points.length,stride_frames:step,pairs,hits,recurrence_rate:pairs?hits/pairs:null,marks,radius_deg:radius,min_separation_frames:minSeparation}
  }
  return {uniform,phase,recurrence}
})();
