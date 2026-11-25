/* Explicit same-tab handoff. No automatic persistence or remote upload. */
(function(root){
  const KEY="vimo.research.transfer.v1", LIMIT=1500000;
  function put(kind, csv, metadata, destination){
    if(!["pose","angle"].includes(kind)||typeof csv!=="string"||!csv.length)throw Error("没有可传递的数据");
    if(csv.length>LIMIT)throw Error("数据超过页面传递上限，请下载 CSV 后手动导入");
    const allowed={pose:["index.html","experiments.html","dynamics.html"],angle:["validation.html"]};
    if(!allowed[kind].includes(destination))throw Error("不支持的目标页面");
    const payload={kind,csv,metadata,created:Date.now(),destination};
    try{sessionStorage.setItem(KEY,JSON.stringify(payload))}catch(e){throw Error("浏览器无法暂存数据，请下载 CSV 后手动导入")}
    location.assign(destination+"?transfer="+kind);
  }
  function take(kind,destination){
    if(new URLSearchParams(location.search).get("transfer")!==kind)return null;
    let payload;
    try{payload=JSON.parse(sessionStorage.getItem(KEY)||"null");if(payload&&payload.kind===kind&&payload.destination===destination){sessionStorage.removeItem(KEY);if(Date.now()-payload.created>600000)return null;return payload}}catch(e){return null}
    return null;
  }
  root.VimoTransfer={put,take};
})(globalThis);
