// 블로그 초안을 Blogger(공식 API)에 초안으로 올림 → 1시간 동안 사람이 막지 않으면(초안 삭제) 자동 공개 발행.
//   node blogger.mjs --login   처음 1회: 브라우저에서 Google 로그인 → refresh token 저장 (의존성 없음)
//   node blogger.mjs           기한 지난 초안 발행 + 새 초안 1개 업로드 (.github/workflows/blogger.yml 이 매시 실행)
//   옵션: --slug <폴더명> 특정 초안 업로드, --hold <분> 자동 발행 대기시간 변경 (테스트용)
// 필요한 .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Google Cloud의 "데스크톱 앱" OAuth 클라이언트)
import os from 'os';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..');
const STATE = path.join(HERE, 'state.json'); // { drafted: { <slug>: { title, at, id } }, published: [<slug>] } (gitignore)
// 토큰은 저장소 밖(AppData)에 둔다: 커밋되면 블로그 권한이 통째로 넘어감
const TOKEN = path.join(os.homedir(), 'AppData', 'Local', 'edohan-blogger', 'token.json');
const API = 'https://www.googleapis.com/blogger/v3';
const arg = (n) => process.argv.includes(`--${n}`);
const argVal = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : null; };

// GitHub Actions에서는 Secrets(환경변수), PC에서는 .env
function env(key) {
  if (process.env[key]) return process.env[key];
  if (!fs.existsSync(path.join(REPO, '.env'))) return '';
  const line = fs.readFileSync(path.join(REPO, '.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^"|"$/g, '') : '';
}
async function notify(msg) {
  console.log(msg);
  const url = env('DISCORD_WEBHOOK_URL');
  if (url) await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: msg }) }).catch(() => {});
}

async function tokenCall(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params }),
  });
  return r.json();
}

const refreshToken = () => env('BLOGGER_REFRESH_TOKEN') || (fs.existsSync(TOKEN) ? JSON.parse(fs.readFileSync(TOKEN, 'utf8')).refresh_token : '');
class LoginError extends Error {}
let access;
async function api(method, p, body) {
  if (!access) {
    const rt = refreshToken();
    if (!rt) throw new LoginError('token 없음');
    const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: rt });
    if (!t.access_token) throw new LoginError(JSON.stringify(t)); // invalid_grant = 토큰 만료/취소 → --login 다시
    access = t.access_token;
  }
  const r = await fetch(API + p, { method, headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function login() {
  // OOB 방식은 Google이 막아서 127.0.0.1 루프백으로 code를 받는다
  const srv = http.createServer();
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const redirect = `http://127.0.0.1:${srv.address().port}`;
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirect, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/blogger', access_type: 'offline', prompt: 'consent',
  });
  console.log('브라우저에서 Google 로그인하세요. 안 열리면 이 주소를 직접 여세요:\n' + url);
  execSync(`start "" "${url}"`, { shell: 'cmd.exe' });
  const code = await new Promise((ok, no) => srv.on('request', (req, res) => {
    const q = new URL(req.url, redirect).searchParams;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(q.get('code') ? '로그인 완료. 이 창을 닫으세요.' : `실패: ${q.get('error')}`);
    q.get('code') ? ok(q.get('code')) : no(new Error(q.get('error') || 'no code'));
  }));
  srv.close();
  const t = await tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirect });
  if (!t.refresh_token) throw new Error('refresh_token 없음: ' + JSON.stringify(t));
  fs.mkdirSync(path.dirname(TOKEN), { recursive: true });
  fs.writeFileSync(TOKEN, JSON.stringify({ refresh_token: t.refresh_token }));
  const blogs = (await api('GET', '/users/self/blogs'))?.items || [];
  console.log('토큰 저장 완료. 내 블로그:\n' + blogs.map((b) => `  ${b.id}  ${b.name}  ${b.url}`).join('\n'));
  console.log(blogs.length ? '위 id를 .env 의 BLOGGER_BLOG_ID= 에 넣으세요.' : '⚠️ 이 Google 계정에는 관리 중인 블로그가 없습니다. 블로그 관리자 계정으로 --login 다시 하세요.');
}

function loadState() { return fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { drafted: {}, published: [] }; }
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));

function readPost(slug) {
  const dir = path.join(REPO, 'blog_queue', slug);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const content = fs.readFileSync(path.join(dir, 'post.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
  let labels = [];
  try { labels = JSON.parse(fs.readFileSync(path.join(REPO, 'sns_queue', slug, 'card.json'), 'utf8')).tags || []; } catch { /* 태그 없음 */ }
  return { title: meta.title, content, labels: labels.map((t) => t.replace(/^#/, '')).filter(Boolean) };
}

if (arg('login')) {
  await login();
} else {
  const LOGIN_MSG = 'PC의 local-blogger 에서 node blogger.mjs --login 후 GitHub Secret BLOGGER_REFRESH_TOKEN 갱신 필요 (Claude에게 "블로거 로그인 다시")';
  const BLOG = env('BLOGGER_BLOG_ID');
  if (!refreshToken() || !BLOG) { console.log('아직 --login / BLOGGER_BLOG_ID 설정 전 → 아무것도 안 함'); process.exit(0); }
  const HOLD_MIN = Number(argVal('hold') ?? 55);
  try { execSync('git pull --rebase --autostash -q origin master', { cwd: REPO, stdio: 'inherit' }); } catch { console.warn('git pull 실패, 로컬 상태로 진행'); }
  const st = loadState();
  let code = 0;
  try {
    for (const [slug, d] of Object.entries(st.drafted)) {
      if (st.published.includes(slug) || Date.now() - Date.parse(d.at) < HOLD_MIN * 60000) continue;
      const post = await api('GET', `/blogs/${BLOG}/posts/${d.id}?view=AUTHOR`);
      if (!post) console.log(`초안이 삭제됨 → 건너뜀: ${d.title}`);
      else if (post.status === 'LIVE') console.log(`이미 발행됨 → 건너뜀: ${d.title}`);
      else { const p = await api('POST', `/blogs/${BLOG}/posts/${d.id}/publish`); await notify(`📢 Blogger 자동 발행: ${d.title}\n${p.url}`); }
      st.published.push(slug);
      saveState(st);
    }

    // 애드센스 신청 시점 알림 (1회): 공개 글 20개 이상 + 첫 글 후 30일 이상 (흔히 승인되는 최소선)
    if (!st.adsenseNotified) {
      const live = await api('GET', `/blogs/${BLOG}/posts?status=LIVE&maxResults=500&fetchBodies=false&fields=items(published)`);
      const dates = (live?.items || []).map((x) => Date.parse(x.published));
      const days = dates.length ? (Date.now() - Math.min(...dates)) / 86400000 : 0;
      console.log(`애드센스 체크: 공개 글 ${dates.length}개, 운영 ${Math.floor(days)}일`);
      if (dates.length >= 20 && days >= 30) {
        await notify(`💰 애드센스 신청해도 좋을 시점이에요 (공개 글 ${dates.length}개, 운영 ${Math.floor(days)}일).\nBlogger → 수익 창출 → AdSense 신청. 신청 전 확인: 메뉴에 소개·문의·개인정보처리방침 노출, 각 글에 직접 쓴 의견 2~3줄.`);
        st.adsenseNotified = true;
        saveState(st);
      }
    }

    const q = path.join(REPO, 'blog_queue');
    const known = new Set([...Object.keys(st.drafted), ...st.published]);
    const slug = argVal('slug') || fs.readdirSync(q).sort().find((x) => !known.has(x) && fs.existsSync(path.join(q, x, 'post.html')));
    if (slug) {
      const body = readPost(slug);
      const p = await api('POST', `/blogs/${BLOG}/posts/?isDraft=true`, body);
      st.drafted[slug] = { title: body.title, at: new Date().toISOString(), id: p.id };
      saveState(st);
      const due = new Date(Date.now() + 60 * 60000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      await notify(`✅ Blogger 초안 업로드: ${body.title}\n**${due}쯤 자동 발행**돼요. 막으려면 Blogger 앱/웹에서 초안을 삭제하세요. 고친 내용은 그대로 발행돼요.`);
    } else console.log('새 초안 없음');
  } catch (e) {
    if (e instanceof LoginError) { await notify(`⚠️ Blogger 로그인 만료: ${LOGIN_MSG}\n${e.message}`); code = 2; }
    else { await notify(`❌ Blogger 처리 실패: ${e.message.slice(0, 500)}`); code = 1; }
  }
  process.exit(code);
}
