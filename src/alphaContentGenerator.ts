import { generateContentWithFallback } from './geminiHelper';
import { MarketSummaryData } from './financeDataFetcher';
import { getLatestInsights } from './trendAndPerformanceAnalyzer';

export interface AlphaShortsScene {
    sceneIndex: number;
    badge: string;            // 상단 뱃지 (예: '🚨 시장 긴급속보', '📊 수급 팩트', '💡 내일 전략')
    title: string;            // 핵심 헤드라인
    subtitle: string;         // 부제 또는 핵심 요약
    highlightStat: {          // 시각화용 핵심 수치 (차트/게이지로 렌더링)
        label: string;
        value: string;
        subValue?: string;
        isPositive: boolean;  // 빨강(상승/긍정) or 파랑(하락/부정)
    };
    chartType: 'CANDLE_SUMMARY' | 'SUPPLY_BAR' | 'STOCK_COMPARE' | 'CHECKLIST';
    voiceScript: string;      // 나레이션 TTS 대본 (자연스러운 한국어 구어체)
}

export interface AlphaShortsContent {
    topic: string;
    youtubeTitle: string;
    description: string;
    tags: string[];
    scenes: AlphaShortsScene[];
}

/**
 * 당일 시장 팩트 데이터를 기반으로 고퀄리티 쇼츠 대본 및 인포그래픽 씬 데이터를 생성합니다.
 */
export async function generateAlphaShortsContent(marketData: MarketSummaryData): Promise<AlphaShortsContent> {
    const isFall = marketData.kospi.changeRate < 0;

    const systemPrompt = `
당신은 블라인드 주식방, 에펨코리아 증시 게시판, 토스 커뮤니티에서 조회수 1위를 찍는 현실 주식 썰/팩폭 전문가입니다.
어려운 증권사 용어와 딱딱한 숫자 나열을 전부 버리고, 개미 투자자들이 무릎을 탁 치며 공감할 수 있는 100% 리얼한 대화체로 쇼츠 대본을 구성하세요.

[🚨 절대 금지 사항]
1. 로봇 같은 억지 감탄사 및 어색한 어미 절대 금지 (~했거든요!, ~한 겁니다!, ~때문이죠!, ~소름 돋는 이유! 등 금지)
2. 시청자가 이해 못 하는 단순 수치 나열 금지 (코스피 지수, 환율 수치 줄줄이 읊기 금지)
3. 뜬금없는 거창한 낚시성 제목 금지

[말투 & 스토리텔링 원칙]
- 친한 주식 고수 형이나 친구가 옆에서 현실적인 팩폭 날려주듯 편안하고 직관적인 구어체.
  (예: "오늘 삼전 보고 진짜 한숨 나오셨죠?", "외인이 1조를 그냥 시장가로 던져버렸습니다.", "여기서 쫄아서 뇌동매매 치면 진짜 바보 됩니다.")
- 씬 구성:
  - Scene 1 [공감 훅]: 개미들의 현실 감정 건드리기 ("오늘 계좌 보고 멘탈 나간 분들 많으시죠?")
  - Scene 2 [원인 딱 1개만]: 가장 결정적인 이유를 일상 언어로 ("외국인이 1조나 던진 이유는 딱 환율 때문입니다")
  - Scene 3 [비교 & 반전]: 남들은 몰랐던 핵심 포인트 ("그런데 이상하게 하이닉스는 외인이 오히려 샀습니다")
  - Scene 4 [현실 행동 요령]: 내일 장에서 당장 어떻게 해야 할지 구체적인 가이드 ("내일 장 시작하자마자 공포에 패닉셀 하지 마시고, 일단 지켜보세요")
`;

    const latestInsights = getLatestInsights();
    let trendPromptAddition = '';
    if (latestInsights) {
        trendPromptAddition = `
[🚨 전일 시청률 진단 & 실시간 급상승 트렌드 피드백 (반드시 대본과 제목에 반영할 것)]
- 시청률 진단 피드백: ${latestInsights.audienceRetentionDiagnosis}
- 현재 유튜브 급상승 유행 키워드: ${latestInsights.trendingKeywords.join(', ')}
- 쇼츠 바이럴 문법 트렌드: ${latestInsights.viralFormatTrends}
- 킬러 액션 플랜: ${latestInsights.nextVideoStrategy}
`;
    }

    const userPrompt = `
[오늘의 실제 시장 팩트 데이터]
- 날짜: ${marketData.date}
- 헤드라인: ${marketData.marketSummaryHeadline}
- 코스피: ${marketData.kospi.price.toLocaleString()} (${marketData.kospi.change > 0 ? '+' : ''}${marketData.kospi.change} / ${marketData.kospi.changeRate}%)
- 코스닥: ${marketData.kosdaq.price.toLocaleString()} (${marketData.kosdaq.change > 0 ? '+' : ''}${marketData.kosdaq.change} / ${marketData.kosdaq.changeRate}%)
- 원·달러 환율: ${marketData.usdKrw.price.toLocaleString()}원 (${marketData.usdKrw.change > 0 ? '+' : ''}${marketData.usdKrw.changeRate}%)
- 주요 종목 1: ${marketData.topMovers[0].name} (${marketData.topMovers[0].price.toLocaleString()}원, ${marketData.topMovers[0].changeRate}%, ${marketData.topMovers[0].foreignNet})
- 주요 종목 2: ${marketData.topMovers[1].name} (${marketData.topMovers[1].price.toLocaleString()}원, ${marketData.topMovers[1].changeRate}%, ${marketData.topMovers[1].foreignNet})
${trendPromptAddition}
위 데이터를 바탕으로 최고의 퀄리티를 지닌 숏폼 콘텐츠를 구성해주세요.
`;

    try {
        const responseData = await generateContentWithFallback<any>({
            systemInstruction: systemPrompt,
            userPrompt: userPrompt,
            responseMimeType: 'application/json',
            temperature: 0.3
        });

        let candidate: any = null;
        if (typeof responseData === 'object' && responseData !== null) {
            candidate = responseData;
        } else {
            const responseText = String(responseData);
            const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            candidate = JSON.parse(cleaned);
        }

        // 중첩 객체 탐색
        if (candidate && !Array.isArray(candidate.scenes)) {
            for (const key of Object.keys(candidate)) {
                if (candidate[key] && Array.isArray(candidate[key].scenes)) {
                    candidate = candidate[key];
                    break;
                }
            }
        }

        // 만약 여전히 scenes가 없다면 100% 안전하게 기본 팩트 씬으로 정규화
        if (!candidate || !Array.isArray(candidate.scenes) || candidate.scenes.length === 0) {
            console.warn('[alphaContentGenerator] Gemini 응답에 scenes 배열이 없어 기본 팩트 씬으로 안전 정규화합니다.');
            return buildFallbackContent(marketData, isFall, candidate?.topic, candidate?.youtubeTitle);
        }

        const fallback = buildFallbackContent(marketData, isFall);
        const normalizedScenes: AlphaShortsScene[] = candidate.scenes.map((s: any, idx: number) => {
            const fbScene = fallback.scenes[idx] || fallback.scenes[0];
            const voice = (s.voiceScript || s.narration || s.script || s.text || s.voiceOver || fbScene.voiceScript || '').trim();
            return {
                sceneIndex: idx + 1,
                badge: s.badge || fbScene.badge,
                title: s.title || fbScene.title,
                subtitle: s.subtitle || fbScene.subtitle,
                highlightStat: s.highlightStat || fbScene.highlightStat,
                chartType: s.chartType || fbScene.chartType,
                voiceScript: voice.length > 5 ? voice : fbScene.voiceScript
            };
        });

        return {
            topic: candidate.topic || `오늘의 장마감 팩트 리포트 (${marketData.date})`,
            youtubeTitle: candidate.youtubeTitle || `오늘 국장 왜 이럴까? ${marketData.kospi.changeRate}% 변동 30초 요약 #주식 #코스피`,
            description: candidate.description || `오늘(${marketData.date}) 코스피 및 환율 주요 수급 요약입니다.`,
            tags: Array.isArray(candidate.tags) ? candidate.tags : ['주식', '코스피', '환율', '재테크', '쇼츠'],
            scenes: normalizedScenes
        };
    } catch (error: any) {
        console.warn('[alphaContentGenerator] Gemini 호출 실패 또는 파싱 오류로 정밀 백업 템플릿 가동:', error.message);
        return buildFallbackContent(marketData, isFall);
    }
}

function buildFallbackContent(marketData: MarketSummaryData, isFall: boolean, customTopic?: string, customTitle?: string): AlphaShortsContent {
    return {
        topic: customTopic || `오늘의 장마감 팩트 리포트 (${marketData.date})`,
        youtubeTitle: customTitle || `오늘 국장 왜 이럴까? ${marketData.kospi.changeRate}% 변동의 진짜 이유 30초 요약 #주식 #코스피`,
        description: `오늘(${marketData.date}) 코스피 및 환율 주요 수급 요약입니다. 투자의 책임은 본인에게 있습니다.`,
        tags: ['주식', '코스피', '환율', '삼성전자', 'SK하이닉스', '재테크', '쇼츠'],
        scenes: [
            {
                sceneIndex: 1,
                badge: '🚨 시장 마감 속보',
                title: `코스피 ${marketData.kospi.price.toLocaleString()}p 마감`,
                subtitle: marketData.marketSummaryHeadline,
                highlightStat: {
                    label: 'KOSPI 지수',
                    value: `${marketData.kospi.price.toLocaleString()} pt`,
                    subValue: `${marketData.kospi.changeRate}%`,
                    isPositive: !isFall
                },
                chartType: 'CANDLE_SUMMARY',
                voiceScript: `오늘 주식 계좌 열어보신 분들은 진짜 깜짝 놀라셨을 텐데요! 코스피가 무려 ${marketData.kospi.changeRate}%나 출렁이며 ${marketData.kospi.price.toFixed(0)}선에서 마감했습니다.`
            },
            {
                sceneIndex: 2,
                badge: '📊 수급 & 환율 체크',
                title: `환율 ${marketData.usdKrw.price.toFixed(1)}원 & 외국인 수급`,
                subtitle: '환율 변동성 확대에 따른 외인 매도세',
                highlightStat: {
                    label: '원·달러 환율',
                    value: `${marketData.usdKrw.price.toFixed(1)}원`,
                    subValue: `${marketData.usdKrw.changeRate > 0 ? '+' : ''}${marketData.usdKrw.changeRate}% 변동`,
                    isPositive: marketData.usdKrw.changeRate < 0
                },
                chartType: 'SUPPLY_BAR',
                voiceScript: `첫 번째 이유는 환율인데요! 원달러 환율이 ${marketData.usdKrw.price.toFixed(0)}원 부근을 유지하면서 외국인 자금이 썰물처럼 빠져나간 겁니다.`
            },
            {
                sceneIndex: 3,
                badge: '🏢 대형주 현주소',
                title: `${marketData.topMovers[0].name} vs ${marketData.topMovers[1].name}`,
                subtitle: '반도체 대장주 엇갈린 수급 흐름',
                highlightStat: {
                    label: marketData.topMovers[0].name,
                    value: `${marketData.topMovers[0].price.toLocaleString()}원`,
                    subValue: `${marketData.topMovers[0].changeRate}%`,
                    isPositive: marketData.topMovers[0].changeRate >= 0
                },
                chartType: 'STOCK_COMPARE',
                voiceScript: `두 번째는 대형주 희비인데요! ${marketData.topMovers[0].name}는 외국인 매도세로 밀린 반면, ${marketData.topMovers[1].name}는 기관 방어로 악착같이 버텨냈죠.`
            },
            {
                sceneIndex: 4,
                badge: '💡 내일 장전 전략',
                title: '내일 시초가 핵심 체크포인트',
                subtitle: '야간 미 증시 선물 및 환율 안정 확인 필수',
                highlightStat: {
                    label: '내일의 리스크 지수',
                    value: '관망 및 분할 대응',
                    subValue: '리스크 관리 구간',
                    isPositive: true
                },
                chartType: 'CHECKLIST',
                voiceScript: `그렇다면 내일은 어떻게 대응해야 할까요? 장 시작 전 환율 진정 여부 꼭 체크하시고, 불나방 매매는 절대 금물입니다!`
            }
        ]
    };
}

