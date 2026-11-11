import dotenv from 'dotenv';
import { generateContentWithFallback } from '../geminiHelper';
import { ContentPlan, FeedbackMemory, ScriptOutput, KatalkMessage } from './types';

dotenv.config();

const DEFAULT_COUPANG_URL = process.env.COUPANG_PARTNERS_URL || 'https://link.coupang.com/a/h183YcFkvA';

export class ScriptRejected extends Error {}
const MAX_ATTEMPTS = 3; // 최초 1회 + 재시도 2회
const MIN_MESSAGES = 12;
const MAX_MESSAGES = 22;
const MAX_TOTAL_CHARS = 300; // 실측 약 0.115초/글자 -> 35초 이내
const MAX_CHARS = 30;
const MIN_PARTICIPANTS = 3; // 'me' 제외 서로 다른 상대 닉네임 수
const AD_PATTERN = /쿠팡|coupang|파트너스|https?:\/\/|링크|최저가|할인|특가/i;
const MAX_ME_RATIO = 0.5;
const MIN_ME_RATIO = 0.3;
const MAX_AVG_CHARS = 22;
const MAX_CONSECUTIVE = 2;
const MAX_REACTION_RATIO = 0.25;
const REACTION_PATTERN = /^(헐|헉|와|오|엥|아|ㄹㅇ|ㅇㅇ|진짜\??|뭐\??|미쳤다|대박|ㄷㄷ)[ㅋㅎㅠㅜ?!.~\s]*$/;
// shortcut: 소수 욕설만 마스킹, 목록 확장은 필요할 때
const PROFANITY_PATTERN = /씨발|시발|ㅅㅂ|ㅆㅂ|병신|ㅂㅅ|지랄|좆|존나|개새끼|새끼|미친놈/g;

export function cleanMessages(raw: any): KatalkMessage[] {
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

export function validateMessages(messages: KatalkMessage[]): string | null {
    if (messages.length < MIN_MESSAGES) return `메시지 ${messages.length}개 (<${MIN_MESSAGES})`;
    if (messages.length > MAX_MESSAGES) return `메시지 ${messages.length}개 (>${MAX_MESSAGES})`;
    const total = messages.reduce((a, m) => a + m.text.length, 0);
    if (total > MAX_TOTAL_CHARS) return `전체 ${total}자 (>${MAX_TOTAL_CHARS}자, 영상 약 ${Math.round(total * 0.115)}초): 대사를 더 짧게 줄이거나 줄 수를 줄이기`;
    const long = messages.find(m => m.text.length > MAX_CHARS);
    if (long) return `"${long.text.slice(0, 12)}..." ${long.text.length}자 (>${MAX_CHARS}자): 짧게 줄이기`;
    const names = new Set(messages.filter(m => m.sender === 'other').map(m => m.name));
    if (names.size < MIN_PARTICIPANTS) return `상대 닉네임 ${names.size}명 (<${MIN_PARTICIPANTS})`;

    const meCount = messages.filter(m => m.sender === 'me').length;
    if (meCount / messages.length > MAX_ME_RATIO) return `'나' 비중 ${Math.round(meCount / messages.length * 100)}% (>${MAX_ME_RATIO * 100}%): 독백 금지, 상대들이 더 많이 말해야 함`;
    for (const n of names) {
        const c = messages.filter(m => m.name === n).length;
        if (c < 2) return `상대 "${n}" 발언 ${c}개 (<2): 모든 상대가 최소 2번 이상 말해야 함`;
    }

    if (meCount / messages.length < MIN_ME_RATIO) return `'나' 비중 ${Math.round(meCount / messages.length * 100)}% (<${MIN_ME_RATIO * 100}%): 나도 대화에 충분히 참여해야 함`;
    const avg = messages.reduce((a, m) => a + m.text.length, 0) / messages.length;
    if (avg > MAX_AVG_CHARS) return `평균 ${Math.round(avg)}자 (>${MAX_AVG_CHARS}자): 더 짧은 구어체로`;

    let run = 1;
    for (let i = 1; i < messages.length; i++) {
        run = messages[i].name === messages[i - 1].name ? run + 1 : 1;
        if (run > MAX_CONSECUTIVE) return `"${messages[i].name}"이 ${MAX_CONSECUTIVE}줄 넘게 연속 발언 (${i + 1}번째 줄 근처): 다른 사람이 끼어들어 티키타카로`;
    }

    const reactions = messages.filter(m => m.text.replace(/[ㅋㅎㅠㅜ?!.~\s]/g, '').length <= 2 || REACTION_PATTERN.test(m.text.trim())).length;
    if (reactions / messages.length > MAX_REACTION_RATIO) return `단순 반응 줄 ${reactions}/${messages.length} (>${MAX_REACTION_RATIO * 100}%): 정보·웃음·갈등이 있는 대사로 교체`;
    return null;
}

/** 구조 검증을 통과한 대본에만 1회 호출: 웃김/복선/펀치라인/논란/실명. 호출 자체가 실패하면 구조 검증 결과를 믿고 통과 */
async function judgeScript(messages: KatalkMessage[]): Promise<string | null> {
    try {
        const j = await generateContentWithFallback<any>({
            responseMimeType: 'application/json', temperature: 0.2,
            userPrompt: `아래 카톡 대본을 코미디 쇼츠 심사자로서 채점하세요.\n${messages.map(m => `${m.name}: ${m.text}`).join('\n')}\n\nJSON으로만: {"funny":0~10,"punchline":0~10(마지막 줄이 앞 설정에서 자연스럽게 터지는 정도),"twist_setup":true|false(반전의 복선이 앞에 있음),"controversy":true|false(정치·젠더/세대 갈등·비난·성적/폭력/질병 등),"real_names":true|false(실존 인물·업체명),"fix":"가장 큰 문제 한 줄"}`
        });
        if (j.funny >= 4 && j.punchline >= 4 && j.twist_setup && !j.controversy && !j.real_names) return null;
        return `심사 불합격 (웃김 ${j.funny}, 펀치라인 ${j.punchline}, 복선 ${j.twist_setup}, 논란 ${j.controversy}, 실명 ${j.real_names}): ${j.fix}`;
    } catch (e: any) {
        console.warn('[ScriptAgent] 심사 호출 실패, 구조 검증만으로 통과:', String(e.message).slice(0, 80));
        return null;
    }
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

${plan.sourceText ? `[원문 썰 - 이 줄거리를 따라 각색]:
${plan.sourceText}
각색 규칙: 원문이 1인칭 독백/후기여도 반드시 단톡방 대화로 재구성한다. '나'는 사건을 던지는 역할이고, 원문 속 등장인물(가족·친구·동료)을 각각 다른 닉네임의 상대로 만들어 직접 말하게 하며, 상대들이 놀리고 되묻고 맞장구치게 한다. '나'가 3줄 이상 혼자 설명하지 않는다(상대가 끼어들게). 원문의 사건 순서와 웃음 포인트를 유지하되 문장은 그대로 베끼지 말고 카톡 말투로 새로 쓴다. 실명·업체명·지역 등 개인정보는 가상 닉네임/일반명사로 바꾸고, 특정인·집단을 비난하거나 사회적 논란이 될 표현은 순화하거나 뺀다.
` : ''}
${plan.freeform ? `[창작 모드 - 원문 없음]: 위 '상황 시드'를 바탕으로 완전히 새로운 설정(인물 관계·구체적 사건·복선·반전)을 직접 만들어라. 한 가지 황당한 상황 + 친구들이 가볍게 놀리는 구조. 실존 인물·연예인·업체·정치·젠더/세대 갈등·성적/폭력/질병 소재 금지.` : ''}
[피드백 작성 지침]:
- 약점 회피: ${feedback.weaknessesToAvoid.join(' / ')}
- 바이럴 훅 규칙: ${feedback.viralHookRules.join(' / ')}

[대본 작성 절대 규칙 - 레퍼런스 바이럴 쇼츠 스타일시트]:
0. 이야기 품질(가장 중요): 반전은 앞 대사에서 깔아 둔 복선이 있어야 말이 되고, 마지막 펀치라인은 그 반전에서 자연스럽게 나와야 한다. 설정이 모순되면(예: 구매자 사진과 다른 사람이 나왔는데 이유가 억지) 불합격. 한 가지 사건만 다루고, 등장인물 반응("헐", "ㅋㅋㅋ"만 있는 줄)은 전체의 25% 이하. 매 줄이 정보·웃음·갈등 중 하나를 더해야 한다.
   좋은 예(실제 조회수 400만 구조): 친구 "시험 끝나고 니 집에서 술 먹기로 했는데 니도 올래?" → 나 "내집??" → 친구 "ㅇㅇ 니집에서 마실건데" → (사진: 다리 깁스) 나 "아무도 안 믿은거임?" → "차가 날 쳤다고" → "그걸 왜 가만히 있냐 / 피하면 되는걸 / 무빙을 못 치네" → "너희가 사람이냐". 즉 말도 안 되는 상황 하나를 던지고 친구들이 위로 대신 가볍게 놀리는 구조.
1. 메세지 개수: 16~22개, 전체 글자수 합계 280자 이내 (영상 길이 35초 이내 목표, 300자 또는 22줄 초과 시 자동 불합격). 12개 미만이면 불합격.
2. (검증 기준) '나' 발언은 전체의 50% 이하, 같은 사람 연속 발언 최대 2줄, 상대 각자 최소 2번 발언, 단순 반응("헐","ㅋㅋ") 줄 25% 이하. 어기면 자동 불합격.
2-1. 단톡방 구성: 나(sender "me") 1명 + 상대 2~4명 = 총 3~5명. 상대는 전부 sender "other"이되 name을 서로 다르게, 웃긴 닉네임으로 (예: 화난 어피치, 소심한 네오, 빈털털이 제이지). 최소 3개의 서로 다른 닉네임이 말해야 함.
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
        const basePrompt = buildPrompt(plan, feedback);

        let parsed: any = {};
        let messages: KatalkMessage[] = [];
        let prompt = basePrompt;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            parsed = await generateContentWithFallback<any>({ userPrompt: prompt, responseMimeType: 'application/json' });
            messages = cleanMessages(parsed.messages);
            const problem = validateMessages(messages) ?? (await judgeScript(messages));
            if (!problem) break;
            console.warn(`[ScriptAgent] 검증 실패 (${attempt}/${MAX_ATTEMPTS}): ${problem}`);
            // 구체적 실패 사유를 모델에 되돌려 재작성
            prompt = `${basePrompt}\n\n[직전 시도 불합격 사유 - 반드시 고쳐서 처음부터 다시 작성]: ${problem}`;
            messages = [];
        }
        if (messages.length === 0) {
            // 출처 글은 억지 백업 대본으로 대체하지 않고 폐기(호출부가 다음 후보로)
            if (plan.source || plan.freeform || plan.inboxFile) throw new ScriptRejected(`검증 ${MAX_ATTEMPTS}회 실패: ${plan.source?.url ?? plan.key}`);
            messages = getFallbackScript(plan).messages;
        }

        const hookHeadline = parsed.hookHeadline || `[대참사] ${plan.hookIdea}`;
        const ctaQuiz = parsed.ctaQuiz || 'Q. 여러분이라면 이 상황에서 어떻게 하시겠습니까? 댓글로 투표해주세요!';
        const videoTitle = plan.freeform ? hookHeadline.replace(/^[^가-힣A-Za-z0-9]+/, "") : plan.title; // 창작 모드의 plan.title은 상황 시드라 헤드라인을 제목으로
        const coupangMention = parsed.coupangProductMention || `영상 속 멘탈 회복 꿀템 (${plan.coupangKeyword})`;

        const sourceCredit = plan.source ? `※ 출처: ${plan.source.site} 「${plan.source.title}」 ${plan.source.url}\n(원문을 카톡 형식으로 각색했습니다)` : undefined;

        // 고정 댓글 문구 (쿠팡 파트너스 링크 + 필수 공정위 문구)
        const coupangComment = (sourceCredit ? sourceCredit + '\n\n' : '') + `👇 ${coupangMention} 특가 보러가기:\n🔗 ${DEFAULT_COUPANG_URL}\n\n※ 이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.`;


        // 유튜브 영상 설명
        const youtubeDescription = `${videoTitle}\n\n${ctaQuiz}\n\n${sourceCredit ? sourceCredit + '\n\n' : ''}━━━━━━━━━━━━━━━━━━━━\n🛒 화제의 추천 아이템 (${plan.coupangKeyword})\n👉 ${DEFAULT_COUPANG_URL}\n\n(이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.)\n━━━━━━━━━━━━━━━━━━━━\n\n#Shorts #카톡썰 #유머 #레전드썰 #${plan.category.replace(/[^가-힣a-zA-Z]/g, '')}`;

        const tags = ['Shorts', '카톡썰', '유머', '레전드썰', '썰', plan.category, plan.coupangKeyword];

        const scriptOutput: ScriptOutput = {
            planId: plan.id,
            title: `${videoTitle} #Shorts`,
            hookHeadline,
            messages,
            ctaQuiz,
            coupangComment,
            coupangKeyword: plan.coupangKeyword,
            youtubeDescription,
            tags,
            sourceCredit
        };

        console.log(`[ScriptAgent] ✅ 대본 작성 완수! (톡 ${messages.length}개, 배너: "${hookHeadline}")`);
        return scriptOutput;

    } catch (err: any) {
        if (err instanceof ScriptRejected) throw err;
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
