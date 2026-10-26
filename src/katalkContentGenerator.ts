import { Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import { CommunityStory } from './communityFetcher';
import { generateContentWithFallback } from './geminiHelper';

dotenv.config();

export interface KatalkChatMessage {
    sender: 'me' | 'other';
    name: string;
    text: string;
}

export interface KatalkScriptResponse {
    title: string;
    topic: string;
    messages: KatalkChatMessage[];
    ctaText: string;
    instaCaption: string;
    threadText: string;
}

/**
 * 수집한 썰을 2인 카카오톡 톡 대화 대본으로 자동 변환하는 AI 생성기 (멀티 모델 자동 폴백 내장)
 */
export async function generateKatalkScript(story: CommunityStory): Promise<KatalkScriptResponse> {
    console.log(`[KatalkContentGenerator] 🤖 썰 기반 카톡 2인 대화 대본 생성 중: "${story.title}"`);

    const systemInstruction = `
    당신은 디시인사이드, 에펨코리아, 블라인드, 네이트판 등 인터넷 커뮤니티에서 실시간 베스트를 찍는 100% 현실 '카톡 썰' 전문 제작자입니다.
    유튜브 쇼츠 / 틱톡 / 릴스에서 시청자가 "이거 내 카톡 캡처한 줄 ㅋㅋㅋ", "진짜 숨 막히네"라며 몰입할 수 있는 리얼한 2인 카톡 대본을 만드세요.

    [절대 금지 사항]
    - 대화 본문에 어색한 제품 홍보나 광고 멘트(AI 검수, 앱 추천 등) 절대 금지! (시청자가 가짜 주작인 거 알고 바로 이탈함)
    - 교과서적인 문어체나 딱딱한 설명 금지

    [대본 작성 필수 규칙]
    1. 현실적인 캐릭터 관계: (예: 당근 진상 vs 판매자 / 찐친끼리의 폭로 / 직장 상사 vs 신입의 아찔한 실수 / 연애·소개팅 참사)
    2. 메세지 호흡: 정확히 4~6개의 톡 메시지. 짧고 타격감 있는 티키타카 (실제 카톡처럼 짤막하게 던지기)
    3. 말투: 100% 날 것 그대로의 현실 커뮤니티 구어체.
       - 감탄사, 리액션 적극 활용 ("아 진짜요?", "미쳤냐 진짜 ㅋㅋㅋ", "헐 설마", "아니 그게 아니고")
    4. 음성(TTS) 호환: 영어 약어는 반드시 한글 발음으로 표기.
    5. 마지막 ctaText: 시청자들이 댓글로 서로 싸우거나 편 들어줄 수 있는 논쟁형 질문 ("이거 누가 잘못한 거냐? ㅋㅋㅋ", "너네라면 손절 침?")
    `;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            messages: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        sender: { type: Type.STRING, enum: ['me', 'other'] },
                        name: { type: Type.STRING },
                        text: { type: Type.STRING }
                    },
                    required: ['sender', 'name', 'text']
                }
            },
            ctaText: { type: Type.STRING },
            instaCaption: { type: Type.STRING },
            threadText: { type: Type.STRING }
        },
        required: ['title', 'topic', 'messages', 'ctaText', 'instaCaption', 'threadText']
    };

    try {
        const data = await generateContentWithFallback<KatalkScriptResponse>({
            systemInstruction,
            userPrompt: `다음 썰을 바탕으로 대박 터질 카톡 숏폼 대본을 생성해 줘: 제목 "${story.title}", 내용 "${story.content}"`,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.8
        });

        console.log(`[KatalkContentGenerator] ✅ 카톡 대본 생성 완수! (메세지 ${data.messages.length}개, 제목: "${data.title}")`);
        return data;
    } catch (err: any) {
        console.warn('[KatalkContentGenerator] ⚠️ 모든 AI 모델 호출 실패로 안전 오프라인 템플릿으로 자동 전환합니다:', err.message);
        return getFallbackKatalkScript(story);
    }
}

/**
 * 모든 Gemini API가 일시 장애일 때 파이프라인 중단을 막아주는 고품질 룰 기반 백업 카톡 대본
 */
function getFallbackKatalkScript(story: CommunityStory): KatalkScriptResponse {
    const cleanTitle = story.title.replace(/\[.*?\]|\(.*?\)/g, '').trim();
    return {
        title: cleanTitle || '팀장님한테 실수로 전여친 카톡 복붙해서 보낸 썰',
        topic: '직장 대참사 썰',
        messages: [
            { sender: 'me', name: '김사원', text: '자기야 오늘 끝나고 마라탕 먹으러 갈까? 보고 싶어' },
            { sender: 'other', name: '박팀장', text: '김사원... 이거 나한테 보낸 거 맞나?' },
            { sender: 'me', name: '김사원', text: '헐 팀장님 죄송합니다!! 잘못 보냈습니다 진짜 죄송합니다!!' },
            { sender: 'other', name: '박팀장', text: '마라탕 2단계에 꿔바로우 추가하면 같이 가줌.' },
            { sender: 'me', name: '김사원', text: '네? 진짜요?' },
            { sender: 'other', name: '박팀장', text: '농담이고 법카 챙겨서 6시에 1층으로 내려와라.' }
        ],
        ctaText: '이런 상사 있으면 이직 생각 바로 접는다 vs 그래도 식은땀 난다 댓글 달아봐 ㅋㅋㅋ',
        instaCaption: `🔥 팀장님한테 애칭 카톡 잘못 보냈을 때 대처법 😱\n\n진짜 심장 멎을 뻔했는데 팀장님 반응 반전 실화냐 ㅋㅋㅋ\n\n#직장인썰 #카톡실수 #회사생활 #팀장님 #공감유머 #썰스타그램`,
        threadText: `팀장님한테 "자기야 마라탕 먹을까?" 잘못 보내서 퇴사할 뻔한 썰 푼다 ㅋㅋㅋ\n\n손 덜덜 떨리면서 취소 버튼 찾는데 1초 만에 1 읽힘 뜸...\n근데 답장이 "꿔바로우 사주면 봐줌" ㅋㅋㅋㅋ 갓팀장 인정?`
    };
}
