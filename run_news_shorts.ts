import { generateMarketingContent } from './src/contentGenerator';
import { createShortsVideo } from './src/shortsRenderer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function runNewsShorts() {
    console.log('🚀 [NewsShorts] 실시간 뉴스 트렌드 기반 쇼츠 자동 생성 시작...');
    
    // 1. 실시간 뉴스 트렌드 수집 및 AI 팩폭 썰 스피치 대본 생성 (SPICY 팩폭 톤 적용)
    const content = await generateMarketingContent('SPICY');

    console.log('\n📰 ================= [수집된 실시간 뉴스 & 콘텐트] =================');
    console.log(`📌 주제/뉴스: ${content.topic}`);
    if (content.news_source) console.log(`📰 출처: ${content.news_source}`);
    console.log(`💬 스레드 문구: ${content.thread_text}`);
    console.log('=================================================================\n');

    console.log('🎬 생성된 쇼츠 슬라이드 3개:');
    content.card_news_slides.forEach((slide, idx) => {
        console.log(`\n[슬라이드 ${idx + 1} - ${slide.type}]`);
        console.log(` - 제목: ${slide.title}`);
        console.log(` - 부제목: ${slide.subtitle}`);
        console.log(` - 본문: ${slide.contentLines.join(' / ')}`);
    });

    // 2. 9:16 모션 그래픽 쇼츠 동영상 렌더링 (Ken Burns + Neural TTS + Dynamic Subtitles)
    console.log('\n🎥 9:16 모션 그래픽 세로 쇼츠 렌더링 가동 중...');
    const videoPath = await createShortsVideo(content.card_news_slides);
    
    console.log('\n🎉 =================================================================');
    console.log(`✨ 실시간 뉴스 기반 알고리즘 폭격 숏폼 완성!: ${videoPath}`);
    console.log('=================================================================\n');
}

runNewsShorts().catch(err => {
    console.error('❌ 쇼츠 생성 중 오류 발생:', err);
});
