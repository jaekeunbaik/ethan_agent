import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { FeedbackMemory, ContentPlan } from './types';

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

/**
 * 🧠 PlannerAgent (기획 에이전트)
 * - 커뮤니티 썰 트렌드 수집 및 이전 영상의 FeedbackMemory(성공패턴, 약점)를 주입받아
 * - 이번 쇼츠의 타깃 주제, 후킹 포인트, 쿠팡 파트너스 연계 상품군을 완벽 기획
 */
export async function runPlannerAgent(feedback: FeedbackMemory): Promise<ContentPlan> {
    console.log('\n[🧠 PlannerAgent] 도파민 유머 썰 기획 및 쿠팡 상품 매칭 시작...');

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
1. 0~2초에 시선을 강탈할 수 있는 자극적이고 재미있는 hookIdea 설계
2. 대화 중간의 예상치 못한 반전(twistPoint) 기획
3. 이 썰 영상의 하단/댓글에 자연스럽게 붙일 수 있는 '쿠팡 파트너스 추천 상품 키워드' 1개 선정 (예: 직장 썰 -> 눈마사지기/영양제, 자취/당근 썰 -> 자취필수템, 실수 썰 -> 멘탈케어 차/선물)

반드시 아래 JSON 스키마로만 응답하세요:
{
  "title": "기획 영상 타이틀 (예: 부장님한테 야근 거절 카톡 잘못 보낸 썰 ㅋㅋㅋ)",
  "category": "직장/알바" | "당근/중고거래" | "연애/소개팅" | "가족/친구" | "황당실수",
  "hookIdea": "첫 2초 시선 고정 훅 아이디어",
  "synopsis": "대화 줄거리 2문장",
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
