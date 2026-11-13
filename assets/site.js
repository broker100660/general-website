const API='https://api.openbrokka.com/api/loans'; /* your backend address; confirm it is the right one */
const $=s=>document.querySelector(s),fmt=n=>'UGX '+Math.round(n).toLocaleString('en-US');
async function call(a,opt){const r=await fetch(API+'/'+a,opt),d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
const post=(a,o)=>call(a,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
const needsPrice=p=>p&&p.asset_price==null&&p.deposit_type==='percent';
const depAmt=(p,price)=>p.deposit_type==='fixed'?+p.deposit_value:(price?price*p.deposit_value/100:null);
const depLabel=p=>p.deposit_type==='fixed'?(+p.deposit_value?fmt(p.deposit_value):'None'):(p.asset_price?fmt(depAmt(p,p.asset_price)):p.deposit_value+'% of price');
const ICON={'Smartphone loans':'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>','Boda boda financing':'<circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5 9 9h5l4.5 7.5M14 9l-1-3h-2"/>','Car financing':'<path d="M3 15v-3l2-5h14l2 5v3zM3 12h18"/><circle cx="7.5" cy="16" r="1.8"/><circle cx="16.5" cy="16" r="1.8"/>','General loans':'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M8 6V4h8v2M3 12h18"/>'};
const icon=c=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON[c]||ICON['General loans'])+'</svg>';
const slug=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const page=document.body.dataset.page;

if(page==='cat'){
  call('products').then(all=>{
    const ps=all.filter(p=>p.category===document.body.dataset.cat);
    $('#list').innerHTML=ps.map(p=>'<article class="card"><div class="pic">'+icon(p.category)+'<img src="assets/products/'+slug(p.name)+'.jpg" alt="'+p.name+'" loading="lazy" onerror="this.remove()"></div><h3>'+p.name+'</h3><dl>'+
      (p.asset_price?'<div><dt>Estimated price</dt><dd>'+fmt(p.asset_price)+'</dd></div>':'')+
      '<div><dt>Application fee</dt><dd>'+fmt(p.application_fee)+'</dd></div>'+
      '<div><dt>Deposit</dt><dd>'+depLabel(p)+'</dd></div></dl>'+
      '<a class="btn" href="apply.html?p='+p.id+'">Apply for this loan</a></article>').join('')||'<p>No products listed yet.</p>';
  }).catch(()=>{$('#list').innerHTML='<p>We could not load products. Please refresh the page.</p>'});
}

if(page==='apply'){
  let P=[];const by=id=>P.find(p=>p.id==id);
  const sel=$('#fProduct');
  function sync(){
    const p=by(sel.value);if(!p)return;
    $('#fPriceWrap').hidden=!needsPrice(p);
    const d=depAmt(p,p.asset_price??(+$('#fPrice').value||null));
    $('#sFee').textContent=fmt(p.application_fee);$('#sDep').textContent=d==null?'Enter the price':fmt(d);
  }
  call('products').then(d=>{
    P=d;const g={};P.forEach(p=>(g[p.category]=g[p.category]||[]).push(p));
    sel.innerHTML=Object.entries(g).map(([c,ps])=>'<optgroup label="'+c+'">'+ps.map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join('')+'</optgroup>').join('');
    const q=new URLSearchParams(location.search).get('p');if(q&&by(q))sel.value=q;sync();
  }).catch(()=>{sel.innerHTML='<option>Products unavailable. Refresh the page.</option>'});
  sel.addEventListener('change',sync);$('#fPrice').addEventListener('input',sync);
  $('#appForm').addEventListener('submit',async e=>{
    e.preventDefault();const m=$('#appMsg'),b=$('#appGo');m.className='msg';m.textContent='';b.disabled=true;b.textContent='Please wait…';
    try{location.href=(await call('apply',{method:'POST',body:new FormData(e.target)})).redirect_url}
    catch(err){m.className='msg bad';m.textContent=err.message;b.disabled=false;b.textContent='Continue to pay application fee'}
  });
}

if(page==='track'){
  const ST={new:'Waiting for your application fee.',paid:'Application fee received. We are reviewing your application.',reviewing:'We are reviewing your application.',approved:'Approved. You can now pay your deposit.',awaiting_upload:'Deposit received. Upload your signed documents.',uploaded:'Signed documents received. We are verifying them.',complete:'Complete. Thank you for choosing KJR Ventures.',rejected:'We could not approve this application.'};
  const who=()=>({ref:$('#tRef').value,contact:$('#tContact').value}),msg=(t,c)=>{$('#trkMsg').className='msg '+(c||'');$('#trkMsg').textContent=t};
  async function track(){
    msg('');
    try{
      const s=await post('status',who());
      $('#trkOut').hidden=false;$('#trkState').textContent=ST[s.status]||s.status;
      $('#bPack').hidden=!s.fee_paid;
      $('#bDep').hidden=!(s.status==='approved'&&s.fee_paid&&!s.deposit_paid&&s.deposit_due);
      $('#bDep').textContent='Pay deposit: '+fmt(s.deposit_due||0);
      $('#upWrap').hidden=s.status!=='awaiting_upload';
    }catch(err){$('#trkOut').hidden=true;msg(err.message,'bad')}
  }
  $('#trkForm').addEventListener('submit',e=>{e.preventDefault();track()});
  $('#bPack').addEventListener('click',async()=>{
    try{const l=await post('pack',who());$('#packLinks').innerHTML=l.length?'<p class="fine">Links expire in 10 minutes.</p>'+l.map(x=>'<p><a href="'+x.url+'" target="_blank" rel="noopener">'+x.name+'</a></p>').join(''):'<p class="fine">Your loan pack is being prepared. Please check back soon.</p>'}
    catch(err){msg(err.message,'bad')}
  });
  $('#bDep').addEventListener('click',async()=>{try{location.href=(await post('deposit',who())).redirect_url}catch(err){msg(err.message,'bad')}});
  $('#bUp').addEventListener('click',async()=>{
    const f=$('#upFile').files[0];if(!f)return msg('Choose a file to upload.','bad');
    const fd=new FormData(),w=who();fd.append('ref',w.ref);fd.append('contact',w.contact);fd.append('file',f);
    try{await call('upload',{method:'POST',body:fd});track();msg('Uploaded. We will confirm once we have checked your documents.','ok')}catch(err){msg(err.message,'bad')}
  });
  const q=new URLSearchParams(location.search).get('ref');
  if(q){$('#tRef').value=q;msg('Enter the phone or email you applied with to see your payment status.')}
}
