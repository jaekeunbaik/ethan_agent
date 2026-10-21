import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { trackChannelPerformance, ChannelMetrics } from '../channelPerformanceMonitor';
import { FeedbackMemory } from './types';

dotenv.config();

const MEMORY_FILE_PATH = path.join(process.cwd(), 'feedback_memory.json');

/**
 * 기본 초기 학습 지침 (첫 실행 또는 채널 데이터가 적을 때 사용)
 */
const DEFAULT_FEEDBACK_MEMORY: FeedbackMemory = {
    lastAnalyzedAt: new Date().toISOString(),
    channelStatus: '신규 채널 성장 단계: 1~2초 이탈 방지(Swipe-away 최소화) 및 댓글 참여 유도 집중',
    successfulPatterns: [
        '첫 대사에 "엄마 나 실수했어", "팀장님 이거 보고 계시죠" 등 극단적 상황 제시',
        '카톡 대화 4~6턴 이내로 20초 안에 빠른 템포와 반전 결말 배치',
        '마지막에 시청자에게 "누가 잘못했는지" 편 가르기 유도 퀴즈'
    ],
    weaknessesToAvoid: [
        '주식 지수 나열, 무미건조한 뉴스 브리핑 등 1초 만에 넘겨버리는 포맷 절대 금지',
        '말풍선 텍스트가 너무 길어 한눈에 안 들어오는 현상 방지',
        '노골적인 광고성 멘트가 본편 대화에 끼어드는 것 금지 (쿠팡 링크는 설명/댓글로만 분리)'
    ],
    viralHookRules: [
        '상단 옐로우 배너에 "ㅋㅋㅋ 역대급 카톡 대참사" 등 호기심 유발 헤드라인 필수',
        '오디오 템포를 평소 말속도 대비 +25% 이상 빠른 템포로 유지'
    ],
    recommendedCategories: ['당근/중고거래', '직장/알바', '연애/소개팅', '황당실수'],
    avgViewCount: 0
};

/**
 * 🔄 FeedbackAgent (자가 진화 피드백 에이전트)
 * - 유튜브 API로 최근 업로드된 영상들의 실시간 성과(조회수, 좋아요, 댓글 수)를 크롤링
 * - Gemini 2.5를 통해 "무엇이 터졌고, 무엇이 문제였는지" 자가 비평
 * - feedback_memory.json에 지속 업데이트하여 차기 기획/대본 에이전트에 개선 지침 주입
 */
export async function runFeedbackAgent(): Promise<FeedbackMemory> {
    console.log('\n[🔄 FeedbackAgent] 이전 영상 성과 분석 및 자가 진화 메모리 동기화 중...');

    // 1. 기존 메모리 파일 로드 (있을 경우)
    let currentMemory: FeedbackMemory = DEFAULT_FEEDBACK_MEMORY;
    if (fs.existsSync(MEMORY_FILE_PATH)) {
        try {
            const raw = fs.readFileSync(MEMORY_FILE_PATH, 'utf-8');
            currentMemory = { ...DEFAULT_FEEDBACK_MEMORY, ...JSON.parse(raw) };
        } catch {
            currentMemory = DEFAULT_FEEDBACK_MEMORY;
        }
    }

    // 2. 실시간 유튜브 지표 수집
    let metrics: ChannelMetrics | null = null;
    try {
        metrics = await trackChannelPerformance();
    } catch (e: any) {
        console.warn('[FeedbackAgent] 유튜브 통계 수집 건너뜀 (오프라인 모드):', e.message);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.log('[FeedbackAgent] GEMINI_API_KEY 미설정으로 기존 피드백 지침 유지');
        return currentMemory;
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        let channelSummary = '채널 초기 단계 또는 영상 데이터 누적 중';
        if (metrics && metrics.recentVideos.length > 0) {
            const totalViews = metrics.recentVideos.reduce((acc, v) => acc + v.views, 0);
            const avg = Math.round(totalViews / metrics.recentVideos.length);
            channelSummary = `
- 최근 영상 수: ${metrics.recentVideos.length}개
- 평균 조회수: ${avg}회
- 최근 영상 리스트:
${metrics.recentVideos.map(v => `  * "${v.title}": 조회수 ${v.views}회, 좋아요 ${v.likes}개, 댓글 ${v.comments}개`).join('\n')}
            `.trim();
        }

        const prompt = `
당신은 유튜브 쇼츠 알고리즘 총괄 분석관입니다.
최근 영상들의 성과와 기존 채널 피드백 메모리를 검토하여, 앞으로 제작될 '유머 카톡썰 쇼츠'가 조회수 10만~100만을 달성하기 위한 구체적인 [자가 개선 지침]을 JSON 형식으로 작성하세요.

[현재 채널 성과 데이터]:
${channelSummary}

[기존 학습 메모리]:
- 기존 성공 패턴: ${currentMemory.successfulPatterns.join(', ')}
- 피해야 할 약점: ${currentMemory.weaknessesToAvoid.join(', ')}

반드시 아래 JSON 스키마 형식으로만 응답하세요:
{
  "channelStatus": "채널 현 상태 진단 요약 1~2문장",
  "successfulPatterns": ["반드시 지켜야 할 성공 바이럴 공식 3가지"],
  "weaknessesToAvoid": ["조회수를 갉아먹는 피해야 할 요소 3가지"],
  "viralHookRules": ["0~2초 이탈률을 막기 위한 구체적 시각/청각 훅 규칙 2가지"],
  "recommendedCategories": ["당근/중고거래", "직장/알바", "연애/소개팅", "황당실수"]
}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });

        const rawText = response.text || '{}';
        const parsed = JSON.parse(rawText);

        const updatedMemory: FeedbackMemory = {
            lastAnalyzedAt: new Date().toISOString(),
            channelStatus: parsed.channelStatus || currentMemory.channelStatus,
            successfulPatterns: parsed.successfulPatterns || currentMemory.successfulPatterns,
            weaknessesToAvoid: parsed.weaknessesToAvoid || currentMemory.weaknessesToAvoid,
            viralHookRules: parsed.viralHookRules || currentMemory.viralHookRules,
            recommendedCategories: parsed.recommendedCategories || currentMemory.recommendedCategories,
            avgViewCount: metrics && metrics.recentVideos.length > 0 
                ? Math.round(metrics.recentVideos.reduce((a, b) => a + b.views, 0) / metrics.recentVideos.length)
                : currentMemory.avgViewCount
        };

        fs.writeFileSync(MEMORY_FILE_PATH, JSON.stringify(updatedMemory, null, 2), 'utf-8');
        console.log(`[FeedbackAgent] ✅ 자가 학습 메모리 갱신 완료! (피해야 할 요소: ${updatedMemory.weaknessesToAvoid.length}건, 성공 패턴: ${updatedMemory.successfulPatterns.length}건)`);
        return updatedMemory;

    } catch (err: any) {
        console.warn('[FeedbackAgent] AI 분석 중 오류로 기존 캐시 메모리 사용:', err.message);
        return currentMemory;
    }
}
