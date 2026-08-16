import { createKatalkShortsVideo } from './src/katalkShortsRenderer';
import { KatalkScriptResponse } from './src/katalkContentGenerator';

const testScript: KatalkScriptResponse = {
    title: '팀장님한테 자소서 검수받다가 팩폭맞음',
    topic: '자소서 팩폭 썰',
    messages: [
        {
            sender: 'other',
            name: '김팀장',
            text: '야 너 이번에 쓴 자소서 초안 봤는데 도대체 무슨 말을 하고 싶은 거냐?'
        },
        {
            sender: 'me',
            name: '나',
            text: '열정과 끈기로 최선을 다해 팀 프로젝트를 성공적으로 이끌었습니다!'
        },
        {
            sender: 'other',
            name: '김팀장',
            text: '열정 끈기 같은 뜬구름 잡는 소리 집어치우고 구체적인 수치랑 성과부터 박으라고 몇 번을 말해!'
        },
        {
            sender: 'me',
            name: '나',
            text: '헉... 바로 디든(dethan)에서 3초 만에 수치형 문장으로 AI 팩폭 교정받아오겠습니다!'
        },
        {
            sender: 'other',
            name: '김팀장',
            text: '오 디든으로 고쳐오니까 훨씬 깔끔하네. 진작 이렇게 쓰지 그랬냐 ㅋㅋ'
        }
    ],
    ctaText: '디든(dethan)에서 3초 만에 무료 AI 자소서 진단 받자!',
    instaCaption: '팀장님도 인정한 디든 AI 자소서 교정 #디든 #자소서첨삭',
    threadText: '자소서에 열정, 끈기만 쓰는 취준생들 주목! 디든에서 3초 만에 수치 기반으로 고쳐보세요.'
};

async function testRender() {
    console.log('🎬 카카오톡 쇼츠 렌더링 테스트 실행...');
    const result = await createKatalkShortsVideo(testScript);
    console.log('✅ 테스트 완료! 비디오 파일:', result);
}

testRender().catch(err => {
    console.error('❌ 테스트 에러:', err);
});
