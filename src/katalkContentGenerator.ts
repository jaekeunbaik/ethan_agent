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
        title: cleanTitle || '팀장님한테 자소서 검수 카톡 보냈다가 광탈할 뻔한 썰',
        topic: '자소서 오탈자 팩폭 썰',
        messages: [
            { sender: 'me', name: '취준생', text: '팀장님! 이번 상반기 자소서 다 썼는데 한번만 봐주실 수 있나요?' },
            { sender: 'other', name: '팀장님', text: '어 그래 보내봐라. 어디 지원하는 건데?' },
            { sender: 'me', name: '취준생', text: '삼성전자요! 제 열정과 헌신을 다 쏟아부었습니다!' },
            { sender: 'other', name: '팀장님', text: '야... 첫 줄부터 "LG전자에 뼈를 묻겠습니다"라고 적혀있는데?' },
            { sender: 'me', name: '취준생', text: '헉... 복붙하다가 실수했습니다 ㅠㅠ' },
            { sender: 'other', name: '팀장님', text: '너 디든(dethan)으로 3초 AI 검수 안 돌렸냐? 당장 가서 돌려라' }
        ],
        ctaText: 'Q. 너도 회사 이름 복붙 실수로 광탈해본 적 있어? 댓글로 썰 풀어봐!',
        instaCaption: `🔥 자소서 복붙하다가 회사 이름 틀려본 사람 손?! 😱\n\n서류 제출 전 3초 만에 AI 팩폭 검수 안 돌리면 진짜 바로 광탈입니다..\n👉 지금 프로필 링크에서 3초 무료 AI 자소서 교정(dethan 디든) 받아보세요!\n\n#자소서 #취준생 #취업썰 #자소서첨삭 #디든 #취업준비 #이직 #대기업취업`,
        threadText: `자소서 10군데 복붙하다가 회사 이름 헷갈려서 LG에 "삼성맨이 되겠습니다" 썼던 썰 푼다 ㅋㅋㅋ\n\n서류 10초 만에 훑어보는 인사담당자가 제일 먼저 거르는 게 이런 오탈자랑 복붙 흔적임..\n\n제발 제출하기 전에 3초 AI 팩폭 검수 한 번만 돌리고 내라!\n👉 프로필 링크에 디든(dethan) 3초 무료 검수 링크 걸어둠!`
    };
}
