import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';

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
    insta_caption: string;
    card_news_slides: CardNewsSlide[];
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
 * Gemini API를 활용하여 인스타그램/스레드 홍보 콘텐츠 및 3슬라이드 카드뉴스 생성
 */
export async function generateMarketingContent(): Promise<MarketingContentResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY가 .env에 설정되어 있지 않습니다.');
    }

    const ai = new GoogleGenAI({ apiKey });

    // 랜덤 주제 선택
    const selectedTopic = MARKETING_TOPICS[Math.floor(Math.random() * MARKETING_TOPICS.length)];
    const draftEthanUrl = process.env.DRAFT_ETHAN_URL || 'https://draft-ethan.com';

    const systemInstruction = `
    당신은 Draft Ethan(AI 자소서 교정 및 평가 서비스)의 10년 차 수석 마케터이자 "취업 시장의 뼈 때리는 팩폭 메이트 & AI 취업 코치"입니다.
    취준생과 이직 준비생의 답답함에 깊이 공감하되, 딱딱하지 않게 바로 해결책을 던져주는 위트 있고 자극적인 톤앤매너로 작성하세요.

    [Draft Ethan 핵심 가치 (USP)]
    - ⚡ 3초 만에 끝나는 문장 단위 (Diff) 1:1 교정 및 이유 명시
    - 📊 4대 역량 스코어링 (직무 적합성 / 가독성 / 논리성 / 구체성)
    - 💡 기업/직무 맞춤 톤앤매너(논리적, 전문적 등) & 합격 소제목 자동 추천
    - 🎁 무료 체험 제공 (비용 부담 Zero, 10만 원 컨설팅 대비 시간/비용 90% 절감)
    - 📌 프로필 검색 최적화(SEO): AI 자소서 첨삭·평가 | draft_ethan

    [출력 요구사항]
    1. thread_text: 스레드용 숏폼 텍스트 (위트 있고 가독성 좋은 300자 내외, 공감대 형성 + 팩폭 메시지, 자연스러운 Draft Ethan URL 링크 포함: ${draftEthanUrl})
    2. insta_caption: 인스타그램 본문 캡션 (자극적인 첫 줄 헤드라인 + 본문 팩폭/팁 + 서비스 셀링 포인트 + CTA: "프로필 링크에서 무료로 확인하세요!" + 필수 해시태그 포함 (#자소서첨삭 #자기소개서 #취준생 #서류합격 #취업준비 #이력서컨설팅 #자소서예시 #AI자소서 #이직준비 #취업인스타그램))
    3. card_news_slides: 정확히 3장의 카드뉴스 슬라이드 텍스트 배열
       - 1장 (COVER): 자극적 공감 유도 / 호기심 클릭 타이틀 (예: "어릴 적부터 진취적이었던 저는..." (X), "서류 탈락하는 자소서의 흔한 착각")
       - 2장 (BODY): Before vs After 문장 교정 시연 및 4대 역량 스코어 점수 상승 표기.
         * contentLines: [
             "Before: 어릴 적부터 진취적이고 적극적인 자세로 일을 처리했습니다.",
             "After: ROAS 280% 달성 과정에서 데이터 기반 개편을 주도했습니다.",
             "📈 직무 적합성 +35pt | 논리성 +40pt 상승!"
           ]
         * highlightText: 교정 핵심 이유 (예: "추상적인 미사여구 대신 직무 수치와 성과를 명시하세요.")
       - 3장 (CTA): "내 자소서는 몇 점일까? 지금 프로필 링크에서 무료로 확인해 보세요!" 
         * contentLines: [
             "⚡ 3초 만에 문장 단위 (Diff) 1:1 맞춤 교정",
             "📊 4대 역량 스코어링 (직무적합/가독성/논리성/구체성)",
             "🎁 비용 부담 Zero! 프로필 링크에서 바로 시작"
           ]
  `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            topic: { type: Type.STRING },
            thread_text: { type: Type.STRING },
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
        required: ['topic', 'thread_text', 'insta_caption', 'card_news_slides']
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `오늘의 홍보 주제: "${selectedTopic}". 이 주제로 3슬라이드 인스타그램 카드뉴스, 인스타 캡션, 스레드 포스팅 콘텐츠를 생성해 줘.` }]
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
