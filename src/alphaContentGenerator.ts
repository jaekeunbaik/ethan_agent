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
당신은 유튜브에서 수백만 조회수를 기록하는 인기 경제 쇼츠 전문 크리에이터입니다.
시청자가 스크롤을 내리려다 멈추고 끝까지 집중하게 만드는 [빠르고 똑 부러지는 쇼츠 스토리텔링 말투]로 대본을 작성하세요.

[말투 & 딕션 가이드라인 - 필수]
1. 도입(Hook): "오늘 주식 계좌 열어보신 분들은 진짜 깜짝 놀라셨을 텐데요!"처럼 시청자의 현실 공감을 1초 만에 때려박는 시작.
2. 어미 & 리듬감: 딱딱한 뉴스투(~했습니다) 금지! 
   "~했거든요!", "~한 겁니다!", "~때문인 거죠!", "~라는 건데요!"처럼 귀에 쏙쏙 감기는 리듬감 있는 구어체.
3. 군더더기 제로: "첫 번째는 환율인데요", "두 번째는 외국인의 폭풍 매도입니다"처럼 팩트를 번호와 함께 쾌속 전달.
4. 씬 구성:
   - Scene 1: [HOOK] 오늘 장마감 충격 상황 요약 ("대체 오늘 무슨 일이 있었던 걸까요?")
   - Scene 2: [FACT 1] 환율 급등과 외국인 자금 이탈 현황 ("환율이 치솟으면서 외국인이 썰물처럼 빠져나간 건데요")
   - Scene 3: [FACT 2] 삼성전자와 하이닉스 희비 엇갈림 ("삼전은 휘청인 반면, 하이닉스는 악착같이 버텨냈죠")
   - Scene 4: [ACTION] 내일 아침 실전 대응 팁 ("내일 시초가 불나방 매매는 절대 금물입니다!")
5. 호흡: 한 씬당 6~7초 분량으로 숨 쉴 틈 없이 빠르게 전개.
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

        if (typeof responseData === 'object' && responseData !== null) {
            if (Array.isArray(responseData.scenes)) {
                return responseData as AlphaShortsContent;
            }
            // 중첩 래퍼 객체 탐색
            for (const key of Object.keys(responseData)) {
                if (responseData[key] && Array.isArray(responseData[key].scenes)) {
                    return responseData[key] as AlphaShortsContent;
                }
            }
        }

        const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.scenes)) {
            return parsed as AlphaShortsContent;
        }
        for (const key of Object.keys(parsed)) {
            if (parsed[key] && Array.isArray(parsed[key].scenes)) {
                return parsed[key] as AlphaShortsContent;
            }
        }
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
