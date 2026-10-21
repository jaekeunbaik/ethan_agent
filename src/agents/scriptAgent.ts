import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ContentPlan, FeedbackMemory, ScriptOutput, KatalkMessage } from './types';

dotenv.config();

const DEFAULT_COUPANG_URL = process.env.COUPANG_PARTNERS_URL || 'https://link.coupang.com/a/h183YcFkvA';

/**
 * ✍️ ScriptAgent (대본/카피 에이전트)
 * - 기획서(ContentPlan)를 바탕으로 15~25초 분량의 초고속 티키타카 카톡 대본 작성
 * - 0~2초 이탈률을 방어하는 상단 배너 헤드라인, 댓글 폭발 유도 퀴즈(CTA),
 * - 쿠팡 파트너스 수익화 링크 및 필수 공정위 문구 생성
 */
export async function runScriptAgent(plan: ContentPlan, feedback: FeedbackMemory): Promise<ScriptOutput> {
    console.log(`\n[✍️ ScriptAgent] 기획안 바탕 대본 작성 중: "${plan.title}"`);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return getFallbackScript(plan);
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
당신은 유튜브 쇼츠 누적 조회수 5천만 뷰를 기록한 카카오톡 썰 전문 작가(ScriptAgent)입니다.
아래의 [기획서]와 [자가 진화 피드백]을 바탕으로 시청자가 1초도 스크롤을 넘기지 못할 대박 카톡 대본을 작성하세요.

[기획서]:
- 제목: ${plan.title}
- 카테고리: ${plan.category}
- 훅 아이디어: ${plan.hookIdea}
- 줄거리: ${plan.synopsis}
- 반전 포인트: ${plan.twistPoint}
- 쿠팡 매칭 키워드: ${plan.coupangKeyword}

[피드백 작성 지침]:
- 약점 회피: ${feedback.weaknessesToAvoid.join(' / ')}
- 바이럴 훅 규칙: ${feedback.viralHookRules.join(' / ')}

[대본 작성 절대 규칙]:
1. 메세지 개수: 정확히 4~6개의 톡으로 구성 (영상 길이 20초 안팎의 빠른 호흡 유지)
2. 구어체: 실제 카톡하듯 짧고 직관적인 구어체 ("팀장님", "응 왜?", "잘못 보냈습니다 ㅠㅠ")
3. TTS 읽기 호환: 영문/외래어는 반드시 한글 발음으로 표기 (예: OK -> 오케이, DM -> 디엠)
4. hookHeadline: 영상 맨 위에 시선 강탈용으로 띄울 짧고 강렬한 한 줄 (예: "🚨 부장님한테 욕 카톡 잘못 보냄 ㅋㅋㅋ")
5. ctaQuiz: 댓글창에 시청자들이 편을 갈라 싸우거나 투표하게 만드는 질문 (예: "Q. 솔직히 이건 상사가 꼰대다 vs 신입이 선 넘었다? 댓글 ㄱㄱ")

반드시 아래 JSON 스키마 형식으로만 응답하세요:
{
  "hookHeadline": "영상 상단 배너 문구",
  "messages": [
    { "sender": "me", "name": "나", "text": "첫 톡 내용" },
    { "sender": "other", "name": "상대방 이름", "text": "답장 내용" }
  ],
  "ctaQuiz": "댓글 참여 유도 퀴즈 문구",
  "coupangProductMention": "쿠팡 상품을 센스있게 소개하는 한 줄"
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
        const messages: KatalkMessage[] = parsed.messages && parsed.messages.length >= 3 
            ? parsed.messages 
            : getFallbackScript(plan).messages;

        const hookHeadline = parsed.hookHeadline || `[대참사] ${plan.hookIdea}`;
        const ctaQuiz = parsed.ctaQuiz || 'Q. 여러분이라면 이 상황에서 어떻게 하시겠습니까? 댓글로 투표해주세요!';
        const coupangMention = parsed.coupangProductMention || `영상 속 멘탈 회복 꿀템 (${plan.coupangKeyword})`;

        // 고정 댓글 문구 (쿠팡 파트너스 링크 + 필수 공정위 문구)
        const coupangComment = `👇 ${coupangMention} 특가 보러가기:\n🔗 ${DEFAULT_COUPANG_URL}\n\n※ 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`;

        // 유튜브 영상 설명
        const youtubeDescription = `${plan.title}\n\n${ctaQuiz}\n\n━━━━━━━━━━━━━━━━━━━━\n🛒 화제의 추천 아이템 (${plan.coupangKeyword})\n👉 ${DEFAULT_COUPANG_URL}\n\n(이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.)\n━━━━━━━━━━━━━━━━━━━━\n\n#Shorts #카톡썰 #유머 #레전드썰 #${plan.category.replace(/[^가-힣a-zA-Z]/g, '')}`;

        const tags = ['Shorts', '카톡썰', '유머', '레전드썰', '썰', plan.category, plan.coupangKeyword];

        const scriptOutput: ScriptOutput = {
            planId: plan.id,
            title: `${plan.title} #Shorts`,
            hookHeadline,
            messages,
            ctaQuiz,
            coupangComment,
            youtubeDescription,
            tags
        };

        console.log(`[ScriptAgent] ✅ 대본 작성 완수! (톡 ${messages.length}개, 배너: "${hookHeadline}")`);
        return scriptOutput;

    } catch (err: any) {
        console.warn('[ScriptAgent] 대본 생성 실패로 안전 백업 대본 사용:', err.message);
        return getFallbackScript(plan);
    }
}

function getFallbackScript(plan: ContentPlan): ScriptOutput {
    const messages: KatalkMessage[] = [
        { sender: 'me', name: '나', text: '부장님 내일 출근 못 할 것 같습니다 ㅠㅠ' },
        { sender: 'other', name: '부장님', text: '왜 무슨 일인데? 어디 아프냐?' },
        { sender: 'me', name: '나', text: '부장님 얼굴 볼 자신이 없습니다...' },
        { sender: 'other', name: '부장님', text: '?? 너 어제 술자리에서 무슨 짓 했냐?' },
        { sender: 'me', name: '나', text: '부장님 머리에 맥주 붓고 탬버린 쳤습니다 죄송합니다' },
        { sender: 'other', name: '부장님', text: '...내일 시말서 쓰고 연차 올려라 ㅋㅋㅋ' }
    ];

    const coupangComment = `👇 직장인 피로회복 꿀템 (${plan.coupangKeyword}):\n🔗 ${DEFAULT_COUPANG_URL}\n\n※ 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`;

    return {
        planId: plan.id,
        title: `${plan.title} #Shorts`,
        hookHeadline: '🚨 술김에 부장님 머리에 맥주 부은 신입 카톡 ㅋㅋㅋ',
        messages,
        ctaQuiz: 'Q. 솔직히 이건 부장님이 대인배다 vs 그래도 퇴사각이다? 댓글로 남겨줘!',
        coupangComment,
        youtubeDescription: `${plan.title}\n\nQ. 이건 부장님이 대인배다 vs 그래도 퇴사각이다?\n\n🛒 피로회복/숙취해소 꿀템: ${DEFAULT_COUPANG_URL}\n(이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.)\n\n#Shorts #카톡썰 #직장인썰 #레전드썰`,
        tags: ['Shorts', '카톡썰', '직장인썰', '레전드썰', '유머']
    };
}
