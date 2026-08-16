import dotenv from 'dotenv';
import path from 'path';
import { fetchTrendingCommunityStory } from './src/communityFetcher';
import { generateKatalkScript } from './src/katalkContentGenerator';
import { createKatalkShortsVideo } from './src/katalkShortsRenderer';
import { uploadToYouTubeShorts } from './src/youtubeUploader';
import { postToThreads } from './src/snsUploader';
import { sendDiscordReport } from './src/discordNotifier';
import { logMarketingResult } from './src/supabaseLogger';

dotenv.config();

async function runKatalkShortsPipeline() {
    console.log('📱 [KatalkShorts] 카카오톡 썰 자동화 파이프라인 가동...');

    try {
        // 1. 실시간 핫이슈 썰 크롤링
        const story = await fetchTrendingCommunityStory();

        // 2. Gemini AI 카톡 대본 각색
        const script = await generateKatalkScript(story);

        // 3. 카카오톡 모션 그래픽 쇼츠 렌더링
        const videoPath = await createKatalkShortsVideo(script);

        // 4. 유튜브 쇼츠 자동 업로드
        let youtubeUrl = '';
        const ytResult = await uploadToYouTubeShorts({
            videoPath,
            title: `[카톡썰] ${script.title}`,
            description: script.instaCaption,
            tags: ['Shorts', '카톡썰', '자소서', 'dethan', '디든', '취업']
        });
        if (ytResult.success && ytResult.videoUrl) {
            youtubeUrl = ytResult.videoUrl;
        }

        // 5. 스레드 포스팅 자동 게재
        let threadsPostId = '';
        try {
            threadsPostId = await postToThreads(`${script.threadText}\n\n👉 3초 만에 AI 무료 교정 받으러 가기: https://draft-ethan.vercel.app/`);
        } catch (e: any) {
            console.warn('[KatalkShorts] 스레드 업로드 경고:', e.message);
        }

        // 6. 로컬 로그 DB 기록
        await logMarketingResult({
            topic: script.topic,
            thread_text: script.threadText,
            insta_caption: script.instaCaption,
            card_news_slides: [],
            threads_post_id: threadsPostId,
            status: 'SUCCESS'
        });

        // 7. 디스코드 알림 전송
        await sendDiscordReport({
            topic: script.topic,
            threadsPostId,
            youtubeShortsUrl: youtubeUrl,
            status: 'SUCCESS'
        });

        console.log('🎉 =================================================================');
        console.log(`✨ 카카오톡 썰 쇼츠 자동화 파이프라인 완수!: ${videoPath}`);
        if (youtubeUrl) console.log(`📺 유튜브 쇼츠 URL: ${youtubeUrl}`);
        console.log('=================================================================');
    } catch (err: any) {
        console.error('❌ [KatalkShorts] 파이프라인 실행 중 오류 발생:', err);
        await sendDiscordReport({
            topic: '카카오톡 썰 쇼츠 자동화 파이프라인',
            status: 'FAILED',
            errorMessage: err.message || String(err)
        });
    }
}

runKatalkShortsPipeline();
