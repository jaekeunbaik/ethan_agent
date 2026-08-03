import { renderAllCardNewsSlides } from './src/imageRenderer';
import { CardNewsSlide } from './src/contentGenerator';

const testSlides: CardNewsSlide[] = [
    {
        slideNumber: 1,
        type: 'COVER',
        title: '"어릴 적부터 진취적이었던 저는..." (X)',
        subtitle: '서류 탈락하는 자소서 비포 & 애프터 1:1 심폐소생',
        contentLines: []
    },
    {
        slideNumber: 2,
        type: 'BODY',
        title: '3초 만에 끝나는 문장 교정 (Diff)',
        subtitle: '추상적인 표현을 직무 수치와 성과로 즉시 교정!',
        contentLines: [
            'Before: 어릴 적부터 진취적이고 적극적인 자세로 일을 수행했습니다.',
            'After: ROAS 320% 달성 과정에서 유저 데이터 기반 개편을 주도했습니다.',
            '📈 직무 적합성 +35pt | 논리성 +40pt 상승!'
        ],
        highlightText: '추상적인 미사여구 대신 직무 수치와 성과를 명시하세요!'
    },
    {
        slideNumber: 3,
        type: 'CTA',
        title: '내 자소서는 몇 점일까?',
        subtitle: '지금 프로필 링크에서 무료로 확인해 보세요!',
        contentLines: [
            '⚡ 3초 만에 끝나는 문장 단위 (Diff) 1:1 교정',
            '📊 4대 역량 스코어링 (직무 적합성/가독성/논리성/구체성)',
            '🎁 비용 부담 Zero! 프로필 링크에서 바로 무료 체험'
        ]
    }
];

async function run() {
    console.log('Rendering 3 card news slides (Concept A Strategy)...');
    const paths = await renderAllCardNewsSlides(testSlides);
    console.log('Successfully generated 3 card news slides:');
    paths.forEach(p => console.log(' -', p));
}

run().catch(console.error);
