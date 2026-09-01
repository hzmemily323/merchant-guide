/* 春千个人业绩看板 V2 — 多时段（周/双月/YoY）多维版 */
const D = {}; // 数据仓库
const PERIODS = ["this_week","last_week","this_bimonth","last_bimonth","yoy_bimonth"];
const PERIOD_LABEL = {
  this_week:"本周", last_week:"上周", this_bimonth:"本双月(7-8月)",
  last_bimonth:"上双月(5-6月)", yoy_bimonth:"去年同期(25年7-8月)"
};
const PREV = {this_week:"last_week", this_bimonth:"last_bimonth", last_bimonth:"yoy_bimonth"};
const TABS = [
  {key:"overview", name:"总览"},
  {key:"note", name:"商笔"},
  {key:"live", name:"店播"},
  {key:"kbo", name:"K播"},
  {key:"category", name:"品类"},
  {key:"sellers", name:"商家"},
];
let CUR_P = "this_week", CUR_T = "overview";
const CHARTS = [];

const $=id=>document.getElementById(id);
const fmtW=v=>v==null?"—":(v>=1e8?(v/1e8).toFixed(2)+"亿":(v>=1e4?(v/1e4).toFixed(1)+"万":Math.round(v).toLocaleString()));
const fmtN=v=>v==null?"—":Math.round(v).toLocaleString("zh-CN");
const pct=v=>v==null?"—":(v*100).toFixed(1)+"%";
function delta(cur,prev){
  if(cur==null||prev==null||prev===0) return `<span class="delta flat">—</span>`;
  const r=(cur-prev)/prev;
  const cls=r>=0?"up":"down", ar=r>=0?"↑":"↓";
  return `<span class="delta ${cls}">${ar} ${Math.abs(r*100).toFixed(1)}%</span>`;
}
function kpi(v,l,dhtml,fmt){
  return `<div class="kpi"><div class="v">${fmt?fmt(v):v}</div><div class="l">${l}</div>${dhtml?`<div class="d">${dhtml}</div>`:""}</div>`;
}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}

/* ---------- 总览 ---------- */
function renderOverview(){
  const p=CUR_P, prev=PREV[p];
  const sum=D.summary[p].total_dgmv;
  const prevSum=prev?D.summary[prev].total_dgmv:null;
  const fd=D.field_dist.periods[p], pfd=prev?D.field_dist.periods[prev]:null;
  const getG=(data,name)=>{if(!data)return null;const r=data.rows.find(x=>x[0]===name);return r?r[3]:null};
  const scenes=fd.rows.filter(r=>r[0]!=="总计");
  const no=D.new_old.periods[p];
  const getNO=k=>{const r=no.rows.find(x=>x[0]===k);return r?{dgmv:r[1],uv:r[2]}:null};
  const newC=getNO("新客1-2"), oldC=getNO("老客>=3");
  const totalUV=no.rows.reduce((s,r)=>s+r[2],0), totalDG=no.rows.reduce((s,r)=>s+r[1],0);
  const ss=D.seller_structure.periods[p];
  const ds=D.daily_series.daily;
  const m=$("main");

  // 场域占比（本周/时段内）
  const sceneData=fd.rows.filter(r=>r[0]!=="总计").map(r=>({name:r[0],value:r[3]})).sort((a,b)=>b.value-a.value);

  m.innerHTML=`
  <div class="hero">
    <h2>📋 业绩摘要 · ${PERIOD_LABEL[p]}<button id="copy-btn">复制周报文字</button></h2>
    <div class="kpis">
      ${kpi(fmtW(sum),"DGMV",prev?delta(sum,prevSum):`<span class="delta flat">基线期</span>`)}
      ${kpi(ss.active_sellers,"动销商家",prev&&D.seller_structure.periods[prev]?delta(ss.active_sellers,D.seller_structure.periods[prev].active_sellers):"")}
      ${kpi(newC?fmtW(newC.dgmv):"—","新客DGMV",newC&&prev?delta(newC.dgmv,(D.new_old.periods[prev].rows.find(x=>x[0]==="新客1-2")||[])[1]):"")}
      ${kpi(oldC?fmtW(oldC.dgmv):"—","老客DGMV",oldC&&prev?delta(oldC.dgmv,(D.new_old.periods[prev].rows.find(x=>x[0]==="老客>=3")||[])[1]):"")}
      ${kpi(totalUV?fmtN(totalUV):"—","购买用户",prev?delta(totalUV,D.new_old.periods[prev].rows.reduce((s,r)=>s+r[2],0)):"")}
      ${kpi(totalUV?(oldC? (oldC.uv/totalUV*100).toFixed(1)+"%":"—"):"—","复购率(老客UV占比)","")}
    </div>
  </div>
  <div class="grid">
    <div class="card full insight" id="insight-box"></div>
    <div class="card"><h3>场域结构<small>DGMV 按载体</small></h3><div class="chart-box" id="c-field" style="height:260px"></div></div>
    <div class="card"><h3>DGMV 趋势<small>5-8月逐日 · 周分界</small></h3><div class="chart-box" id="c-trend" style="height:260px"></div></div>
    <div class="card full"><h3>TOP10 商家${prev?`<small>含 vs ${PERIOD_LABEL[prev]}</small>`:""}</h3><div id="c-topsellers"></div></div>
    <div class="card full"><h3>TOP10 商品</h3>
      <table><thead><tr><th>#</th><th>商品</th><th>商家</th><th class="num">价格</th><th class="num">件数</th><th class="num">DGMV</th></tr></thead>
      <tbody>${D.top_products.periods[p].rows.slice(0,10).map((r,i)=>`<tr><td>${i+1}</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r[1])}">${esc(r[1])}</td><td>${esc(r[3])}</td><td class="num">¥${(r[2]||0).toFixed(0)}</td><td class="num">${fmtN(r[4])}</td><td class="num">${fmtW(r[5])}</td></tr>`).join("")}</tbody></table></div>
  </div>`;

  // 场域饼图
  chart("c-field",{tooltip:{trigger:"item",formatter:x=>`${x.name}: <b>${fmtW(x.value)}</b> (${x.percent}%)`},
    legend:{bottom:0,type:"scroll"},
    series:[{type:"pie",radius:["34%","60%"],center:["50%","42%"],label:{formatter:x=>`${x.name}\n${x.percent}%`,fontSize:11},
      data:sceneData}]});

  // 日序列趋势 + 当前时段高亮
  const dates=ds.map(r=>r.date), vals=ds.map(r=>r.dgmv);
  const ps=PERIOD_LABEL[p];
  const [s,e]=D.summary[p].label.match(/\d{4}-\d{2}-\d{2}/g)||[];
  const inRange=i=>s&&e&&dates[i]>=s&&dates[i]<=e;
  chart("c-trend",{tooltip:{trigger:"axis",formatter:x=>`${x[0].axisValue}<br>DGMV: <b>${fmtW(x[0].value)}</b>`},
    grid:{left:50,right:10,top:10,bottom:22},
    xAxis:{type:"category",data:dates,axisLabel:{fontSize:10}},
    yAxis:{type:"value",axisLabel:{formatter:v=>fmtW(v),fontSize:10},splitLine:{lineStyle:{color:"#eee"}}},
    dataZoom:[{type:"inside"}],
    series:[{type:"line",data:vals.map((v,i)=>({value:v,itemStyle:{color:inRange(i)?"#ff6700":"#c9ced9"},lineStyle:{color:"#c9ced9",width:1.5},symbol:"none"})),
      areaStyle:{color:"rgba(255,103,0,.06)"}}]});

  // TOP商家（含环比）
  const tops=D.top_sellers.periods[p].rows.slice(0,10);
  const prevTops=prev?D.top_sellers.periods[prev].rows:[];
  const prevMap={};prevTops.forEach(r=>prevMap[r[0]]=r[3]);
  const max=tops[0]?tops[0][3]:1;
  $("c-topsellers").innerHTML=tops.map(r=>`
    <div class="bar-row"><span class="name" title="${esc(r[2])}">${esc(r[2])}</span>
    <span class="track"><span class="fill" style="display:block;width:${(r[3]/max*100).toFixed(0)}%"></span></span>
    <span class="val">${fmtW(r[3])}</span>
    <span class="delta">${prev?deltaHTML(r[3],prevMap[r[0]]):""}</span></div>`).join("");

  // 洞察块
  const ins=[];
  if(prev){
    const r=(sum-prevSum)/prevSum;
    ins.push(`DGMV <b>${fmtW(sum)}</b>，vs ${PERIOD_LABEL[prev]} ${r>=0?"<span class='up'>↑"+(r*100).toFixed(1)+"%</span>":"<span class='down'>↓"+Math.abs(r*100).toFixed(1)+"%</span>"}（${fmtW(prevSum)}）`);
  }
  const top1=tops[0];
  if(top1) ins.push(`头部商家 <b>${esc(top1[2])}</b> ${fmtW(top1[3])}，占 DGMV ${(top1[3]/sum*100).toFixed(0)}%`);
  if(ss&&ss.new_sellers&&Object.keys(ss.new_sellers).length)
    ins.push(`新动销 ${Object.keys(ss.new_sellers).length} 家：${Object.values(ss.new_sellers).slice(0,3).map(x=>esc(x.name)).join("、")}${Object.keys(ss.new_sellers).length>3?" 等":""}`);
  if(ss&&ss.lost_sellers&&Object.keys(ss.lost_sellers).length)
    ins.push(`流失 ${Object.keys(ss.lost_sellers).length} 家（上期有成交本期无）：${Object.values(ss.lost_sellers).slice(0,3).map(x=>esc(x.name)).join("、")}${Object.keys(ss.lost_sellers).length>3?" 等":""}`);
  if(newC&&oldC) ins.push(`新老客：新客 ${fmtW(newC.dgmv)} / 老客 ${fmtW(oldC.dgmv)}，老客占比 ${(oldC.dgmv/totalDG*100).toFixed(0)}%`);
  const zhibo=getG(fd,"店播"), shangbi=getG(fd,"商品笔记"), kbo=getG(fd,"K播");
  if(zhibo!=null) ins.push(`场域：商笔 ${fmtW(shangbi)} / 店播 ${fmtW(zhibo)} / K播 ${fmtW(kbo)} / 商卡及其他 ${fmtW(sum-(shangbi||0)-(zhibo||0)-(kbo||0))}`);
  $("insight-box").innerHTML=`<div style="font-weight:600;margin-bottom:6px">🔍 本期洞察</div>`+ins.map(x=>`<div>· ${x}</div>`).join("");

  $("copy-btn").onclick=()=>{
    const txt=`【春千${PERIOD_LABEL[p]}业绩】DGMV ${fmtW(sum)}${prev?`（vs${PERIOD_LABEL[prev]} ${((sum-prevSum)/prevSum*100).toFixed(1)}%）`:""}；动销商家 ${ss.active_sellers} 家；新客DGMV ${newC?fmtW(newC.dgmv):"—"}、老客 ${oldC?fmtW(oldC.dgmv):"—"}；场域：商笔 ${fmtW(shangbi)}/店播 ${fmtW(zhibo)}/K播 ${fmtW(kbo)}。${ins.slice(2,5).join("；")}。`;
    navigator.clipboard.writeText(txt).then(()=>{$("copy-btn").textContent="✅ 已复制";setTimeout(()=>$("copy-btn").textContent="复制周报文字",2000)});
  };
}
function deltaHTML(cur,prev){
  if(cur==null||prev==null||prev===0) return `<span class="delta flat">新上榜</span>`;
  const r=(cur-prev)/prev;
  return `<span class="delta ${r>=0?"up":"down"}">${r>=0?"↑":"↓"}${Math.abs(r*100).toFixed(0)}%</span>`;
}

/* ---------- 商笔 ---------- */
function renderNote(){
  const p=CUR_P, prev=PREV[p];
  const cur=D.note_metrics.periods[p].rows[0];
  const prv=prev?D.note_metrics.periods[prev].rows[0]:null;
  const c=(i)=>cur?cur[i]:null, q=(i)=>prv?prv[i]:null;
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>商笔核心指标${prev?`<small>vs ${PERIOD_LABEL[prev]}</small>`:""}</h3>
      <div class="kpis">
        ${kpi(fmtW(c(2)),"商笔DGMV",prev?delta(c(2),q(2)):"")}
        ${kpi(fmtN(c(3)),"新发商笔数",prev?delta(c(3),q(3)):"")}
        ${kpi(c(0)>1e8?(c(0)/1e8).toFixed(2)+"亿":fmtN(c(0)/1e4)+"万","商笔曝光量",prev?delta(c(0),q(0)):"")}
        ${kpi(fmtN(c(1)),"笔记阅读PV",prev?delta(c(1),q(1)):"")}
        ${kpi(pct(c(4)),"阅读后商卡点击率",prev?delta(c(4),q(4)):"")}
        ${kpi(pct(c(5)),"商笔商品转化率",prev?delta(c(5),q(5)):"")}
      </div></div>
    <div class="card full insight">
      <div style="font-weight:600;margin-bottom:6px">🔍 商笔诊断</div>
      <div>· 曝光→阅读转化 <b>${c(0)?pct(c(1)/c(0)):"—"}</b>${prev&&q(0)?`（上期 ${pct(q(1)/q(0))}）`:""}：内容封面/标题的点击吸引力</div>
      <div>· 阅读→商卡点击 <b>${pct(c(4))}</b>：挂卡位置与商品匹配度</div>
      <div>· 商笔DGMV/新发笔记 = <b>${c(2)&&c(3)?"¥"+fmtN(c(2)/c(3)):"—"}</b>/篇：单篇带货效率</div>
      <div>· 场域占比：商笔占总 DGMV <b>${pct(c(2)/D.summary[p].total_dgmv)}</b></div>
    </div>
  </div>`;
}

/* ---------- 店播 ---------- */
function renderLive(){
  const p=CUR_P, prev=PREV[p];
  const cur=D.store_live.periods[p];
  const core=cur.core_2479.rows[0], det=cur.detail_5574&&cur.detail_5574.rows?cur.detail_5574.rows[0]:null;
  // detail_5574 列序: [购买UV, 商卡CTR, GPM, 自播DGMV, 开播时长s, 开播直播间数]
  const prv=prev?D.store_live.periods[prev]:null;
  const pcore=prv?prv.core_2479.rows[0]:null;
  const pdet=prv&&prv.detail_5574&&prv.detail_5574.rows?prv.detail_5574.rows[0]:null;
  const g=(a,i)=>a?a[i]:null;
  const hours=det?det[4]/3600:null, phours=pdet?pdet[4]/3600:null;
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>店播核心指标${prev?`<small>vs ${PERIOD_LABEL[prev]}</small>`:""}</h3>
      <div class="kpis">
        ${kpi(fmtW(g(core,0)),"店播DGMV",prev?delta(g(core,0),g(pcore,0)):"")}
        ${kpi(g(core,3),"开播商家数",prev?delta(g(core,3),g(pcore,3)):"")}
        ${kpi(det?fmtN(det[5]):"—","开播场次",prev?delta(det?det[5]:null,pdet?pdet[5]:null):"")}
        ${kpi(hours!=null?fmtN(hours)+"h":"—","开播时长",prev&&phours!=null?delta(hours,phours):"")}
        ${kpi(g(core,1)?fmtN(g(core,1)):"—","店播购买UV",prev?delta(g(core,1),g(pcore,1)):"")}
        ${kpi(g(core,2)!=null?g(core,2).toFixed(1):"—","GPM(平均)",prev?delta(g(core,2),g(pcore,2)):"")}
        ${kpi(pct(g(core,4)),"店播CTR(平均)",prev?delta(g(core,4),g(pcore,4)):"")}
        ${kpi(g(core,5)!=null?"¥"+g(core,5).toFixed(1):"—","笔单价(平均)",prev?delta(g(core,5),g(pcore,5)):"")}
      </div></div>
    <div class="card full insight">
      <div style="font-weight:600;margin-bottom:6px">🔍 店播诊断</div>
      <div>· 店播占总 DGMV <b>${pct(g(core,0)/D.summary[p].total_dgmv)}</b>；开播商家渗透 <b>${(g(core,3)/146*100).toFixed(0)}%</b>（146家中${g(core,3)}家）</div>
      <div>· 场均 DGMV <b>${det&&det[5]?(g(core,0)/det[5]/1e4).toFixed(2)+"万/场":"—"}</b>${det?`（${det[5]}场）`:""}</div>
      <div>· 场均时长 <b>${det&&det[5]&&hours?(hours/det[5]).toFixed(1)+"h":"—"}</b>${p==="this_week"?"：对照店播专项 4-6h 性价比区间":""}</div>
      <div>· GPM <b>${g(core,1)!=null?g(core,1).toFixed(1):"—"}</b>：休食友好线参考 170（月度口径），低 GPM 优先查货品结构与流量承接</div>
    </div>
  </div>`;
}

/* ---------- K播 ---------- */
function renderKbo(){
  const p=CUR_P, prev=PREV[p];
  const cur=D.k_live.periods[p];
  const prv=prev?D.k_live.periods[prev]:null;
  const w=cur.wide, pw=prv?prv.wide:null;
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>K播核心指标${prev?`<small>vs ${PERIOD_LABEL[prev]}</small>`:""}</h3>
      <div class="kpis">
        ${kpi(fmtW(w[0]),"K播DGMV",prev?delta(w[0],pw[0]):"")}
        ${kpi(cur.from_1922.k_sellers_1922,"K带动销商家",prev?delta(cur.from_1922.k_sellers_1922,prv.from_1922.k_sellers_1922):"")}
        ${kpi(fmtN(cur.from_1922.k_orders),"K播订单数",prev?delta(cur.from_1922.k_orders,prv.from_1922.k_orders):"")}
        ${kpi(pct(w[0]/D.summary[p].total_dgmv),"占总DGMV","")}
      </div></div>
    <div class="card full insight">
      <div style="font-weight:600;margin-bottom:6px">🔍 K播诊断</div>
      <div>· K播贡献 <b>${fmtW(w[0])}</b>，主要由头部达人带货（金燕耳、ffit8 等品为主）</div>
      <div>· 合作主播数/场次数两字段疑似同源（量级参考：<b>${fmtN(w[1])}</b>）</div>
      <div>· K播 DGMV/动销商家 = <b>¥${fmtN(w[0]/cur.from_1922.k_sellers_1922)}</b>/家：头部集中度指标</div>
    </div>
  </div>`;
}

/* ---------- 品类 ---------- */
function renderCategory(){
  const p=CUR_P, prev=PREV[p];
  const cur=D.category_dist.periods[p].rows;
  const prv=prev?D.category_dist.periods[prev].rows:[];
  const map={};prv.forEach(r=>map[r[0]]=r);
  const total=cur.reduce((s,r)=>s+r[4],0);
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>一级类目结构<small>DGMV·商家数·占比${prev?` · vs ${PERIOD_LABEL[prev]}`:""}</small></h3><div class="chart-box" id="c-cat" style="height:280px"></div></div>
    <div class="card full"><table><thead><tr>
      <th>一级类目</th><th class="num">动销商家</th><th class="num">DGMV</th><th class="num">占比</th><th class="num">购买用户</th>${prev?"<th class='num'>DGMV环比</th>":""}</tr></thead>
      <tbody>${cur.map(r=>{const pm=map[r[0]];return `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${fmtW(r[4])}</td><td class="num">${(r[4]/total*100).toFixed(1)}%</td><td class="num">${fmtN(r[3])}</td>${prev?`<td class="num">${deltaHTML(r[4],pm?pm[4]:null)}</td>`:""}</tr>`}).join("")}
      <tr class="total"><td>合计</td><td class="num">—</td><td class="num">${fmtW(total)}</td><td class="num">100%</td><td class="num">—</td>${prev?"<td></td>":""}</tr></tbody></table></div>
  </div>`;
  chart("c-cat",{tooltip:{formatter:x=>`${x.name}: <b>${fmtW(x.value)}</b> (${x.percent}%)`},
    series:[{type:"treemap",roam:false,nodeClick:false,breadcrumb:{show:false},
      label:{show:true,formatter:x=>`${x.name}\n${fmtW(x.value)}`,fontSize:11},
      itemStyle:{borderColor:"#fff",borderWidth:2,gapWidth:2},
      data:cur.map(r=>({name:r[0],value:r[4]}))}]});
}

/* ---------- 商家 ---------- */
function renderSellers(){
  const p=CUR_P;
  const ss=D.seller_structure.periods[p];
  const news=Object.entries(ss.new_sellers||{}), lost=Object.entries(ss.lost_sellers||{});
  const tops=D.top_sellers.periods[p].rows;
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>商家结构<small>${ss.label} · 动销 ${ss.active_sellers}/146 家</small></h3>
      <div class="kpis">
        ${kpi(ss.active_sellers,"本期动销商家","")}
        ${kpi(news.length,"新动销","")}
        ${kpi(lost.length,"流失","")}
        ${kpi(((ss.active_sellers)/146*100).toFixed(0)+"%","动销率","")}
      </div></div>
    <div class="card"><h3>🆕 新动销商家<small>上期无成交、本期有</small></h3>
      ${news.length?`<table><tbody>${news.map(([id,v])=>`<tr><td>${esc(v.name)}</td><td class="num">${fmtW(v.dgmv)}</td></tr>`).join("")}</tbody></table>`:`<div style="color:var(--muted);padding:20px;text-align:center">无</div>`}</div>
    <div class="card"><h3>⚠️ 流失商家<small>上期有成交、本期无</small></h3>
      ${lost.length?`<table><tbody>${lost.map(([id,v])=>`<tr><td>${esc(v.name)}</td><td class="num">${fmtW(v.dgmv)}</td></tr>`).join("")}</tbody></table>`:`<div style="color:var(--muted);padding:20px;text-align:center">无</div>`}</div>
    <div class="card full"><h3>DGMV TOP20 商家</h3>
      <table><thead><tr><th>#</th><th>商家</th><th>一级类目</th><th class="num">DGMV</th></tr></thead>
      <tbody>${tops.map((r,i)=>`<tr><td>${i+1}</td><td title="${r[0]}">${esc(r[2])}</td><td>${r[1]}</td><td class="num">${fmtW(r[3])}</td></tr>`).join("")}</tbody></table></div>
  </div>`;
}

/* ---------- 框架 ---------- */
function chart(id,opt){
  const el=$(id); if(!el)return;
  const c=echarts.init(el); CHARTS.push(c); c.setOption(opt);
}
function renderPeriods(){
  const el=$("periods"); el.innerHTML="";
  PERIODS.forEach(k=>{
    const b=document.createElement("button");
    b.textContent=PERIOD_LABEL[k];
    if(k===CUR_P)b.classList.add("active");
    b.onclick=()=>{CUR_P=k;renderPeriods();renderTab();};
    el.appendChild(b);
  });
}
function renderTab(){
  CHARTS.forEach(c=>c.dispose()); CHARTS.length=0;
  const el=$("tabs"); el.innerHTML="";
  TABS.forEach(t=>{
    const b=document.createElement("button");
    b.textContent=t.name;
    if(t.key===CUR_T)b.classList.add("active");
    b.onclick=()=>{CUR_T=t.key;renderTab();};
    el.appendChild(b);
  });
  if(CUR_T==="overview")renderOverview();
  else if(CUR_T==="note")renderNote();
  else if(CUR_T==="live")renderLive();
  else if(CUR_T==="kbo")renderKbo();
  else if(CUR_T==="category")renderCategory();
  else if(CUR_T==="sellers")renderSellers();
  window.scrollTo({top:0});
}
window.addEventListener("resize",()=>CHARTS.forEach(c=>c.resize()));

(async()=>{
  const files=["summary","field_dist","daily_series","top_sellers","top_products","category_dist","note_metrics","store_live","k_live","new_old","seller_structure"];
  for(const f of files){
    D[f]=await (await fetch(`data2/${f}.json`)).json();
  }
  renderPeriods();
  renderTab();
})();
