import { Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
import { fetchLatestCareerTrend, TrendNewsArticle } from './trendFetcher';
import { generateContentWithFallback } from './geminiHelper';

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
    news_source?: string;
}

export interface SpeechTonePreset {
    id: string;
    name: string;
    description: string;
    endingExamples: string;
    promptInstruction: string;
}

export const SPEECH_TONE_PRESETS: SpeechTonePreset[] = [
    {
        id: 'STORY',
        name: '🎭 100% 썰 스피치 톤 (친한 친구 썰 풀기)',
        description: '친한 친구에게 카페에서 대박 소식 알려주듯 흥미진진하고 빠른 호흡의 구어체',
        endingExamples: '~했거든?, ~인 거야, ~라고 하더라고, ~해봐!',
        promptInstruction: '친한 친구에게 썰 풀듯 "~했거든?", "~인 거야", "~라고 하더라고", "~해봐!" 어미를 사용하는 100% 썰 스피치 반말 구어체로 작성하세요.'
    },
    {
        id: 'SPICY',
        name: '💥 매운맛 팩폭 코치 톤 (직설적 사이다)',
        description: '취준생의 뼈를 때리는 사이다 직언과 직설적인 조언 톤',
        endingExamples: '~지 마라, ~인 거 알지?, ~하면 바로 광탈임, ~해라!',
        promptInstruction: '취준생의 뼈를 때리는 직설 사이다 톤으로 "~지 마라", "~인 거 알지?", "~하면 바로 광탈임", "~해라!" 어미를 사용하는 매운맛 반말 구어체로 작성하세요.'
    },
    {
        id: 'SECRET',
        name: '🤫 비밀 제보 꿀팁 톤 (취준생 꿀정보 공유)',
        description: '남들은 잘 모르는 합격 치트키를 비밀스럽게 털어놓는 듯한 톤',
        endingExamples: '~만 비밀로 알려줌, ~ 모르면 손해임, ~ 챙겨가라!',
        promptInstruction: '합격 비밀을 털어놓듯 "~만 비밀로 알려줌", "~ 모르면 손해임", "~ 챙겨가라!" 어미를 사용하는 꿀팁 제보 톤으로 작성하세요.'
    },
    {
        id: 'AI_FACT',
        name: '🤖 AI 데이터 팩트 폭격 톤 (스마트 분석가)',
        description: '데이터와 수치로 서류 탈락 원인을 정밀하게 짚어내는 스마트 분석 톤',
        endingExamples: '~ 감지 완료, ~ 수치 미달임, ~ 강력 추천함!',
        promptInstruction: '데이터와 수치를 강조하는 스마트 AI 분석가 톤으로 "~ 감지 완료", "~ 수치 미달임", "~ 추천함" 어미를 사용하는 팩트 폭격 반말 톤으로 작성하세요.'
    }
];

const MARKETING_TOPICS = [
    '[서비스 소개] 3초 만에 자소서 평가받는 법 (무료 혜택)',
    '[대표 B&A] 서류 탈락하는 자소서 vs 합격하는 자소서 차이 (Diff 시연)',
    '[브랜드 스토리] 우리가 10만 원짜리 자소서 컨설팅을 AI로 만든 이유',
    '"어릴 적부터 진취적이었던 저는..." 자소서 망하는 대표 문장 심폐소생',
    '서류 탈락하는 자소서엔 이것이 없습니다: AI 비포 & 애프터 1:1 교정',
    '대기업 합격자소서 비포 & 애프터: 문장 하나로 서류 합불이 갈리는 이유',
    '마케터 지원자가 자소서에 절대 쓰면 안 되는 금지어 5가지',
    '개발자/영업직 자소서 톤앤매너 설정법 (논리형 vs 자신감형)',
    '합격률 높여주는 항목별 소제목(Headline) 템플릿 모음',
    '자소서 서두 10초 만에 훑어보는 면접관을 사로잡는 두괄식 작성 공식',
    '자소서 첨삭에 10만 원 쓴 친구 오열하는 영상: 3초 완성 AI 교정',
    '소제목 못 짜서 밤새는 취준생 구함: Draft Ethan 소제목 자동 추출'
];

/**
 * Gemini API를 활용하여 실시간 검증된 이슈/뉴스 기반 마케팅 콘텐츠 생성 (멀티 모델 자동 폴백 내장)
 */
export async function generateMarketingContent(toneId?: string): Promise<MarketingContentResponse> {
    // 실시간 뉴스 트렌드 수집
    const trendNews: TrendNewsArticle | null = await fetchLatestCareerTrend();

    const selectedTopic = trendNews 
        ? `[실시간 이슈 팩폭] ${trendNews.title}` 
        : MARKETING_TOPICS[Math.floor(Math.random() * MARKETING_TOPICS.length)];

    const draftEthanUrl = process.env.DRAFT_ETHAN_URL || 'https://draft-ethan.vercel.app/';
    const mytiUrl = process.env.MYTI_URL || 'https://myti-five.vercel.app/';

    const newsContextInstruction = trendNews ? `
    [🚨 실시간 뉴스 기반 사실(Fact) 원칙 - 필수 준수]
    - 수집된 실제 뉴스: "${trendNews.title}"
    - 언론사 출처: ${trendNews.source}
    - 보도 요약/스니펫: ${trendNews.snippet}
    
    ⚠️ 작성 지침 (가짜 뉴스 방지 및 사실 기반 보장):
    1. 지어낸 통계 수치나 가짜 뉴스, 할루시네이션(환각)은 절대 금지합니다! 뉴스에 명시된 사실과 채용 시장의 객관적 현실만을 바탕으로 작성하세요.
    2. 콘텐츠(스레드/인스타/카드뉴스)에 반드시 출처를 표기하세요 (예: "📰 출처: ${trendNews.source} 보도 / 실시간 뉴스 분석").
    3. 이 뉴스가 취준생/이직러의 자소서 작성 및 면접 준비에 미치는 실질적인 영향을 팩폭 톤으로 전달하고, dethan과 MYTI로 해결책을 제안하세요.
    ` : '';

    const targetToneId = toneId || process.env.SHORTS_TONE || 'STORY';
    const selectedTone = SPEECH_TONE_PRESETS.find(t => t.id === targetToneId) || SPEECH_TONE_PRESETS[0];
    console.log(`[ContentGenerator] 🎭 적용된 쇼츠 말투 컨셉: ${selectedTone.name} (${selectedTone.endingExamples})`);

    const systemInstruction = `
    당신은 2030 취준생 및 이직러의 도파민과 공감을 자극하여 조회수 100만 회를 터뜨리는 대한민국 Top Tier SNS 바이럴 마케터이자 "팩폭 메이트"입니다.
    당신은 두 가지 사이드 프로젝트를 운영하며 마케팅하고 있습니다:
    1. dethan (디든 - AI 자소서 교정 및 3초 팩폭 평가 서비스 - ${draftEthanUrl})
    2. MYTI (내 안의 취업/이직 페르소나 테스트 - ${mytiUrl})
    ${newsContextInstruction}

    [🔥 알고리즘 폭발 및 조회수 극대화 4대 핵심 원칙 (Algorithm Growth Hack)]
    1. 🎯 강력한 첫 줄 (Scroll-Stopper & Pattern Interrupt):
       - 첫 줄에서 스크롤을 멈추지 않으면 패배입니다. "면접관이 1초 만에 거르는 자소서 특징", "대기업 인사팀이 절대 안 알려주는 비밀", "열심히 살았는데 서류 탈락하는 사람들의 치명적 공통점" 등 호기심과 긴장감을 극대화하세요.
    2. 💬 댓글 알고리즘 부스팅 (Comment Trigger):
       - 스레드/인스타그램은 댓글이 많이 달릴수록 수만 명의 홈 피드에 추천됩니다.
       - 반드시 게시물 말미에 "댓글로 '자소서'라고 남겨주시면 3초 팩폭 무료 검수 쿠폰 1:1 디엠으로 쏴드립니다!", "Q. 너 자소서는 1번이야 2번이야? 댓글로 달아줘!" 형태의 참여 트리거를 강력하게 넣으세요.
    3. 💾 저장 & 공유 트리거 (Save/Share Trigger):
       - "하반기 공채/이직할 때 바로 꺼내보게 '저장'부터 해두세요!", "주변에 자소서 쓰는 친구한테 공유해주면 평생 고마워함"
    4. 💥 극단적 Before vs After 팩폭:
       - 두리뭉실한 뜬구름 잡는 비포(❌)와 숫자가 살아있는 명확한 애프터(⭕)를 대비시켜 "아, 내 자소서가 이래서 떨어졌구나"라는 즉각적인 깨달음과 서비스 이용 욕구를 자극하세요.

    [dethan (디든) 핵심 가치 (USP)]
    - ⚡ 3초 만에 끝나는 문장 단위 (Diff) 1:1 교정 및 이유 명시 (디든으로 발음)
    - 📊 4대 역량 스코어링 (직무 적합성 / 가독성 / 논리성 / 구체성)
    - 💡 기업/직무 맞춤 톤앤매너 & 합격 소제목 추천
    - 🎁 100% 무료 체험 제공

    [MYTI 핵심 가치 (USP)]
    - 🎯 내 안의 취업/이직 페르소나 테스트 (${mytiUrl})
    - ⚡ 100% 무료, 회원가입/로그인 0초 컷, 12문항 1분 30초 완성
    - 🤖 16가지 직무 행동 패턴 기반의 면접장 팩폭 페르소나 도출
    - 💥 팩폭 특징 3가지 & 환상의/환장의 짝꿍 케미 분석
    - 🚀 테스트 완료 후 3초 무료 AI 자소서 팩폭 검수(dethan 디든) 자연스러운 연결

    [유튜브 쇼츠 3단계 카피라이팅 말투 원칙 (필수 준수)]
    - 선택된 컨셉: ${selectedTone.name}
    - 어미 스타일: ${selectedTone.endingExamples}
    - ⚠️ ${selectedTone.promptInstruction} 절대로 존댓말(~입니다, ~했습니다)이나 경어체를 쓰지 마세요!
    - 1문장은 10자 내외로 짧게 끊어서 빠르고 드라마틱한 호흡 유지!
    - 1. Hook (0~5초 / Cover Slide): 오프닝 인사 없이 바로 자극적인 핫이슈 훅!
    - 2. Body (5~22초 / Body Slide): 인사담당자 관점의 팩폭 비교 (BEFORE vs AFTER)
    - 3. Call to Action (22~30초 / CTA Slide): dethan (디든) 3초 무료 교정 제안 + 댓글 유도 퀴즈 (예: "Q. 너 자소서는 1번(비포)이야 2번(애프터)이야? 댓글 남겨봐!")

    [출력 요구사항]
    1. thread_text: dethan(디든) 서비스 홍보용 스레드 포스팅 텍스트 (250~350자, 100% 공감+팩폭 썰 톤, 링크는 본문에 직접 넣지 말고 하단에 "👉 3초 만에 AI 팩폭 교정받는 링크는 프로필 링크에 걸어뒀어! 댓글로 '자소서'라고 남겨주면 1:1 무료 쿠폰 디엠으로 쏨!" 형태로 자연스러운 댓글/프로필 유도)
    2. myti_thread_text: MYTI 서비스 전용 스레드 포스팅 텍스트 (Threads 전용! 반말/친근/팩폭 톤, 2030 취준생/이직러 공감, 페르소나 특징/짝케미 언급, "👉 프로필 링크에서 1분 30초 컷 취업 MBTI 테스트 해봐!", 댓글/저장/공유 유도)
    3. insta_caption: dethan(디든) 인스타그램 캡션 (호기심 유발 헤드라인 + 뉴스 팩폭/팁 + "👉 지금 바로 프로필 링크(@계정)에서 3초 무료 팩폭 검수 받아보세요!" + "💬 댓글로 '자소서' 남겨주시면 1:1 무료 검수 쿠폰 쏴드립니다!" + 인기 해시태그 10개 내외: #자소서 #자소서첨삭 #디든 #취준생 #이직 #자기소개서 #취업준비 #면접팁 #합격자소서)
    4. card_news_slides: 정확히 3장의 dethan(디든) 카드뉴스/쇼츠 슬라이드 텍스트 배열 (1번 COVER: 훅, 2번 BODY: BEFORE/AFTER 팩폭 비교, 3번 CTA: 디든 3초 무료 교정 제안 및 프로필 링크 유도)
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

    const userPrompt = `오늘의 홍보 주제: "${selectedTopic}". 이 주제로 Draft Ethan용 (인스타 캡션, 인스타 3슬라이드 카드뉴스, 스레드 문구) 및 MYTI 전용 스레드 포스팅 문구를 생성해 줘.

🚨 [쇼츠/슬라이드 말투 및 대본 필수 원칙]
1. card_news_slides의 모든 제목, 소제목, 내용 문장은 반드시 친한 친구에게 썰 풀듯 "~했거든?", "~인 거야", "~라고 하더라고", "~해봐!" 어미를 사용하는 100% 썰 스피치 반말 구어체로만 작성해야 해. 절대로 뉴스 기사체나 존댓말(~입니다, ~했습니다)을 쓰면 안 돼!
2. ⭐ [음성 읽기(TTS) 호환 필수]: 영문 단어나 알파벳(Before, After, Diff, AI, URL 등)을 영문으로 넣으면 알파벳을 하나씩 철자대로 읽어 어색해지므로, 반드시 읽을 음성에 맞춰 "비포", "애프터", "에이아이", "디든" 처럼 자연스러운 한글 표기로 작성해야 해!`;

    try {
        const data = await generateContentWithFallback<MarketingContentResponse>({
            systemInstruction,
            userPrompt,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.7
        });

        if (trendNews?.source) {
            data.news_source = trendNews.source;
        }

        return data;
    } catch (error: any) {
        console.warn('[ContentGenerator] ⚠️ 모든 AI 모델 호출 실패로 안전 오프라인 템플릿으로 자동 전환합니다:', error.message);
        return getFallbackMarketingContent(selectedTopic);
    }
}

/**
 * 모든 Gemini API가 일시 장애일 때 파이프라인 중단을 막아주는 고품질 룰 기반 백업 마케팅 콘텐츠
 */
function getFallbackMarketingContent(topic: string): MarketingContentResponse {
    return {
        topic: topic || '서류 탈락하는 자소서 vs 합격하는 자소서 차이',
        thread_text: `자소서 서류 탈락하는 사람들의 공통점 딱 1가지 알려줌.\n\n"열심히 하겠습니다" 같은 추상적인 다짐만 적고, "전년 대비 전환율 24% 상승" 같은 구체적인 수치 성과가 없음..\n\n인사담당자는 10초 만에 훑어보는데 눈에 띄는 숫자가 없으면 바로 탈락 폴더행임!\n\n👉 지금 프로필 링크에 디든(dethan) 3초 무료 AI 자소서 팩폭 검수 링크 걸어둠! 댓글 남기면 1:1 무료 쿠폰 디엠으로 쏨!`,
        myti_thread_text: `면접장만 가면 머릿속 하얘지는 '쫄보형 완벽주의자' 취준생들 특징 ㅋㅋㅋ\n\n1. 질문 예상 답변 100개 외워감\n2. 꼬리 질문 하나 나오면 동공 지진\n3. 끝나고 나오면서 이불킥 100번 함\n\n너 면접장 페르소나는 뭔지 1분 만에 검사해봐!\n👉 프로필 링크에서 MYTI 1분 30초 컷 취업 MBTI 무료 테스트 고고!`,
        insta_caption: `🔥 서류 탈락하는 자소서 vs 대기업 합격 자소서의 결정적 차이! 📄✨\n\n추상적인 미사여구는 빼고, 3초 만에 인사담당자 시선을 사로잡는 수치 성과(STAR 기법)로 문장을 바꿔보세요.\n\n👉 지금 바로 프로필 링크(@draft_ethan)에서 3초 무료 AI 자소서 팩폭 검수(dethan 디든)를 받아보세요!\n💬 댓글로 '자소서' 남겨주시면 1:1 무료 검수 쿠폰을 보내드립니다.\n\n#자소서 #자소서첨삭 #디든 #취준생 #이직 #자기소개서 #취업준비 #면접팁 #합격자소서`,
        card_news_slides: [
            {
                slideNumber: 1,
                type: 'COVER',
                title: '서류 탈락하는 자소서의 치명적 공통점',
                subtitle: '인사담당자가 10초 만에 거르는 이유',
                contentLines: ['너 자소서 아직도 "열정"만 적었어?', '인사담당자는 숫자 없는 자소서 바로 넘기거든!'],
                highlightText: '서류 광탈 1순위 문장'
            },
            {
                slideNumber: 2,
                type: 'BODY',
                title: '비포 vs 애프터 팩폭 비교',
                subtitle: '추상적 다짐 ➔ 수치 성과 전환',
                contentLines: ['비포: 최선을 다해 매출을 올렸습니다', '애프터: 프로모션 기획으로 전환율 24% 상승 달성'],
                highlightText: 'STAR 수치화 공식'
            },
            {
                slideNumber: 3,
                type: 'CTA',
                title: '디든(dethan) 3초 무료 AI 팩폭 검수',
                subtitle: '프로필 링크에서 3초 만에 첨삭 완료',
                contentLines: ['오탈자랑 문맥 교정까지 한번에!', 'Q. 너 자소서는 비포야 애프터야? 댓글 남겨봐!'],
                highlightText: '3초 무료 교정'
            }
        ]
    };
}
