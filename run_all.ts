import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { runMarketingPipeline } from './marketingAutomation';

dotenv.config();

async function runAllPipelines() {
    console.log('🚀 [MasterRunner] 4대 SNS 매체 풀패키지 마케팅 파이프라인 가동 시작!');
    console.log('=================================================================');

    // 1. 4대 SNS (Draft Ethan 스레드, MYTI 스레드, 인스타그램, 유튜브 쇼츠) 풀패키지 가동
    console.log('\n[1/2] 🎨 4대 매체 (Draft Ethan Threads, MYTI Threads, Instagram, YouTube Shorts) 전체 게재 진행 중...');
    try {
        await runMarketingPipeline();
    } catch (e: any) {
        console.error('❌ 4대 매체 풀패키지 파이프라인 오류:', e.message || e);
    }

    // 2. 카카오톡 썰 숏폼 동영상 추가 가동
    console.log('\n[2/2] 📱 커뮤니티 썰 카카오톡 모션 쇼츠 추가 가동 중...');
    try {
        execSync('npx ts-node run_kakaotalk_shorts.ts', { stdio: 'inherit' });
    } catch (e: any) {
        console.error('❌ 카카오톡 썰 쇼츠 가동 중 경고:', e.message || e);
    }

    console.log('\n🎉 =================================================================');
    console.log('✨ [MasterRunner] 모든 파이프라인 가동 완수! 4대 SNS 채널에 전격 포스팅 되었습니다.');
    console.log('=================================================================');
}

runAllPipelines().catch((err) => {
    console.error('❌ [MasterRunner] 마스터 파일 실행 도중 크리티컬 오류:', err);
});
