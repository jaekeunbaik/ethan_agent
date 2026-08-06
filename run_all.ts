import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

async function runAllPipelines() {
    console.log('🚀 [MasterRunner] 2종류 자동화 파이프라인 동시 가동 시작!');
    console.log('=================================================================');

    // 1. 뉴스 기반 팩폭 숏폼 파이프라인 실행
    console.log('\n[1/2] 📰 뉴스 트렌드 기반 알고리즘 쇼츠 실행 중...');
    try {
        execSync('npx ts-node run_news_shorts.ts', { stdio: 'inherit' });
    } catch (e: any) {
        console.error('❌ 뉴스 쇼츠 실행 중 경고:', e.message);
    }

    // 2. 카카오톡 썰 숏폼 파이프라인 실행
    console.log('\n[2/2] 📱 커뮤니티 썰 카카오톡 모션 쇼츠 실행 중...');
    try {
        execSync('npx ts-node run_kakaotalk_shorts.ts', { stdio: 'inherit' });
    } catch (e: any) {
        console.error('❌ 카카오톡 썰 쇼츠 실행 중 경고:', e.message);
    }

    console.log('\n🎉 =================================================================');
    console.log('✨ [MasterRunner] 총 2개의 매력적인 쇼츠 동영상 및 SNS 포스팅 자동 완수!');
    console.log('=================================================================');
}

runAllPipelines();
