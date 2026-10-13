import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fetchDailyMarketData } from './src/financeDataFetcher';
import { generateAlphaShortsContent } from './src/alphaContentGenerator';
import { renderAlphaShortsVideo } from './src/alphaShortsRenderer';
import { sendDiscordReport } from './src/discordNotifier';

dotenv.config();

/**
 * 차세대 초고화질 금융 쇼츠 자동화 파이프라인 (AlphaShorts)
 */
async function main() {
    console.log('\n===============================================================');
    console.log(`🚀 [${new Date().toISOString()}] AlphaShorts 금융 인텔리전스 팩토리 가동`);
    console.log('===============================================================\n');

    const outputDir = path.join(process.cwd(), 'output_shorts');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 1단계: 공개 금융 데이터 공식 수집 (코스피, 코스닥, 환율, 대형주)
    console.log('📊 [1/3] 실시간 및 장마감 시장 팩트 데이터 수집 중...');
    const marketData = await fetchDailyMarketData();
    console.log(`✅ 데이터 수집 완료! [헤드라인: ${marketData.marketSummaryHeadline}]`);
    console.log(`   - KOSPI: ${marketData.kospi.price} (${marketData.kospi.changeRate}%)`);
    console.log(`   - KOSDAQ: ${marketData.kosdaq.price} (${marketData.kosdaq.changeRate}%)`);
    console.log(`   - USD/KRW: ${marketData.usdKrw.price}원 (${marketData.usdKrw.changeRate}%)`);

    // 2단계: Gemini 2.5 기반 고몰입 45초 대본 & 인포그래픽 씬 생성
    console.log('\n🧠 [2/3] Gemini 2.5 기반 금융 쇼츠 스토리텔링 및 씬 메타데이터 생성 중...');
    const content = await generateAlphaShortsContent(marketData);
    console.log(`✅ 콘텐츠 기획 완료! [주제: ${content.topic}]`);
    console.log(`   - 유튜브 제목: ${content.youtubeTitle}`);
    console.log(`   - 씬 개수: ${content.scenes.length}개`);
    content.scenes.forEach((s, idx) => {
        console.log(`     [Scene ${idx + 1}] ${s.badge} | ${s.title}`);
        console.log(`       대본: "${s.voiceScript}"`);
    });

    // 3단계: 1080x1920 세로형 다크 글래스모피즘 모션 비디오 렌더링
    console.log('\n🎥 [3/3] 1080x1920 초고화질 모션 인포그래픽 쇼츠 렌더링 시작...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputVideoPath = path.join(outputDir, `AlphaShorts_${timestamp}.mp4`);

    const finalVideo = await renderAlphaShortsVideo(content, outputVideoPath);

    console.log('\n🎉 ===============================================================');
    console.log(`✨ [성공] 차세대 AlphaShorts 영상이 성공적으로 렌더링되었습니다!`);
    console.log(`📁 비디오 경로: ${finalVideo}`);
    console.log('===============================================================\n');

    // 디스코드 알림 (설정된 경우 자동 발송)
    try {
        await sendDiscordReport({
            topic: content.topic,
            threadsPostId: null,
            mytiThreadsPostId: null,
            instagramPostId: null,
            youtubeShortsUrl: `로컬 생성 완료: ${path.basename(finalVideo)}`,
            publicImageUrls: [],
            status: 'SUCCESS'
        });
    } catch {
        // Discord 웹훅 미설정 시 무시
    }
}

main().catch(err => {
    console.error('❌ AlphaShorts 파이프라인 실행 중 오류 발생:', err);
    process.exit(1);
});
