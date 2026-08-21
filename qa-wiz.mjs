export default async function (page) {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text().slice(0,160)); });
  await page.fill('input[type="email"]','user@admin.com');
  await page.fill('input[type="password"]','12345678');
  await page.click('button[type="submit"]');
  let token=null;
  for(let i=0;i<60&&!token;i++){await page.waitForTimeout(1000);
    token=await page.evaluate(()=>{const r=document.cookie.split('; ').find(c=>c.startsWith('houseiana_session='));
      if(!r)return null;try{return JSON.parse(decodeURIComponent(r.split('=').slice(1).join('='))).token}catch{return null}});}
  if(!token) return {fatal:'login'};
  const origin=new URL(page.url()).origin;

  // --- amenities step ---
  await page.goto(`${origin}/ar/hotels/new?step=amenities`, { waitUntil:'networkidle' });
  await page.waitForTimeout(7000);
  const amenities = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('h3, h2')].map(h => h.innerText.trim()).filter(Boolean);
    const chips = [...document.querySelectorAll('button')]
      .map(b => b.innerText.trim())
      .filter(x => x && x.length < 30);
    return { groupCount: groups.length, groups: groups.slice(0, 12), chipSample: chips.slice(0, 14) };
  });

  // --- rooms step ---
  await page.goto(`${origin}/ar/hotels/new?step=rooms`, { waitUntil:'networkidle' });
  await page.waitForTimeout(6000);
  const addRoom = page.locator('button', { hasText: /إضافة نوع غرفة/ }).first();
  if (await addRoom.count()) { await addRoom.click(); await page.waitForTimeout(2500); }
  const beds = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find(s => (s.getAttribute('aria-label')||'').includes('السرير'));
    const addBed = [...document.querySelectorAll('button')].find(b => b.innerText.includes('إضافة سرير'));
    const roomAmenityChips = [...document.querySelectorAll('button')].map(b=>b.innerText.trim())
      .filter(x => x && x.length < 25);
    return {
      bedSelectFound: Boolean(sel),
      bedOptions: sel ? [...sel.options].map(o=>o.text) : [],
      addBedButton: Boolean(addBed),
      sample: roomAmenityChips.slice(0, 12),
    };
  });
  return { amenities, beds, problems };
}
