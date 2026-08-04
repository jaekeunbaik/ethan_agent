import cron from 'node-cron';
import path from 'path';
import dotenv from 'dotenv';
import { generateMarketingContent, MarketingContentResponse } from './src/contentGenerator';
import { renderAllCardNewsSlides } from './src/imageRenderer';
import { uploadImagesToSupabaseStorage, logMarketingResult } from './src/supabaseLogger';
import { postToThreads, postCarouselToInstagram } from './src/snsUploader';
import { createShortsVideo } from './src/shortsRenderer';
import { uploadToYouTubeShorts } from './src/youtubeUploader';
import { sendDiscordReport } from './src/discordNotifier';

dotenv.config();

/**
 * Draft Ethan SNS 마케팅 자동화 메인 파이프라인 함수
 */
export async function runMarketingPipeline(): Promise<void> {
    console.log('\n==================================================');
    console.log(`[${new Date().toISOString()}] Draft Ethan 마케팅 파이프라인 실행을 시작합니다.`);
    console.log('==================================================\n');

    let contentData: MarketingContentResponse | null = null;
    let publicUrls: string[] = [];
    let threadsPostId: string | null = null;
    let mytiThreadsPostId: string | null = null;
    let instagramPostId: string | null = null;
    let youtubeShortsUrl: string | null = null;

    try {
        // 1단계: Gemini 2.5 API 기반 마케팅 콘텐츠 자동 생성
        console.log('🚀 [1/6] Gemini 2.5 API로 오늘의 홍보 콘텐츠 생성 중...');
        contentData = await generateMarketingContent();
        console.log(`✅ 콘텐츠 생성 완료! (주제: "${contentData.topic}")`);
        console.log(`- Draft Ethan 스레드 문구: ${contentData.thread_text.substring(0, 40)}...`);
        console.log(`- MYTI 스레드 문구: ${contentData.myti_thread_text.substring(0, 40)}...`);

        // 2단계: 카드뉴스 슬라이드 3장 이미지 렌더링 (Draft Ethan용)
        console.log('\n🎨 [2/6] Draft Ethan 카드뉴스 이미지 렌더링 중...');
        const outputDir = path.join(process.cwd(), 'output_cardnews');
        const localImagePaths = await renderAllCardNewsSlides(contentData.card_news_slides, outputDir);
        console.log(`✅ 이미지 렌더링 완료! (저장 위치: ${outputDir})`);

        // 3단계: 임시 공개 이미지 호스트에 카드뉴스 이미지 업로드하여 퍼블릭 URL 획득
        console.log('\n☁️ [3/6] 임시 이미지 호스팅 서버에 업로드 중...');
        try {
            publicUrls = await uploadImagesToSupabaseStorage(localImagePaths);
        } catch (uploadError: any) {
            console.warn('⚠️ 임시 이미지 업로더 전송 실패:', uploadError.message);
        }

        // 4단계: Threads 자동 업로드 (2개 사이드 프로젝트 포스팅)
        console.log('\n💬 [4/6] Threads API로 스레드 포스팅 업로드 중 (Draft Ethan + MYTI)...');
        
        // 4-1. Draft Ethan 스레드 게시
        try {
            console.log('  📌 [Threads 1/2] Draft Ethan 스레드 업로드 중...');
            threadsPostId = await postToThreads(contentData.thread_text);
        } catch (threadsErr: any) {
            console.error('❌ Draft Ethan Threads 업로드 실패:', threadsErr.message || threadsErr);
        }

        // 스레드 연속 게시 간 5초 딜레이
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // 4-2. MYTI 페르소나 테스트 스레드 게시 (Threads 전용)
        try {
            console.log('  📌 [Threads 2/2] MYTI 페르소나 테스트 스레드 업로드 중...');
            mytiThreadsPostId = await postToThreads(contentData.myti_thread_text);
        } catch (mytiErr: any) {
            console.error('❌ MYTI Threads 업로드 실패:', mytiErr.message || mytiErr);
        }

        // 5단계: Instagram Graph API Carousel 자동 업로드 (Draft Ethan)
        console.log('\n📸 [5/6] Instagram Graph API로 카드뉴스 캐러셀 포스팅 업로드 중...');
        try {
            if (publicUrls.length > 0) {
                instagramPostId = await postCarouselToInstagram(publicUrls, contentData.insta_caption);
            } else {
                console.warn('⚠️ 퍼블릭 이미지 URL이 없어 인스타그램 업로드를 건너뜁니다.');
            }
        } catch (instaErr: any) {
            console.error('❌ Instagram 업로드 실패:', instaErr.message || instaErr);
            if (instaErr.response?.data) {
                console.error('   상세 에러:', JSON.stringify(instaErr.response.data, null, 2));
            }
        }

        // 6단계: YouTube Shorts 세로 영상 (.mp4) 자동 합성 및 브랜드 채널 업로드
        console.log('\n🎬 [6/6] YouTube Shorts 9:16 세로 영상 합성 및 업로드 중...');
        try {
            const videoPath = await createShortsVideo(contentData.card_news_slides);
            const uploadRes = await uploadToYouTubeShorts({
                videoPath,
                title: contentData.card_news_slides[0]?.title || `[자소서 팩폭] ${contentData.topic}`,
                description: contentData.thread_text,
                tags: ['Shorts', '자소서', '취업', 'DraftEthan', 'AI교정']
            });

            if (uploadRes.success) {
                youtubeShortsUrl = uploadRes.videoUrl || null;
            }
        } catch (shortsErr: any) {
            console.error('❌ YouTube Shorts 처리 실패:', shortsErr.message || shortsErr);
        }

        // 결과 판정 및 Database/JSON 로깅
        const isSuccess = Boolean(threadsPostId || mytiThreadsPostId || instagramPostId || youtubeShortsUrl);
        const allSuccess = Boolean(threadsPostId && mytiThreadsPostId && instagramPostId && youtubeShortsUrl);
        const status = allSuccess ? 'SUCCESS' : (isSuccess ? 'PARTIAL_SUCCESS' : 'FAILED');

        await logMarketingResult({
            topic: contentData.topic,
            thread_text: contentData.thread_text,
            myti_thread_text: contentData.myti_thread_text,
            insta_caption: contentData.insta_caption,
            card_news_slides: contentData.card_news_slides,
            card_news_urls: publicUrls,
            threads_post_id: threadsPostId,
            myti_threads_post_id: mytiThreadsPostId,
            instagram_post_id: instagramPostId,
            status: status,
            error_message: !isSuccess ? '모든 플랫폼 업로드 실패' : null
        });

        // 7단계: Discord 비서 알림 (draft_secretary) 전송
        await sendDiscordReport({
            topic: contentData.topic,
            threadsPostId: threadsPostId,
            mytiThreadsPostId: mytiThreadsPostId,
            instagramPostId: instagramPostId,
            youtubeShortsUrl: youtubeShortsUrl,
            publicImageUrls: publicUrls,
            status: status,
            errorMessage: !isSuccess ? '모든 플랫폼 업로드 실패' : null
        });

        console.log('\n🎉 파이프라인 실행 및 디스코드 보고서 전송이 완료되었습니다!');
        console.log(`- 최종 상태: ${status}`);
        console.log(`- Draft Ethan Threads Post ID: ${threadsPostId || 'N/A'}`);
        console.log(`- MYTI Threads Post ID: ${mytiThreadsPostId || 'N/A'}`);
        console.log(`- Instagram Post ID: ${instagramPostId || 'N/A'}`);

    } catch (error: any) {
        console.error('\n💥 마케팅 파이프라인 실행 도중 크리티컬 오류 발생:', error.message || error);
        if (contentData) {
            await logMarketingResult({
                topic: contentData.topic,
                thread_text: contentData.thread_text,
                myti_thread_text: contentData.myti_thread_text,
                insta_caption: contentData.insta_caption,
                card_news_slides: contentData.card_news_slides,
                card_news_urls: publicUrls,
                status: 'FAILED',
                error_message: error.message || String(error)
            });

            await sendDiscordReport({
                topic: contentData.topic,
                publicImageUrls: publicUrls,
                status: 'FAILED',
                errorMessage: error.message || String(error)
            });
        }
    }
}

/**
 * node-cron 스케줄러 등록 (매일 오전 11:15, 오후 18:15 실행)
 */
function startCronScheduler(): void {
    console.log('⏰ Draft Ethan SNS 마케팅 크론 스케줄러가 활성화되었습니다.');
    console.log('- 실행 시간: 매일 오전 11:15, 오후 18:15 (Cron: 15 11,18 * * *)');

    // 매일 오전 11시 15분, 오후 6시 15분 스케줄링
    cron.schedule('15 11,18 * * *', async () => {
        console.log('[Cron Job] 지정된 스케줄 시각 도달! 파이프라인 트리거 중...');
        await runMarketingPipeline();
    });
}

// CLI 실행 인자 확인
const isTestRun = process.argv.includes('--test') || process.argv.includes('--now');

if (isTestRun) {
    console.log('🧪 [--test] 즉시 실행 모드로 1회 테스트를 실행합니다.');
    runMarketingPipeline();
} else {
    startCronScheduler();
}
