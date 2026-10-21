import { runFeedbackAgent } from './feedbackAgent';
import { runPlannerAgent } from './plannerAgent';
import { runScriptAgent } from './scriptAgent';
import { runDesignerAgent } from './designerAgent';
import { runPublisherAgent } from './publisherAgent';
import { sendDiscordReport } from '../discordNotifier';

/**
 * 👑 OrchestratorAgent (멀티 서브에이전트 총괄 오케스트레이터)
 * 1. FeedbackAgent: 이전 영상 성과 분석 및 자가 진화 메모리 로드
 * 2. PlannerAgent: 실시간 유머 썰 기획 및 쿠팡 상품 매칭
 * 3. ScriptAgent: 0~2초 훅 카톡 대본 및 수익화 카피 생성
 * 4. DesignerAgent: 상단 고대비 배너 + 2인 TTS + 1080x1920 세로 영상 렌더링
 * 5. PublisherAgent: 유튜브 쇼츠 업로드 및 쿠팡 링크 댓글 게시
 * 6. DiscordNotifier: 종합 성과 리포트 자동 발송
 */
export async function executeMultiAgentShortsFactory(): Promise<void> {
    const startTime = Date.now();
    console.log('\n======================================================================');
    console.log('🤖 [OrchestratorAgent] 5대 서브에이전트 자율 쇼츠 팩토리 파이프라인 가동');
    console.log('======================================================================\n');

    try {
        // [1단계] 🔄 피드백 & 자가진화 에이전트
        console.log('1️⃣ [Phase 1/5] FeedbackAgent 가동...');
        const feedback = await runFeedbackAgent();

        // [2단계] 🧠 기획 에이전트
        console.log('\n2️⃣ [Phase 2/5] PlannerAgent 가동...');
        const plan = await runPlannerAgent(feedback);

        // [3단계] ✍️ 대본/카피 에이전트
        console.log('\n3️⃣ [Phase 3/5] ScriptAgent 가동...');
        const script = await runScriptAgent(plan, feedback);

        // [4단계] 🎨 디자인/렌더링 에이전트
        console.log('\n4️⃣ [Phase 4/5] DesignerAgent 가동...');
        const render = await runDesignerAgent(script);

        // [5단계] 🛒 배포 & 쿠팡 수익화 에이전트
        console.log('\n5️⃣ [Phase 5/5] PublisherAgent 가동...');
        const publishResult = await runPublisherAgent(script, render);

        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        console.log('\n🎉 ======================================================================');
        console.log(`✨ [성공] 멀티 서브에이전트 파이프라인 전 과정 완수! (소요 시간: ${elapsedSec}초)`);
        console.log(`📁 완성 비디오: ${render.videoPath}`);
        if (publishResult.videoUrl) {
            console.log(`📺 유튜브 쇼츠 URL: ${publishResult.videoUrl}`);
        }
        console.log('======================================================================\n');

        // 디스코드 리포트 발송
        try {
            await sendDiscordReport({
                topic: `[카톡썰 쇼츠] ${plan.title}`,
                threadsPostId: null,
                mytiThreadsPostId: null,
                instagramPostId: null,
                youtubeShortsUrl: publishResult.videoUrl || `로컬 생성: ${render.videoPath}`,
                publicImageUrls: [],
                status: 'SUCCESS'
            });
        } catch {}

    } catch (error: any) {
        console.error('❌ [OrchestratorAgent] 파이프라인 실행 중 오류 발생:', error);
        try {
            await sendDiscordReport({
                topic: '[카톡썰 쇼츠 파이프라인 오류]',
                status: 'FAILED',
                errorMessage: error.message || String(error)
            });
        } catch {}
    }
}
