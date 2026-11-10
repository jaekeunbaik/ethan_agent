import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ContentPlan, FeedbackMemory, ScriptOutput, KatalkMessage } from './types';

dotenv.config();

const DEFAULT_COUPANG_URL = process.env.COUPANG_PARTNERS_URL || 'https://link.coupang.com/a/h183YcFkvA';

const MAX_ATTEMPTS = 3;
const MIN_MESSAGES = 18;
const MIN_PARTICIPANTS = 3; // 'me' 제외 서로 다른 상대 닉네임 수
const AD_PATTERN = /쿠팡|coupang|파트너스|https?:\/\/|링크|최저가|할인|특가/i;
// shortcut: 소수 욕설만 마스킹, 목록 확장은 필요할 때
const PROFANITY_PATTERN = /씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|지랄|좆|존나|개새끼|새끼|미친놈/g;

function cleanMessages(raw: any): KatalkMessage[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .filter((m: any) => m && typeof m.text === 'string' && m.text.trim() && (m.sender === 'me' || m.sender === 'other'))
        .map((m: any): KatalkMessage => ({
            sender: m.sender,
            name: String(m.name || (m.sender === 'me' ? '나' : '상대')),
            text: m.text.trim().replace(PROFANITY_PATTERN, (w: string) => '*'.repeat(w.length))
        }))
        .filter(m => !AD_PATTERN.test(m.text)); // 광고는 고정 댓글로만
}

function validateMessages(messages: KatalkMessage[]): string | null {
    if (messages.length < MIN_MESSAGES) return `메시지 ${messages.length}개 (<${MIN_MESSAGES})`;
    const names = new Set(messages.filter(m => m.sender === 'other').map(m => m.name));
    if (names.size < MIN_PARTICIPANTS) return `상대 닉네임 ${names.size}명 (<${MIN_PARTICIPANTS})`;
    return null;
}

function buildPrompt(plan: ContentPlan, feedback: FeedbackMemory): string {
    return `
당신은 유튜브 쇼츠 누적 조회수 5천만 뷰를 기록한 카카오톡 단톡방 썰 전문 작가(ScriptAgent)입니다.
아래의 [기획서]와 [자가 진화 피드백]을 바탕으로 시청자가 1초도 스크롤을 넘기지 못할 대박 카톡 대본을 작성하세요.

[기획서]:
- 제목: ${plan.title}
- 카테고리: ${plan.category}
- 훅 아이디어: ${plan.hookIdea}
- 줄거리: ${plan.synopsis}
- 반전 포인트: ${plan.twistPoint}

[피드백 작성 지침]:
- 약점 회피: ${feedback.weaknessesToAvoid.join(' / ')}
- 바이럴 훅 규칙: ${feedback.viralHookRules.join(' / ')}

[대본 작성 절대 규칙 - 레퍼런스 바이럴 쇼츠 스타일시트]:
0. 이야기 품질(가장 중요): 반전은 앞 대사에서 깔아 둔 복선이 있어야 말이 되고, 마지막 펀치라인은 그 반전에서 자연스럽게 나와야 한다. 설정이 모순되면(예: 구매자 사진과 다른 사람이 나왔는데 이유가 억지) 불합격. 한 가지 사건만 다루고, 등장인물 반응("헐", "ㅋㅋㅋ"만 있는 줄)은 전체의 25% 이하. 매 줄이 정보·웃음·갈등 중 하나를 더해야 한다.
   좋은 예(실제 조회수 400만 구조): 친구 "시험 끝나고 니 집에서 술 먹기로 했는데 니도 올래?" → 나 "내집??" → 친구 "ㅇㅇ 니집에서 마실건데" → (사진: 다리 깁스) 나 "아무도 안 믿은거임?" → "차가 날 쳤다고" → "그걸 왜 가만히 있냐 / 피하면 되는걸 / 무빙을 못 치네" → "너희가 사람이냐". 즉 말도 안 되는 상황 하나를 던지고 친구들이 위로 대신 가볍게 놀리는 구조.
1. 메세지 개수: 20~26개 (한 줄당 1~1.2초, 영상 총 길이 35초 이내가 목표). 18개 미만이면 불합격.
2. 단톡방 구성: 나(sender "me") 1명 + 상대 2~4명 = 총 3~5명. 상대는 전부 sender "other"이되 name을 서로 다르게, 웃긴 닉네임으로 (예: 화난 어피치, 소심한 네오, 빈털털이 제이지). 최소 3개의 서로 다른 닉네임이 말해야 함.
3. 첫 메세지(0~3초)에서 즉시 훅: 질문/제안/폭탄 발언으로 바로 시작. 인사말·상황설명 금지.
4. 중반에 오해 또는 반전 (예: "진짜임?", "아무도 안 믿은 거임?")을 넣어 대화가 뒤집히게.
5. 마지막 메세지는 짧은 한마디 펀치라인 한 줄 (예: "너희가 사람이냐", "오케이").
6. 각 메세지는 25자 이내의 짧은 구어체. 실제 친구/가족끼리 카톡하듯 (ㅋㅋ, ㅠㅠ, ?? 활용). 소재는 친구·가족 일상 개그 위주.
7. 욕설 금지. 불가피하면 순화하거나 **** 로 마스킹.
8. 대화 안에 광고·쿠팡·링크·상품 홍보 절대 금지 (광고는 coupangProductMention 필드에만).
9. TTS 읽기 호환: 영문/외래어는 한글 발음으로 표기 (예: OK -> 오케이, DM -> 디엠)
10. hookHeadline: 영상 상단에 고정될 시선 강탈용 짧은 제목 한 줄 (예: "🚨 부장님한테 욕 카톡 잘못 보냄 ㅋㅋㅋ")
11. ctaQuiz: 댓글창에서 편을 갈라 싸우게 만드는 질문
12. coupangProductMention: 쿠팡 상품(${plan.coupangKeyword})을 센스있게 소개하는 한 줄 (고정 댓글 전용)

반드시 아래 JSON 스키마 형식으로만 응답하세요:
{
  "hookHeadline": "영상 상단 제목 문구",
  "messages": [
    { "sender": "me", "name": "나", "text": "첫 톡 내용" },
    { "sender": "other", "name": "화난 어피치", "text": "답장 내용" }
  ],
  "ctaQuiz": "댓글 참여 유도 퀴즈 문구",
  "coupangProductMention": "쿠팡 상품을 센스있게 소개하는 한 줄"
}
    `;
}

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
        const prompt = buildPrompt(plan, feedback);

        let parsed: any = {};
        let messages: KatalkMessage[] = [];
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { responseMimeType: 'application/json' }
            });
            parsed = JSON.parse(response.text || '{}');
            messages = cleanMessages(parsed.messages);
            const problem = validateMessages(messages);
            if (!problem) break;
            console.warn(`[ScriptAgent] 검증 실패 (${attempt}/${MAX_ATTEMPTS}): ${problem}`);
            messages = [];
        }
        if (messages.length === 0) messages = getFallbackScript(plan).messages;

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
            coupangKeyword: plan.coupangKeyword,
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
        { sender: 'me', name: '나', text: '얘들아 나 어제 폭탄 발언함' },
        { sender: 'other', name: '화난 어피치', text: '뭔데 또 ㅋㅋ' },
        { sender: 'other', name: '소심한 네오', text: '설마 또 사고쳤냐' },
        { sender: 'other', name: '빈털털이 제이지', text: '치킨 사준다는 거면 환영' },
        { sender: 'me', name: '나', text: '나 단톡방 잘못 보냄' },
        { sender: 'other', name: '화난 어피치', text: '뭘?? 설마' },
        { sender: 'me', name: '나', text: '우리 팀장 험담 톡' },
        { sender: 'other', name: '소심한 네오', text: '...어디에?' },
        { sender: 'me', name: '나', text: '팀장 있는 단톡방에' },
        { sender: 'other', name: '빈털털이 제이지', text: 'ㅋㅋㅋㅋㅋㅋ 미친' },
        { sender: 'other', name: '화난 어피치', text: '읽음 숫자 1 떴어?' },
        { sender: 'me', name: '나', text: '1 사라짐' },
        { sender: 'other', name: '소심한 네오', text: '그럼 읽은 거네' },
        { sender: 'me', name: '나', text: '근데 답장이 아직 없어' },
        { sender: 'other', name: '빈털털이 제이지', text: '그게 더 무서운데' },
        { sender: 'other', name: '화난 어피치', text: '혹시 팀장 폰 꺼진 거 아님?' },
        { sender: 'me', name: '나', text: '아 그럴 수도 있겠다' },
        { sender: 'other', name: '소심한 네오', text: '잠깐 방금 팀장 입력 중 뜸' },
        { sender: 'me', name: '나', text: '입력 중이 3분째임' },
        { sender: 'other', name: '빈털털이 제이지', text: '장문이다 이건' },
        { sender: 'other', name: '화난 어피치', text: '유언 남겨라' },
        { sender: 'me', name: '나', text: '팀장 답장 왔다' },
        { sender: 'other', name: '소심한 네오', text: '뭐래뭐래' },
        { sender: 'me', name: '나', text: "잘못 보냈네요 저도 같은 생각" },
        { sender: 'other', name: '빈털털이 제이지', text: '팀장이 한패였네' }
    ];

    const coupangComment = `👇 직장인 피로회복 꿀템 (${plan.coupangKeyword}):\n🔗 ${DEFAULT_COUPANG_URL}\n\n※ 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`;

    return {
        planId: plan.id,
        title: `${plan.title} #Shorts`,
        hookHeadline: '🚨 팀장 험담 톡을 팀장 있는 단톡방에 보냄 ㅋㅋㅋ',
        messages,
        ctaQuiz: 'Q. 팀장이 쿨한 거다 vs 무서운 거다? 댓글로 남겨줘!',
        coupangComment,
        coupangKeyword: plan.coupangKeyword,
        youtubeDescription: `${plan.title}\n\nQ. 이건 부장님이 대인배다 vs 그래도 퇴사각이다?\n\n🛒 피로회복/숙취해소 꿀템: ${DEFAULT_COUPANG_URL}\n(이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.)\n\n#Shorts #카톡썰 #직장인썰 #레전드썰`,
        tags: ['Shorts', '카톡썰', '직장인썰', '레전드썰', '유머']
    };
}
