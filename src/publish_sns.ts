import * as fs from 'fs';
import * as path from 'path';
import { CardNewsSlide } from './contentGenerator';
import { renderAllCardNewsSlides, setBrand } from './imageRenderer';
import { uploadImagesToSupabaseStorage } from './supabaseLogger';
import { postToThreads, postCarouselToInstagram } from './snsUploader';

// sns_queue/<slug>/card.json 하나를 카드뉴스로 렌더 → 스레드 + 인스타 캐러셀 게시 (Actions 전용).
// 검수 게이트: card.json 의 "approved": true 인 항목만 게시. 결과는 meta.json 에 기록(멱등).
// 사용: node publish_sns.js [--item <slug>] [--dry-run] [--selfcheck]
//  계정 브랜드(이름·URL·태그)는 sns_queue/brand.json 에서 읽음 (없으면 렌더러 기본값).
const Q = 'sns_queue';
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };

export interface Card {
    topic: string;
    approved?: boolean;
    sources: string[];
    thread_text: string;
    insta_caption: string;
    slides: CardNewsSlide[];
    tags?: string[]; // 표지 해시태그 (없으면 brand.json 기본값)
}

// 렌더러가 줄바꿈을 안 하는 자리(본문 제목·본문 줄)는 길이 제한으로 잘림 방지
export function validateCard(c: Card): string[] {
    const e: string[] = [];
    if (!c.topic) e.push('topic 없음');
    if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some(s => !/^https:\/\//.test(s))) e.push('sources: 공식 출처 https URL 1개 이상 필요');
    if (!c.thread_text || c.thread_text.length > 500) e.push('thread_text: 1~500자');
    if (!c.insta_caption || c.insta_caption.length > 2200) e.push('insta_caption: 1~2200자');
    const s = c.slides || [];
    if (s.length < 3 || s.length > 5) e.push('slides: 3~5장');
    // 표지 태그 한 줄에 들어가는 폭: 최대 5개, 각 '#' 포함 10자 이하
    if (c.tags && (c.tags.length > 5 || c.tags.some(t => !t.startsWith('#') || t.length > 10))) e.push('tags: 최대 5개, #으로 시작, 10자 이하');
    if (s[0]?.type !== 'COVER') e.push('slides[0] 은 COVER');
    if (s[s.length - 1]?.type !== 'CTA') e.push('마지막 slide 는 CTA');
    s.forEach((sl, i) => {
        if (sl.slideNumber !== i + 1) e.push(`slides[${i}].slideNumber 는 ${i + 1}`);
        if (sl.type === 'BODY') {
            if (sl.title.length > 20) e.push(`slides[${i}].title 20자 초과`);
            if (sl.contentLines.length > 4) e.push(`slides[${i}].contentLines 4줄 초과`);
            sl.contentLines.forEach((l, j) => { if (l.length > 26) e.push(`slides[${i}].contentLines[${j}] 26자 초과`); });
        }
    });
    return e;
}

function selfcheck() {
    const ok: Card = {
        topic: 't', sources: ['https://www.nts.go.kr'], thread_text: 'a', insta_caption: 'b',
        slides: [
            { slideNumber: 1, type: 'COVER', title: 'c', contentLines: [] },
            { slideNumber: 2, type: 'BODY', title: 'b', contentLines: ['1', '2'] },
            { slideNumber: 3, type: 'CTA', title: 'x', contentLines: [] }
        ]
    };
    const bad = (patch: Partial<Card>) => validateCard({ ...ok, ...patch }).length > 0;
    if (validateCard(ok).length) throw new Error('selfcheck: 정상 카드가 거부됨');
    if (!bad({ sources: [] })) throw new Error('selfcheck: 출처 없음 통과됨');
    if (!bad({ sources: ['http://x'] })) throw new Error('selfcheck: http 출처 통과됨');
    if (!bad({ slides: ok.slides.slice(0, 2) })) throw new Error('selfcheck: 2장 통과됨');
    if (!bad({ slides: [ok.slides[0], { ...ok.slides[1], contentLines: ['가'.repeat(27)] }, ok.slides[2]] })) throw new Error('selfcheck: 긴 줄 통과됨');
    if (validateCard({ ...ok, tags: ['#에너지바우처', '#생활정보'] }).length) throw new Error('selfcheck: 정상 태그 거부됨');
    if (!bad({ tags: ['에너지바우처'] })) throw new Error('selfcheck: # 없는 태그 통과됨');
    if (!bad({ tags: ['#a', '#b', '#c', '#d', '#e', '#f'] })) throw new Error('selfcheck: 태그 6개 통과됨');
    console.log('selfcheck OK');
}

(async () => {
    if (process.argv.includes('--selfcheck')) return selfcheck();
    const dry = process.argv.includes('--dry-run');
    const readJson = (p: string) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return undefined; } };
    const done = (d: string) => { const m = readJson(`${Q}/${d}/meta.json`) || {}; return !!(m.threadsPostId && m.instagramPostId); };
    const ready = (d: string) => readJson(`${Q}/${d}/card.json`)?.approved === true;

    const wanted = arg('item') || process.env.ITEM;
    const items = fs.existsSync(Q) ? fs.readdirSync(Q).filter(d => fs.existsSync(`${Q}/${d}/card.json`)).sort() : [];
    const item = wanted || items.find(d => ready(d) && !done(d));
    if (!item) { console.log('승인(approved: true)된 미게시 항목이 없습니다.'); return; }

    const dir = `${Q}/${item}`;
    const card: Card = readJson(`${dir}/card.json`);
    if (!card) throw new Error(`card.json 읽기 실패: ${dir}`);
    if (card.approved !== true) throw new Error(`검수 미승인 항목: ${item} (card.json 에 "approved": true 필요)`);
    const errs = validateCard(card);
    if (errs.length) throw new Error(`card.json 검증 실패 (${item}):\n- ${errs.join('\n- ')}`);

    const metaPath = `${dir}/meta.json`;
    const meta = readJson(metaPath) || {};
    if (dry) { console.log(`[dry-run] 게시 예정: ${item} | "${card.topic}" | 슬라이드 ${card.slides.length}장 | 출처 ${card.sources.join(', ')}`); return; }

    const brand = readJson(`${Q}/brand.json`);
    if (brand) setBrand(brand);
    if (card.tags?.length) setBrand({ tags: card.tags });
    const save = () => fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1), 'utf8');

    // 플랫폼별로 성공한 것만 기록 → 재실행 시 실패한 쪽만 다시 시도
    if (!meta.threadsPostId) {
        meta.threadsPostId = await postToThreads(card.thread_text);
        meta.threadsAt = new Date().toISOString();
        save();
    }
    if (!meta.instagramPostId) {
        const imgs = await renderAllCardNewsSlides(card.slides, path.join(dir, '_render'));
        const urls = await uploadImagesToSupabaseStorage(imgs);
        meta.instagramPostId = await postCarouselToInstagram(urls, card.insta_caption);
        meta.instagramAt = new Date().toISOString();
        save();
    }
    console.log('PUB', JSON.stringify(meta));
})().catch(e => { console.error(e.response?.data || e); process.exit(1); });
