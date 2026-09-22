/* 春千个人业绩看板 V2 — 多时段（周/双月/YoY）多维版 */
const D = {}; // 数据仓库
const PERIODS = ["today","yesterday","d7","d14","d30"];
const PERIOD_LABEL = {today:"今天", yesterday:"昨日", d7:"近7天", d14:"近14天", d30:"近30天"};
/* 对比基准：当前窗口整体前移7天（同星期对齐——周一vs上周一） */
function prevWinDates(p){
  const dates=winDates(p);
  if(!dates.length) return [];
  const all=(D.daily_series.daily||[]).map(r=>r.date).filter(d=>d<=DAY_END());
  const s=all.indexOf(dates[0]), e=all.indexOf(dates[dates.length-1]);
  if(s<0||e<0||s-7<0) return [];
  const pd=all.slice(s-7, e-6);
  return (pd[0]>=DAY_START())?pd:[];
}
function prevLabel(p){
  const d=prevWinDates(p);
  if(!d.length) return "上期(数据未覆盖)";
  return d.length===1?`上周同日 ${d[0].slice(5)}`:`上期 ${d[0].slice(5)}~${d[d.length-1].slice(5)}`;
}
/* 日窗口聚合器：从 seller_daily 日粒度主表实时算 */
function DAY_END(){ try{ return D.seller_daily.meta.end }catch(e){ return "2026-09-21" } }
function DAY_START(){ try{ return D.seller_daily.meta.start }catch(e){ return "2026-09-01" } }
function winDates(p){
  const end=DAY_END();
  const all=(D.daily_series.daily||[]).map(r=>r.date);
  const dates=all.filter(d=>d<=end);
  if(p==="today") return dates.slice(-1);
  if(p==="yesterday") return dates.slice(-2,-1);
  if(p==="d7") return dates.slice(-7);
  if(p==="d14") return dates.slice(-14);
  if(p==="d30") return dates.slice(-30);
  return dates;
}
function aggWindowFor(dateArr, sid){
  const dates=new Set(dateArr);
  const out={dgmv:0,zhibo:0,shangbi:0,kbo:0,shangka:0,other:0,buys:0,live_rooms:0,live_h:0,live_uv:0,new_notes:0,note_dgmv:0,note_pv:0,read_pv:0,days:0};
  const sellers=sid!=null ? (D.seller_daily.sellers||[]).filter(x=>x.seller_id===sid) : (D.seller_daily.sellers||[]);
  let has=false;
  sellers.forEach(s=>{
    Object.entries(s.days||{}).forEach(([d,v])=>{
      if(!dates.has(d)) return;
      has=true; out.days++;
      ["dgmv","zhibo","shangbi","kbo","shangka","other","buys","live_rooms","live_h","live_uv","new_notes","note_dgmv","note_pv","read_pv"].forEach(k=>out[k]+=(v[k]||0));
    });
  });
  return has?out:out;
}
function aggWindow(p, sid){ return aggWindowFor(winDates(p), sid); }
function aggActiveFor(dateArr){ // 动销商家数
  const dates=new Set(dateArr);
  let n=0;
  (D.seller_daily.sellers||[]).forEach(s=>{
    for(const [d,v] of Object.entries(s.days||{})) if(dates.has(d)&&(v.dgmv||0)>0){n++;break}
  });
  return n;
}
function aggActive(p){ return aggActiveFor(winDates(p)); }
function yoyWindow(p){
  // 去年同日历日期
  const dates=winDates(p);
  const yoy=(D.daily_total_yoy||{});
  // daily_total_yoy: {rows:[[date,sellers,dgmv]]} 2025年
  const m={}; (yoy.rows||[]).forEach(r=>m[r[0]]=r[2]);
  let cur=0, prev=0;
  const curM={}; (D.daily_series.daily||[]).forEach(r=>curM[r.date]=r.dgmv);
  dates.forEach(d=>{
    cur+=curM[d]||0;
    const y=d.replace(/^2026/,"2025");
    prev+=m[y]||0;
  });
  return {cur, prev};
}
const TABS = [
  {key:"overview", name:"总览"},
  {key:"note", name:"商笔"},
  {key:"live", name:"店播"},
  {key:"kbo", name:"K播"},
  {key:"sellers", name:"商家"},
  {key:"schedule", name:"排期与邀约"},
];
const FIELDS = ["zhibo","shangbi","kbo","shangka","other"];
const FIELD_NAME = {zhibo:"店播", shangbi:"商笔", kbo:"K播", shangka:"商卡", other:"其他"};
let CUR_P = "today", CUR_T = "overview";
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
  const p=CUR_P;
  const prevD=prevWinDates(p); const prev=prevD.length>0;
  const agg=aggWindow(p);
  const pAgg=prev?aggWindowFor(prevD):null;
  const yoy=yoyWindow(p);
  const active=aggActive(p), pActive=prev?aggActiveFor(prevD):null;
  const m=$("main");
  const dates=winDates(p);
  const winLabel=`${dates[0]?.slice(5)}~${dates[dates.length-1]?.slice(5)}`;

  const fieldSum=f=>agg[f]||0;
  const sceneData=[["店播",fieldSum("zhibo")],["商笔",fieldSum("shangbi")],["K播",fieldSum("kbo")],["商卡",fieldSum("shangka")],["其他",fieldSum("other")]].filter(x=>x[1]>0);
  const sum=agg.dgmv;

  m.innerHTML=`
  <div class="hero">
    <h2>📋 业绩摘要 · ${PERIOD_LABEL[p]}<small style="font-weight:400;font-size:12px;color:#999;margin-left:10px">${winLabel} · 数据截至 ${DAY_END()}</small></h2>
    <div class="kpis">
      ${kpi(fmtW(sum),"DGMV",prev&&pAgg&&pAgg.dgmv>0?delta(sum,pAgg.dgmv):"")}
      ${kpi(active,"动销商家",prev&&pActive!=null?delta(active,pActive):"")}
      ${kpi(fmtN(agg.buys),"购买用户",prev&&pAgg?delta(agg.buys,pAgg.buys):"")}
      ${kpi(yoy.prev>0?(yoy.cur>=yoy.prev?"↑":"↓")+Math.abs((yoy.cur-yoy.prev)/yoy.prev*100).toFixed(1)+"%":"—","vs 去年同期",yoy.prev>0?delta(yoy.cur,yoy.prev):"")}
      ${kpi(prev&&pAgg&&pAgg.dgmv>0?((sum-pAgg.dgmv)/pAgg.dgmv>=0?"↑":"↓")+Math.abs((sum-pAgg.dgmv)/pAgg.dgmv*100).toFixed(1)+"%":"—",prev?"vs "+prevLabel(p):"",prev&&pAgg&&pAgg.dgmv>0?delta(sum,pAgg.dgmv):"")}
    </div>
  </div>
  <div class="grid">
    <div class="card full insight" id="insight-box"></div>
    <div class="card"><h3>场域结构<small>DGMV 按载体</small></h3><div class="chart-box" id="c-field" style="height:260px"></div></div>
    <div class="card"><h3>DGMV 趋势<small id="trend-range"></small></h3><div class="chart-box" id="c-trend" style="height:260px"></div></div>
    <div class="card full"><h3>TOP10 商家${prev?`<small>含 vs ${prevLabel(p)}</small>`:""}</h3><div id="c-topsellers"></div></div>
  </div>`;

  // 场域饼图
  chart("c-field",{tooltip:{trigger:"item",formatter:x=>`${x.name}: <b>${fmtW(x.value)}</b> (${x.percent}%)`},
    legend:{bottom:0,type:"scroll"},
    series:[{type:"pie",radius:["34%","60%"],center:["50%","42%"],label:{formatter:x=>`${x.name}\n${x.percent}%`,fontSize:11},
      data:sceneData}]});

  // 日序列趋势：显示近30天，高亮当前窗口
  const dsAll=D.daily_series.daily.filter(r=>r.date<=DAY_END());
  const ds=dsAll.slice(-30);
  const dts=ds.map(r=>r.date), vals=ds.map(r=>r.dgmv);
  const tr=$("trend-range"); if(tr) tr.textContent=`${dts[0]?.slice(5)}~${dts[dts.length-1]?.slice(5)} · 当前窗口高亮`;
  const inWin=i=>dts[i]>=dates[0]&&dts[i]<=dates[dates.length-1];
  chart("c-trend",{tooltip:{trigger:"axis",formatter:x=>`${x[0].axisValue}<br>DGMV: <b>${fmtW(x[0].value)}</b>`},
    grid:{left:50,right:10,top:10,bottom:22},
    xAxis:{type:"category",data:dts,axisLabel:{fontSize:10}},
    yAxis:{type:"value",axisLabel:{formatter:v=>fmtW(v),fontSize:10},splitLine:{lineStyle:{color:"#eee"}}},
    dataZoom:[{type:"inside"}],
    series:[{type:"line",data:vals.map((v,i)=>({value:v,itemStyle:{color:inWin(i)?"#FF2442":"#d5d0d5"},lineStyle:{color:"#c9ced9",width:1.5},symbol:"none"})),
      areaStyle:{color:"rgba(255,103,0,.06)"}}]});

  // TOP商家（日窗口聚合）
  const sellerRows=(D.seller_daily.sellers||[]).map(sd=>{
    const wd=new Set(dates);
    let cur=0, pv=0;
    Object.entries(sd.days||{}).forEach(([d,v])=>{
      if(wd.has(d)) cur+=(v.dgmv||0);
      if(prev){ const pd=new Set(winDates(prev)); if(pd.has(d)) pv+=(v.dgmv||0); }
    });
    return {id:sd.seller_id,name:sd.name,cur,pv};
  }).filter(r=>r.cur>0).sort((a,b)=>b.cur-a.cur);
  const tops=sellerRows.slice(0,10);
  const max=tops[0]?tops[0].cur:1;
  $("c-topsellers").innerHTML=tops.map(r=>`
    <div class="bar-row"><span class="name" title="${esc(r.name)}">${esc(r.name)}</span>
    <span class="track"><span class="fill" style="display:block;width:${(r.cur/max*100).toFixed(0)}%"></span></span>
    <span class="val">${fmtW(r.cur)}</span>
    <span class="delta">${prev?deltaHTML(r.cur,r.pv):""}</span>
    <span style="width:44px"><button class="drill-btn" data-sid="${r.id}" style="font-size:11px;padding:2px 8px;border:1px solid #ddd;background:#fff;border-radius:10px;cursor:pointer">🔍</button></span></div>`).join("");

  // 洞察
  const ins=[];
  if(prev&&pAgg&&pAgg.dgmv>0){
    const r=(sum-pAgg.dgmv)/pAgg.dgmv;
    ins.push(`DGMV <b>${fmtW(sum)}</b>，vs ${prevLabel(p)} ${r>=0?"<span class='up'>↑"+(r*100).toFixed(1)+"%</span>":"<span class='down'>↓"+Math.abs(r*100).toFixed(1)+"%</span>"}（${fmtW(pAgg.dgmv)}）`);
  }
  if(yoy.prev>0) ins.push(`vs 去年同期 ${yoy.cur>=yoy.prev?"<span class='up'>↑":"<span class='down'>↓"}${Math.abs((yoy.cur-yoy.prev)/yoy.prev*100).toFixed(1)}%</span>（去年同窗口 ${fmtW(yoy.prev)}）`);
  const top1=tops[0];
  if(top1) ins.push(`头部商家 <b>${esc(top1.name)}</b> ${fmtW(top1.cur)}，占 DGMV ${(top1.cur/sum*100).toFixed(0)}%`);
  ins.push(`场域：商笔 ${fmtW(fieldSum("shangbi"))} / 店播 ${fmtW(fieldSum("zhibo"))} / K播 ${fmtW(fieldSum("kbo"))} / 商卡 ${fmtW(fieldSum("shangka"))}`);
  if(agg.new_notes>0) ins.push(`新发商笔 ${Math.round(agg.new_notes)} 篇 · 店播 ${Math.round(agg.live_rooms)} 场 / ${agg.live_h.toFixed(0)}h`);
  $("insight-box").innerHTML=`<div style="font-weight:600;margin-bottom:6px">🔍 ${PERIOD_LABEL[p]}洞察 · ${winLabel}</div>`+ins.map(x=>`<div>· ${x}</div>`).join("");
}
function deltaHTML(cur,prev){
  if(cur==null||prev==null||prev===0) return `<span class="delta flat">新上榜</span>`;
  const r=(cur-prev)/prev;
  return `<span class="delta ${r>=0?"up":"down"}">${r>=0?"↑":"↓"}${Math.abs(r*100).toFixed(0)}%</span>`;
}

/* ---------- 商笔 ---------- */
function renderNote(){
  const p=CUR_P;
  const prevD=prevWinDates(p); const prev=prevD.length>0;
  const agg=aggWindow(p), pAgg=prev?aggWindowFor(prevD):null;
  const sum=agg.dgmv;
  const sb=agg.shangbi;
  const g=(k)=>agg[k]||0, q=(k)=>pAgg?(pAgg[k]||0):null;
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>商笔核心指标${prev?`<small>vs ${prevLabel(p)}</small>`:""}</h3>
      <div class="kpis">
        ${kpi(fmtW(sb),"商笔DGMV",prev&&pAgg?delta(sb,q("shangbi")):"")}
        ${kpi(fmtN(Math.round(g("new_notes"))),"新发商笔数",prev&&pAgg?delta(Math.round(g("new_notes")),q("new_notes")!=null?Math.round(q("new_notes")):null):"")}
        ${kpi(fmtN(g("note_pv")),"商笔曝光量",prev&&pAgg?delta(g("note_pv"),q("note_pv")):"")}
        ${kpi(fmtN(g("read_pv")),"笔记阅读PV",prev&&pAgg?delta(g("read_pv"),q("read_pv")):"")}
        ${kpi(sb>0?pct(g("note_dgmv")>0?g("note_pv")/sum*0+g("read_pv")/g("note_pv"):0):"—","阅读/曝光",prev&&pAgg&&q("read_pv")?delta(g("read_pv")/g("note_pv"),q("read_pv")/q("note_pv")):"")}
        ${kpi(g("new_notes")>0?"¥"+fmtN(sb/Math.round(g("new_notes"))):"—","单篇DGMV","")}
      </div></div>
    <div class="card full"><h3>商笔 · 涨跌 TOP5 商家<small>${PERIOD_LABEL[p]} vs ${prev?prevLabel(p):"—"} · 日窗口</small></h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
        <div><div style="font-weight:600;color:var(--up);margin-bottom:4px">📈 拉升 TOP5</div>${moverRowsDaily("shangbi",p,prev).up}</div>
        <div><div style="font-weight:600;color:var(--down);margin-bottom:4px">📉 衰减 TOP5</div>${moverRowsDaily("shangbi",p,prev).down}</div>
      </div></div>
    <div class="card full insight">
      <div style="font-weight:600;margin-bottom:6px">🔍 商笔诊断</div>
      <div>· 场域占比：商笔占总 DGMV <b>${sum>0?pct(sb/sum):"—"}</b></div>
      <div>· 曝光→阅读 <b>${g("note_pv")>0?pct(g("read_pv")/g("note_pv")):"—"}</b>：内容封面/标题的点击吸引力</div>
      <div>· 新发笔记 <b>${Math.round(g("new_notes"))}</b> 篇，单篇带货 <b>${g("new_notes")>0?"¥"+fmtN(sb/Math.round(g("new_notes"))):"—"}</b></div>
    </div>
  </div>`;
}

function renderLive(){
  const p=CUR_P;
  const prevD=prevWinDates(p); const prev=prevD.length>0;
  const agg=aggWindow(p), pAgg=prev?aggWindowFor(prevD):null;
  const sum=agg.dgmv;
  const g=k=>agg[k]||0, q=k=>pAgg?(pAgg[k]||0):null;
  // GPM中位：按商家在窗口内的GPM取中位（日粒度gpm为当日单商家值，简单平均仍偏，取中位数）
  const dates=new Set(winDates(p));
  const gpms=[];
  (D.seller_daily.sellers||[]).forEach(sd=>{
    let dsum=0,gsum=0,n=0;
    Object.entries(sd.days||{}).forEach(([d,v])=>{
      if(dates.has(d)&&(v.gpm!=null)){ gsum+=v.gpm; dsum+=(v.dgmv||0); n++ }
    });
    if(n>0) gpms.push(gsum/n);
  });
  gpms.sort((a,b)=>a-b);
  const medGpm=gpms.length?gpms[Math.floor(gpms.length/2)].toFixed(1):"—";
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>店播核心指标${prev?`<small>vs ${prevLabel(p)}</small>`:""}</h3>
      <div class="kpis">
        ${kpi(fmtW(g("zhibo")),"店播DGMV",prev&&pAgg?delta(g("zhibo"),q("zhibo")):"")}
        ${kpi(fmtN(g("live_rooms")),"开播场次",prev&&pAgg?delta(g("live_rooms"),q("live_rooms")):"")}
        ${kpi(fmtN(g("live_h"))+"h","开播时长",prev&&pAgg?delta(g("live_h"),q("live_h")):"")}
        ${kpi(fmtN(g("live_uv")),"店播观看UV",prev&&pAgg?delta(g("live_uv"),q("live_uv")):"")}
        ${kpi(g("live_uv")>0?fmtN(g("buys")):"—","购买用户",prev&&pAgg?delta(g("buys"),q("buys")):"")}
        ${kpi(medGpm,"GPM(中位)","")}
        ${kpi(g("live_uv")>0?pct(g("buys")/g("live_uv")):"—","观看→购买率","")}
      </div></div>
    <div class="card full"><h3>店播 · 涨跌 TOP5 商家<small>${PERIOD_LABEL[p]} vs ${prev?prevLabel(p):"—"} · 日窗口</small></h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
        <div><div style="font-weight:600;color:var(--up);margin-bottom:4px">📈 拉升 TOP5</div>${moverRowsDaily("zhibo",p,prev).up}</div>
        <div><div style="font-weight:600;color:var(--down);margin-bottom:4px">📉 衰减 TOP5</div>${moverRowsDaily("zhibo",p,prev).down}</div>
      </div></div>
    <div class="card full insight">
      <div style="font-weight:600;margin-bottom:6px">🔍 店播诊断</div>
      <div>· 店播占总 DGMV <b>${sum>0?pct(g("zhibo")/sum):"—"}</b>；共 <b>${Math.round(g("live_rooms"))}</b> 场 / <b>${g("live_h").toFixed(0)}</b> 小时</div>
      <div>· 场均 DGMV <b>${g("live_rooms")>0?"¥"+fmtN(g("zhibo")/g("live_rooms")):"—"}</b>；场均时长 <b>${g("live_rooms")>0?(g("live_h")/g("live_rooms")).toFixed(1)+"h":"—"}</b>（对照店播专项 4-6h 性价比区间）</div>
      <div>· GPM 中位 <b>${medGpm}</b>（跨商家平均会被小曝光极端值拉偏，看中位更稳）</div>
    </div>
  </div>`;
}

/* ---------- K播 ---------- *//* ---------- K播 ---------- */
function renderKbo(){
  const p=CUR_P;
  const prevD=prevWinDates(p); const prev=prevD.length>0;
  const agg=aggWindow(p), pAgg=prev?aggWindowFor(prevD):null;
  const sum=agg.dgmv;
  const g=k=>agg[k]||0, q=k=>pAgg?(pAgg[k]||0):null;
  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>K播核心指标${prev?`<small>vs ${prevLabel(p)}</small>`:""}</h3>
      <div class="kpis">
        ${kpi(fmtW(g("kbo")),"K播DGMV",prev&&pAgg?delta(g("kbo"),q("kbo")):"")}
        ${kpi(sum>0?pct(g("kbo")/sum):"—","占总DGMV","")}
      </div></div>
    <div class="card full"><h3>K播 · 涨跌 TOP5 商家<small>${PERIOD_LABEL[p]} vs ${prev?prevLabel(p):"—"} · 日窗口</small></h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
        <div><div style="font-weight:600;color:var(--up);margin-bottom:4px">📈 拉升 TOP5</div>${moverRowsDaily("kbo",p,prev).up}</div>
        <div><div style="font-weight:600;color:var(--down);margin-bottom:4px">📉 衰减 TOP5</div>${moverRowsDaily("kbo",p,prev).down}</div>
      </div></div>
    <div class="card full insight">
      <div style="font-weight:600;margin-bottom:6px">🔍 K播诊断</div>
      <div>· K播贡献 <b>${fmtW(g("kbo"))}</b>${sum>0?`，占总盘 <b>${pct(g("kbo")/sum)}</b>`:""}</div>
      <div>· 涨跌归因请点 TOP5 商家行的 🔍 下钻看逐日 K播曲线</div>
    </div>
  </div>`;
}

/* ---------- 品类 ---------- *//* ---------- 商家 ---------- *//* ---------- 商家 ---------- */
/* 日窗口涨跌TOP */
function topMoversDaily(field, p, prevP, n=5){
  const cur=new Set(winDates(p)), pv=new Set(prevWinDates(p));
  if(!pv.size) return {up:[],down:[]};
  const rows=(D.seller_daily.sellers||[]).map(sd=>{
    let c=0, q=0;
    Object.entries(sd.days||{}).forEach(([d,v])=>{
      if(cur.has(d)) c+=(v[field]||0);
      if(pv.has(d)) q+=(v[field]||0);
    });
    return {name:sd.name, seller_id:sd.seller_id, cur:c, prev:q, delta:c-q};
  }).filter(r=>r.cur>0||r.prev>0);
  const up=[...rows].filter(r=>r.delta>0).sort((a,b)=>b.delta-a.delta).slice(0,n);
  const down=[...rows].filter(r=>r.delta<0).sort((a,b)=>a.delta-b.delta).slice(0,n);
  return {up,down};
}
function moverRowsDaily(field, p, prevP){
  const mv=topMoversDaily(field,p,prevP);
  const fmt=list=>{ if(!list||!list.length) return `<div class="muted" style="padding:8px 0">无</div>`;
    return `<table><tbody>${list.map(r=>`<tr>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.name)}">${esc(r.name)}</td>
    <td class="num">${fmtW(r.prev)}</td><td style="color:var(--muted)">→</td>
    <td class="num"><b>${fmtW(r.cur)}</b></td>
    <td class="num ${r.delta>=0?"up":"down"}">${r.delta>=0?"▲":"▼"}${fmtW(Math.abs(r.delta))}${r.prev>0?`（${r.delta>=0?"+":""}${(r.delta/r.prev*100).toFixed(0)}%）`:"（新起量）"}</td>
    <td style="width:44px"><button class="drill-btn" data-sid="${r.seller_id}" style="font-size:11px;padding:2px 8px;border:1px solid #ddd;background:#fff;border-radius:10px;cursor:pointer">🔍</button></td>
  </tr>`).join("")}</tbody></table>` };
  return {up:fmt(mv.up), down:fmt(mv.down)};
}

/* ---------- 排期与邀约 ---------- */
const SCH_STATUS={1:"待开播",2:"开播中",3:"已直播",4:"已过期"};
const INV_STATUS={0:"待响应",1:"已接受",2:"已拒绝",10:"已读未回",15:"已读未回"};
function renderSchedule(){
  const names={}; (D.seller_weekly||[]).forEach(r=>names[r.seller_id]=r.name);
  // 达人昵称映射：优先专门表，回落到 K播成交明细里的历史合作主播
  const distMap=(D.distributor_names||{});
  (function(){
    const kh=D.seller_kbo_hosts||{};
    Object.values(kh).forEach(rec=>{
      Object.values(rec.weeks||{}).forEach(wd=>{
        (wd.hosts||[]).forEach(h=>{ if(!distMap[h.anchor_id]) distMap[h.anchor_id]=h.nickname; });
      });
    });
  })();
  const distName=id=>distMap[id]||("达人 "+id.slice(0,8));
  const sch=(D.live_schedule&&D.live_schedule.schedules)||[];
  const inv=(D.kbo_invitations&&D.kbo_invitations)||[];
  const today=DAY_END();
  // 排期分：未来（含今天）/ 已播
  const future=sch.filter(x=>x.live_schedule_start_time>=today+" 00:00"&&x.live_schedule_status!==4).sort((a,b)=>a.live_schedule_start_time<b.live_schedule_start_time?-1:1);
  const past=sch.filter(x=>!future.includes(x)).sort((a,b)=>b.live_schedule_start_time<a.live_schedule_start_time?-1:1);
  const invList=(inv.invitations||[]).map(x=>({...x, sname:names[x.seller_id]||x.seller_id.slice(0,8)}));
  const pending=invList.filter(x=>[0,10,15].includes(x.status));
  const accepted=invList.filter(x=>x.status===1);
  const rejected=invList.filter(x=>x.status===2);
  const fmtDT=t=>t?t.slice(5,16):"—";

  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>📅 排期与邀约概览<small>快照分区 ${D.live_schedule?.meta?.partition||"—"} · 日更</small></h3>
      <div class="kpis">
        ${kpi(future.length,"未来排期场次","")}
        ${kpi(new Set(future.map(x=>x.seller_id)).size,"未来开播商家","")}
        ${kpi(pending.length,"邀约进行中","")}
        ${kpi(accepted.length,"已接受邀约","")}
        ${kpi(rejected.length,"已拒绝","")}
      </div></div>
    <div class="card full"><h3>📅 未来店播排期<small>今天起 · 按开播时间排序</small></h3>
      ${future.length?`<table><thead><tr><th>商家</th><th>计划名称</th><th>开播时间</th><th>时长</th><th>状态</th><th class="num">预计挂品</th><th class="num">预期销售额</th></tr></thead>
      <tbody>${future.map(x=>{
        const st=x.live_schedule_start_time, en=x.live_schedule_end_time;
        const dur=(st&&en)?Math.max(1,Math.round((new Date(en)-new Date(st))/3600000))+"h":"—";
        const stt=x.live_schedule_status;
        return `<tr><td>${esc(x.shop_name||names[x.seller_id]||"—")}</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.live_schedule_title||"")}">${esc(x.live_schedule_title||"—")}</td><td>${fmtDT(st)}</td><td>${dur}</td>
        <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;${stt===2?'background:#e8f5e9;color:#1b5e20':stt===1?'background:#fff3e0;color:#e65100':'background:#f5f5f5;color:#999'}">${SCH_STATUS[stt]||stt}</span></td>
        <td class="num">${x.live_schedule_goods_count||"—"}</td><td class="num">${x.live_schedule_sale_amont?fmtW(x.live_schedule_sale_amont):"—"}</td></tr>`}).join("")}</tbody></table>`
      :`<div style="color:var(--muted);padding:24px;text-align:center">146 家当前无未来排期——可以推动商家建计划</div>`}
    </div>
    <div class="card full" style="padding:0;background:transparent;border:none;box-shadow:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="card" style="margin:0"><h3>🤝 K播邀约 · 进行中<small>待响应/已读未回 · ${pending.length}条</small></h3>
          ${pending.length?`<div style="max-height:640px;overflow-y:auto"><table><thead><tr><th>商家</th><th>达人</th><th>发出</th><th>状态</th></tr></thead>
          <tbody>${pending.sort((a,b)=>a.create_time<b.create_time?1:-1).map(x=>`<tr><td style="font-size:12px">${esc(x.sname)}</td><td style="font-size:12px">${esc(distName(x.distributor_id))}</td><td style="font-size:11.5px;color:#666">${fmtDT(x.create_time)}</td>
          <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;${x.status===0?'background:#eef1fb;color:#4457b8':'background:#fdf3e3;color:#b06a1f'}">${INV_STATUS[x.status]}</span></td></tr>`).join("")}</tbody></table></div>`
          :`<div style="color:var(--muted);padding:24px;text-align:center">无进行中邀约</div>`}
        </div>
        <div class="card" style="margin:0"><h3>✅ K播邀约 · 已接受<small>近90天 · ${accepted.length}条</small></h3>
          ${accepted.length?`<div style="max-height:640px;overflow-y:auto"><table><thead><tr><th>商家</th><th>达人</th><th>发出</th><th>回复</th></tr></thead>
          <tbody>${accepted.sort((a,b)=>a.create_time<b.create_time?1:-1).map(x=>`<tr><td style="font-size:12px">${esc(x.sname)}</td><td style="font-size:12px">${esc(distName(x.distributor_id))}</td><td style="font-size:11.5px;color:#666">${fmtDT(x.create_time)}</td><td style="font-size:11.5px;color:#666">${x.replay_time&&x.replay_time.slice(0,4)>"1971"?fmtDT(x.replay_time):"—"}</td></tr>`).join("")}</tbody></table></div>`
          :`<div style="color:var(--muted);padding:24px;text-align:center">无</div>`}
        </div>
      </div>
    </div>
    <div class="card full" style="font-size:12px;color:#999">
      口径：排期=直播计划扩展表（每日快照，含店播与买手计划）；邀约=商家邀约表（近90天，已剔除删除/过期）。已拒绝 ${rejected.length} 条。replay_time 的 1970 哨兵已过滤。
    </div>
  </div>`;
}

function renderSellers(){
  const p=CUR_P;
  const dates=new Set(winDates(p));
  // 日窗口全量聚合
  const buildAllRows=()=>{
    const sd=D.seller_daily&&D.seller_daily.sellers||[];
    const wk=(D.seller_weekly||[]);
    const map={};
    sd.forEach(s=>{
      const fields={zhibo:0,shangbi:0,kbo:0,shangka:0,other:0,live_rooms:0,new_notes:0,dgmv:0};
      Object.entries(s.days||{}).forEach(([d,v])=>{
        if(!dates.has(d)) return;
        fields.dgmv+=v.dgmv||0; fields.zhibo+=v.zhibo||0; fields.shangbi+=v.shangbi||0; fields.kbo+=v.kbo||0;
        fields.shangka+=v.shangka||0; fields.other+=v.other||0;
        fields.live_rooms+=v.live_rooms||0; fields.new_notes+=v.new_notes||0;
      });
      map[s.seller_id]={seller_id:s.seller_id,name:s.name,...fields};
    });
    wk.forEach(w=>{ if(!map[w.seller_id]) map[w.seller_id]={seller_id:w.seller_id,name:w.name,dgmv:0,zhibo:0,shangbi:0,kbo:0,shangka:0,other:0,live_rooms:0,new_notes:0}; });
    return Object.values(map).sort((a,b)=>b.dgmv-a.dgmv);
  };
  const allRows=buildAllRows();
  const noActive=allRows.filter(r=>r.dgmv===0).length;

  $("main").innerHTML=`
  <div class="grid">
    <div class="card full"><h3>商家结构<small>${PERIOD_LABEL[p]} · 动销 ${aggActive(p)}/146 家</small></h3>
      <div class="kpis">
        ${kpi(aggActive(p),"本期动销商家","")}
        ${kpi(146-aggActive(p),"零成交商家","")}
        ${kpi(((aggActive(p))/146*100).toFixed(0)+"%","动销率","")}
      </div></div>
    <div class="card full">
      <h3>🔍 全量商家明细<small>146 家挂接商家 · 搜索商家名 · 点行末🔍下钻查看该商家逐日/事件</small></h3>
      <div style="display:flex;gap:10px;margin-bottom:8px;flex-wrap:wrap">
        <input id="seller-search" placeholder="搜索商家名（支持部分匹配）" style="flex:1;min-width:200px;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px">
        <select id="seller-filter" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px">
          <option value="all">全部 (${allRows.length})</option>
          <option value="active">动销 (${allRows.length-noActive})</option>
          <option value="zero">零成交 (${noActive})</option>
          <option value="live">有店播</option>
          <option value="note">有商笔</option>
          <option value="kbo">有K播</option>
        </select>
        <select id="seller-sort" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px">
          <option value="dgmv">按DGMV降序</option>
          <option value="zhibo">按店播降序</option>
          <option value="shangbi">按商笔降序</option>
          <option value="kbo">按K播降序</option>
          <option value="name">按名称</option>
        </select>
      </div>
      <div style="max-height:520px;overflow-y:auto;border:1px solid #f0f0f0;border-radius:6px">
        <table id="seller-tbl" style="width:100%;font-size:12.5px">
          <thead style="position:sticky;top:0;background:#fafafa;z-index:1">
            <tr><th style="padding:8px 6px;text-align:left">商家</th><th class="num">DGMV</th><th class="num">店播</th><th class="num">商笔</th><th class="num">K播</th><th class="num">商卡</th><th class="num">场次</th><th class="num">新笔</th><th></th></tr>
          </thead>
          <tbody id="seller-tbody"></tbody>
        </table>
      </div>
      <div style="margin-top:8px;font-size:11.5px;color:#999">💡 数据窗口 = ${D.seller_daily?.meta?.start||"—"} ~ ${D.seller_daily?.meta?.end||"—"}；下钻里的逐日/事件仅TOP16有完整事件标注，其他商家仅有逐日DGMV</div>
    </div>
  </div>`;

  // 渲染逻辑
  const renderList=()=>{
    const q=($("seller-search")?.value||"").trim().toLowerCase();
    const filter=$("seller-filter")?.value||"all";
    const sort=$("seller-sort")?.value||"dgmv";
    let rows=allRows.filter(r=>!q||r.name.toLowerCase().includes(q));
    if(filter==="active") rows=rows.filter(r=>r.dgmv>0);
    else if(filter==="zero") rows=rows.filter(r=>r.dgmv===0);
    else if(filter==="live") rows=rows.filter(r=>r.zhibo>0);
    else if(filter==="note") rows=rows.filter(r=>r.shangbi>0);
    else if(filter==="kbo") rows=rows.filter(r=>r.kbo>0);
    if(sort==="name") rows.sort((a,b)=>a.name.localeCompare(b.name,"zh"));
    else rows.sort((a,b)=>(b[sort]||0)-(a[sort]||0));
    $("seller-tbody").innerHTML=rows.map(r=>`
      <tr>
        <td style="padding:5px 6px" title="${r.seller_id}">${esc(r.name)}</td>
        <td class="num">${r.dgmv?fmtW(r.dgmv):'—'}</td>
        <td class="num" style="color:${r.zhibo>0?'#FF2442':'#ccc'}">${r.zhibo?fmtW(r.zhibo):'—'}</td>
        <td class="num" style="color:${r.shangbi>0?'#5b8def':'#ccc'}">${r.shangbi?fmtW(r.shangbi):'—'}</td>
        <td class="num" style="color:${r.kbo>0?'#a688e8':'#ccc'}">${r.kbo?fmtW(r.kbo):'—'}</td>
        <td class="num" style="color:${r.shangka>0?'#3fbf9f':'#ccc'}">${r.shangka?fmtW(r.shangka):'—'}</td>
        <td class="num">${r.live_rooms||'—'}</td>
        <td class="num">${r.new_notes||'—'}</td>
        <td><button class="drill-btn" data-sid="${r.seller_id}" style="font-size:11px;padding:2px 8px;border:1px solid #ddd;background:#fff;border-radius:10px;cursor:pointer">🔍</button></td>
      </tr>`).join("");
  };
  renderList();
  $("seller-search").oninput=renderList;
  $("seller-filter").onchange=renderList;
  $("seller-sort").onchange=renderList;
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
document.addEventListener("click",e=>{
  const btn=e.target.closest(".drill-btn");
  if(btn&&btn.dataset.sid){ renderDrill(btn.dataset.sid); }
});
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
  if(CUR_T==="schedule")renderSchedule();
  else if(CUR_T==="overview")renderOverview();
  else if(CUR_T==="note")renderNote();
  else if(CUR_T==="live")renderLive();
  else if(CUR_T==="kbo")renderKbo();
  else if(CUR_T==="sellers")renderSellers();
  window.scrollTo({top:0});
}
window.addEventListener("resize",()=>CHARTS.forEach(c=>c.resize()));

(async()=>{
  const files=["summary","field_dist","daily_series","top_sellers","top_products","category_dist","note_metrics","store_live","k_live","new_old","seller_structure"];
const files3=["seller_weekly","seller_live_weekly","seller_note_weekly","yoy_weekly","seller_kbo_hosts"];
  for(const f of ["seller_weekly","seller_live_weekly","seller_note_weekly","yoy_weekly","seller_kbo_hosts","seller_daily_drill","seller_daily","live_schedule","kbo_invitations","distributor_names","daily_total_yoy"]){
    try{ D[f]=await (await fetch(`data3/${f}.json`)).json(); }catch(e){ D[f]={}; }
  }
  try{ D.drillSellers=(D.seller_daily_drill&&D.seller_daily_drill.sellers)||[]; }catch(e){ D.drillSellers=[]; }
  // 日粒度版：data2 只加载日序列（其余 data2 周快照已废弃）
  try{ D.daily_series=await (await fetch(`data2/daily_series.json`)).json(); }catch(e){ D.daily_series={daily:[]}; }
  // 动态填数据截止日期
  try{
    let cutoff=null;
    if(D.daily_series&&D.daily_series.daily&&D.daily_series.daily.length){
      cutoff=D.daily_series.daily[D.daily_series.daily.length-1].date;
    } else if(D.seller_weekly&&D.seller_weekly[0]){
      const wk=D.seller_weekly[0].weeks, last=Object.keys(wk).sort().pop();
      cutoff=last+"周";
    }
    const el=document.getElementById("meta-sub");
    if(el&&cutoff) el.textContent=`挂接商家 146 家 · 商家ID口径 · 数据截至 ${cutoff}（日更管道：最新周为周至今口径，涨跌下钻为日环比）`;
  }catch(e){}
  renderPeriods();
  renderTab();
})();

/* ---------- V4: 商家日粒度下钻 ---------- */
function renderDrill(seller_id){
  let r=(D.drillSellers||[]).find(x=>x.seller_id===seller_id);
  if(!r){
    // 从 seller_daily 全量构造（覆盖任意商家，不限TOP16）
    const sd=(D.seller_daily&&D.seller_daily.sellers||[]).find(x=>x.seller_id===seller_id);
    if(!sd){
      // 挂接名单里但整个窗口零成交（不在 seller_daily）
      const w=(D.seller_weekly||[]).find(x=>x.seller_id===seller_id);
      const nm=w?w.name:seller_id.slice(0,10);
      r={seller_id, name:nm, direction:"up", delta_w35_vs_w34:0, days:[], events:[], _zero:true};
    } else {
      const ddays=Object.keys(sd.days||{}).sort().map(d=>({date:d,...sd.days[d]}));
      const totalDgmv=ddays.reduce((s,d)=>s+(d.dgmv||0),0);
      const cur=ddays[ddays.length-1]||{dgmv:0}, prev=ddays.length>=2?ddays[ddays.length-2]:null;
      const dt=prev?(cur.dgmv-prev.dgmv):0;
      r={seller_id, name:sd.name, direction:dt>=0?"up":"down",
         delta_w35_vs_w34:dt, days:ddays, events:[], _zero:totalDgmv===0};
    }
  }
  const days=r.days||[];
  const mid=Math.ceil(days.length/2); const w34=days.slice(0,mid), w35=days.slice(mid);
  const sum=(arr,f)=>arr.reduce((s,d)=>s+(d[f]||0),0);
  const evList=(r.events||[]);
  $("main").innerHTML=`
  <div style="margin-bottom:10px"><button id="back-btn" style="font-size:13px;padding:6px 14px;border:1px solid #ddd;background:#fff;border-radius:8px;cursor:pointer">← 返回</button></div>
  <div class="hero"><h2>🔍 ${esc(r.name)} · 逐日下钻<small style="font-weight:400;font-size:12px;color:#999">${r._zero?"当前窗口零成交":`${r.direction==="up"?"▲":"▼"}${fmtW(Math.abs(r.delta_day??r.delta_w36_vs_w35??r.delta_w35_vs_w34??0))} · ${days[0]?.date?.slice(5)}~${days[days.length-1]?.date?.slice(5)}`}</small></h2></div>
  <div class="card full"><h3>逐日 DGMV 分场域<small>堆叠=店播/商笔/K播/商卡/其他</small></h3><div id="drill-chart" style="height:320px"></div></div>
  <div class="card full"><h3>关键动作信号日</h3>
    ${evList.length?evList.map(e=>`<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px"><b style="min-width:80px;color:#666">${e.date.slice(5)}</b><span style="min-width:52px">${{note:"📝发笔记",live:"🎬开播",kbo:"🎙K播"}[e.type]||e.type}</span><span>${esc(e.detail)}</span></div>`).join(""):'<div style="color:#999;font-size:13px">无显著信号日——波动为渐进式或由商卡/其他载体驱动</div>'}
    <div style="font-size:11.5px;color:#999;margin-top:8px">信号日判定：新发商笔≥max(5, 2×中位) · 店播DGMV≥1.8×中位 · 多直播间开播 · K播当日≥5000元；K播主播明细为周粒度</div>
  </div>
  <div class="card full"><h3>逐日明细</h3>
    <div style="overflow-x:auto"><table class="tbl" style="width:100%;font-size:12px">
      <thead><tr><th>日期</th><th>DGMV</th><th>店播</th><th>商笔</th><th>K播</th><th>商卡</th><th>新发笔记</th><th>开播场次</th><th>开播时长</th></tr></thead>
      <tbody>${days.map(d=>`<tr><td>${d.date.slice(5)}</td><td class="num">${fmtW(d.dgmv)}</td><td class="num">${fmtW(d.zhibo)}</td><td class="num">${fmtW(d.shangbi)}</td><td class="num">${fmtW(d.kbo)}</td><td class="num">${fmtW(d.shangka)}</td><td>${d.new_notes||0}</td><td>${d.live_rooms||0}</td><td>${d.live_h?d.live_h.toFixed(1)+"h":"—"}</td></tr>`).join("")}</tbody>
    </table></div>
  </div>`;
  // ECharts 堆叠柱
  const chart=echarts.init($("drill-chart"));
  const F=[["zhibo","店播","#FF2442"],["shangbi","商笔","#5b8def"],["kbo","K播","#a688e8"],["shangka","商卡","#3fbf9f"],["other","其他","#d8d3d8"]];
  chart.setOption({
    animation:false,
    tooltip:{trigger:"axis",valueFormatter:v=>v>=10000?(v/10000).toFixed(1)+"万":Math.round(v)},
    legend:{bottom:0,textStyle:{fontSize:11}},
    grid:{left:50,right:10,top:10,bottom:30},
    xAxis:{type:"category",data:days.map(d=>d.date.slice(5))},
    yAxis:{type:"value",axisLabel:{formatter:v=>v>=10000?v/10000+"万":v}},
    series:F.map(([f,n,c],i)=>({name:n,type:"bar",stack:"t",itemStyle:{color:c},barMaxWidth:26,data:days.map(d=>Math.round(d[f]||0))}))
  });
  $("back-btn").onclick=()=>{ renderTab(); };
}

