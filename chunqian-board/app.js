/* 春千个人业绩看板 — 基于 2026-08-03~09-01 商家列表导出 */
const DATA_URL = "sellers.json";
let SELLERS = [];
const fmtW = v => v == null ? "—" : (v >= 1e8 ? (v/1e8).toFixed(2)+"亿" : (v/1e4).toFixed(1)+"万");
const fmtN = v => v == null ? "—" : Math.round(v).toLocaleString("zh-CN");
const pct = v => v == null ? "—" : (v*100).toFixed(1)+"%";

const TABS = [
  {key:"overview", name:"总览"},
  {key:"field", name:"场域拆解"},
  {key:"category", name:"品类结构"},
  {key:"sellers", name:"商家明细"},
  {key:"growth", name:"增长与问题点"},
];

function $(id){return document.getElementById(id)}

function renderTabs(cur){
  const el = $("tabs"); el.innerHTML = "";
  TABS.forEach(t=>{
    const b = document.createElement("button");
    b.textContent = t.name;
    if(t.key===cur) b.classList.add("active");
    b.onclick = ()=>{renderTabs(t.key); render(t.key);};
    el.appendChild(b);
  });
}

/* ---------- 总览 ---------- */
function renderOverview(){
  const R = SELLERS;
  const dgmv = sum(R,"dgmv");
  const zhibo = sum(R,"zhibo"), kbo = sum(R,"kbo"), shangbi = sum(R,"shangbi");
  const other = dgmv - zhibo - kbo - shangbi;
  const sellers = R.length;
  const active = R.filter(r=>(r.dgmv||0)>0).length;
  const orders = sum(R,"orders"), buyers = sum(R,"buyers");
  const newBuyers = sum(R,"new_buyers"), oldDgmv = sum(R,"old_dgmv");
  const aov = orders>0 ? dgmv/orders : null;
  const m = $("main");

  m.innerHTML = `
  <div class="hero">
    <h2>📋 业绩摘要（近30天）<button id="copy-btn">复制摘要</button></h2>
    <div class="kpis">
      <div class="kpi"><div class="v">${fmtW(dgmv)}</div><div class="l">DGMV</div></div>
      <div class="kpi"><div class="v">${sellers}</div><div class="l">挂接商家</div></div>
      <div class="kpi"><div class="v">${active}</div><div class="l">动销商家</div></div>
      <div class="kpi"><div class="v">${fmtN(orders)}</div><div class="l">订单数</div></div>
      <div class="kpi"><div class="v">¥${aov?aov.toFixed(1):"—"}</div><div class="l">客单价</div></div>
      <div class="kpi"><div class="v">${fmtN(newBuyers)}</div><div class="l">新客购买UV</div></div>
      <div class="kpi"><div class="v">${pct(1-oldDgmv/dgmv)}</div><div class="l">新客DGMV占比</div></div>
    </div>
  </div>
  <div class="grid">
    <div class="card full"><h3>场域贡献结构<small>商笔/店播/K播/其他（普通商卡等）</small></h3><div class="chart-box" id="c-field"></div></div>
    <div class="card full"><h3>TOP15 商家<small>按 DGMV</small></h3><div id="c-topsellers"></div></div>
  </div>`;
  echarts.init($("c-field")).setOption({
    tooltip:{trigger:"item",formatter:p=>`${p.name}: <b>${fmtW(p.value)}</b> (${p.percent}%)`},
    legend:{bottom:0},
    series:[{type:"pie",radius:["38%","62%"],center:["50%","44%"],
      label:{formatter:p=>`${p.name}\n${p.percent}%`},
      data:[
        {name:"商笔",value:shangbi,itemStyle:{color:"#ff6700"}},
        {name:"店播",value:zhibo,itemStyle:{color:"#f59e0b"}},
        {name:"K播",value:kbo,itemStyle:{color:"#8b5cf6"}},
        {name:"其他(商卡等)",value:other,itemStyle:{color:"#94a3b8"}},
      ]}]
  });
  const top = [...R].sort((a,b)=>(b.dgmv||0)-(a.dgmv||0)).slice(0,15);
  const max = top[0].dgmv||1;
  $("c-topsellers").innerHTML = top.map(r=>`
    <div class="bar-row"><span class="name" title="${r.seller}">${r.seller}</span>
    <span class="track"><span class="fill" style="width:${(r.dgmv/max*100).toFixed(0)}%"></span></span>
    <span class="val">${fmtW(r.dgmv)}</span></div>`).join("");
  $("copy-btn").onclick = ()=>{
    const txt = `【春千近30天业绩】DGMV ${fmtW(dgmv)}（商笔 ${fmtW(shangbi)}/店播 ${fmtW(zhibo)}/K播 ${fmtW(kbo)}/其他 ${fmtW(other)}）；挂接商家 ${sellers} 家，动销 ${active} 家；订单 ${fmtN(orders)}，客单 ¥${aov?aov.toFixed(1):"—"}；新客购买UV ${fmtN(newBuyers)}，新客DGMV占比 ${pct(1-oldDgmv/dgmv)}。TOP商家：${top.slice(0,5).map(r=>r.seller+" "+fmtW(r.dgmv)).join("、")}。`;
    navigator.clipboard.writeText(txt).then(()=>{$("copy-btn").textContent="✅ 已复制";setTimeout(()=>$("copy-btn").textContent="复制摘要",2000)});
  };
}

/* ---------- 场域拆解 ---------- */
function renderField(){
  const R = SELLERS;
  const m = $("main");
  const zhiboSellers = R.filter(r=>(r.zhibo||0)>0);
  const kboSellers = R.filter(r=>(r.kbo||0)>0);
  const sbSellers = R.filter(r=>(r.shangbi||0)>0);
  const avgGpm = (()=>{const s=R.filter(r=>r.zhibo_gpm);return s.length? s.reduce((a,r)=>a+(r.zhibo_gpm||0),0)/s.length:null})();
  m.innerHTML = `
  <div class="grid">
    <div class="card"><h3>店播</h3>
      <div class="kpis">
        <div class="kpi"><div class="v">${fmtW(sum(R,"zhibo"))}</div><div class="l">店播DGMV</div></div>
        <div class="kpi"><div class="v">${zhiboSellers.length}</div><div class="l">开播成交商家</div></div>
        <div class="kpi"><div class="v">${avgGpm?avgGpm.toFixed(1):"—"}</div><div class="l">平均GPM</div></div>
        <div class="kpi"><div class="v">${fmtN(sum(R,"zhibo_sessions"))}</div><div class="l">店播场次</div></div>
      </div></div>
    <div class="card"><h3>商品笔记</h3>
      <div class="kpis">
        <div class="kpi"><div class="v">${fmtW(sum(R,"shangbi"))}</div><div class="l">商笔DGMV</div></div>
        <div class="kpi"><div class="v">${sbSellers.length}</div><div class="l">有商笔成交商家</div></div>
        <div class="kpi"><div class="v">${fmtN(sum(R,"shangbi_cnt"))}</div><div class="l">商笔发布数</div></div>
        <div class="kpi"><div class="v">${fmtN(sum(R,"new_shangbi"))}</div><div class="l">新增商笔数</div></div>
      </div></div>
    <div class="card full"><h3>K播</h3>
      <div class="kpis">
        <div class="kpi"><div class="v">${fmtW(sum(R,"kbo"))}</div><div class="l">K播DGMV</div></div>
        <div class="kpi"><div class="v">${kboSellers.length}</div><div class="l">K播动销商家</div></div>
      </div></div>
    <div class="card full"><h3>店播 TOP10 商家</h3><div id="t-zb"></div></div>
    <div class="card full"><h3>商笔 TOP10 商家</h3><div id="t-sb"></div></div>
  </div>`;
  barList("t-zb", [...R].sort((a,b)=>(b.zhibo||0)-(a.zhibo||0)).slice(0,10), r=>r.zhibo);
  barList("t-sb", [...R].sort((a,b)=>(b.shangbi||0)-(a.shangbi||0)).slice(0,10), r=>r.shangbi);
}

/* ---------- 品类结构 ---------- */
function renderCategory(){
  const m = $("main");
  const byCat = {};
  SELLERS.forEach(r=>{
    const c = r.cat1 || "未知";
    byCat[c] = byCat[c] || {dgmv:0, sellers:0, zhibo:0, shangbi:0, kbo:0};
    const b = byCat[c];
    b.dgmv += r.dgmv||0; b.sellers++;
    b.zhibo += r.zhibo||0; b.shangbi += r.shangbi||0; b.kbo += r.kbo||0;
  });
  const cats = Object.entries(byCat).sort((a,b)=>b[1].dgmv-a[1].dgmv);
  const total = cats.reduce((s,[,v])=>s+v.dgmv,0);
  m.innerHTML = `
  <div class="grid">
    <div class="card full"><h3>一级类目 DGMV 结构<small>挂接商家的实际经营分布</small></h3><div class="chart-box" id="c-cat"></div></div>
    <div class="card full"><h3>类目明细</h3>
      <table><thead><tr><th>一级类目</th><th>商家数</th><th>DGMV</th><th>占比</th><th>店播</th><th>商笔</th><th>K播</th></tr></thead>
      <tbody>${cats.map(([c,v])=>`<tr><td>${c}</td><td>${v.sellers}</td><td>${fmtW(v.dgmv)}</td><td>${pct(v.dgmv/total)}</td><td>${fmtW(v.zhibo)}</td><td>${fmtW(v.shangbi)}</td><td>${fmtW(v.kbo)}</td></tr>`).join("")}
      <tr class="total"><td>合计</td><td>${SELLERS.length}</td><td>${fmtW(total)}</td><td>100%</td><td>${fmtW(sum(SELLERS,"zhibo"))}</td><td>${fmtW(sum(SELLERS,"shangbi"))}</td><td>${fmtW(sum(SELLERS,"kbo"))}</td></tr></tbody></table></div>
  </div>`;
  echarts.init($("c-cat")).setOption({
    tooltip:{formatter:p=>`${p.name}: <b>${fmtW(p.value)}</b> (${p.percent}%)`},
    series:[{type:"treemap",roam:false,nodeClick:false,
      breadcrumb:{show:false},
      label:{show:true,formatter:p=>`${p.name}\n${fmtW(p.value)}`,fontSize:12},
      itemStyle:{borderColor:"#fff",borderWidth:2,gapWidth:2},
      data:cats.map(([c,v])=>({name:c,value:v.dgmv}))}]
  });
}

/* ---------- 商家明细 ---------- */
function renderSellers(){
  const m = $("main");
  m.innerHTML = `
  <div class="card full">
    <h3>商家明细（146 家）<small>可按名称搜索 · 点击表头排序</small></h3>
    <div style="margin-bottom:8px"><input id="q" placeholder="🔍 搜索商家名/类目" style="width:240px;padding:6px 10px;border:1px solid var(--border);border-radius:6px"></div>
    <div style="max-height:640px;overflow:auto">
    <table id="tbl"><thead><tr>
      <th data-k="seller">商家</th><th data-k="cat1">一级类目</th><th data-k="cat2">二级类目</th>
      <th data-k="dgmv">DGMV</th><th data-k="zhibo">店播</th><th data-k="shangbi">商笔</th><th data-k="kbo">K播</th>
      <th data-k="zhibo_sessions">店播场次</th><th data-k="note_cnt">笔记数</th><th data-k="fans">粉丝</th><th data-k="settle_date">入驻</th>
    </tr></thead><tbody></tbody></table></div>
  </div>`;
  const tb = $("tbl").querySelector("tbody");
  let sortKey = "dgmv", asc = false;
  function draw(list){
    tb.innerHTML = list.map(r=>`<tr>
      <td title="${r.seller_id}">${r.seller}</td><td>${r.cat1||"—"}</td><td>${r.cat2||"—"}</td>
      <td>${fmtW(r.dgmv)}</td><td>${fmtW(r.zhibo)}</td><td>${fmtW(r.shangbi)}</td><td>${fmtW(r.kbo)}</td>
      <td>${r.zhibo_sessions??"—"}</td><td>${r.note_cnt??"—"}</td><td>${fmtN(r.fans)}</td><td>${r.settle_date}</td></tr>`).join("");
  }
  const sortList = (k)=>{
    const l = [...SELLERS].sort((a,b)=>{
      let x=a[k]??-1, y=b[k]??-1;
      if(typeof x==="string") return asc? x.localeCompare(y): y.localeCompare(x);
      return asc? x-y : y-x;
    });
    draw(l);
  };
  $("tbl").querySelectorAll("th").forEach(th=>{
    th.style.cursor="pointer";
    th.onclick=()=>{ if(sortKey===th.dataset.k) asc=!asc; else {sortKey=th.dataset.k; asc=false;} sortList(sortKey); };
  });
  $("q").oninput = e=>{
    const q = e.target.value.trim();
    draw(SELLERS.filter(r=>!q || (r.seller||"").includes(q) || (r.cat1||"").includes(q) || (r.cat2||"").includes(q)));
  };
  sortList("dgmv");
}

/* ---------- 增长与问题点 ---------- */
function renderGrowth(){
  const R = SELLERS;
  const m = $("main");
  const zero = R.filter(r=>!(r.dgmv>0));
  const noZhibo = R.filter(r=>(r.dgmv||0)>0 && !(r.zhibo>0));
  const noSb = R.filter(r=>(r.dgmv||0)>0 && !(r.shangbi>0));
  const lowGpm = R.filter(r=>(r.zhibo||0)>10000 && r.zhibo_gpm!=null && r.zhibo_gpm<50);
  const highRefund = R.filter(r=>r.refund_rate!=null && typeof r.refund_rate==="number" && r.refund_rate>0.15 && (r.dgmv||0)>50000);
  const newSettlers = R.filter(r=>r.settle_date>="2026-01-01");
  const topOld = R.filter(r=>(r.old_dgmv||0)>0).sort((a,b)=>(b.old_dgmv||0)-(a.old_dgmv||0)).slice(0,8);
  m.innerHTML = `
  <div class="grid">
    <div class="card full"><h3>🚨 问题点雷达<small>挂户首月基线，下期刷新后看变化</small></h3>
      <table><tbody>
      <tr><td>零成交商家</td><td><b>${zero.length}</b> 家（占 ${(zero.length/R.length*100).toFixed(0)}%）</td><td class="muted">优先盘点：是死店还是有货盘没起量</td></tr>
      <tr><td>动销但无店播</td><td><b>${noZhibo.length}</b> 家</td><td class="muted">店播渗透 ${pct(1-noZhibo.length/R.filter(r=>r.dgmv>0).length)}，商卡/商笔依赖型可先不动</td></tr>
      <tr><td>动销但无商笔</td><td><b>${noSb.length}</b> 家</td><td class="muted">内容渗透机会：${noSb.slice(0,5).map(r=>r.seller).join("、")}${noSb.length>5?" 等":""}</td></tr>
      <tr><td>店播GPM&lt;50</td><td><b>${lowGpm.length}</b> 家（店播>1万）</td><td class="muted">货品结构/承接问题，对照店播专项SOP做功</td></tr>
      <tr><td>退款率&gt;15%</td><td><b>${highRefund.length}</b> 家（DGMV>5万）</td><td class="muted">体验红线，优先排查品退原因</td></tr>
      <tr><td>2026年新入驻</td><td><b>${newSettlers.length}</b> 家</td><td class="muted">新商扶持资源可优先倾斜</td></tr>
      </tbody></table></div>
    <div class="card full"><h3>老客贡献 TOP8<small>复购基本盘</small></h3>
      <div id="t-old"></div></div>
  </div>`;
  barList("t-old", topOld, r=>r.old_dgmv);
}

/* ---------- utils ---------- */
function sum(rows,k){return rows.reduce((s,r)=>s+(r[k]||0),0)}
function barList(id, list, getV){
  const el = $(id); if(!el) return;
  const max = Math.max(...list.map(getV),1);
  el.innerHTML = list.map(r=>`
    <div class="bar-row"><span class="name" title="${r.seller}">${r.seller}</span>
    <span class="track"><span class="fill" style="width:${((getV(r)||0)/max*100).toFixed(0)}%"></span></span>
    <span class="val">${fmtW(getV(r))}</span></div>`).join("");
}

fetch(DATA_URL).then(r=>r.json()).then(d=>{
  SELLERS = d;
  renderTabs("overview");
  renderOverview();
});
function render(key){
  if(key==="overview")renderOverview();
  else if(key==="field")renderField();
  else if(key==="category")renderCategory();
  else if(key==="sellers")renderSellers();
  else if(key==="growth")renderGrowth();
}
