export default async function (page) {
  const problems=[], calls=[];
  page.on('console',(m)=>{if(m.type()==='error')problems.push(m.text().slice(0,150));});
  page.on('response',(r)=>{const u=r.url();
    if(u.includes('azurecontainerapps')&&r.request().method()==='POST')calls.push(`${r.status()} ${u.replace(/.*\/api\//,'')}`);});
  await page.waitForTimeout(3000);
  await page.fill('input[type="email"]','user@admin.com');
  await page.fill('input[type="password"]','12345678');
  await page.click('button[type="submit"]');
  let token=null;
  for(let i=0;i<60&&!token;i++){await page.waitForTimeout(1000);
    token=await page.evaluate(()=>{const r=document.cookie.split('; ').find(c=>c.startsWith('houseiana_session='));
      if(!r)return null;try{return JSON.parse(decodeURIComponent(r.split('=').slice(1).join('='))).token}catch{return null}});}
  if(!token) return {fatal:'login'};
  const origin=new URL(page.url()).origin;
  const api='https://houseiana-api.jollyisland-881a1746.eastus.azurecontainerapps.io';
  const HID='b1850bbb-c8ee-4b64-9a2f-34489692608f';
  const read=async()=>{const d=await page.evaluate(async([u,t])=>(await fetch(u,{headers:{Authorization:`Bearer ${t}`}})).json(),[`${api}/api/hotels/${HID}`,token]);
    const r=((d.data??d).roomTypes[0]||{}).ratePlans||[];
    return r.map(p=>`${p.boardBasis} | ${p.cancellationPolicyType} | h=${p.freeCancellationHours} d=${p.freeCancellationDays}`);};

  const before=await read();
  await page.goto(`${origin}/ar/hotels/${HID}/edit?step=rooms`,{waitUntil:'networkidle'});
  await page.waitForTimeout(9000);

  const sel=page.locator('select[aria-label="الإلغاء"]').first();
  const options=await sel.evaluate(s=>[...s.options].map(o=>o.text));
  const initial=await sel.inputValue();

  // the case that used to snap back
  await sel.selectOption({ label: 'إلغاء مجاني · ٧ أيام' });
  await page.waitForTimeout(1800);
  const afterPick=await sel.inputValue();

  // and again after a re-render
  await page.goto(`${origin}/ar/hotels/${HID}/edit?step=review`,{waitUntil:'networkidle'});
  await page.waitForTimeout(4000);
  await page.goto(`${origin}/ar/hotels/${HID}/edit?step=rooms`,{waitUntil:'networkidle'});
  await page.waitForTimeout(8000);
  const survived=await page.locator('select[aria-label="الإلغاء"]').first().inputValue();

  await page.goto(`${origin}/ar/hotels/${HID}/edit?step=review`,{waitUntil:'networkidle'});
  await page.waitForTimeout(5000);
  calls.length=0;
  const btn=page.locator('button',{hasText:/حفظ التعديلات/}).first();
  if(await btn.count() && await btn.isEnabled()) await btn.click();
  await page.waitForTimeout(13000);

  return { options, initial, afterPick, survived, calls, before, after: await read(), problems };
}
