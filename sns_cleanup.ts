/**
 * draft_ethan 계정 기존 게시물 정리 (A안 계정 전환용)
 *   npx ts-node sns_cleanup.ts            → 목록만 뽑아 sns_cleanup_list.json 저장 (삭제 안 함)
 *   npx ts-node sns_cleanup.ts --delete   → sns_cleanup_list.json 에 남아 있는 ID만 삭제 (되돌릴 수 없음)
 * 지우기 싫은 글은 --delete 전에 json 에서 해당 줄을 빼면 된다.
 */
import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const LIST_FILE = 'sns_cleanup_list.json';
const THREADS = 'https://graph.threads.net/v1.0';
// IG 삭제는 Facebook Login(graph.facebook.com) 토큰만 지원 (Instagram Login 토큰은 불가)
const FB = 'https://graph.facebook.com/v27.0';
const IG_LOGIN = 'https://graph.instagram.com/v21.0';

interface Item { platform: 'threads' | 'instagram'; id: string; timestamp: string; text: string; permalink?: string }

async function fetchAll(url: string, params: Record<string, string>): Promise<any[]> {
    const out: any[] = [];
    let next: string | null = url;
    let p: Record<string, string> | undefined = params;
    while (next) {
        const res: any = await axios.get(next, { params: p });
        out.push(...(res.data?.data || []));
        next = res.data?.paging?.next || null;
        p = undefined; // next URL already carries params
    }
    return out;
}

async function igToken(igId: string, userToken: string): Promise<string> {
    // snsUploader 와 같은 방식: 연결된 페이지 토큰이 있으면 사용
    try {
        const res = await axios.get(`${FB}/me/accounts`, { params: { fields: 'access_token,instagram_business_account', access_token: userToken } });
        const page = (res.data?.data || []).find((p: any) => p.instagram_business_account?.id === igId && p.access_token);
        if (page) return page.access_token;
    } catch { /* fall back to user token */ }
    return userToken;
}

async function list(): Promise<void> {
    const items: Item[] = [];
    const tToken = process.env.THREADS_ACCESS_TOKEN;
    const igId = process.env.INSTAGRAM_ACCOUNT_ID;
    const igUser = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (tToken) {
        const posts = await fetchAll(`${THREADS}/me/threads`, { fields: 'id,text,timestamp,permalink', limit: '100', access_token: tToken });
        posts.forEach((p) => items.push({ platform: 'threads', id: p.id, timestamp: p.timestamp, text: (p.text || '').slice(0, 60), permalink: p.permalink }));
        console.log(`[Threads] ${posts.length}개`);
    } else console.warn('[Threads] THREADS_ACCESS_TOKEN 없음 → 건너뜀');

    if (igId && igUser) {
        const igLogin = igUser.startsWith('IG');
        const base = igLogin ? IG_LOGIN : FB;
        const token = igLogin ? igUser : await igToken(igId, igUser);
        const media = await fetchAll(`${base}/${igId}/media`, { fields: 'id,caption,timestamp,permalink,media_type', limit: '100', access_token: token });
        media.forEach((m) => items.push({ platform: 'instagram', id: m.id, timestamp: m.timestamp, text: (m.caption || '').slice(0, 60), permalink: m.permalink }));
        console.log(`[Instagram] ${media.length}개`);
        if (igLogin) console.warn('[Instagram] ⚠️ Instagram Login 토큰(IG...)이라 API 삭제 불가 → 앱에서 직접 지우거나 Facebook Login 토큰으로 재발급');
    } else console.warn('[Instagram] INSTAGRAM_ACCOUNT_ID / INSTAGRAM_ACCESS_TOKEN 없음 → 건너뜀');

    fs.writeFileSync(LIST_FILE, JSON.stringify(items, null, 2), 'utf8');
    console.log(`\n총 ${items.length}개 → ${LIST_FILE} 저장. 확인 후 지우지 않을 항목은 파일에서 빼고 --delete 로 실행하세요.`);
}

async function del(): Promise<void> {
    if (!fs.existsSync(LIST_FILE)) throw new Error(`${LIST_FILE} 없음. 먼저 목록 모드로 실행하세요.`);
    const items: Item[] = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
    const tToken = process.env.THREADS_ACCESS_TOKEN;
    const igId = process.env.INSTAGRAM_ACCOUNT_ID || '';
    const igUser = process.env.INSTAGRAM_ACCESS_TOKEN || '';
    if (igUser.startsWith('IG') && items.some((i) => i.platform === 'instagram')) {
        throw new Error('Instagram Login 토큰으로는 IG 삭제 불가. json 에서 instagram 항목을 빼거나 Facebook Login 토큰을 쓰세요.');
    }
    const igTok = igUser ? await igToken(igId, igUser) : '';

    let ok = 0, fail = 0;
    for (const it of items) {
        try {
            const url = it.platform === 'threads' ? `${THREADS}/${it.id}` : `${FB}/${it.id}`;
            const token = it.platform === 'threads' ? tToken : igTok;
            const res = await axios.delete(url, { params: { access_token: token } });
            if (res.data?.success === false) throw new Error(JSON.stringify(res.data));
            ok++;
            console.log(`🗑️  [${it.platform}] ${it.id} 삭제 (${it.text})`);
        } catch (e: any) {
            fail++;
            console.error(`❌ [${it.platform}] ${it.id}:`, JSON.stringify(e.response?.data || e.message));
        }
        await new Promise((r) => setTimeout(r, 1500)); // Threads 하루 100개 제한, 천천히
    }
    console.log(`\n성공 ${ok}건 / 실패 ${fail}건`);
}

(process.argv.includes('--delete') ? del() : list()).catch((e) => {
    console.error('💥', e.response?.data || e.message || e);
    process.exit(1);
});
