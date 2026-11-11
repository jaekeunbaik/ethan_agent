import axios from 'axios';

export interface SourceStory {
    id: string;
    site: string;
    title: string;
    url: string;
    text: string;
    comments: string[]; // 베스트 댓글 상위 3개 (웃음/논쟁 반응 판별용)
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const strip = (h: string) => decode(h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

/**
 * 네이트판 랭킹에서 후보 글 본문을 수집 (이미 쓴 글 id는 제외)
 * shortcut: 정규식 파싱이라 네이트판 HTML이 바뀌면 깨짐, 깨지면 호출부가 백업 시나리오로 넘어감
 */
async function get(url: string): Promise<string> {
    let err: any;
    for (let i = 1; i <= 3; i++) {
        try { return (await axios.get(url, { headers: HEADERS, timeout: 10000 })).data as string; }
        catch (e) { err = e; await new Promise(r => setTimeout(r, i * 1000)); }
    }
    throw err;
}

export async function fetchPannCandidates(usedIds: string[], limit = 20): Promise<SourceStory[]> {
    const list = await get('https://pann.nate.com/talk/ranking');
    const seen = new Set<string>(usedIds);
    const items: { id: string; title: string }[] = [];
    for (const m of list.matchAll(/<a href="\/talk\/(\d+)"[^>]*title="([^"]+)"/g)) {
        if (seen.has(m[1])) continue;
        seen.add(m[1]);
        items.push({ id: m[1], title: decode(m[2]) });
        if (items.length >= limit) break;
    }

    const stories: SourceStory[] = [];
    for (const it of items) {
        try {
            const html = await get(`https://pann.nate.com/talk/${it.id}`);
            const i = html.indexOf('id="contentArea"');
            const j = html.indexOf('</div>', i);
            if (i < 0 || j < 0) continue;
            const text = decode(html.slice(i, j).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim());
            if (text.length < 80) continue;
            stories.push({ id: it.id, site: '네이트판', title: it.title, url: `https://pann.nate.com/talk/${it.id}`, text: text.slice(0, 2500), comments: parseBestComments(html) });
        } catch { /* 한 글 실패는 건너뜀 */ }
    }
    return stories;
}

function parseBestComments(html: string): string[] {
    const k = html.indexOf('class="cmt_best"');
    if (k < 0) return [];
    return [...html.slice(k).matchAll(/id="beple_content_area_\d+" class="usertxt">([\s\S]*?)<\/dd>/g)].slice(0, 3).map(m => strip(m[1]).slice(0, 120));
}
