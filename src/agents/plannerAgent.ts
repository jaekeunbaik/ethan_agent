import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { FeedbackMemory, ContentPlan } from './types';
import { fetchPannCandidates } from '../pannFetcher';
import { generateContentWithFallback } from '../geminiHelper';
import { filterStories, keywordReject } from '../storyFilter';

dotenv.config();

const parser = new Parser({
    timeout: 5000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
});

const VIRAL_COMMUNITY_RSS_FEEDS = [
    'https://news.google.com/rss/search?q=%EC%B9%B4%ED%86%A1+%EC%8D%B0+%EC%98%A4%ED%83%80+%EB%8C%80%EC%B0%B8%EC%82%AC&hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/search?q=%EB%8B%B9%EA%B7%BC%EB%A7%88%EC%BC%93+%EB%A0%88%EC%A0%84%EB%93%9C+%ED%99%A9%EB%8B%B9&hl=ko&gl=KR&ceid=KR:ko',
    'https://news.google.com/rss/search?q=%EC%A7%81%EC%9E%A5%EC%9D%B8+%EC%B9%B4%ED%86%A1+%EC%8B%A4%EC%88%98+%EC%8D%B0&hl=ko&gl=KR&ceid=KR:ko'
];

// 오프라인/RSS 실패 대비 레전드 썰 시나리오 풀 (주기별 순환)
const BACKUP_VIRAL_STORIES = [
    {
        title: '부장님한테 보낸 카톡 대참사',
        category: '직장/알바' as const,
        hookIdea: '퇴사 각 잡힌 신입사원의 카톡 오타',
        synopsis: '부장님이 야근 지시했는데 친구한테 욕하려던 톡을 부장님 단톡방에 보냄',
        twistPoint: '부장님이 "내일 연차 써라"라고 답장함',
        coupangProductCategory: '직장인 스트레스 완화 힐링템/안마기',
        coupangKeyword: '눈마사지기'
    },
    {
        title: '당근마켓 네고 빌런 참교육',
        category: '당근/중고거래' as const,
        hookIdea: '3만원짜리를 3천원에 달라는 당근 구매자',
        synopsis: '무료 나눔 해달라고 떼쓰더니 직접 집 앞까지 배달해 달라고 함',
        twistPoint: '알고 보니 같은 아파트 사는 이웃 주민이었음',
        coupangProductCategory: '자취생 가성비 생활 꿀템',
        coupangKeyword: '자취 꿀템 정리함'
    },
    {
        title: '엄마한테 보낼 톡을 여친한테 보냄',
        category: '황당실수' as const,
        hookIdea: '한 글자 오타로 헤어질 뻔한 썰',
        synopsis: '엄마한테 된장찌개 끓여달라고 애교 부렸는데 여친한테 전송됨',
        twistPoint: '여친이 바로 요리 유튜브 링크 보내며 정색함',
        coupangProductCategory: '간편 요리 밀키트/주방용품',
        coupangKeyword: '간편 밀키트'
    }
];


const USED_SOURCES_FILE = 'used_sources.json';

export class NoCandidates extends Error {}

// 원문 없는 창작용 일상 상황 시드 (최근 사용분은 피해서 순환). [상황, 쿠팡 키워드]
const THEMES: [string, string][] = [
    ['엄마가 내 물건을 허락 없이 당근에 팔아버림', '자취 꿀템 정리함'],
    ['단톡방에 보낼 험담 톡을 당사자가 있는 방에 잘못 보냄', '눈마사지기'],
    ['친구가 약속 시간에 늦으면서 점점 황당한 핑계를 댐', '보조배터리'],
    ['치킨 시켰는데 누가 먹었는지 가족 수사가 시작됨', '치킨 무'],
    ['다이어트 선언한 친구가 단톡방에 몰래 야식 인증샷을 올림', '다이어트 도시락'],
    ['시험 전날 친구들이 서로 공부 안 했다고 거짓말 경쟁', '형광펜 세트'],
    ['아빠가 카톡 프사를 이상한 걸로 바꿔서 가족방이 난리남', '스마트폰 거치대'],
    ['동생이 내 이름으로 배달 시키고 안 갚음', '배달 보온백'],
    ['모임 장소 정하는데 아무도 결정을 못 하고 서로 미룸', '휴대용 선풍기'],
    ['자취방 보일러 고장 났다고 했더니 친구들이 훈수만 둠', '핫팩'],
    ['친구 생일 선물을 서로 안 겹치게 하려다 다 같은 걸 삼', '선물 포장지'],
    ['엄마가 이모티콘을 잘못 눌러서 이상한 분위기가 됨', '이모티콘 키보드'],
    ['친구가 여행 계획을 세워왔는데 일정이 전부 먹는 것뿐임', '여행용 파우치'],
    ['룸메이트가 냉장고 음식에 이름표를 붙이기 시작함', '밀폐용기 세트'],
    ['알람 10개 맞췄는데 다 못 듣고 지각해서 변명 회의 중', '무소음 알람시계']
];

function usedThemeIdx(): number[] {
    const used: string[] = fs.existsSync(USED_SOURCES_FILE) ? JSON.parse(fs.readFileSync(USED_SOURCES_FILE, 'utf8')) : [];
    return [...used, ...queuedSourceIds()].filter(x => x.startsWith('free:')).map(x => Number(x.split(':')[1]));
}

/** 원문 없는 기본 경로: 아직 안 쓴 테마 하나를 골라 대본 단계에서 새 설정을 창작하게 함 (Gemini 호출 없음) */
function planFreeform(feedback: FeedbackMemory, skipIds: string[]): ContentPlan {
    const recent = new Set([...usedThemeIdx().slice(-(THEMES.length - 3)), ...skipIds.map(Number)]);
    const open = THEMES.map((_, i) => i).filter(i => !recent.has(i));
    if (open.length === 0) throw new NoCandidates('쓸 수 있는 테마가 없음');
    const i = open[Math.floor(Math.random() * open.length)];
    const [theme, kw] = THEMES[i];
    return {
        id: `plan_${Date.now()}`, title: theme, category: '가족/친구', hookIdea: '첫 메세지부터 황당한 상황 투척',
        synopsis: `상황 시드: ${theme}`, twistPoint: '복선을 깔고 마지막에 어이없는 반전',
        coupangProductCategory: '생활 꿀템', coupangKeyword: kw,
        appliedFeedbackRules: feedback.successfulPatterns.slice(0, 2), freeform: true, key: String(i)
    };
}

/** inbox/*.txt 중 가장 오래된 파일을 각색 원문으로 사용 (이든이 직접 넣은 글) */
function blocked(n: string): boolean {
    const t = fs.readFileSync(`inbox/${n}`, 'utf8');
    const why = keywordReject(t.split('\n')[0], t);
    if (why) console.warn(`[PlannerAgent] inbox/${n} 제외: ${why}`);
    return !!why;
}

function planFromInbox(feedback: FeedbackMemory, skipIds: string[]): ContentPlan | null {
    if (!fs.existsSync('inbox')) return null;
    const f = fs.readdirSync('inbox').filter(n => n.endsWith('.txt') && !skipIds.includes(n) && !blocked(n))
        .sort((a, b) => fs.statSync(`inbox/${a}`).mtimeMs - fs.statSync(`inbox/${b}`).mtimeMs)[0];
    if (!f) return null;
    const text = fs.readFileSync(`inbox/${f}`, 'utf8').trim().slice(0, 2500);
    const title = text.split('\n')[0].slice(0, 60);
    return {
        id: `plan_${Date.now()}`, title, category: '가족/친구', hookIdea: '원문 속 가장 황당한 순간으로 시작',
        synopsis: text.slice(0, 200), twistPoint: '원문 속 반전/웃음 포인트', coupangProductCategory: '생활 꿀템', coupangKeyword: '자취 필수템',
        appliedFeedbackRules: feedback.successfulPatterns.slice(0, 2), sourceText: text, key: f, inboxFile: `inbox/${f}`
    };
}

/** 큐(upload_queue 하위 meta.json)에 이미 들어간 원문 id: 업로드 전이라도 재선정 방지 */
function queuedSourceIds(): string[] {
    const dir = 'upload_queue';
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).flatMap(d => {
        try { return [JSON.parse(fs.readFileSync(`${dir}/${d}/meta.json`, 'utf8')).sourceId as string]; } catch { return []; }
    }).filter(Boolean);
}

/** 네이트판 글을 storyFilter(키워드+LLM 안전/재미 점수)로 거른 뒤 1등을 기획서로 변환. 통과 글이 없으면 NoCandidates */
async function planFromPann(feedback: FeedbackMemory, skipIds: string[]): Promise<ContentPlan> {
    const used: string[] = fs.existsSync(USED_SOURCES_FILE) ? JSON.parse(fs.readFileSync(USED_SOURCES_FILE, 'utf8')) : [];
    const stories = await fetchPannCandidates([...used, ...queuedSourceIds(), ...skipIds]);
    const { passed, rejected } = await filterStories(stories);
    rejected.forEach(r => console.log(`[PlannerAgent] 탈락 ${r.id}: ${r.reason}`));
    if (passed.length === 0) throw new NoCandidates(`통과 글 없음 (후보 ${stories.length}개)`);
    const picked = passed[0].story;
    console.log(`[PlannerAgent] 선정(재미 ${passed[0].score}/10): ${picked.title}`);
    {
        const p = await generateContentWithFallback<any>({
            responseMimeType: 'application/json',
            userPrompt: `아래 커뮤니티 글을 카톡 대화 쇼츠(35초)로 각색할 기획서로 정리하세요.

제목: ${picked.title}
${picked.text}

JSON으로만 응답:
{"title": "영상 제목(원문 문장 그대로 쓰지 말 것)", "category": "직장/알바"|"당근/중고거래"|"연애/소개팅"|"가족/친구"|"황당실수", "hookIdea": "첫 메세지 훅", "synopsis": "원문 줄거리를 따르는 2문장 요약 (인물은 웃긴 닉네임으로)", "twistPoint": "원문 속 반전/웃음 포인트", "coupangProductCategory": "연관 상품 카테고리", "coupangKeyword": "쿠팡 검색 키워드"}`
        });
        console.log(`[PlannerAgent] 📰 출처: 네이트판 「${picked.title}」 ${picked.url}`);
        return {
            id: `plan_${Date.now()}`,
            title: p.title, category: p.category, hookIdea: p.hookIdea, synopsis: p.synopsis, twistPoint: p.twistPoint,
            coupangProductCategory: p.coupangProductCategory || '생활 필수 꿀템',
            coupangKeyword: p.coupangKeyword || '자취 필수템',
            appliedFeedbackRules: feedback.successfulPatterns.slice(0, 2),
            source: { site: picked.site, title: picked.title, url: picked.url, id: picked.id },
            sourceText: picked.text
        };
    }
}

/**
 * 🧠 PlannerAgent (기획 에이전트)
 * - 커뮤니티 썰 트렌드 수집 및 이전 영상의 FeedbackMemory(성공패턴, 약점)를 주입받아
 * - 이번 쇼츠의 타깃 주제, 후킹 포인트, 쿠팡 파트너스 연계 상품군을 완벽 기획
 */
export async function runPlannerAgent(feedback: FeedbackMemory, skipIds: string[] = []): Promise<ContentPlan> {
    console.log('\n[🧠 PlannerAgent] 도파민 유머 썰 기획 및 쿠팡 상품 매칭 시작...');

    // 우선순위: inbox 글 > (PANN_INSPIRATION=1일 때만) 네이트판 > 원문 없는 창작. GEMINI 키가 없는 환경만 아래 구형 경로
    if (process.env.GEMINI_API_KEY) {
        const inbox = planFromInbox(feedback, skipIds);
        if (inbox) return inbox;
        if (process.env.PANN_INSPIRATION === '1') return planFromPann(feedback, skipIds);
        return planFreeform(feedback, skipIds);
    }

    // 1. 실시간 썰 크롤링 시도
    let fetchedRawStory = '';
    for (const feedUrl of VIRAL_COMMUNITY_RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(feedUrl);
            if (feed.items && feed.items.length > 0) {
                const item = feed.items[Math.floor(Math.random() * Math.min(5, feed.items.length))];
                if (item.title) {
                    fetchedRawStory = `${item.title} - ${item.contentSnippet || ''}`;
                    console.log(`[PlannerAgent] 📡 실시간 핫토픽 썰 포착: "${item.title.substring(0, 35)}..."`);
                    break;
                }
            }
        } catch {
            // feed 오류 시 다음 feed 시도
        }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const fallback = BACKUP_VIRAL_STORIES[Math.floor(Math.random() * BACKUP_VIRAL_STORIES.length)];
        return {
            id: `plan_${Date.now()}`,
            ...fallback,
            appliedFeedbackRules: feedback.successfulPatterns.slice(0, 2)
        };
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
당신은 대한민국 최고 숏폼 바이럴 기획자(Planner)입니다.
아래의 [자가 진화 피드백 메모리]를 엄격히 준수하여 유튜브 쇼츠 100만 뷰를 달성할 카카오톡 썰 기획서를 작성하세요.

[자가 진화 피드백 지침]:
- 채널 상태: ${feedback.channelStatus}
- 반드시 적용할 성공 패턴: ${feedback.successfulPatterns.join(' / ')}
- 절대 피해야 할 약점: ${feedback.weaknessesToAvoid.join(' / ')}
- 추천 카테고리: ${feedback.recommendedCategories.join(', ')}

[참고할 실시간 썰 이슈]:
${fetchedRawStory || '당근마켓 네고 빌런 카톡 썰, 직장 상사 카톡 오타 대참사, 친구 간 황당 카톡 실수'}

[요구사항]:
1. 0~2초에 시선을 강탈할 수 있는 hookIdea 설계 (첫 메세지가 질문/제안/폭탄 발언으로 즉시 시작)
2. 대화 중간의 오해/반전과, 마지막 한마디 펀치라인으로 이어지는 twistPoint 기획
3. 3~5명 단톡방 구도(나 + 웃긴 닉네임의 상대 2~4명)로 20~30줄 대화가 나올 수 있는 줄거리. 소재는 친구/가족 일상 개그 위주. 욕설 없이, 대화 안에 광고 없이.
4. 이 썰 영상의 고정 댓글에 자연스럽게 붙일 수 있는 '쿠팡 파트너스 추천 상품 키워드' 1개 선정 (예: 직장 썰 -> 눈마사지기/영양제, 자취/당근 썰 -> 자취필수템, 실수 썰 -> 멘탈케어 차/선물)

반드시 아래 JSON 스키마로만 응답하세요:
{
  "title": "기획 영상 타이틀 (예: 부장님한테 야근 거절 카톡 잘못 보낸 썰 ㅋㅋㅋ)",
  "category": "직장/알바" | "당근/중고거래" | "연애/소개팅" | "가족/친구" | "황당실수",
  "hookIdea": "첫 2초 시선 고정 훅 아이디어",
  "synopsis": "단톡방 인물 구성(닉네임 포함)과 대화 줄거리 2문장",
  "twistPoint": "마지막 반전 포인트",
  "coupangProductCategory": "추천 상품 카테고리명",
  "coupangKeyword": "쿠팡 검색 연관 키워드 (예: 눈마사지기)",
  "appliedFeedbackRules": ["반영한 피드백 지침 1~2개"]
}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const parsed = JSON.parse(response.text || '{}');
        const plan: ContentPlan = {
            id: `plan_${Date.now()}`,
            title: parsed.title || '카톡 역대급 오타 대참사 썰',
            category: parsed.category || '황당실수',
            hookIdea: parsed.hookIdea || '첫 줄부터 빵 터지는 카톡 오타',
            synopsis: parsed.synopsis || '잘못 보낸 카톡 하나로 벌어진 대혼란',
            twistPoint: parsed.twistPoint || '마지막 카톡에서 반전 결말',
            coupangProductCategory: parsed.coupangProductCategory || '생활 필수 꿀템',
            coupangKeyword: parsed.coupangKeyword || '자취 필수템',
            appliedFeedbackRules: parsed.appliedFeedbackRules || feedback.successfulPatterns.slice(0, 2)
        };

        console.log(`[PlannerAgent] ✅ 기획 완료: [${plan.category}] "${plan.title}" (쿠팡 키워드: ${plan.coupangKeyword})`);
        return plan;

    } catch (err: any) {
        console.warn('[PlannerAgent] 기획 생성 실패로 백업 시나리오 적용:', err.message);
        const fallback = BACKUP_VIRAL_STORIES[Math.floor(Math.random() * BACKUP_VIRAL_STORIES.length)];
        return {
            id: `plan_${Date.now()}`,
            ...fallback,
            appliedFeedbackRules: feedback.successfulPatterns.slice(0, 2)
        };
    }
}
