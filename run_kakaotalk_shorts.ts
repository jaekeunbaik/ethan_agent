import dotenv from 'dotenv';
import { executeMultiAgentShortsFactory } from './src/agents/orchestratorAgent';

dotenv.config();

/**
 * 📱 카카오톡 썰 쇼츠 멀티 서브에이전트 실행기
 */
async function main() {
    await executeMultiAgentShortsFactory();
}

main().catch((err) => {
    console.error('❌ [run_kakaotalk_shorts] 실행 실패:', err);
});
