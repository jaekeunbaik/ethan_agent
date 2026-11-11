import { generateContentWithFallback } from './geminiHelper';
import { SourceStory } from './pannFetcher';

export const PASS_SCORE = 6;

// 1차 하드 제외 (docs/AUTOMATION_PLAN.md 3절, ANALYSIS.md A3). 의심되면 탈락 = 보수적, 오탐은 감수(LLM 2차가 아니라 전체 보수 정책)
const BLACKLIST = new RegExp([
    '정치|대통령|국회|선거|정당|민주당|국민의힘|좌파|우파|정권|종교|교회|목사|사이비|혐오|젠더|페미|한남|김치녀|틀딱|맘충|도태|노조|군대',
    '시댁|시부모|시어머니|시누|며느리|장모|처제|처가|상견례|남편|와이프|이혼|재혼|양육|불륜|바람피|외도|소송|고소|고발|변호사|재판',
    '사망|돌아가|장례|발인|유품|상속|유산|부고|자살|암 진단|암환자|우울',
    '성병|산부인과|산후|임신|피임|야한|몰카|성추행|성폭|폭행|폭력|학폭|살인|스토킹|스토커|사기|명예훼손',
    '미성년|중학생|초등학생|연예인|아이돌|방탄|BTS|블랙핑크|뉴진스|아이브|에스파|라이즈|엔믹스|하이브|컴백|화보|(걸|보이)?그룹',
    '콜센터|진상|갑질|빌런|하소연|답답',
    '고민|조언|상담|어떡해야|어떻게 해야|모르겠음|모르겠다|정리해본|하는 이유|후기|광고|협찬|출처\s*:\s*http'
].join('|'));
const QUESTION_END = /(어때|할까요|인가요|일까요|나요|까요)\s*\??\s*$/;

/** 키워드/구조 1차 필터 (Gemini 호출 없음). 걸리면 사유 문자열, 통과면 null */
export function keywordReject(title: string, text: string): string | null {
    const hit = (title + ' ' + text).match(BLACKLIST);
    if (hit) return `키워드: ${hit[0]}`;
    if (text.replace(/https?:\/\/\S+/g, '').trim().length < 200) return '본문 200자 미만 또는 URL뿐';
    if (QUESTION_END.test(title.trim())) return '질문형 제목';
    return null;
}

export interface Judged { story: SourceStory; score: number; reason: string }

/** 키워드 제외 후 LLM이 안전성+재미(0~10)를 한 번에 채점. 통과(>=PASS_SCORE)한 글을 점수순으로 반환 */
export async function filterStories(stories: SourceStory[]): Promise<{ passed: Judged[]; rejected: { id: string; reason: string }[] }> {
    const rejected: { id: string; reason: string }[] = [];
    const cand: SourceStory[] = [];
    for (const s of stories) {
        const why = keywordReject(s.title, s.text);
        if (why) rejected.push({ id: s.id, reason: why }); else cand.push(s);
    }
    if (cand.length === 0) return { passed: [], rejected };

    const list = cand.map((s, i) => `[${i}] 제목: ${s.title}\n${s.text.slice(0, 900)}\n베스트댓글: ${s.comments.join(' / ') || '없음'}`).join('\n\n---\n\n');
    const res = await generateContentWithFallback<{ items: { index: number; safe: boolean; score: number; reason: string }[] }>({
        responseMimeType: 'application/json',
        temperature: 0.2,
        userPrompt: `커뮤니티 글들을 카톡 대화 코미디 쇼츠 소재로 심사하세요.
safe=false 조건(하나라도 해당): 사회이슈·정치·젠더/세대/지역 갈등, 특정인·집단 비난/저격, 하소연·푸념·고민상담·넋두리·훈계·정보/팁, 무겁거나 논란 소지(불륜·폭력·질병·사망·소송), 실명/업체 특정, 광고, 베스트댓글이 싸움·비난 위주.
score(0~10): 구체적 사건 1개(+2), 마지막 반전/펀치라인(+2), 황당·귀여운 일상 상황(+2), 서로 다른 인물 2명 이상이 대화로 옮겨질 수 있음(+2), 베스트댓글이 ㅋㅋ 위주 웃음 반응(+2). 독백/하소연/긴 서사는 0~3점.

${list}

JSON으로만: {"items":[{"index":숫자,"safe":true|false,"score":0~10 정수,"reason":"한 줄"}]} (모든 글 포함)`
    });

    const passed: Judged[] = [];
    for (const it of res.items || []) {
        const s = cand[it.index];
        if (!s) continue;
        if (!it.safe || it.score < PASS_SCORE) rejected.push({ id: s.id, reason: `${it.safe ? '재미' : '안전'} ${it.score}: ${it.reason}` });
        else passed.push({ story: s, score: it.score, reason: it.reason });
    }
    return { passed: passed.sort((a, b) => b.score - a.score), rejected };
}
