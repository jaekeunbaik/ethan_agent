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
    '취준생이 자주 틀리는 자소서 표현 TOP 3 & 수정 가이드',
    '대기업/IT기업 합격자소서는 이것이 다르다: 비포 & 애프터',
    '자소서 성장과정 작성법: 진부한 이야기에서 설득력 있는 스토리로',
    'AI시대 자소서 검수! Draft Ethan으로 3분 만에 임팩트 강화하는 팁',
    '직무별 핵심 역량 키워드 바이블 (개발/마케팅/영업/기획)',
    '수치와 성과 중심의 경험 작성법 (STAR 기법 적용 공식)',
    '면접관이 10초 만에 훑어보는 자소서 서두 작성 공식',
    '자소서 서류 탈락 줄이는 5가지 필수 체크리스트'
];

/**
 * Gemini 2.5 API를 활용하여 인스타그램/스레드 홍보 콘텐츠 및 카드뉴스 슬라이드 생성
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
    당신은 Draft Ethan(AI 자소서 교정 및 최적화 서비스)의 10년 차 수석 SNS 마케팅 에디터입니다.
    취준생과 이직러의 눈길을 사로잡고 실제 웹사이트 방문으로 이어지게 만드는 고성능 마케팅 콘텐츠를 작성하세요.

    [Draft Ethan 서비스 핵심 가치]
    - AI 기반 자소서 문맥 교정, 맞춤법/문체 최적화, 직무별 핵심 키워드 추천, 임팩트 있는 비포&애프터 제시.

    [출력 요구사항]
    1. thread_text: 스레드용 숏폼 텍스트 (위트 있고 가독성 좋은 300자 내외, 공감대 형성, 자연스러운 Draft Ethan URL 링크 포함: ${draftEthanUrl})
    2. insta_caption: 인스타그램 본문 캡션 (핵심 요약 + 유용한 팁 + CTA + 해시태그 포함 (#자소서 #합격자소서 #DraftEthan #취준생 #이직러 #취업성공 #AI자소서교정))
    3. card_news_slides: 정확히 3장의 카드뉴스 슬라이드 텍스트 배열
       - 1장 (COVER): 사람들의 호기심과 클릭을 유도하는 강렬한 제목과 서브타이틀
       - 2장 (BODY): 실용적인 핵심 꿀팁 3~4가지를 contentLines 배열로. 각 항목은 간결하고 임팩트 있게 1~2줄로. highlightText에 핵심 메시지 한 줄.
       - 3장 (CTA): "더 완벽한 자소서를 원한다면? Draft Ethan에서 무료 교정 받기!" 메시지와 액션 유도. contentLines에 서비스 장점 3가지.
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
                    parts: [{ text: `오늘의 홍보 주제: "${selectedTopic}". 이 주제로 인스타그램 카드뉴스, 인스타 캡션, 스레드 포스팅 콘텐츠를 생성해 줘.` }]
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
