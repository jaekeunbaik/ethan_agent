// PC 전용: 블로그 초안을 티스토리에 "임시저장"까지 자동으로 넣는다 (발행은 사람이 폰에서).
//   node tistory.mjs --login     처음 1회(또는 로그인 만료 시): 창에서 로그인하면 쿠키 저장 후 자동으로 닫힘
//   node tistory.mjs --explore   글쓰기 화면 구조 점검용 (개발용)
//   node tistory.mjs             새 초안 1개를 임시저장 (작업 스케줄러가 실행)
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
  // 기본: 저장소 최신화 → 아직 안 넣은 초안 1개를 임시저장 → 디스코드 알림
  // --slug <폴더명> 으로 특정 초안 지정 가능 (테스트용)
  const { execSync } = await import('child_process');
  try { execSync('git pull --rebase --autostash -q origin master', { cwd: REPO, stdio: 'inherit' }); } catch { console.warn('git pull 실패, 로컬 상태로 진행'); }
  const done = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : [];
  const i = process.argv.indexOf('--slug');
  const want = i > 0 ? process.argv[i + 1] : null;
  const q = path.join(REPO, 'blog_queue');
  const slug = want || fs.readdirSync(q).sort().find((d) => !done.includes(d) && fs.existsSync(path.join(q, d, 'post.html')));
  if (!slug) { console.log('새 초안 없음'); process.exit(0); }

  const ctx = await open(true);
  const r = await saveDraft(ctx, slug);
  await ctx.close();
  const title = JSON.parse(fs.readFileSync(path.join(q, slug, 'meta.json'), 'utf8')).title;
  if (r === 'OK') {
    if (!done.includes(slug)) fs.writeFileSync(STATE, JSON.stringify([...done, slug], null, 1));
    await notify(`✅ 티스토리 임시저장 완료: ${title}\n앱 → 글 관리 → 임시저장에서 열고 날짜·금액 확인, 의견 1~2문단 넣고 발행하세요.`);
  } else if (r === 'LOGIN') {
    await notify(`⚠️ 티스토리 로그인 만료로 임시저장 못 함: ${title}\nPC에서 C:\\ethan\\git\\ethan_agent\\local-tistory 폴더의 node tistory.mjs --login 실행 필요`);
    process.exit(2);
  } else {
    await notify(`❌ 티스토리 임시저장 실패: ${title}\nPC의 local-tistory/last.png 확인 필요. 이번 글은 수동으로 붙여넣기 하세요.`);
    process.exit(1);
  }
}
