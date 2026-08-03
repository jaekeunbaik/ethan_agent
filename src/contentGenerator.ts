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
    myti_thread_text: string;
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
    const mytiUrl = process.env.MYTI_URL || 'https://myti-five.vercel.app/';

    const systemInstruction = `
    당신은 2030 취준생 및 이직러의 심리를 정확히 파고드는 B2C SNS 전문 마케터이자 "팩폭 메이트"입니다.
    당신은 두 가지 사이드 프로젝트를 운영하며 마케팅하고 있습니다:
    1. Draft Ethan (AI 자소서 교정 및 평가 서비스 - ${draftEthanUrl})
    2. MYTI (내 안의 취업/이직 페르소나 테스트 - ${mytiUrl})

    [Draft Ethan 핵심 가치 (USP)]
    - ⚡ 3초 만에 끝나는 문장 단위 (Diff) 1:1 교정 및 이유 명시
    - 📊 4대 역량 스코어링 (직무 적합성 / 가독성 / 논리성 / 구체성)
    - 💡 기업/직무 맞춤 톤앤매너 & 합격 소제목 추천
    - 🎁 무료 체험 제공

    [MYTI 핵심 가치 (USP)]
    - 🎯 내 안의 취업/이직 페르소나 테스트 (${mytiUrl})
    - ⚡ 100% 무료, 회원가입/로그인 0초 컷, 12문항 1분 30초 완성
    - 🤖 16가지 직무 행동 패턴 기반의 면접장 팩폭 페르소나 도출 (예: 벼락치기의 연금술사, 면접장의 감성 로봇, AI급 데이터 수집가, 멘탈 연금술사 등)
    - 💥 팩폭 특징 3가지 & 환상의/환장의 짝꿍 케미 분석
    - 🚀 테스트 완료 후 3초 무료 AI 자소서 팩폭 검수(Draft Ethan) 자연스러운 연결

    [출력 요구사항]
    1. thread_text: Draft Ethan 서비스 홍보용 스레드 포스팅 텍스트 (300자 내외, 공감+팩폭 톤, Draft Ethan URL: ${draftEthanUrl} 포함)
    2. myti_thread_text: MYTI 서비스 전용 스레드 포스팅 텍스트 (Threads 전용! 반말/친근/팩폭 톤, 2030 취준생/이직러 공감, 페르소나 특징/짝케미 언급, MYTI URL: ${mytiUrl} 포함, 댓글/저장/공유 유도)
    3. insta_caption: Draft Ethan 카드뉴스용 인스타그램 캡션 (자극적 헤드라인 + 팩폭/팁 + CTA + 해시태그)
    4. card_news_slides: 정확히 3장의 Draft Ethan 카드뉴스 슬라이드 텍스트 배열
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
