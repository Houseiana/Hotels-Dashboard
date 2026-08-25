export default async function (page) {
  const problems=[];
  page.on('console',(m)=>{if(m.type()==='error')problems.push(m.text().slice(0,150));});
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
  await page.goto(`${origin}/ar/hotels/new?step=rooms`,{waitUntil:'networkidle'});
  await page.waitForTimeout(7000);
  await page.locator('button',{hasText:/إضافة نوع غرفة/}).first().click();
  await page.waitForTimeout(4000);
  const sections = await page.evaluate(() =>
    [...document.querySelectorAll('section')].map(s => {
      const head = s.querySelector('span');
      const fields = s.querySelectorAll('input, select, textarea, button[role="switch"]').length;
      return { title: head ? head.innerText.trim().replace(/\s+/g,' ').slice(0,60) : '(none)', controls: fields };
    }));
  const order = await page.evaluate(() => document.body.innerText.split('\n').filter(Boolean).slice(14, 34).join(' | ').slice(0, 340));
  return { sections, order, problems };
}
