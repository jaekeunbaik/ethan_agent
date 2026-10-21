import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { executeMultiAgentShortsFactory } from './src/agents/orchestratorAgent';

dotenv.config();

const CACHE_DIR = path.join(process.cwd(), '.cache');
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function isSlotAlreadyExecuted(slotKey: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const cacheFile = path.join(CACHE_DIR, `executed_${today}_${slotKey}.json`);
    return fs.existsSync(cacheFile);
}

function markSlotExecuted(slotKey: string) {
    const today = new Date().toISOString().slice(0, 10);
    const cacheFile = path.join(CACHE_DIR, `executed_${today}_${slotKey}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify({
        date: today,
        slotKey,
        timestamp: new Date().toISOString()
    }, null, 2), 'utf-8');
}

async function runScheduledJob(slotName: string) {
    if (isSlotAlreadyExecuted(slotName)) {
        console.log(`[${new Date().toLocaleTimeString()}] [${slotName}] 오늘 이미 작업이 완료되었습니다. 토큰 및 리소스 절약을 위해 패스합니다.`);
        return;
    }

    console.log(`\n===============================================================`);
    console.log(`🤖 [${new Date().toISOString()}] 멀티 서브에이전트 [${slotName}] 자율 스케줄 시작`);
    console.log(`===============================================================\n`);

    try {
        await executeMultiAgentShortsFactory();
        markSlotExecuted(slotName);
        console.log(`✅ [성공] ${slotName} 슬롯 작업 완료 기록`);
    } catch (err: any) {
        console.error(`⚠️ [${slotName}] 자율 작업 실행 중 오류 (데몬 프로세스는 정상 유지):`, err.message);
    }
}

console.log('======================================================================');
console.log('🚀 [KatalkShorts Multi-Agent Autonomous Daemon] 24/7 완전 무인 자율 데몬 가동');
console.log('📌 콘텐츠: 도파민 유머 카톡썰 + 쿠팡 파트너스 자동 수익화');
console.log('📌 자가 진화: 이전 영상 실시간 성과 피드백 메모리 자동 반영');
console.log('📌 골든 타임 스케줄: 매일 18:30(퇴근/저녁 피크) & 22:30(심야 피크)');
console.log('======================================================================');

// 1. 매일 18:30 (퇴근/하교 저녁 골든 타임)
cron.schedule('30 18 * * *', () => {
    runScheduledJob('EVENING_PEAK');
});

// 2. 매일 22:30 (심야 취침 전 숏폼 시청 피크)
cron.schedule('30 22 * * *', () => {
    runScheduledJob('NIGHT_PEAK');
});

// 시작 시점 알림
console.log(`[시스템 상태] 데몬이 백그라운드에서 정상 대기 중입니다. (스케줄: 매일 18:30, 22:30)`);
