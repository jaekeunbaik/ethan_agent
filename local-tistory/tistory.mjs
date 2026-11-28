// PC 전용: 블로그 초안을 티스토리에 임시저장 → 1시간 동안 사람이 막지 않으면(임시저장 글 삭제) 자동 공개 발행.
//   node tistory.mjs --login     처음 1회(또는 로그인 만료 시): 창에서 로그인하면 쿠키 저장 후 자동으로 닫힘
//   node tistory.mjs --explore   글쓰기 화면 구조 점검용 (개발용)
//   node tistory.mjs             기한 지난 임시저장 글 발행 + 새 초안 1개 임시저장 (작업 스케줄러가 매시 실행)
import { chromium } from 'playwright-core';
import os from 'os';
import path from 'path';
import fs from 'fs';

const BLOG = 'https://ontheday.tistory.com';
const PROFILE = path.join(os.homedir(), 'AppData', 'Local', 'edohan-tistory-profile');
const arg = (n) => process.argv.includes(`--${n}`);

async function open(headless) {
  return chromium.launchPersistentContext(PROFILE, { channel: 'chrome', headless, viewport: { width: 1400, height: 1000 } });
}

// 티스토리 세션 쿠키는 브라우저를 닫으면 사라지므로 파일로 보관했다가 매번 복원한다.
// 파일은 저장소 밖(사용자 AppData)에 둔다: 로그인 정보라 커밋되면 안 됨.
const COOKIES = path.join(PROFILE, 'tistory-cookies.json');
async function saveCookies(ctx) {
  const all = await ctx.cookies();
  fs.writeFileSync(COOKIES, JSON.stringify(all.filter((c) => /tistory\.com$/.test(c.domain.replace(/^\./, '')) || /tistory/.test(c.domain))), 'utf8');
}
async function restoreCookies(ctx) {
  if (fs.existsSync(COOKIES)) await ctx.addCookies(JSON.parse(fs.readFileSync(COOKIES, 'utf8')));
}

// 로그인이 풀려 있으면 카카오 자동 로그인을 시도하지 않고 false (사람이 --login 다시)
async function gotoLoggedIn(page, url) {
  await restoreCookies(page.context());
  await page.goto(url, { waitUntil: 'networkidle' });
  if (!page.url().includes('/auth/login')) { await saveCookies(page.context()); return true; }
  return false;
}

// 카카오 간편로그인 자동 클릭은 하지 않는다: 반복하면 카카오가 전체 로그인을 요구함 (2026-11-28 확인)

const HERE = path.dirname(new URL(import.meta.url).pathname.slice(1));
const REPO = path.join(HERE, '..');
const STATE = path.join(HERE, 'state.json'); // 이미 임시저장한 초안 폴더명 (gitignore)

function env(key) {
  const line = fs.readFileSync(path.join(REPO, '.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^"|"$/g, '') : '';
}
async function notify(msg) {
  console.log(msg);
  const url = env('DISCORD_WEBHOOK_URL');
  if (url) await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) }).catch(() => {});
}

// state.json: { drafted: { <slug>: { title, at } }, published: [<slug>] }  (예전 배열 형식은 "이미 처리됨"으로 간주)
function loadState() {
  if (!fs.existsSync(STATE)) return { drafted: {}, published: [] };
  const s = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  return Array.isArray(s) ? { drafted: {}, published: s } : s;
}
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));

async function openDraftList(page) {
  await page.locator('a.action', { hasText: '임시저장' }).locator('xpath=..').locator('a,button,span').filter({ hasText: /^\d+$/ }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
}

// 임시저장 글을 불러와 공개 발행. 목록에 없으면(사람이 삭제·직접 발행) 'GONE'
async function publishDraft(ctx, title) {
  const page = await ctx.newPage();
  page.on('dialog', (d) => { console.log('dialog accepted:', d.message()); d.accept(); });
  if (!(await gotoLoggedIn(page, `${BLOG}/manage/newpost/`))) return { r: 'LOGIN' };
  await page.waitForTimeout(2000);
  await openDraftList(page);
  const item = page.locator('a.link_info').filter({ hasText: title }).first();
  if (!(await item.count())) { await page.close(); return { r: 'GONE' }; }
  await item.click();
  await page.waitForTimeout(2500);
  if ((await page.inputValue('#post-title-inp')).trim() !== title.trim()) { await page.screenshot({ path: path.join(HERE, 'last.png') }); await page.close(); return { r: 'FAIL' }; }
  await page.click('#publish-layer-btn');
  await page.waitForTimeout(1500);
  await page.locator('label.form-field', { hasText: /^공개$/ }).first().click();
  await Promise.all([page.waitForURL((u) => !u.pathname.includes('/newpost'), { timeout: 30000 }).catch(() => {}), page.click('#publish-btn')]);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(HERE, 'last.png') });
  const url = page.url();
  await page.close();
  return { r: url.includes('/newpost') ? 'FAIL' : 'OK', url };
}

async function saveDraft(ctx, slug) {
  const dir = path.join(REPO, 'blog_queue', slug);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const html = fs.readFileSync(path.join(dir, 'post.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
  let tags = [];
  try { tags = JSON.parse(fs.readFileSync(path.join(REPO, 'sns_queue', slug, 'card.json'), 'utf8')).tags || []; } catch { /* 태그 없음 */ }
  tags = tags.map((t) => t.replace(/^#/, '')).filter(Boolean);

  const page = await ctx.newPage();
  page.on('dialog', (d) => { console.log('dialog dismissed:', d.message()); d.dismiss(); }); // "이어서 작성?" 류는 새 글로
  if (!(await gotoLoggedIn(page, `${BLOG}/manage/newpost/`))) return 'LOGIN';
  await page.waitForFunction(() => window.tinymce && window.tinymce.activeEditor && window.tinymce.activeEditor.initialized);

  await page.fill('#post-title-inp', meta.title);
  await page.evaluate((h) => { const ed = window.tinymce.activeEditor; ed.setContent(h); ed.fire('change'); ed.save(); }, html);
  for (const t of tags) { await page.fill('#tagText', t); await page.press('#tagText', 'Enter'); }

  const saved = page.waitForResponse((r) => /draft/i.test(r.url()) && r.request().method() !== 'GET', { timeout: 20000 }).catch(() => null);
  await page.locator('a.action', { hasText: '임시저장' }).click();
  const res = await saved;
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(HERE, 'last.png') });
  const ok = !!res && res.ok();
  console.log('draft response:', res ? `${res.status()} ${res.url()}` : 'none');
  await page.close();
  return ok ? 'OK' : 'FAIL';
}

if (arg('login')) {
  const ctx = await open(false);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${BLOG}/manage/newpost/`);
  console.log('브라우저에서 로그인하세요. 글쓰기 화면이 뜨면 자동으로 저장하고 닫힙니다.');
  await page.waitForURL(`${BLOG}/manage/newpost/**`, { timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(2000);
  await saveCookies(ctx);
  await ctx.close();
  console.log('로그인 쿠키 저장 완료');
} else if (arg('explore-drafts')) {
  const ctx = await open(true);
  const page = await ctx.newPage();
  page.on('dialog', (d) => { console.log('DIALOG:', d.message()); d.dismiss(); });
  console.log('logged in:', await gotoLoggedIn(page, `${BLOG}/manage/newpost/`));
  await page.waitForTimeout(2000);
  const cnt = page.locator('a.action', { hasText: '임시저장' }).locator('xpath=..').locator('a,button,span').filter({ hasText: /^\d+$/ }).first();
  console.log('count el:', await cnt.count());
  if (await cnt.count()) await cnt.click(); else await page.locator('text=임시저장').last().click();
  await page.waitForTimeout(1500);
  const layer = await page.evaluate(() => [...document.querySelectorAll('li,a,button')].filter((e) => e.offsetWidth && /에너지|임시|삭제|불러/.test(e.innerText)).map((e) => `${e.tagName}|${String(e.className).slice(0, 50)}|${e.innerText.trim().replace(/\s+/g, ' ').slice(0, 60)}`).slice(0, 30));
  console.log(layer.join('\n'));
  // 초안 불러오기 → 완료 창 열기만 (발행 안 함)
  await page.locator('a.link_info').first().click();
  await page.waitForTimeout(2500);
  console.log('title after load:', await page.inputValue('#post-title-inp'));
  await page.click('#publish-layer-btn');
  await page.waitForTimeout(1500);
  const pub = await page.evaluate(() => [...document.querySelectorAll('input,label,button,a')].filter((e) => e.offsetWidth && /공개|발행|비공개|보호|예약|취소|닫기/.test(e.innerText || e.value || e.getAttribute('aria-label') || '')).map((e) => `${e.tagName}|${e.id}|${String(e.className).slice(0, 50)}|${(e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 40)}|${e.getAttribute('type') || ''}`).slice(0, 30));
  console.log('PUBLISH LAYER:\n' + pub.join('\n'));
  await page.screenshot({ path: path.join(HERE, 'explore.png') });
  await ctx.close();
} else if (arg('explore')) {
  const ctx = await open(true);
  const page = await ctx.newPage();
  page.on('dialog', (d) => { console.log('DIALOG:', d.message()); d.accept(); });
  console.log('logged in:', await gotoLoggedIn(page, `${BLOG}/manage/newpost/`));
  console.log('URL', page.url());
  const info = await page.evaluate(() => {
    const vis = (e) => !!(e.offsetWidth || e.offsetHeight);
    const pick = (sel) => [...document.querySelectorAll(sel)].filter(vis).slice(0, 40).map((e) => ({
      tag: e.tagName, id: e.id, cls: String(e.className).slice(0, 80), text: (e.innerText || e.value || e.placeholder || '').trim().slice(0, 40), name: e.getAttribute('name')
    }));
    const named = [...document.querySelectorAll('button,a')].filter((e) => vis(e) && /저장|완료|발행|공개|임시/.test(e.innerText)).map((e) => ({ tag: e.tagName, id: e.id, cls: String(e.className).slice(0, 60), text: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 30) }));
    return { named, tinymce: !!(window.tinymce && window.tinymce.activeEditor), iframes: [...document.querySelectorAll('iframe')].map((f) => f.id || f.className) };
  });
  console.log(JSON.stringify(info, null, 1));
  await page.screenshot({ path: path.join(HERE, 'explore.png') });
  await ctx.close();
} else {
  // 기본 (작업 스케줄러가 08~21시 매시 실행):
  //  1) 임시저장한 지 1시간 지난 글을 공개 발행 (사람이 앱에서 지웠거나 직접 발행했으면 건너뜀)
  //  2) 아직 안 넣은 새 초안 1개를 임시저장
  // --slug <폴더명> 으로 특정 초안 임시저장 (테스트용)
  const h = process.argv.indexOf('--hold');
  const HOLD_MIN = h > 0 ? Number(process.argv[h + 1]) : 55; // 임시저장 후 자동 발행까지 최소 대기 (분), --hold 로 테스트용 변경
  const LOGIN_MSG = 'PC에서 C:\\ethan\\git\\ethan_agent\\local-tistory 폴더의 node tistory.mjs --login 실행 필요 (또는 Claude에게 "로그인 다시")';
  const { execSync } = await import('child_process');
  try { execSync('git pull --rebase --autostash -q origin master', { cwd: REPO, stdio: 'inherit' }); } catch { console.warn('git pull 실패, 로컬 상태로 진행'); }
  const st = loadState();
  const ctx = await open(true);
  let code = 0;

  for (const [slug, d] of Object.entries(st.drafted)) {
    if (st.published.includes(slug) || Date.now() - Date.parse(d.at) < HOLD_MIN * 60000) continue;
    const { r, url } = await publishDraft(ctx, d.title);
    if (r === 'OK') { st.published.push(slug); await notify(`📢 자동 발행 완료: ${d.title}\n${url}`); }
    else if (r === 'GONE') { st.published.push(slug); console.log(`임시저장 목록에 없음(삭제·직접 발행) → 건너뜀: ${d.title}`); }
    else if (r === 'LOGIN') { await notify(`⚠️ 로그인 만료로 자동 발행 못 함: ${d.title}\n${LOGIN_MSG}`); code = 2; break; }
    else { await notify(`❌ 자동 발행 실패: ${d.title}\nPC의 local-tistory/last.png 확인. 앱에서 직접 발행하세요.`); st.published.push(slug); code = 1; }
    saveState(st);
  }

  const i = process.argv.indexOf('--slug');
  const q = path.join(REPO, 'blog_queue');
  const known = new Set([...Object.keys(st.drafted), ...st.published]);
  const slug = (i > 0 ? process.argv[i + 1] : null) || fs.readdirSync(q).sort().find((x) => !known.has(x) && fs.existsSync(path.join(q, x, 'post.html')));
  if (code !== 2 && slug) {
    const title = JSON.parse(fs.readFileSync(path.join(q, slug, 'meta.json'), 'utf8')).title;
    const r = await saveDraft(ctx, slug);
    if (r === 'OK') {
      st.drafted[slug] = { title, at: new Date().toISOString() };
      saveState(st);
      const due = new Date(Date.now() + 60 * 60000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      await notify(`✅ 티스토리 임시저장: ${title}\n**${due}쯤 자동 발행**돼요. 막으려면 앱에서 임시저장 글을 삭제하세요. 고친 내용은 그대로 발행돼요.`);
    } else if (r === 'LOGIN') { await notify(`⚠️ 로그인 만료로 임시저장 못 함: ${title}\n${LOGIN_MSG}`); code = 2; }
    else { await notify(`❌ 임시저장 실패: ${title}\nPC의 local-tistory/last.png 확인. 이번 글은 수동으로 붙여넣기 하세요.`); code = 1; }
  } else if (!slug) console.log('새 초안 없음');

  await ctx.close();
  process.exit(code);
}
