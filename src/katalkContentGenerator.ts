import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import { CommunityStory } from './communityFetcher';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
}

const ai = new GoogleGenAI({ apiKey });

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
 * 수집한 썰을 2인 카카오톡 톡 대화 대본으로 자동 변환하는 AI 생성기
 */
export async function generateKatalkScript(story: CommunityStory): Promise<KatalkScriptResponse> {
    console.log(`[KatalkContentGenerator] 🤖 썰 기반 카톡 2인 대화 대본 생성 중: "${story.title}"`);

    const systemInstruction = `
    당신은 대한민국 최고 숏폼 바이럴 카카오톡 썰 제작자입니다.
    유튜브 쇼츠 / 인스타 릴스에서 조회수 100만 이상 터지는 2인 카카오톡 대화 대본을 만드세요.

    [대본 작성 필수 규칙]
    1. 대화 상대: "나"(취준생/직장인) vs "상대방"(꼰대 팀장님 / 까칠한 면접관 / 친한 친구)
    2. 메세지 개수: 정확히 4~6개의 톡 메세지로 구성하여 15~25초 숏폼 속도감 유지
    3. 말투: 100% 생생한 구어체, 짤막한 톡 어투 ("팀장님!", "응 왜?", "실수로 누나라고 보냄", "미쳤냐?")
    4. 음성(TTS) 읽기 호환: 영문 알파벳(Before, After, AI, Diff 등) 금지! 한글 발음("비포", "애프터", "에이아이", "디든")으로 표기
    5. 마지막 ctaText: "Q. 너도 자소서 오탈자로 광탈할래? 3초 만에 디든(dethan) 무료 교정받자!" 형태의 댓글 유도 퀴즈 문구 작성
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

    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [
            {
                role: 'user',
                parts: [{ text: `다음 썰을 바탕으로 대박 터질 카톡 숏폼 대본을 생성해 줘: 제목 "${story.title}", 내용 "${story.content}"` }]
            }
        ],
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.8
        }
    });

    const text = response.text;
    if (!text) throw new Error('Gemini API 응답이 비어있습니다.');
    const data: KatalkScriptResponse = JSON.parse(text);

    console.log(`[KatalkContentGenerator] ✅ 대본 생성 성공! 메세지 ${data.messages.length}개`);
    return data;
}
