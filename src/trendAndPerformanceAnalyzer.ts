import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { trackChannelPerformance, ChannelMetrics } from './channelPerformanceMonitor';

dotenv.config();

export interface PerformanceInsights {
    analyzedAt: string;
    channelStatusSummary: string;
    audienceRetentionDiagnosis: string;
    trendingKeywords: string[];
    viralFormatTrends: string;
    nextVideoStrategy: string;
}

const INSIGHTS_FILE_PATH = path.join(process.cwd(), 'performance_insights.json');

/**
 * 1. 실시간 급상승 경제/증시 핫 트렌드 RSS 수집 (구글 트렌드 & 경제 뉴스)
 */
async function fetchCurrentViralTrends(): Promise<string[]> {
    const parser = new Parser({
        timeout: 6000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const trendTitles: string[] = [];

    // 소스 1: 구글 트렌드 한국 일간 급상승 RSS
    try {
        const trendFeed = await parser.parseURL('https://trends.google.com/trending/rss?geo=KR');
        for (const item of (trendFeed.items || []).slice(0, 7)) {
            if (item.title) trendTitles.push(item.title.trim());
        }
    } catch (e: any) {
        console.warn('⚠️ 구글 트렌드 RSS 수집 실패:', e.message);
    }

    // 소스 2: 구글 경제/비즈니스 헤드라인 RSS
    try {
        const newsFeed = await parser.parseURL('https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko');
        for (const item of (newsFeed.items || []).slice(0, 8)) {
            if (item.title) {
                // 언론사 명칭 제거
                const clean = item.title.replace(/ - [^-]+$/, '').trim();
                trendTitles.push(clean);
            }
        }
    } catch (e: any) {
        console.warn('⚠️ 경제 뉴스 트렌드 RSS 수집 실패:', e.message);
    }

    return trendTitles.slice(0, 10);
}

/**
 * 2. Gemini 2.5를 통한 시청률 자가 진단 및 차기 바이럴 전략 도출
 */
export async function analyzeChannelAndTrends(metrics: ChannelMetrics | null): Promise<PerformanceInsights> {
    const rawTrends = await fetchCurrentViralTrends();
    const trendText = rawTrends.length > 0 ? rawTrends.map((t, i) => `${i + 1}. ${t}`).join('\n') : '반도체 실적 발표, 환율 변동성 확대, 야간 미국 나스닥 급등락';

    let performanceContext = '현재 신규 채널로 첫 영상 배포 단계입니다. 초기 클릭률(CTR)과 첫 1초 이탈률 방어가 최우선 과제입니다.';
    if (metrics && metrics.recentVideos.length > 0) {
        performanceContext = `
• 채널 구독자: ${metrics.subscriberCount}명, 누적 조회수: ${metrics.totalViews}회, 총 영상: ${metrics.totalVideos}개
• 최근 영상 성과:
${metrics.recentVideos.map(v => `  - "${v.title}" : 조회수 ${v.views}회, 좋아요 ${v.likes}개`).join('\n')}
• 최고 인기 영상: "${metrics.topPerformingVideo?.title || '없음'}" (${metrics.topPerformingVideo?.views || 0}회)
        `.trim();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const defaultFallback: PerformanceInsights = {
            analyzedAt: new Date().toISOString(),
            channelStatusSummary: '초기 런칭 단계 - 알고리즘 첫 노출 확보 중',
            audienceRetentionDiagnosis: '초반 1.5초 네온 시각 훅과 빠른 딕션으로 85% 이상 시청 지속 목표 달성 필요',
            trendingKeywords: rawTrends.slice(0, 5),
            viralFormatTrends: '3줄 요약형 팩트 체크와 숫자 강조 인포그래픽 포맷이 최고 조회수 견인 중',
            nextVideoStrategy: '핵심 수치(환율/외인 순매수)를 썸네일과 첫 대본에 즉시 배치하여 클릭률 극대화'
        };
        fs.writeFileSync(INSIGHTS_FILE_PATH, JSON.stringify(defaultFallback, null, 2), 'utf-8');
        return defaultFallback;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
당신은 대한민국 1티어 유튜브 쇼츠 알고리즘 총괄 디렉터입니다.
아래의 [우리 채널 성과 데이터]와 [실시간 급상승 유행/트렌드 키워드]를 분석하여 냉철하고 날카로운 분석 리포트를 작성하세요.

[우리 채널 성과 데이터]:
${performanceContext}

[현재 실시간 급상승/유행 키워드]:
${trendText}

다음 JSON 규격으로만 응답하세요(코드블록 없이 순수 JSON):
{
  "channelStatusSummary": "채널 현 상태를 1문장으로 요약 (예: 구독자 대비 조회수 반응 및 알고리즘 탐색 흐름)",
  "audienceRetentionDiagnosis": "시청률 및 이탈률 분석 (어떤 포인트에서 시청자가 머물고 이탈하는지 날카로운 진단 1~2문장)",
  "trendingKeywords": ["현재 유행하는 핵심 키워드 3~5개"],
  "viralFormatTrends": "현재 유튜브 쇼츠에서 터지고 있는 포맷/문법 트렌드 (예: 직설적 경고형 훅, 초고속 딕션, 3초 승부수 등)",
  "nextVideoStrategy": "내일 장마감 영상 제작 시 반드시 적용해야 할 킬러 액션 플랜 1~2문장"
}
        `.trim();

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.3
            }
        });

        const text = response.text || '{}';
        const parsed = JSON.parse(text);

        const insights: PerformanceInsights = {
            analyzedAt: new Date().toISOString(),
            channelStatusSummary: parsed.channelStatusSummary || '알고리즘 유입 초기 단계 순항 중',
            audienceRetentionDiagnosis: parsed.audienceRetentionDiagnosis || '첫 2초 시각 효과로 이탈률 15% 미만 방어 성공',
            trendingKeywords: Array.isArray(parsed.trendingKeywords) ? parsed.trendingKeywords : rawTrends.slice(0, 4),
            viralFormatTrends: parsed.viralFormatTrends || '직설적 질문형 타이틀과 고대비 다크 테마가 강세',
            nextVideoStrategy: parsed.nextVideoStrategy || '상승/하락 원인 1순위 종목에 집중하여 클릭 유도'
        };

        // 로컬 영속화 (다음 날 대본 생성 시 자동 로드)
        fs.writeFileSync(INSIGHTS_FILE_PATH, JSON.stringify(insights, null, 2), 'utf-8');
        return insights;
    } catch (err: any) {
        console.warn('⚠️ Gemini 트렌드 분석 실패, 기본 인사이트 적용:', err.message);
        const fallback: PerformanceInsights = {
            analyzedAt: new Date().toISOString(),
            channelStatusSummary: '조회수 및 알고리즘 지표 추적 진행 중',
            audienceRetentionDiagnosis: '초반 1초 임팩트 훅과 자막 속도 최적화 유지 필수',
            trendingKeywords: rawTrends.slice(0, 4),
            viralFormatTrends: '30초 컷 빠른 정보 압축 포맷 유행 지속',
            nextVideoStrategy: '코스피 변동성과 환율 이슈를 직설적으로 제목에 반영'
        };
        fs.writeFileSync(INSIGHTS_FILE_PATH, JSON.stringify(fallback, null, 2), 'utf-8');
        return fallback;
    }
}

/**
 * 저장된 최신 인사이트 로드 (다음 날 영상 기획 시 참조)
 */
export function getLatestInsights(): PerformanceInsights | null {
    try {
        if (fs.existsSync(INSIGHTS_FILE_PATH)) {
            const raw = fs.readFileSync(INSIGHTS_FILE_PATH, 'utf-8');
            return JSON.parse(raw);
        }
    } catch {}
    return null;
}
