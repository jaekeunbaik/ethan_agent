import { createShortsVideo } from './src/shortsRenderer';
import { CardNewsSlide } from './src/contentGenerator';

const testSlides: CardNewsSlide[] = [
    {
        slideNumber: 1,
        type: 'COVER',
        title: '아직도 자소서 이렇게 쓴다고? 🚨',
        subtitle: '서류 광탈하는 자소서 비포 & 애프터 썰 풀이',
        contentLines: []
    },
    {
        slideNumber: 2,
        type: 'BODY',
        title: 'Before vs After 3초 교정! 🔥',
        subtitle: '추상적인 표현 대신 직무 성과 수치로 심폐소생',
        contentLines: [
            'Before: 적극적인 자세로 팀 프로젝트에 임했습니다.',
            'After: 데이터 분석 기반으로 유저 이탈률 25% 감소시켰습니다.',
            '⚡ 직무 적합성 +45pt 급상승!'
        ],
        highlightText: '추상적인 단어 싹 지우고 수치부터 박으라고!'
    },
    {
        slideNumber: 3,
        type: 'CTA',
        title: '내 자소서도 3초 만에 팩폭 교정받기! 🎁',
        subtitle: '지금 프로필 링크에서 100% 무료로 체험해봐!',
        contentLines: [
            '⚡ 3초 완성 AI 1:1 맞춤 교정',
            '📊 4대 역량 스코어링 분석',
            '👉 draft-ethan.vercel.app 접속'
        ]
    }
];

async function main() {
    console.log('🎬 숏폼 영상 제작 및 음성 싱크 테스트 시작...');
    const videoPath = await createShortsVideo(testSlides);
    console.log('✨ 생성 완료된 영상 경로:', videoPath);
}

main().catch(console.error);
