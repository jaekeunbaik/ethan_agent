import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { CardNewsSlide } from './contentGenerator';

const CANVAS_SIZE = 1080;

/**
 * 텍스트 래핑 헬퍼 함수
 */
function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

/**
 * 단일 카드뉴스 슬라이드를 1080x1080 이미지로 렌더링하고 퍼버(Buffer)로 반환
 */
export async function renderSlideImage(
    slide: CardNewsSlide,
    totalSlides: number = 5
): Promise<Buffer> {
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');

    // 1. 배경 그래디언트 (Deep Slate Dark Theme)
    const bgGradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgGradient.addColorStop(0, '#0F172A'); // Deep Navy
    bgGradient.addColorStop(1, '#020617'); // Almost Black
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 2. 백그라운드 데코레이션 빛 발산 (Glow Effect)
    const glowGradient = ctx.createRadialGradient(
        CANVAS_SIZE / 2, 200, 50,
        CANVAS_SIZE / 2, 200, 450
    );
    glowGradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)'); // Indigo Glow
    glowGradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, 200, 450, 0, Math.PI * 2);
    ctx.fill();

    // 3. 상단 헤더 (배지 & 슬라이드 번호)
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;

    // Header Logo Badge
    ctx.beginPath();
    ctx.roundRect(60, 60, 240, 50, 25);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#38BDF8'; // Light Cyan
    ctx.textAlign = 'center';
    ctx.fillText('✨ Draft Ethan AI', 180, 92);

    // Slide Number Badge
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'right';
    ctx.fillText(`${slide.slideNumber} / ${totalSlides}`, CANVAS_SIZE - 60, 92);

    // 4. 슬라이드 유형별 메인 콘텐츠 렌더링
    if (slide.type === 'COVER') {
        // [표지 슬라이드]
        // 상단 태그
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#818CF8'; // Accent Purple/Indigo
        ctx.textAlign = 'left';
        ctx.fillText('⚡ 자소서 성공 전략 리포트', 80, 260);

        // 메인 타이틀
        ctx.font = 'bold 54px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        const titleLines = wrapText(ctx, slide.title, CANVAS_SIZE - 160);
        let currentY = 350;
        for (const line of titleLines) {
            ctx.fillText(line, 80, currentY);
            currentY += 75;
        }

        // 서브타이틀 Card Box
        if (slide.subtitle) {
            const boxY = currentY + 30;
            ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(80, boxY, CANVAS_SIZE - 160, 160, 20);
            ctx.fill();
            ctx.stroke();

            ctx.font = '28px sans-serif';
            ctx.fillStyle = '#CBD5E1';
            const subLines = wrapText(ctx, slide.subtitle, CANVAS_SIZE - 220);
            let subY = boxY + 65;
            for (const line of subLines) {
                ctx.fillText(line, 110, subY);
                subY += 45;
            }
        }
    } else if (slide.type === 'BODY') {
        // [본문 슬라이드]
        ctx.font = 'bold 42px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(slide.title, 80, 220);

        if (slide.subtitle) {
            ctx.font = '24px sans-serif';
            ctx.fillStyle = '#94A3B8';
            ctx.fillText(slide.subtitle, 80, 265);
        }

        // 본문 컨텐츠 카드 박스
        const contentBoxY = 310;
        const contentBoxHeight = 560;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(80, contentBoxY, CANVAS_SIZE - 160, contentBoxHeight, 24);
        ctx.fill();
        ctx.stroke();

        let textY = contentBoxY + 70;
        slide.contentLines.forEach((lineText, index) => {
            // 포인트 불릿 아이콘
            ctx.font = 'bold 26px sans-serif';
            ctx.fillStyle = '#38BDF8';
            ctx.fillText(`0${index + 1}.`, 120, textY);

            // 내용 텍스트
            ctx.font = '26px sans-serif';
            ctx.fillStyle = '#F1F5F9';
            const lines = wrapText(ctx, lineText, CANVAS_SIZE - 280);
            let lineY = textY;
            lines.forEach((l, lIdx) => {
                ctx.fillText(l, 180, lineY);
                if (lIdx < lines.length - 1) lineY += 38;
            });

            textY = Math.max(textY + 110, lineY + 70);
        });

        if (slide.highlightText) {
            ctx.font = 'bold 24px sans-serif';
            ctx.fillStyle = '#34D399'; // Emerald Highlight
            ctx.fillText(`💡 TIP: ${slide.highlightText}`, 120, contentBoxY + contentBoxHeight - 40);
        }
    } else if (slide.type === 'CTA') {
        // [CTA 마무리 슬라이드]
        ctx.font = 'bold 50px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(slide.title, CANVAS_SIZE / 2, 280);

        // 메인 CTA 버튼 렌더링
        const btnY = 400;
        const btnWidth = 640;
        const btnHeight = 110;
        const btnX = (CANVAS_SIZE - btnWidth) / 2;

        const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnWidth, btnY + btnHeight);
        btnGrad.addColorStop(0, '#6366F1'); // Indigo
        btnGrad.addColorStop(1, '#06B6D4'); // Cyan
        ctx.fillStyle = btnGrad;
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 55);
        ctx.fill();

        ctx.font = 'bold 34px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Draft Ethan 무료 자소서 교정 🚀', CANVAS_SIZE / 2, btnY + 68);

        // 하단 혜택 설명 목록
        let listY = 600;
        slide.contentLines.forEach((item) => {
            ctx.font = '28px sans-serif';
            ctx.fillStyle = '#CBD5E1';
            ctx.fillText(`✓  ${item}`, CANVAS_SIZE / 2, listY);
            listY += 60;
        });
    }

    // 5. 하단 푸터 (브랜드 워터마크 & Swipe 안내)
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, CANVAS_SIZE - 120);
    ctx.lineTo(CANVAS_SIZE - 80, CANVAS_SIZE - 120);
    ctx.stroke();

    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'left';
    ctx.fillText('Draft Ethan | AI Resume Proofreading Engine', 80, CANVAS_SIZE - 70);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('Swipe ➔', CANVAS_SIZE - 80, CANVAS_SIZE - 70);

    return canvas.toBuffer('image/png');
}

/**
 * 5장의 슬라이드 배열을 렌더링하여 지정된 출력 디렉터리에 로컬 PNG 파일들로 저장하고 저장된 파일 경로 배열 반환
 */
export async function renderAllCardNewsSlides(
    slides: CardNewsSlide[],
    outputDir: string = path.join(process.cwd(), 'output_cardnews')
): Promise<string[]> {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const generatedFilePaths: string[] = [];
    for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const imageBuffer = await renderSlideImage(slide, slides.length);
        const filePath = path.join(outputDir, `slide_${i + 1}.png`);
        fs.writeFileSync(filePath, imageBuffer);
        generatedFilePaths.push(filePath);
    }

    return generatedFilePaths;
}
