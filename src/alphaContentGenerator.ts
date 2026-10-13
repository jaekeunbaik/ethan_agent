import { generateContentWithFallback } from './geminiHelper';
import { MarketSummaryData } from './financeDataFetcher';

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
당신은 최고 권위의 경제 금융 전문 유튜브 채널의 수석 퀀트 애널리스트이자 숏폼 디렉터입니다.
주어진 실제 금융 시장 팩트 데이터(코스피, 코스닥, 환율, 대형주 수급)를 바탕으로,
시청자의 이탈을 방지하고 45초 동안 몰입도를 극대화하는 바이럴 금융 숏폼 대본을 생성하세요.

[필수 원칙]
1. 절대로 허위나 과장된 거짓 정보를 지어내지 말고, 입력된 실제 수치와 금융 팩트에 충실하세요.
2. 어조: 차분하면서도 긴장감 있고 신뢰도 높은 아나운서/경제 전문가 톤.
3. 씬 구성은 정확히 4개 씬으로 구성합니다:
   - Scene 1: [HOOK] 당일 코스피/코스닥 지수와 시장 분위기 요약 (chartType: 'CANDLE_SUMMARY')
   - Scene 2: [SUPPLY] 환율 변동과 외국인/기관 수급 분석 (chartType: 'SUPPLY_BAR')
   - Scene 3: [STOCKS] 삼성전자/SK하이닉스 등 주요 대형주 흐름 (chartType: 'STOCK_COMPARE')
   - Scene 4: [STRATEGY & CTA] 내일 장전 체크포인트 및 마무리 안내 (chartType: 'CHECKLIST')
4. voiceScript는 실제 TTS로 읽었을 때 각 씬당 8~10초, 총 40초 내외가 되도록 군더더기 없이 간결하게 작성하세요.
5. 반드시 제공된 JSON 스키마 규격으로만 응답하세요.
`;

    const userPrompt = `
[오늘의 실제 시장 팩트 데이터]
- 날짜: ${marketData.date}
- 헤드라인: ${marketData.marketSummaryHeadline}
- 코스피: ${marketData.kospi.price.toLocaleString()} (${marketData.kospi.change > 0 ? '+' : ''}${marketData.kospi.change} / ${marketData.kospi.changeRate}%)
- 코스닥: ${marketData.kosdaq.price.toLocaleString()} (${marketData.kosdaq.change > 0 ? '+' : ''}${marketData.kosdaq.change} / ${marketData.kosdaq.changeRate}%)
- 원·달러 환율: ${marketData.usdKrw.price.toLocaleString()}원 (${marketData.usdKrw.change > 0 ? '+' : ''}${marketData.usdKrw.changeRate}%)
- 주요 종목 1: ${marketData.topMovers[0].name} (${marketData.topMovers[0].price.toLocaleString()}원, ${marketData.topMovers[0].changeRate}%, ${marketData.topMovers[0].foreignNet})
- 주요 종목 2: ${marketData.topMovers[1].name} (${marketData.topMovers[1].price.toLocaleString()}원, ${marketData.topMovers[1].changeRate}%, ${marketData.topMovers[1].foreignNet})

위 데이터를 바탕으로 최고의 퀄리티를 지닌 숏폼 콘텐츠를 구성해주세요.
`;

    try {
        const responseData = await generateContentWithFallback<any>({
            systemInstruction: systemPrompt,
            userPrompt: userPrompt,
            responseMimeType: 'application/json',
            temperature: 0.3
        });

        if (typeof responseData === 'object' && responseData.scenes) {
            return responseData as AlphaShortsContent;
        }

        const responseText = String(responseData);
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return parsed as AlphaShortsContent;
    } catch (error: any) {
        console.warn('[alphaContentGenerator] Gemini 호출 실패 또는 파싱 오류로 정밀 백업 템플릿 가동:', error.message);

        // Fallback: 팩트 데이터를 온전히 보존하는 정밀 템플릿
        return {
            topic: `오늘의 장마감 팩트 리포트 (${marketData.date})`,
            youtubeTitle: `오늘 국장 왜 이럴까? ${marketData.kospi.changeRate}% 변동의 진짜 이유 30초 요약 #주식 #코스피`,
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
                    voiceScript: `오늘 코스피 지수가 ${marketData.kospi.changeRate}% 변동하며 ${marketData.kospi.price.toFixed(0)}선에서 마감했습니다. 시장을 흔든 핵심 변수를 빠르게 짚어드립니다.`
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
                    voiceScript: `달러 환율이 ${marketData.usdKrw.price.toFixed(0)}원 부근을 유지하면서 외국인 자금의 리스크 회피 심리가 시장을 압박했습니다.`
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
                    voiceScript: `${marketData.topMovers[0].name}는 ${marketData.topMovers[0].changeRate}퍼센트를 기록한 반면, ${marketData.topMovers[1].name}는 상대적 견조함을 보였습니다.`
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
                    voiceScript: `내일 장 시작 전 미 증시 마감과 환율 안정 여부를 반드시 확인하세요. 성공 투자를 응원합니다.`
                }
            ]
        };
    }
}
