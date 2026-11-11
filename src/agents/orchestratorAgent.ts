import { runFeedbackAgent } from './feedbackAgent';
import { runPlannerAgent } from './plannerAgent';
import { runScriptAgent } from './scriptAgent';
import { runDesignerAgent } from './designerAgent';
import { ScriptRejected } from './scriptAgent';
import * as fs from 'fs';
import * as crypto from 'crypto';
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
        // 대본 검증 3회 실패 시 그 글은 폐기하고 다음 후보로 (최대 3글). 후보가 없으면 NoCandidates로 중단
        const skipIds: string[] = [];
        let plan: Awaited<ReturnType<typeof runPlannerAgent>> | undefined;
        let script: Awaited<ReturnType<typeof runScriptAgent>> | undefined;
        for (let n = 0; n < 3 && !script; n++) {
            plan = await runPlannerAgent(feedback, skipIds);
            console.log('\n3️⃣ [Phase 3/5] ScriptAgent 가동...');
            try { script = await runScriptAgent(plan, feedback); }
            catch (e: any) { if (!(e instanceof ScriptRejected) || !(plan.source || plan.key)) throw e; console.warn(`[Orchestrator] ${e.message} → 다음 후보`); skipIds.push(plan.key ?? plan.source!.id); }
        }
        if (!plan || !script) throw new Error('대본 검증을 통과한 글이 없어 중단');

        // [4단계] 🎨 디자인/렌더링 에이전트
        console.log('\n4️⃣ [Phase 4/5] DesignerAgent 가동...');
        const render = await runDesignerAgent(script);

        // [5단계] 업로드는 GitHub Actions(publish_only)에서만: 큐에 넣고 사람이 검수 후 업로드
        console.log('\n5️⃣ [Phase 5/5] 업로드 큐 적재 (업로드는 Actions에서)...');
        // 중복 방지 키: pann 글 id / free:<테마>:<헤드라인 해시> / inbox:<파일명>
        const hash = crypto.createHash('md5').update(script.hookHeadline).digest('hex').slice(0, 8);
        const sourceId = plan.source?.id ?? (plan.freeform ? `free:${plan.key}:${hash}` : plan.inboxFile ? `inbox:${plan.key}` : undefined);
        const slug = `${new Date().toISOString().slice(0, 10)}_${plan.key ?? plan.source?.id ?? plan.id}`;
        const dir = `upload_queue/${slug}`;
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(render.videoPath, `${dir}/video.mp4`);
        fs.writeFileSync(`${dir}/script.json`, JSON.stringify(script, null, 1), 'utf8');
        fs.writeFileSync(`${dir}/meta.json`, JSON.stringify({ sourceId, sourceUrl: plan.source?.url, createdAt: new Date().toISOString(), approved: false }, null, 1), 'utf8');

        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        console.log('\n🎉 ======================================================================');
        console.log(`✨ [성공] 멀티 서브에이전트 파이프라인 전 과정 완수! (소요 시간: ${elapsedSec}초)`);
        console.log(`📁 완성 비디오: ${render.videoPath}`);
        if (plan.inboxFile) { fs.mkdirSync('inbox/done', { recursive: true }); fs.renameSync(plan.inboxFile, `inbox/done/${plan.key}`); }
        console.log(`📦 큐: ${dir}`);
        console.log('======================================================================\n');

        // 디스코드 리포트 발송
        try {
            await sendDiscordReport({
                topic: `[카톡썰 쇼츠] ${plan.title}`,
                threadsPostId: null,
                mytiThreadsPostId: null,
                instagramPostId: null,
                youtubeShortsUrl: `큐 대기: ${dir}`,
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
