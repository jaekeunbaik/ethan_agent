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

const FONT_FAMILY = '"Malgun Gothic", "Apple SD Gothic Neo", "NanumGothic", "Noto Sans CJK KR", sans-serif';

/**
 * 텍스트에서 특수 이모지 및 특수 기호를 제거하는 헬퍼 함수 (tofu 방지)
 */
function stripEmojis(text: string): string {
    if (!text) return '';
    return text
        .replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
        .trim();
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

    // 1. 베이스 어두운 배경 (Deep Slate Dark Slate)
    ctx.fillStyle = '#090D1A'; 
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 2. 다층 네뷸라 글로우 데코레이션 (Premium Glowing Effect)
    // 2-1) 탑-레프트 사이언 글로우
    const glowCyan = ctx.createRadialGradient(150, 150, 0, 150, 150, 400);
    glowCyan.addColorStop(0, 'rgba(6, 182, 212, 0.12)'); 
    glowCyan.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = glowCyan;
    ctx.beginPath();
    ctx.arc(150, 150, 400, 0, Math.PI * 2);
    ctx.fill();

    // 2-2) 센터-우측 인디고/바이올렛 글로우
    const glowIndigo = ctx.createRadialGradient(850, 450, 50, 850, 450, 550);
    glowIndigo.addColorStop(0, 'rgba(99, 102, 241, 0.18)'); 
    glowIndigo.addColorStop(1, 'rgba(99, 102, 241, 0)');
    ctx.fillStyle = glowIndigo;
    ctx.beginPath();
    ctx.arc(850, 450, 550, 0, Math.PI * 2);
    ctx.fill();

    // 2-3) 바텀-레프트 핑크 글로우
    const glowPink = ctx.createRadialGradient(100, 850, 0, 100, 850, 350);
    glowPink.addColorStop(0, 'rgba(236, 72, 153, 0.08)'); 
    glowPink.addColorStop(1, 'rgba(236, 72, 153, 0)');
    ctx.fillStyle = glowPink;
    ctx.beginPath();
    ctx.arc(100, 850, 350, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow/effects
    ctx.shadowBlur = 0;

    // 3. 상단 헤더 (유리모프 스타일 디자인 로고)
    // 3-1) Logo Capsule Badge Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(60, 60, 220, 50, 25);
    ctx.fill();
    ctx.stroke();

    // Logo Capsule Text & Dot
    ctx.fillStyle = '#6366F1'; // Blue dot
    ctx.beginPath();
    ctx.arc(90, 85, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = '#E2E8F0'; 
    ctx.textAlign = 'left';
    ctx.fillText('Draft Ethan AI', 112, 91);

    // 3-2) Slide Number Capsule Badge
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.roundRect(CANVAS_SIZE - 150, 60, 90, 50, 25);
    ctx.fill();
    ctx.stroke();

    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'center';
    ctx.fillText(`${slide.slideNumber} / ${totalSlides}`, CANVAS_SIZE - 105, 91);

    // 4. 슬라이드 유형별 메인 콘텐츠 렌더링
    if (slide.type === 'COVER') {
        // [표지 슬라이드]
        // 상단 카테고리 태그
        ctx.font = `bold 22px ${FONT_FAMILY}`;
        ctx.fillStyle = '#818CF8'; 
        ctx.textAlign = 'left';
        ctx.fillText('자소서 성공 전략 리포트', 80, 250);

        // 태그 하단 미세 그라데이션 라인
        const tagLineGrad = ctx.createLinearGradient(80, 0, 320, 0);
        tagLineGrad.addColorStop(0, '#818CF8');
        tagLineGrad.addColorStop(1, 'rgba(129, 140, 248, 0)');
        ctx.fillStyle = tagLineGrad;
        ctx.fillRect(80, 268, 240, 4);

        // 메인 타이틀 (텍스트 드롭 섀도우)
        ctx.font = `bold 56px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        
        const titleLines = wrapText(ctx, stripEmojis(slide.title), CANVAS_SIZE - 165);
        let currentY = 360;
        for (const line of titleLines) {
            ctx.fillText(line, 80, currentY);
            currentY += 78;
        }
        ctx.shadowBlur = 0; // Shadow reset
        ctx.shadowOffsetY = 0;

        // 서브타이틀 글라스모피즘 카드 박스
        if (slide.subtitle) {
            const boxY = currentY + 30;
            const boxHeight = 150;
            ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(80, boxY, CANVAS_SIZE - 160, boxHeight, 20);
            ctx.fill();
            ctx.stroke();

            // 왼쪽 세로 컬러 바 데코레이션
            ctx.fillStyle = '#06B6D4'; // Cyan
            ctx.fillRect(80, boxY + 20, 5, boxHeight - 40);

            ctx.font = `26px ${FONT_FAMILY}`;
            ctx.fillStyle = '#94A3B8';
            const subLines = wrapText(ctx, stripEmojis(slide.subtitle), CANVAS_SIZE - 230);
            let subY = boxY + 62;
            for (const line of subLines) {
                ctx.fillText(line, 115, subY);
                subY += 42;
            }
        }
    } else if (slide.type === 'BODY') {
        // [본문 슬라이드]
        ctx.font = `bold 44px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(stripEmojis(slide.title), 80, 210);

        // 타이틀 하단 데코레이션 쇼트 그라데이션
        const accentGrad = ctx.createLinearGradient(80, 0, 200, 0);
        accentGrad.addColorStop(0, '#6366F1'); // Indigo
        accentGrad.addColorStop(1, '#06B6D4'); // Cyan
        ctx.fillStyle = accentGrad;
        ctx.fillRect(80, 232, 100, 6);

        if (slide.subtitle) {
            ctx.font = `24px ${FONT_FAMILY}`;
            ctx.fillStyle = '#64748B';
            ctx.fillText(stripEmojis(slide.subtitle), 80, 280);
        }

        // 본문 컨텐츠 카드 박스
        const contentBoxY = 320;
        const contentBoxHeight = 550;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.5)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(80, contentBoxY, CANVAS_SIZE - 160, contentBoxHeight, 24);
        ctx.fill();
        ctx.stroke();

        let textY = contentBoxY + 68;
        slide.contentLines.forEach((lineText, index) => {
            // 1. 순번 인디고 그라데이션 원형 배지 그리기
            const badgeY = textY - 8;
            const badgeRadius = 18;
            const badgeX = 135;

            const badgeGrad = ctx.createLinearGradient(badgeX - badgeRadius, 0, badgeX + badgeRadius, 0);
            badgeGrad.addColorStop(0, '#6366F1');
            badgeGrad.addColorStop(1, '#4F46E5');
            
            ctx.fillStyle = badgeGrad;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();

            // 순번 이너 텍스트 
            ctx.font = `bold 18px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(`${index + 1}`, badgeX, badgeY + 6);

            // 2. 내용 텍스트 렌더링
            ctx.font = `26px ${FONT_FAMILY}`;
            ctx.fillStyle = '#E2E8F0';
            ctx.textAlign = 'left';
            const lines = wrapText(ctx, stripEmojis(lineText), CANVAS_SIZE - 300);
            let lineY = textY;
            lines.forEach((l, lIdx) => {
                ctx.fillText(l, 175, lineY);
                if (lIdx < lines.length - 1) lineY += 38;
            });

            textY = Math.max(textY + 115, lineY + 70);
        });

        // 하단 가이드 팁
        if (slide.highlightText) {
            const tipBoxY = contentBoxY + contentBoxHeight - 65;
            // 팁 미세 배경
            ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
            ctx.beginPath();
            ctx.roundRect(115, tipBoxY - 20, CANVAS_SIZE - 230, 60, 8);
            ctx.fill();

            ctx.fillStyle = '#10B981';
            ctx.fillRect(115, tipBoxY - 20, 4, 60);

            ctx.font = `bold 22px ${FONT_FAMILY}`;
            ctx.fillStyle = '#34D399'; 
            ctx.fillText(`TIP: ${stripEmojis(slide.highlightText)}`, 135, tipBoxY + 18);
        }
    } else if (slide.type === 'CTA') {
        // [CTA 마무리 슬라이드]
        ctx.font = `bold 52px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(stripEmojis(slide.title), CANVAS_SIZE / 2, 280);

        // 메인 CTA 버튼 렌더링 (그라데이션 및 부드러운 아웃라인 글로우)
        const btnY = 380;
        const btnWidth = 620;
        const btnHeight = 96;
        const btnX = (CANVAS_SIZE - btnWidth) / 2;

        const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnWidth, btnY + btnHeight);
        btnGrad.addColorStop(0, '#8B5CF6'); // Violet
        btnGrad.addColorStop(1, '#6366F1'); // Indigo
        ctx.fillStyle = btnGrad;
        
        ctx.beginPath();
        ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 48);
        ctx.fill();

        ctx.font = `bold 30px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Draft Ethan 무료 자소서 교정', CANVAS_SIZE / 2, btnY + 58);

        // 하단 안내 서브 리스트
        let listY = 560;
        slide.contentLines.forEach((item) => {
            // 커스텀 예쁜 포인트 도트 그리기
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(CANVAS_SIZE / 2 - 220, listY - 8, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.font = `26px ${FONT_FAMILY}`;
            ctx.fillStyle = '#CBD5E1';
            ctx.textAlign = 'left';
            ctx.fillText(stripEmojis(item), CANVAS_SIZE / 2 - 200, listY);
            listY += 65;
        });
    }

    // 5. 하단 푸터 (브랜드 워터마크 & Swipe 안내)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, CANVAS_SIZE - 120);
    ctx.lineTo(CANVAS_SIZE - 80, CANVAS_SIZE - 120);
    ctx.stroke();

    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    ctx.fillText('Draft Ethan | AI Resume Proofreading Engine', 80, CANVAS_SIZE - 70);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#6366F1';
    ctx.fillText('Swipe ->', CANVAS_SIZE - 80, CANVAS_SIZE - 70);

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
