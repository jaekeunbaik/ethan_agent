import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchDailyMarketData } from './src/financeDataFetcher';
import { generateAlphaShortsContent } from './src/alphaContentGenerator';
import { renderAlphaShortsVideo } from './src/alphaShortsRenderer';
import { sendDiscordReport } from './src/discordNotifier';

dotenv.config();

const CACHE_DIR = path.join(process.cwd(), '.cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * 토큰 절약형 스마트 캐시 검사
 * 오늘 날짜의 해당 슬롯(MORNING / CLOSING)에 이미 작업이 완료되었다면
 * Gemini API 토큰을 1개도 소비하지 않고 건너뜁니다.
 */
function isSlotAlreadyExecuted(slotKey: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const cacheFile = path.join(CACHE_DIR, `executed_${today}_${slotKey}.json`);
    return fs.existsSync(cacheFile);
}

function markSlotExecuted(slotKey: string, videoPath: string) {
    const today = new Date().toISOString().slice(0, 10);
    const cacheFile = path.join(CACHE_DIR, `executed_${today}_${slotKey}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify({
        date: today,
        slotKey,
        videoPath,
        timestamp: new Date().toISOString()
    }, null, 2), 'utf-8');
}

/**
 * 주말(토, 일)에는 시장이 열리지 않으므로 토큰을 0개 소모하고 대기
 */
function isMarketOpenDay(): boolean {
    const day = new Date().getDay();
    return day !== 0 && day !== 6; // 0=일, 6=토
}

/**
 * 단일 파이프라인 안전 자율 실행 (오류 발생 시에도 죽지 않고 스스로 복구)
 */
async function executeAutonomousJob(slotName: string) {
    if (!isMarketOpenDay()) {
        console.log(`[${new Date().toLocaleTimeString()}] 주말 휴장일입니다. 토큰 절약을 위해 실행을 건너뜁니다.`);
        return;
    }

    if (isSlotAlreadyExecuted(slotName)) {
        console.log(`[${new Date().toLocaleTimeString()}] [${slotName}] 오늘 이미 작업이 완료되었습니다. 토큰 절약을 위해 패스합니다.`);
        return;
    }

    console.log(`\n===============================================================`);
    console.log(`🤖 [${new Date().toISOString()}] AlphaShorts [${slotName}] 자율 파이프라인 가동 시작`);
    console.log(`===============================================================\n`);

    const outputDir = path.join(process.cwd(), 'output_shorts');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        // 1. 합법적 공개 시장 데이터 수집 (무료/토큰 0 소모)
        console.log('📊 [1/3] 실시간 시장 데이터 수집 중...');
        const marketData = await fetchDailyMarketData();

        // 2. 토큰 최소화 Gemini 생성 (정밀 팩트 대본 1회만 호출)
        console.log('🧠 [2/3] 토큰 절약형 Gemini 2.5 팩트 대본 생성 중 (일 1회만 정밀 소비)...');
        const content = await generateAlphaShortsContent(marketData);

        // 3. 1080x1920 세로형 초고화질 다크 인포그래픽 렌더링
        console.log('🎥 [3/3] 1080x1920 다크 차트 비주얼라이저 영상 렌더링...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outputVideoPath = path.join(outputDir, `AlphaShorts_${slotName}_${timestamp}.mp4`);

        const finalVideo = await renderAlphaShortsVideo(content, outputVideoPath);

        // 실행 완료 기록 (중복 호출 방지)
        markSlotExecuted(slotName, finalVideo);

        console.log(`✅ [성공] ${slotName} 영상 자율 생성 완료: ${finalVideo}`);

        // 디스코드로 조용히 성공 결과만 노티 (사용자 개입 0)
        try {
            await sendDiscordReport({
                topic: `[자율배포] ${content.topic}`,
                threadsPostId: null,
                mytiThreadsPostId: null,
                instagramPostId: null,
                youtubeShortsUrl: `로컬 완성: ${path.basename(finalVideo)}`,
                publicImageUrls: [],
                status: 'SUCCESS'
            });
        } catch {}

    } catch (error: any) {
        console.error(`⚠️ [${slotName}] 자율 파이프라인 실행 중 오류 발생 (시스템 계속 유지):`, error.message);
        try {
            await sendDiscordReport({
                topic: `[자율배포 실패] ${slotName}`,
                status: 'FAILED',
                errorMessage: error.message
            });
        } catch {}
    }
}

// ─── 24시간 자율 무인 크론 스케줄러 ──────────────────────────────────────────

console.log('======================================================================');
console.log('🚀 [AlphaShorts Autonomous Daemon] 24/7 완전 무인 자율 데몬 가동 중');
console.log('📌 토큰 최적화: 평일 장마감(15:45) 일 1회 정밀 실행 + 주말 100% 절전');
console.log('📌 확인 팝업/Accept 클릭 요구 0회, 백그라운드 무인 오케스트레이션');
console.log('======================================================================');

// 평일 15:45 (국내 증시 장마감 직후 수급 정리 쇼츠)
cron.schedule('45 15 * * 1-5', () => {
    executeAutonomousJob('CLOSING_BELL');
});

// 시작 시점 테스트용: 이미 오늘 만든 게 없다면 최초 1회만 안전하게 확인
console.log(`[시스템 상태] 데몬이 백그라운드에서 정상 대기 중입니다. (다음 실행: 평일 15:45)`);
