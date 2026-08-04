import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import { fetchLatestCareerTrend, TrendNewsArticle } from './trendFetcher';

dotenv.config();

export interface CardNewsSlide {
    slideNumber: number;
    type: 'COVER' | 'BODY' | 'CTA';
    title: string;
    subtitle?: string;
    contentLines: string[];
    highlightText?: string;
}

export interface MarketingContentResponse {
    topic: string;
    thread_text: string;
    myti_thread_text: string;
    insta_caption: string;
    card_news_slides: CardNewsSlide[];
    news_source?: string;
}

const MARKETING_TOPICS = [
    // [프로필 고정 게시물 Pinned Posts]
    '[서비스 소개] 3초 만에 자소서 평가받는 법 (무료 혜택)',
    '[대표 B&A] 서류 탈락하는 자소서 vs 합격하는 자소서 차이 (Diff 시연)',
    '[브랜드 스토리] 우리가 10만 원짜리 자소서 컨설팅을 AI로 만든 이유',

    // [Concept A: 팩폭 Before & After]
    '"어릴 적부터 진취적이었던 저는..." 자소서 망하는 대표 문장 심폐소생',
    '서류 탈락하는 자소서엔 이것이 없습니다: AI 비포 & 애프터 1:1 교정',
    '대기업 합격자소서 비포 & 애프터: 문장 하나로 서류 합불이 갈리는 이유',

    // [Concept B: 직무별/기업별 맞춤 자소서 치트키]
    '마케터 지원자가 자소서에 절대 쓰면 안 되는 금지어 5가지',
    '개발자/영업직 자소서 톤앤매너 설정법 (논리형 vs 자신감형)',
    '합격률 높여주는 항목별 소제목(Headline) 템플릿 모음',
    '자소서 서두 10초 만에 훑어보는 면접관을 사로잡는 두괄식 작성 공식',

    // [Concept C & D: 숏폼 & 참여형]
    '자소서 첨삭에 10만 원 쓴 친구 오열하는 영상: 3초 완성 AI 교정',
    '소제목 못 짜서 밤새는 취준생 구함: Draft Ethan 소제목 자동 추출'
];

/**
 * Gemini API를 활용하여 실시간 검증된 이슈/뉴스 기반 마케팅 콘텐츠 생성
 */
export async function generateMarketingContent(): Promise<MarketingContentResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY가 .env에 설정되어 있지 않습니다.');
    }

    const ai = new GoogleGenAI({ apiKey });

    // 실시간 뉴스 트렌드 수집
    const trendNews: TrendNewsArticle | null = await fetchLatestCareerTrend();

    const selectedTopic = trendNews 
        ? `[실시간 이슈 팩폭] ${trendNews.title}` 
        : MARKETING_TOPICS[Math.floor(Math.random() * MARKETING_TOPICS.length)];

    const draftEthanUrl = process.env.DRAFT_ETHAN_URL || 'https://draft-ethan.com';
    const mytiUrl = process.env.MYTI_URL || 'https://myti-five.vercel.app/';

    const newsContextInstruction = trendNews ? `
    [🚨 실시간 뉴스 기반 사실(Fact) 원칙 - 필수 준수]
    - 수집된 실제 뉴스: "${trendNews.title}"
    - 언론사 출처: ${trendNews.source}
    - 보도 요약/스니펫: ${trendNews.snippet}
    
    ⚠️ 작성 지침 (가짜 뉴스 방지 및 사실 기반 보장):
    1. 지어낸 통계 수치나 가짜 뉴스, 할루시네이션(환각)은 절대 금지합니다! 뉴스에 명시된 사실과 채용 시장의 객관적 현실만을 바탕으로 작성하세요.
    2. 콘텐츠(스레드/인스타/카드뉴스)에 반드시 출처를 표기하세요 (예: "📰 출처: ${trendNews.source} 보도 / 실시간 뉴스 분석").
    3. 이 뉴스가 취준생/이직러의 자소서 작성 및 면접 준비에 미치는 실질적인 영향을 팩폭 톤으로 전달하고, Draft Ethan과 MYTI로 해결책을 제안하세요.
    ` : '';

    const systemInstruction = `
    당신은 2030 취준생 및 이직러의 심리를 정확히 파고드는 B2C SNS 전문 마케터이자 "팩폭 메이트"입니다.
    당신은 두 가지 사이드 프로젝트를 운영하며 마케팅하고 있습니다:
    1. Draft Ethan (AI 자소서 교정 및 평가 서비스 - ${draftEthanUrl})
    2. MYTI (내 안의 취업/이직 페르소나 테스트 - ${mytiUrl})
    ${newsContextInstruction}

    [Draft Ethan 핵심 가치 (USP)]
    - ⚡ 3초 만에 끝나는 문장 단위 (Diff) 1:1 교정 및 이유 명시 (이든으로 발음)
    - 📊 4대 역량 스코어링 (직무 적합성 / 가독성 / 논리성 / 구체성)
    - 💡 기업/직무 맞춤 톤앤매너 & 합격 소제목 추천
    - 🎁 무료 체험 제공

    [MYTI 핵심 가치 (USP)]
    - 🎯 내 안의 취업/이직 페르소나 테스트 (${mytiUrl})
    - ⚡ 100% 무료, 회원가입/로그인 0초 컷, 12문항 1분 30초 완성
    - 🤖 16가지 직무 행동 패턴 기반의 면접장 팩폭 페르소나 도출
    - 💥 팩폭 특징 3가지 & 환상의/환장의 짝꿍 케미 분석
    - 🚀 테스트 완료 후 3초 무료 AI 자소서 팩폭 검수(Draft Ethan) 자연스러운 연결

    [유튜브 쇼츠 썰툰/스토리 3단계 카피라이팅 원칙 (필수 준수)]
    - ⚠️ 모든 card_news_slides의 title, subtitle, contentLines 문장은 절대로 뉴스 기사체나 존댓말(~입니다, ~했습니다)을 쓰지 마세요!
    - 100% 친한 친구에게 썰 풀듯 텐션 높은 반말/썰 스피치 구어체(~했거든?, ~인 거야, ~라고 하더라고, ~해봐!)로만 작성하세요!
    - 1문장은 10자 내외로 짧게 끊어서 빠르고 드라마틱한 호흡 유지!
    - 1. Hook (0~5초 / Cover Slide): 오프닝 인사 없이 바로 핫이슈로 훅! ("야 이번에 대규모 채용 소식 들었냐?")
    - 2. Body (5~22초 / Body Slide): 인사담당자 관점의 팩폭 비교 ("아직도 열정만 적고 3초 만에 광탈당하더라?")
    - 3. Call to Action (22~30초 / CTA Slide): Draft Ethan(이든) 3초 무료 AI 팩폭 교정 제안 ("드래프트 이든 AI에서 3초 만에 팩폭 교정받고 합격하자!")

    [출력 요구사항]
    1. thread_text: Draft Ethan 서비스 홍보용 스레드 포스팅 텍스트 (300자 내외, 공감+팩폭 톤, 실제 뉴스 출처 및 Draft Ethan URL: ${draftEthanUrl} 포함)
    2. myti_thread_text: MYTI 서비스 전용 스레드 포스팅 텍스트 (Threads 전용! 반말/친근/팩폭 톤, 2030 취준생/이직러 공감, 페르소나 특징/짝케미 언급, MYTI URL: ${mytiUrl} 포함, 댓글/저장/공유 유도)
    3. insta_caption: Draft Ethan 카드뉴스용 인스타그램 캡션 (자극적 헤드라인 + 뉴스 팩폭/팁 + CTA + 해시태그 + 뉴스 출처 표기)
    4. card_news_slides: 정확히 3장의 Draft Ethan 카드뉴스/쇼츠 슬라이드 텍스트 배열 (1번 COVER: 훅, 2번 BODY: BEFORE/AFTER 팩폭 비교, 3번 CTA: 이든 3초 무료 교정 제안 및 프로필 링크 유도)
  `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            topic: { type: Type.STRING },
            thread_text: { type: Type.STRING },
            myti_thread_text: { type: Type.STRING },
            insta_caption: { type: Type.STRING },
            card_news_slides: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        slideNumber: { type: Type.INTEGER },
                        type: { type: Type.STRING, enum: ['COVER', 'BODY', 'CTA'] },
                        title: { type: Type.STRING },
                        subtitle: { type: Type.STRING },
                        contentLines: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        },
                        highlightText: { type: Type.STRING }
                    },
                    required: ['slideNumber', 'type', 'title', 'contentLines']
                }
            }
        },
        required: ['topic', 'thread_text', 'myti_thread_text', 'insta_caption', 'card_news_slides']
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `오늘의 홍보 주제: "${selectedTopic}". 이 주제로 Draft Ethan용 (인스타 캡션, 인스타 3슬라이드 카드뉴스, 스레드 문구) 및 MYTI 전용 스레드 포스팅 문구를 생성해 줘.` }]
                }
            ],
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
                temperature: 0.7
            }
        });

        const responseText = response.text;
        if (!responseText) {
            throw new Error('Gemini API 응답이 비어있습니다.');
        }

        const data: MarketingContentResponse = JSON.parse(responseText);
        return data;
    } catch (error) {
        console.error('Gemini API 콘텐츠 생성 오류:', error);
        throw error;
    }
}
