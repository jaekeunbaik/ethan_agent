import cron from 'node-cron';
import path from 'path';
import dotenv from 'dotenv';
import { generateMarketingContent, MarketingContentResponse } from './src/contentGenerator';
import { renderAllCardNewsSlides } from './src/imageRenderer';
import { uploadImagesToSupabaseStorage, logMarketingResult } from './src/supabaseLogger';
import { postToThreads, postCarouselToInstagram } from './src/snsUploader';

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
    let instagramPostId: string | null = null;

    try {
        // 1단계: Gemini 2.5 API 기반 마케팅 콘텐츠 자동 생성
        console.log('🚀 [1/5] Gemini 2.5 API로 오늘의 홍보 콘텐츠 생성 중...');
        contentData = await generateMarketingContent();
        console.log(`✅ 콘텐츠 생성 완료! (주제: "${contentData.topic}")`);
        console.log(`- 스레드 문구: ${contentData.thread_text.substring(0, 50)}...`);

        // 2단계: 카드뉴스 슬라이드 5장 이미지 렌더링
        console.log('\n🎨 [2/5] 카드뉴스 5장 슬라이드 이미지 렌더링 중...');
        const outputDir = path.join(process.cwd(), 'output_cardnews');
        const localImagePaths = await renderAllCardNewsSlides(contentData.card_news_slides, outputDir);
        console.log(`✅ 이미지 렌더링 완료! (저장 위치: ${outputDir})`);

        // 3단계: 임시 공개 이미지 호스트에 카드뉴스 이미지 업로드하여 퍼블릭 URL 획득
        console.log('\n☁️ [3/5] 임시 이미지 호스팅 서버에 업로드 중...');
        try {
            publicUrls = await uploadImagesToSupabaseStorage(localImagePaths);
        } catch (uploadError: any) {
            console.warn('⚠️ 임시 이미지 업로더 전송 실패:', uploadError.message);
        }

        // 4단계: Threads 자동 업로드
        console.log('\n💬 [4/5] Threads API로 포스팅 업로드 중...');
        try {
            threadsPostId = await postToThreads(contentData.thread_text);
        } catch (threadsErr: any) {
            console.error('❌ Threads 업로드 실패:', threadsErr.message || threadsErr);
            if (threadsErr.response?.data) {
                console.error('   상세 에러:', JSON.stringify(threadsErr.response.data, null, 2));
            }
        }

        // 5단계: Instagram Graph API Carousel 자동 업로드
        console.log('\n📸 [5/5] Instagram Graph API로 카드뉴스 캐러셀 포스팅 업로드 중...');
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

        // 결과 판정 및 Supabase Database 로깅
        const isSuccess = Boolean(threadsPostId || instagramPostId);
        const status = (threadsPostId && instagramPostId) ? 'SUCCESS' : (isSuccess ? 'PARTIAL_SUCCESS' : 'FAILED');

        await logMarketingResult({
            topic: contentData.topic,
            thread_text: contentData.thread_text,
            insta_caption: contentData.insta_caption,
            card_news_slides: contentData.card_news_slides,
            card_news_urls: publicUrls,
            threads_post_id: threadsPostId,
            instagram_post_id: instagramPostId,
            status: status,
            error_message: !isSuccess ? 'Threads 및 Instagram 업로드 모두 실패' : null
        });

        console.log('\n🎉 파이프라인 실행이 완료되었습니다!');
        console.log(`- 최종 상태: ${status}`);
        console.log(`- Threads Post ID: ${threadsPostId || 'N/A'}`);
        console.log(`- Instagram Post ID: ${instagramPostId || 'N/A'}`);

    } catch (error: any) {
        console.error('\n💥 마케팅 파이프라인 실행 도중 크리티컬 오류 발생:', error.message || error);
        if (contentData) {
            await logMarketingResult({
                topic: contentData.topic,
                thread_text: contentData.thread_text,
                insta_caption: contentData.insta_caption,
                card_news_slides: contentData.card_news_slides,
                card_news_urls: publicUrls,
                status: 'FAILED',
                error_message: error.message || String(error)
            });
        }
    }
}

/**
 * node-cron 스케줄러 등록 (매일 오전 11:00, 오후 18:00 실행)
 */
function startCronScheduler(): void {
    console.log('⏰ Draft Ethan SNS 마케팅 크론 스케줄러가 활성화되었습니다.');
    console.log('- 실행 시간: 매일 오전 11:00, 오후 18:00 (Cron: 0 11,18 * * *)');

    // 매일 오전 11시, 오후 6시 스케줄링
    cron.schedule('0 11,18 * * *', async () => {
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
