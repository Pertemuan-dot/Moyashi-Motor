(() => {
const state = {
  session: null,
  branches: [],
  parts: [],
  services: [],
  suppliers: [],
  users: [],
  permissions: {},
  settings: {},
  dashboard: null,
  sale: {type:"retail", items:[]},
  purchase: {method:"manual", items:[]},
  receiving: null,
  historyTab:"sales"
};

const MENU = [
  {id:"dashboard",label:"Dashboard",icon:"▦",perm:"dashboard",group:"UTAMA"},
  {id:"sales",label:"Penjualan",icon:"▣",perm:"sales",group:"TRANSAKSI"},
  {id:"purchase",label:"Pembelian",icon:"◫",perm:"purchase",group:"TRANSAKSI"},
  {id:"receiving",label:"Terima Barang",icon:"⇩",perm:"receiving",group:"TRANSAKSI"},
  {id:"history",label:"History",icon:"◷",perm:"history",group:"DATA"},
  {id:"settings",label:"Setting",icon:"⚙",perm:"settings",group:"SISTEM"}
];

const $ = id => document.getElementById(id);
const money = n => "Rp " + Number(n||0).toLocaleString("id-ID");
const num = v => Math.max(0, Number(v||0));
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(message,type=""){
  const el=document.createElement("div"); el.className="toast-item "+type; el.textContent=message;
  $("toast").appendChild(el); setTimeout(()=>el.remove(),3200);
}
function fmtDate(v){return v?new Date(v).toLocaleString("id-ID"): "-";}
function todayInput(){return new Date().toISOString().slice(0,10);}
function hasPerm(p){ return state.session?.role==="ADMIN" || state.session?.permissions?.includes(p); }

async function api(action,payload={}){
  payload = {...payload, token:state.session?.token||""};
  return MMApi.call(action,payload);
}

function pageShell(title,subtitle,actions=""){
  return `<div class="section-title"><div><h3>${title}</h3><p>${subtitle||""}</p></div><div>${actions}</div></div>`;
}
function emptyRow(cols,text="Belum ada data"){return `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`;}

async function boot(){
  await MMApi.mountBridge();
  $("loginForm").addEventListener("submit",login);
  $("logoutBtn").addEventListener("click",logout);
  $("menuBtn").addEventListener("click",()=> $("sidebar").classList.toggle("open"));
  $("branchPicker").addEventListener("change", async e=>{
    state.session.branchId=e.target.value;
    renderPage("dashboard");
  });
  const saved = localStorage.getItem("mm_session");
  if(saved){ try { const s=JSON.parse(saved); state.session=s; await hydrate(); showApp(); } catch(e){localStorage.removeItem("mm_session");}}
}
async function login(e){
  e.preventDefault();
  const btn=e.submitter; btn.disabled=true; btn.textContent="Memproses...";
  try{
    const res=await MMApi.call("login",{username:$("loginUsername").value.trim(),password:$("loginPassword").value});
    state.session=res.session; localStorage.setItem("mm_session",JSON.stringify(state.session));
    await hydrate(); showApp(); toast("Login berhasil","success");
  }catch(err){toast(err.message,"error");}
  finally{btn.disabled=false;btn.textContent="Masuk Sistem";}
}
async function hydrate(){
  const data=await api("bootstrap");
  Object.assign(state,data);
  if(!state.session.branchId && state.branches[0]) state.session.branchId=state.branches[0].id;
}
function showApp(){
  $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("headerUserName").textContent=state.session.name||"User";
  $("headerRole").textContent=state.session.role||"";
  buildNav(); buildBranchPicker(); renderPage("dashboard");
}
async function logout(){
  try{await api("logout");}catch(e){}
  state.session=null; localStorage.removeItem("mm_session");
  $("appView").classList.add("hidden");$("loginView").classList.remove("hidden");
  $("loginPassword").value="";
}
function buildBranchPicker(){
  $("branchPicker").innerHTML = state.branches.map(b=>`<option value="${b.id}" ${b.id===state.session.branchId?"selected":""}>${esc(b.name)}</option>`).join("");
}
function buildNav(){
  const groups=[...new Set(MENU.map(m=>m.group))];
  $("navMenu").innerHTML=groups.map(g=>{
    const items=MENU.filter(m=>m.group===g && hasPerm(m.perm));
    if(!items.length)return "";
    return `<div class="nav-group"><div class="nav-title">${g}</div>${items.map(m=>`<button class="nav-item" data-view="${m.id}"><span>${m.icon}</span>${m.label}</button>`).join("")}</div>`;
  }).join("");
  $("navMenu").querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>renderPage(b.dataset.view));
}
function setActiveNav(id){
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  const item=MENU.find(x=>x.id===id);
  $("pageTitle").textContent=item?.label||"Dashboard";
  $("pageKicker").textContent=state.branches.find(b=>b.id===state.session.branchId)?.name||"Moyashi Motor";
  $("sidebar").classList.remove("open");
}
async function renderPage(id){
  setActiveNav(id);
  document.querySelectorAll(".page-view").forEach(v=>v.classList.add("hidden"));
  const view=$("view-"+id); view.classList.remove("hidden");
  if(id==="dashboard") return renderDashboard(view);
  if(id==="sales") return renderSales(view);
  if(id==="purchase") return renderPurchase(view);
  if(id==="receiving") return renderReceiving(view);
  if(id==="history") return renderHistory(view);
  if(id==="settings") return renderSettings(view);
}

async function renderDashboard(view){
  view.innerHTML=`<div class="card card-pad"><div class="empty">Memuat dashboard...</div></div>`;
  try{
    state.dashboard=await api("dashboard",{branchId:state.session.branchId});
    const d=state.dashboard;
    view.innerHTML=`
      <div class="grid grid-4">
        ${statCard("Penjualan Hari Ini",money(d.todaySales),"Transaksi masuk hari ini")}
        ${statCard("Penjualan Bulan Ini",money(d.monthSales),"Semua transaksi penjualan")}
        ${statCard("Penjualan Jasa",money(d.monthService),"Jasa service bulan berjalan")}
        ${statCard("Nilai Stok",money(d.stockValue),"Per cabang aktif")}
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card card-pad">${pageShell("Tren Penjualan","7 hari terakhir")}
          <div class="mini-bars">${renderBars(d.dailySales)}</div>
        </div>
        <div class="card card-pad">${pageShell("Status Stok","Perlu perhatian")}
          ${stockAlertTable(d.lowStock)}</div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card card-pad">${pageShell("Penjualan per Mekanik","Bulan berjalan")}
          ${simpleTable(["Mekanik","Transaksi","Total"],(d.byMechanic||[]).map(x=>[esc(x.mechanic||"-"),x.count,money(x.total)]))}</div>
        <div class="card card-pad">${pageShell("Spare Part Terlaris","Bulan berjalan")}
          ${simpleTable(["Kode","Nama","Qty","Omzet"],(d.topParts||[]).map(x=>[esc(x.code),esc(x.name),x.qty,money(x.total)]))}</div>
      </div>
      <div class="card card-pad" style="margin-top:16px">
        ${pageShell("Export Laporan","Data dapat diunduh dalam format Excel")}
        <div class="toolbar">
          <button class="btn btn-soft" onclick="MMApp.exportReport('sales')">Export Penjualan</button>
          <button class="btn btn-soft" onclick="MMApp.exportReport('mechanic')">Export by Mekanik</button>
          <button class="btn btn-soft" onclick="MMApp.exportReport('stock')">Export Stok</button>
        </div>
      </div>`;
  }catch(e){view.innerHTML=`<div class="card card-pad"><div class="empty">${esc(e.message)}</div></div>`}
}
function statCard(a,b,c){return `<div class="card stat"><span class="dot"></span><div class="label">${a}</div><div class="value">${b}</div><div class="sub">${c}</div></div>`}
function renderBars(rows){
  const vals=rows.map(x=>Number(x.total||0)); const max=Math.max(1,...vals);
  return rows.map(x=>`<div class="bar-wrap"><div class="bar" style="height:${Math.max(8,Math.round(Number(x.total||0)/max*150))}px"></div><div class="cap">${esc(x.label)}</div></div>`).join("");
}
function stockAlertTable(rows){
  return simpleTable(["Kode","Nama","Stok","Min","Status"],rows.map(x=>[
    esc(x.code),esc(x.name),x.qty,x.minStock,
    x.qty<=0?'<span class="badge badge-danger">Habis</span>':'<span class="badge badge-warning">Menipis</span>'
  ]));
}
function simpleTable(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join(""):emptyRow(headers.length)}</tbody></table></div>`;}

async function renderSales(view){
  const branch=state.session.branchId;
  state.sale={type:state.sale.type||"retail",items:[],customer:"",phone:"",plate:"",vehicle:"",mileage:"",mechanic:"",discount:0,payment:0};
  view.innerHTML=`
    <div class="tabs">
      <button class="tab ${state.sale.type==="retail"?"active":""}" id="saleRetailTab">Spare Part Retail</button>
      <button class="tab ${state.sale.type==="service"?"active":""}" id="saleServiceTab">Jasa Service + Spare Part</button>
    </div>
    <div id="saleForm"></div>`;
  $("saleRetailTab").onclick=()=>{state.sale.type="retail";renderSales(view)}
  $("saleServiceTab").onclick=()=>{state.sale.type="service";renderSales(view)}
  $("saleForm").innerHTML=`<div class="pos-layout">
    <div>
      <div class="card card-pad">
        ${pageShell("Pilih Barang / Jasa","Ketik kode, barcode atau nama")}
        <div class="toolbar">
          <div class="field" style="flex:1;min-width:230px"><input id="saleSearch" placeholder="Cari spare part..."></div>
          <button class="btn btn-soft" id="addSaleItemBtn">Tambah Spare Part Manual</button>
        </div>
        <div id="saleSearchResult" style="margin-top:12px"></div>
      </div>
      ${state.sale.type==="service"?`<div class="card card-pad" style="margin-top:16px">
        ${pageShell("Data Service","Informasi kendaraan dan mekanik")}
        <div class="form-grid">
          ${field("Pelanggan","saleCustomer","text","")}${field("No. HP","salePhone","text","")}
          ${field("Plat Nomor","salePlate","text","")}${field("Kendaraan","saleVehicle","text","")}
          ${field("KM","saleMileage","number","0")}${selectField("Mekanik","saleMechanic",state.users.filter(u=>u.role==="MEKANIK").map(u=>[u.id,u.name]))}
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-outline" id="addServiceBtn">Tambah Jasa</button>
        </div>
        <div id="serviceResult" style="margin-top:12px"></div>
      </div>`:""}
    </div>
    <div class="card card-pad cart">
      ${pageShell("Keranjang","Transaksi saat ini")}
      <div id="cartLines"></div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr;margin-top:12px">
        <label>Diskon<input id="saleDiscount" type="number" value="0" min="0"></label>
        <label>Bayar<input id="salePayment" type="number" value="0" min="0"></label>
      </div>
      <div id="saleTotals" style="margin-top:12px"></div>
      <button class="btn btn-primary btn-block" id="saveSaleBtn">Simpan & Cetak Nota</button>
    </div>
  </div>`;
  bindSale(view);
}
function field(label,id,type="text",value=""){return `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}"></label>`}
function selectField(label,id,opts){return `<label>${label}<select id="${id}"><option value="">Pilih...</option>${opts.map(o=>`<option value="${o[0]}">${esc(o[1])}</option>`).join("")}</select></label>`}
function bindSale(view){
  const s=$("saleSearch"), res=$("saleSearchResult");
  s.oninput=()=>{const q=s.value.toLowerCase();const rows=state.parts.filter(p=>p.active && (p.code.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||(p.barcode||"").toLowerCase().includes(q))).slice(0,12);res.innerHTML=rows.map(p=>`<div class="card card-pad" style="margin:6px 0;padding:12px;display:flex;justify-content:space-between;align-items:center"><div><strong>${esc(p.code)} • ${esc(p.name)}</strong><div class="muted">Stok ${getStock(p.id)} • ${money(p.sellPrice)}</div></div><button class="btn btn-soft" onclick="MMApp.addSalePart('${p.id}')">Tambah</button></div>`).join("")||`<div class="empty">Tidak ada barang.</div>`}
  $("addSaleItemBtn").onclick=()=>manualSalePart();
  if($("addServiceBtn")) $("addServiceBtn").onclick=manualService;
  $("saleDiscount").oninput=()=>{state.sale.discount=num($("saleDiscount").value);renderCart()};
  $("salePayment").oninput=()=>{state.sale.payment=num($("salePayment").value);renderCart()};
  $("saveSaleBtn").onclick=saveSale;
  renderCart();
}
function getStock(partId){return Number(state.dashboard?.stockByPart?.[partId]??0)}
window.MMApp = {
  addSalePart(partId){
    const p=state.parts.find(x=>x.id===partId);if(!p)return;
    const existing=state.sale.items.find(i=>i.type==="PART"&&i.refId===partId);
    if(existing) existing.qty++; else state.sale.items.push({type:"PART",refId:p.id,code:p.code,name:p.name,qty:1,price:Number(p.sellPrice),discount:0});
    renderCart();
  }
};
function manualSalePart(){
  const p=prompt("Masukkan kode spare part:");
  if(!p)return;
  const item=state.parts.find(x=>x.code.toLowerCase()===p.toLowerCase());
  if(!item){toast("Kode spare part tidak ditemukan","error");return}
  MMApp.addSalePart(item.id);
}
function manualService(){
  const id=prompt("Masukkan kode jasa:");
  if(!id)return;
  const svc=state.services.find(x=>x.code.toLowerCase()===id.toLowerCase());
  if(!svc){toast("Kode jasa tidak ditemukan","error");return}
  state.sale.items.push({type:"SERVICE",refId:svc.id,code:svc.code,name:svc.name,qty:1,price:Number(svc.price),discount:0});
  renderCart();
}
function renderCart(){
  const el=$("cartLines"); if(!el)return;
  el.innerHTML=state.sale.items.length?state.sale.items.map((i,idx)=>`<div class="cart-line"><div><div class="name">${esc(i.code)} • ${esc(i.name)}</div><small>${i.type==="SERVICE"?"Jasa":"Spare Part"} • ${money(i.price)}</small></div><input type="number" min="1" value="${i.qty}" onchange="MMApp.changeSaleQty(${idx},this.value)"><strong>${money(i.qty*i.price)}</strong><button class="icon-link" onclick="MMApp.removeSaleItem(${idx})">×</button></div>`).join(""):`<div class="empty">Keranjang masih kosong.</div>`;
  const parts=state.sale.items.filter(x=>x.type==="PART").reduce((a,x)=>a+x.qty*x.price,0);
  const services=state.sale.items.filter(x=>x.type==="SERVICE").reduce((a,x)=>a+x.qty*x.price,0);
  const subtotal=parts+services, grand=Math.max(0,subtotal-num(state.sale.discount)), change=Math.max(0,num(state.sale.payment)-grand);
  $("saleTotals").innerHTML=`<div class="total-line"><span>Total Jasa</span><b>${money(services)}</b></div><div class="total-line"><span>Total Spare Part</span><b>${money(parts)}</b></div><div class="total-line"><span>Diskon</span><b>${money(state.sale.discount)}</b></div><div class="total-line grand"><span>Grand Total</span><b>${money(grand)}</b></div><div class="total-line"><span>Kembalian</span><b>${money(change)}</b></div>`;
}
MMApp.changeSaleQty=(idx,v)=>{state.sale.items[idx].qty=Math.max(1,parseInt(v||1));renderCart()};
MMApp.removeSaleItem=idx=>{state.sale.items.splice(idx,1);renderCart()};
async function saveSale(){
  if(!state.sale.items.length){toast("Keranjang masih kosong","error");return}
  if(state.sale.type==="service"){
    state.sale.customer=$("saleCustomer")?.value||"";
    state.sale.phone=$("salePhone")?.value||"";
    state.sale.plate=$("salePlate")?.value||"";
    state.sale.vehicle=$("saleVehicle")?.value||"";
    state.sale.mileage=$("saleMileage")?.value||"";
    state.sale.mechanic=$("saleMechanic")?.value||"";
    if(!state.sale.mechanic){toast("Mekanik wajib dipilih","error");return}
  }
  const parts=state.sale.items.filter(i=>i.type==="PART");
  for(const i of parts){ if(i.qty>getStock(i.refId)){toast(`Stok ${i.name} tidak mencukupi`,"error");return} }
  const subtotal=state.sale.items.reduce((a,i)=>a+i.qty*i.price,0), grand=Math.max(0,subtotal-num(state.sale.discount));
  if(num(state.sale.payment)<grand){toast("Pembayaran kurang","error");return}
  try{
    const res=await api("saveSale",{branchId:state.session.branchId,sale:{...state.sale,subtotal,grandTotal:grand}});
    toast(`Penjualan ${res.invoiceNo} berhasil`,"success");
    printReceipt(res.receipt);
    state.dashboard=null;
    renderPage("sales");
  }catch(e){toast(e.message,"error")}
}

async function renderPurchase(view){
  view.innerHTML=`
  <div class="tabs">
    <button class="tab active" id="purchaseManualTab">Pembelian Manual / Individual</button>
    <button class="tab" id="purchaseRecoTab">Pembelian Rekomendasi 6 Bulan</button>
  </div>
  <div id="purchaseBody"></div>`;
  const showManual=()=>{
    $("purchaseManualTab").classList.add("active");$("purchaseRecoTab").classList.remove("active");renderPurchaseManual();
  };
  const showReco=()=>{
    $("purchaseManualTab").classList.remove("active");$("purchaseRecoTab").classList.add("active");renderPurchaseReco();
  };
  $("purchaseManualTab").onclick=showManual;$("purchaseRecoTab").onclick=showReco;showManual();
}
function renderPurchaseManual(){
  const el=$("purchaseBody");
  state.purchase={method:"manual",items:[]};
  el.innerHTML=`<div class="card card-pad">
    ${pageShell("Pembelian Manual / Individual","Masukkan pembelian berdasarkan kebutuhan/insting")}
    <div class="form-grid">
      ${selectField("Supplier","purchaseSupplier",state.suppliers.filter(s=>s.active).map(s=>[s.id,s.name]))}
      ${field("Catatan","purchaseNotes","text","")}
      ${field("Cari Spare Part","purchaseSearch","text","")}
    </div>
    <div id="purchaseSearchResult" style="margin-top:12px"></div>
    <div style="margin-top:16px" id="purchaseItems"></div>
    <div class="toolbar" style="margin-top:16px;justify-content:flex-end">
      <button class="btn btn-primary" id="savePurchaseBtn">Simpan & Cetak PO</button>
    </div>
  </div>`;
  $("purchaseSearch").oninput=()=>purchaseSearch();
  $("savePurchaseBtn").onclick=savePurchase;
  renderPurchaseItems();
}
function purchaseSearch(){
  const q=$("purchaseSearch").value.toLowerCase();const rows=state.parts.filter(p=>p.active && (p.code.toLowerCase().includes(q)||p.name.toLowerCase().includes(q))).slice(0,10);
  $("purchaseSearchResult").innerHTML=rows.map(p=>`<div class="card card-pad" style="margin:6px 0;padding:10px;display:flex;justify-content:space-between"><span><b>${esc(p.code)} • ${esc(p.name)}</b><small>Stok ${getStock(p.id)}</small></span><button class="btn btn-soft" onclick="MMApp.addPurchasePart('${p.id}')">Tambah</button></div>`).join("");
}
MMApp.addPurchasePart=partId=>{
  const p=state.parts.find(x=>x.id===partId);if(!p)return;
  const ex=state.purchase.items.find(i=>i.partId===partId); if(ex) ex.qtyOrder++; else state.purchase.items.push({partId:p.id,code:p.code,name:p.name,qtyOrder:1,buyPrice:Number(p.buyPrice||0),discount:0,location:p.location||""});
  renderPurchaseItems();
};
function renderPurchaseItems(){
  const el=$("purchaseItems");if(!el)return;
  if(!state.purchase.items.length){el.innerHTML=`<div class="empty">Belum ada item pembelian.</div>`;return}
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th><th>Qty</th><th>Harga Beli</th><th>Lokasi</th><th>Total</th><th></th></tr></thead><tbody>${state.purchase.items.map((i,idx)=>`<tr><td>${esc(i.code)}</td><td>${esc(i.name)}</td><td><input type="number" min="1" value="${i.qtyOrder}" style="width:80px" onchange="MMApp.changePurchaseQty(${idx},this.value)"></td><td><input type="number" min="0" value="${i.buyPrice}" style="width:120px" onchange="MMApp.changePurchasePrice(${idx},this.value)"></td><td><input value="${esc(i.location)}" onchange="MMApp.changePurchaseLoc(${idx},this.value)" style="width:130px"></td><td>${money(i.qtyOrder*i.buyPrice)}</td><td><button class="icon-link" onclick="MMApp.removePurchase(${idx})">×</button></td></tr>`).join("")}</tbody></table></div>`}
MMApp.changePurchaseQty=(i,v)=>{state.purchase.items[i].qtyOrder=Math.max(1,parseInt(v||1));renderPurchaseItems()};
MMApp.changePurchasePrice=(i,v)=>{state.purchase.items[i].buyPrice=num(v);renderPurchaseItems()};
MMApp.changePurchaseLoc=(i,v)=>{state.purchase.items[i].location=v;renderPurchaseItems()};
MMApp.removePurchase=i=>{state.purchase.items.splice(i,1);renderPurchaseItems()};
async function savePurchase(){
  if(!state.purchase.items.length){toast("Item pembelian belum ada","error");return}
  const supplierId=$("purchaseSupplier").value;if(!supplierId){toast("Supplier wajib dipilih","error");return}
  try{
    const res=await api("savePurchase",{branchId:state.session.branchId,purchase:{...state.purchase,supplierId,notes:$("purchaseNotes").value}});
    toast(`PO ${res.poNo} berhasil`,"success"); printReceipt(res.receipt); renderPage("purchase");
  }catch(e){toast(e.message,"error")}
}
async function renderPurchaseReco(){
  const el=$("purchaseBody"); el.innerHTML=`<div class="card card-pad"><div class="empty">Menghitung rekomendasi...</div></div>`;
  try{
    const data=await api("purchaseRecommendation",{branchId:state.session.branchId});
    el.innerHTML=`<div class="card card-pad">
      ${pageShell("Pembelian Rekomendasi","Average demand 6 bulan • pilih dengan checkbox untuk membuat PO",
        `<button class="btn btn-primary" id="generateRecoPoBtn">Buat PO dari Pilihan</button>`)}
      <div class="notice" style="margin-bottom:12px">Rumus: target = max(stok minimum, average 6 bulan × coverage × (1 + safety factor)); qty rekomendasi = max(target - stok saat ini, 0). Parameter dapat diubah ADMIN di Setting.</div>
      <div class="table-wrap"><table id="recoTable"><thead><tr><th><input type="checkbox" id="selectAllReco"></th><th>Kode</th><th>Nama</th><th>Stok</th>${[1,2,3,4,5,6].map(i=>`<th>M-${i}</th>`).join("")}<th>Avg 6B</th><th>Min</th><th>Rekom.</th><th>Qty PO</th></tr></thead>
      <tbody>${data.items.map((x,i)=>`<tr>
        <td><input type="checkbox" class="reco-check" data-i="${i}" ${x.recommendQty>0?"checked":""}></td>
        <td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${x.stock}</td>
        ${x.months.map(v=>`<td>${v}</td>`).join("")}
        <td><b>${x.avg6.toFixed(2)}</b></td><td>${x.minStock}</td><td>${x.recommendQty}</td>
        <td><input type="number" class="reco-qty" data-i="${i}" value="${x.recommendQty}" min="0" style="width:75px"></td>
      </tr>`).join("")}</tbody></table></div>
    </div>`;
    $("selectAllReco").onchange=e=>document.querySelectorAll(".reco-check").forEach(c=>c.checked=e.target.checked);
    $("generateRecoPoBtn").onclick=()=>generateRecoPo(data.items);
  }catch(e){el.innerHTML=`<div class="card card-pad"><div class="empty">${esc(e.message)}</div></div>`}
}
async function generateRecoPo(items){
  const supplierId=prompt("Masukkan ID supplier (bisa disesuaikan di Setting):");if(!supplierId)return;
  const selected=[...document.querySelectorAll(".reco-check:checked")].map(c=>Number(c.dataset.i)).map(i=>({...items[i],qtyOrder:num(document.querySelector(`.reco-qty[data-i="${i}"]`).value)})).filter(x=>x.qtyOrder>0);
  if(!selected.length){toast("Belum ada item dipilih","error");return}
  try{
    const res=await api("savePurchase",{branchId:state.session.branchId,purchase:{
      method:"recommendation",supplierId,notes:"PO dari rekomendasi average demand 6 bulan",
      items:selected.map(x=>({partId:x.partId,code:x.code,name:x.name,qtyOrder:x.qtyOrder,buyPrice:x.buyPrice,discount:0,location:x.location}))
    }});
    toast(`PO ${res.poNo} berhasil dibuat`,"success");printReceipt(res.receipt);renderPage("purchase");
  }catch(e){toast(e.message,"error")}
}

async function renderReceiving(view){
  view.innerHTML=`<div class="card card-pad">
    ${pageShell("Terima Barang","Masukkan nomor PO untuk menerima barang")}
    <div class="toolbar"><div class="field" style="min-width:260px"><input id="grnPoNo" placeholder="Nomor PO"></div><button class="btn btn-primary" id="loadPoBtn">Cari PO</button></div>
    <div id="poArea" style="margin-top:16px"></div>
  </div>`;
  $("loadPoBtn").onclick=loadPurchaseForReceiving;
}
async function loadPurchaseForReceiving(){
  const poNo=$("grnPoNo").value.trim(); if(!poNo)return;
  try{
    const d=await api("getPurchaseForReceiving",{poNo,branchId:state.session.branchId});
    state.receiving=d;
    $("poArea").innerHTML=`<div class="notice">Supplier: <b>${esc(d.supplierName)}</b> • Status PO: <b>${esc(d.status)}</b></div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Kode</th><th>Nama</th><th>Order</th><th>Sudah Terima</th><th>Sisa</th><th>Qty Datang</th><th>Harga Aktual</th><th>Lokasi</th></tr></thead><tbody>
      ${d.items.map((x,i)=>`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${x.qtyOrder}</td><td>${x.qtyReceived}</td><td>${x.remaining}</td>
      <td><input type="number" min="0" max="${x.remaining}" value="0" class="receive-qty" data-i="${i}" style="width:90px"></td>
      <td><input type="number" min="0" value="${x.buyPrice}" class="receive-price" data-i="${i}" style="width:120px"></td>
      <td><input value="${esc(x.location)}" class="receive-loc" data-i="${i}" style="width:120px"></td></tr>`).join("")}</tbody></table></div>
      <div class="toolbar" style="margin-top:12px;justify-content:flex-end"><button class="btn btn-primary" id="saveReceiveBtn">Simpan & Cetak Nota Terima</button></div>`;
    $("saveReceiveBtn").onclick=saveReceiving;
  }catch(e){toast(e.message,"error")}
}
async function saveReceiving(){
  const items=state.receiving.items.map((x,i)=>({...x,qty:num(document.querySelector(`.receive-qty[data-i="${i}"]`).value),buyPrice:num(document.querySelector(`.receive-price[data-i="${i}"]`).value),location:document.querySelector(`.receive-loc[data-i="${i}"]`).value})).filter(x=>x.qty>0);
  if(!items.length){toast("Tidak ada barang yang diterima","error");return}
  try{
    const res=await api("saveReceiving",{branchId:state.session.branchId,receiving:{purchaseId:state.receiving.purchaseId,items}});
    toast(`Penerimaan ${res.grnNo} berhasil`,"success");printReceipt(res.receipt);renderPage("receiving");
  }catch(e){toast(e.message,"error")}
}

async function renderHistory(view){
  view.innerHTML=`<div class="tabs">
    ${["sales","purchases","receiving"].map((t,i)=>`<button class="tab ${state.historyTab===t?"active":""}" data-ht="${t}">${["Penjualan","Pembelian","Penerimaan"][i]}</button>`).join("")}
  </div><div class="card card-pad"><div id="historyBody">Memuat...</div></div>`;
  view.querySelectorAll("[data-ht]").forEach(b=>b.onclick=()=>{state.historyTab=b.dataset.ht;renderHistory(view)});
  try{
    const data=await api("history",{branchId:state.session.branchId,days:31,type:state.historyTab});
    $("historyBody").innerHTML=`${pageShell("History 1 Bulan","Klik detail untuk cetak ulang")}
      ${historyTable(data,state.historyTab)}`;
    document.querySelectorAll("[data-print-ref]").forEach(b=>b.onclick=async()=>{const d=await api("transactionDetail",{id:b.dataset.printRef,type:b.dataset.type});printReceipt(d.receipt)});
  }catch(e){$("historyBody").innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}
function historyTable(data,type){
  if(type==="sales") return simpleTable(["Nota","Tanggal","Cabang","Pelanggan","Mekanik","Total",""],data.map(x=>[esc(x.invoiceNo),fmtDate(x.dateTime),esc(x.branchName),esc(x.customer||"-"),esc(x.mechanic||"-"),money(x.grandTotal),`<button class="btn btn-soft" data-print-ref="${x.id}" data-type="sales">Cetak</button>`]));
  if(type==="purchases") return simpleTable(["PO","Tanggal","Supplier","Total","Status",""],data.map(x=>[esc(x.poNo),fmtDate(x.dateTime),esc(x.supplierName),money(x.total),`<span class="badge badge-neutral">${esc(x.status)}</span>`,`<button class="btn btn-soft" data-print-ref="${x.id}" data-type="purchases">Cetak</button>`]));
  return simpleTable(["GRN","Tanggal","PO","Supplier","Total Qty",""],data.map(x=>[esc(x.grnNo),fmtDate(x.dateTime),esc(x.poNo),esc(x.supplierName),x.totalQty,`<button class="btn btn-soft" data-print-ref="${x.id}" data-type="receiving">Cetak</button>`]));
}

async function renderSettings(view){
  if(!hasPerm("settings")){view.innerHTML=`<div class="card card-pad"><div class="empty">Akses ditolak.</div></div>`;return}
  view.innerHTML=`<div class="tabs">
    <button class="tab active" data-st="users">Karyawan & Otorisasi</button>
    <button class="tab" data-st="parts">Spare Part</button>
    <button class="tab" data-st="services">Jasa</button>
    <button class="tab" data-st="suppliers">Supplier</button>
    <button class="tab" data-st="branches">Cabang</button>
    <button class="tab" data-st="params">Parameter</button>
  </div><div id="settingsBody"></div>`;
  view.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>{view.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderSettingTab(b.dataset.st)});
  renderSettingTab("users");
}
async function renderSettingTab(tab){
  const el=$("settingsBody");
  if(tab==="users") return renderUsersSetting(el);
  if(tab==="parts") return renderPartsSetting(el);
  if(tab==="services") return renderServicesSetting(el);
  if(tab==="suppliers") return renderSuppliersSetting(el);
  if(tab==="branches") return renderBranchesSetting(el);
  if(tab==="params") return renderParamsSetting(el);
}
function renderUsersSetting(el){
  const perms=["dashboard","sales","purchase","receiving","history","settings"];
  el.innerHTML=`<div class="card card-pad">
    ${pageShell("Karyawan & Otorisasi","ADMIN dapat menentukan akses setiap user",`<button class="btn btn-primary" id="addUserBtn">Tambah Karyawan</button>`)}
    <div class="table-wrap"><table><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Cabang</th><th>Aktif</th><th>Permission</th><th>Aksi</th></tr></thead><tbody>
      ${state.users.length?state.users.map(u=>`<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(state.branches.find(b=>b.id===u.branchId)?.name||"Semua")}</td><td>${u.active?'<span class="badge badge-success">Aktif</span>':'<span class="badge badge-danger">Nonaktif</span>'}</td><td>${esc((u.permissions||[]).join(", "))}</td><td><button class="btn btn-soft" onclick='MMApp.editUser(${JSON.stringify(u).replace(/'/g,"&#39;")})'>Edit</button></td></tr>`).join(""):emptyRow(7)}</tbody></table></div>
  </div>`;
  $("addUserBtn").onclick=()=>userModal(perms,null);
}
function userModal(perms,current){
  const values=current||{};
  modal(current?"Edit Karyawan":"Tambah Karyawan",`<div class="form-grid">
    ${field("Nama","mUserName","text",values.name||"")} ${field("Username","mUsername","text",values.username||"")}
    ${field(current?"Password baru (kosongkan = tetap)":"Password","mPassword","password","")} ${selectField("Role","mRole",[["ADMIN","ADMIN"],["KASIR","KASIR"],["MEKANIK","MEKANIK"],["USER","USER"]])}
    ${selectField("Cabang","mBranch",state.branches.map(b=>[b.id,b.name]))}
    <label class="form-span-4">Permission${perms.map(p=>`<span style="margin-right:12px;font-weight:500"><input type="checkbox" class="perm" value="${p}" ${current?.permissions?.includes(p)?"checked":""}> ${p}</span>`).join("")}</label>
  </div>`,async ()=>{
    const permissions=[...document.querySelectorAll(".perm:checked")].map(x=>x.value);
    try{await api("saveUser",{user:{id:current?.id||"",name:$("mUserName").value,username:$("mUsername").value,password:$("mPassword").value,role:$("mRole").value,branchId:$("mBranch").value,permissions,active:true}});closeModal();await hydrate();renderPage("settings");toast("User tersimpan","success")}catch(e){toast(e.message,"error")}
  },"Simpan");
  if(values.role) $("mRole").value=values.role; if(values.branchId) $("mBranch").value=values.branchId;
}
MMApp.editUser = u => userModal(["dashboard","sales","purchase","receiving","history","settings"],u);
function renderPartsSetting(el){
  el.innerHTML=`<div class="card card-pad">${pageShell("Data Spare Part","CRUD data spare part",`<button class="btn btn-primary" id="addPartBtn">Tambah Spare Part</button>`)}${simpleTable(["Kode","Nama","Harga Beli","Harga Jual","Lokasi","Min","Status"],state.parts.map(p=>[esc(p.code),esc(p.name),money(p.buyPrice),money(p.sellPrice),esc(p.location),p.minStock,p.active?"Aktif":"Nonaktif"]))}</div>`;
  $("addPartBtn").onclick=()=>partModal();
}
function partModal(existing=null){
  modal(existing?"Edit Spare Part":"Tambah Spare Part",`<div class="form-grid">
    ${field("Kode","mCode","text",existing?.code||"")} ${field("Barcode","mBarcode","text",existing?.barcode||"")}
    ${field("Nama","mPartName","text",existing?.name||"")} ${field("Merk","mBrand","text",existing?.brand||"")}
    ${field("Kategori","mCategory","text",existing?.category||"")} ${field("Satuan","mUnit","text",existing?.unit||"PCS")}
    ${field("Harga Beli","mBuy","number",existing?.buyPrice||0)} ${field("Harga Jual","mSell","number",existing?.sellPrice||0)}
    ${field("Lokasi","mLocation","text",existing?.location||"")} ${field("Stok Minimum","mMin","number",existing?.minStock||0)}
  </div>`,async()=>{
    try{await api("savePart",{part:{id:existing?.id||"",code:$("mCode").value,barcode:$("mBarcode").value,name:$("mPartName").value,brand:$("mBrand").value,category:$("mCategory").value,unit:$("mUnit").value,buyPrice:num($("mBuy").value),sellPrice:num($("mSell").value),location:$("mLocation").value,minStock:num($("mMin").value),maxStock:0,active:true}});closeModal();await hydrate();renderPage("settings");toast("Spare part tersimpan","success")}catch(e){toast(e.message,"error")}
  },"Simpan");
}
function renderServicesSetting(el){
  el.innerHTML=`<div class="card card-pad">${pageShell("Data Jasa","CRUD jasa service",`<button class="btn btn-primary" id="addSvcBtn">Tambah Jasa</button>`)}${simpleTable(["Kode","Nama Jasa","Harga","Durasi"],state.services.map(s=>[esc(s.code),esc(s.name),money(s.price),esc(s.duration||"-")]))}</div>`;
  $("addSvcBtn").onclick=()=>modal("Tambah Jasa",`<div class="form-grid">${field("Kode","mSvcCode")}${field("Nama Jasa","mSvcName")}${field("Harga","mSvcPrice","number",0)}${field("Durasi","mSvcDuration")}</div>`,async()=>{try{await api("saveService",{service:{code:$("mSvcCode").value,name:$("mSvcName").value,price:num($("mSvcPrice").value),duration:$("mSvcDuration").value,active:true}});closeModal();await hydrate();renderSettingTab("services");toast("Jasa tersimpan","success")}catch(e){toast(e.message,"error")}},"Simpan");
}
function renderSuppliersSetting(el){
  el.innerHTML=`<div class="card card-pad">${pageShell("Supplier","Master supplier",`<button class="btn btn-primary" id="addSupBtn">Tambah Supplier</button>`)}${simpleTable(["Kode","Nama","Telepon","PIC"],state.suppliers.map(s=>[esc(s.code),esc(s.name),esc(s.phone||"-"),esc(s.pic||"-")]))}</div>`;
  $("addSupBtn").onclick=()=>modal("Tambah Supplier",`<div class="form-grid">${field("Kode","mSupCode")}${field("Nama","mSupName")}${field("Telepon","mSupPhone")}${field("PIC","mSupPic")}${field("Alamat","mSupAddress","text","")}</div>`,async()=>{try{await api("saveSupplier",{supplier:{code:$("mSupCode").value,name:$("mSupName").value,phone:$("mSupPhone").value,pic:$("mSupPic").value,address:$("mSupAddress").value,active:true}});closeModal();await hydrate();renderSettingTab("suppliers");toast("Supplier tersimpan","success")}catch(e){toast(e.message,"error")}},"Simpan");
}
function renderBranchesSetting(el){
  el.innerHTML=`<div class="card card-pad">${pageShell("Cabang","Dua cabang Moyashi Motor dapat digunakan terpisah")}
    ${simpleTable(["Kode","Nama","Status"],state.branches.map(b=>[esc(b.code),esc(b.name),b.active?"Aktif":"Nonaktif"]))}
  </div>`;
}
function renderParamsSetting(el){
  const s=state.settings||{};
  el.innerHTML=`<div class="card card-pad">${pageShell("Parameter Pembelian","Digunakan oleh rekomendasi average demand 6 bulan")}
    <div class="form-grid">
      ${field("Periode Average (bulan)","pAvg","number",s.AVG_MONTHS||6)}
      ${field("Coverage (bulan)","pCoverage","number",s.COVERAGE_MONTHS||1)}
      ${field("Safety Factor (%)","pSafety","number",Number(s.SAFETY_FACTOR||0)*100)}
    </div>
    <div class="toolbar" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-primary" id="saveParamsBtn">Simpan Parameter</button></div>
  </div>`;
  $("saveParamsBtn").onclick=async()=>{try{await api("saveSettings",{settings:{AVG_MONTHS:num($("pAvg").value)||6,COVERAGE_MONTHS:num($("pCoverage").value)||1,SAFETY_FACTOR:num($("pSafety").value)/100}});toast("Parameter disimpan","success");await hydrate()}catch(e){toast(e.message,"error")}}
}

function modal(title,body,onSave,saveText="Simpan"){
  const wrap=document.createElement("div");wrap.className="modal";wrap.id="modal";
  wrap.innerHTML=`<div class="modal-card"><div class="modal-head"><strong>${esc(title)}</strong><button class="icon-link" id="closeModalBtn">Tutup</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button class="btn btn-outline" id="cancelModalBtn">Batal</button><button class="btn btn-primary" id="saveModalBtn">${saveText}</button></div></div>`;
  document.body.appendChild(wrap);$("closeModalBtn").onclick=closeModal;$("cancelModalBtn").onclick=closeModal;$("saveModalBtn").onclick=onSave;
}
function closeModal(){$("modal")?.remove()}

async function exportReport(type){
  try{
    const data=await api("exportReport",{branchId:state.session.branchId,type,days:31});
    downloadXls(data.filename,data.headers,data.rows);
  }catch(e){toast(e.message,"error")}
}
function downloadXls(filename,headers,rows){
  const table=`<table><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  const blob=new Blob([`<html><meta charset="utf-8"><body>${table}</body></html>`],{type:"application/vnd.ms-excel"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
}

function printReceipt(r){
  const w=window.open("","_blank","width=430,height=720"); if(!w){toast("Izinkan pop-up untuk mencetak nota","error");return}
  w.document.write(`<html><head><title>${esc(r.title||"Nota Moyashi Motor")}</title><style>
  *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:10px;color:#111}
  .receipt{width:58mm;margin:auto;font-size:11px}.wide{width:80mm}.c{text-align:center}.b{font-weight:800}
  .muted{color:#555}.line{border-top:1px dashed #333;margin:8px 0}.row{display:flex;justify-content:space-between;gap:8px}
  table{width:100%;border-collapse:collapse}td,th{padding:3px 0;font-size:10px;text-align:left}td:last-child,th:last-child{text-align:right}
  @media print{button{display:none}} </style></head><body><div class="receipt">
    <div class="c b">${esc(r.businessName||"MOYASHI MOTOR")}</div>
    <div class="c">${esc(r.branchName||"")}</div><div class="c muted">${esc(r.title||"NOTA")}</div>
    <div class="line"></div>${(r.meta||[]).map(x=>`<div class="row"><span>${esc(x[0])}</span><span>${esc(x[1])}</span></div>`).join("")}
    <div class="line"></div><table><tbody>${(r.items||[]).map(x=>`<tr><td>${esc(x.name)}<br><span class="muted">${x.qty} × ${money(x.price)}</span></td><td>${money(x.subtotal)}</td></tr>`).join("")}</tbody></table>
    <div class="line"></div>${(r.totals||[]).map(x=>`<div class="row ${x.bold?"b":""}"><span>${esc(x[0])}</span><span>${money(x[1])}</span></div>`).join("")}
    <div class="line"></div><div class="c">${esc(r.footer||"Terima kasih telah berkunjung.")}</div>
  </div><script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
}

window.MMApp.exportReport=exportReport;
boot();
})();