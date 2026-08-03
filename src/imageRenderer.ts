import { createCanvas, CanvasRenderingContext2D, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { CardNewsSlide } from './contentGenerator';

// 리눅스(GitHub Actions) 환경 한글 폰트 전체 자동 등록
const nanumDir = '/usr/share/fonts/truetype/nanum';
if (fs.existsSync(nanumDir)) {
    try {
        const files = fs.readdirSync(nanumDir);
        for (const file of files) {
            if (file.endsWith('.ttf') || file.endsWith('.otf')) {
                const fontPath = path.join(nanumDir, file);
                GlobalFonts.registerFromPath(fontPath);
            }
        }
    } catch (e) {
        console.warn('폰트 자동 등록 중 경고:', e);
    }
}
const notoFile = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';
if (fs.existsSync(notoFile)) {
    try { GlobalFonts.registerFromPath(notoFile, 'Noto Sans CJK KR'); } catch {}
}

const CANVAS_SIZE = 1080;

interface ColorTheme {
    grad1: string;
    grad2: string;
    grad3: string;
    coral: string;
    violet: string;
    bgGradEnd: string;
    itemColors: Array<{ bg: string; border: string; badge: string; text: string }>;
}

// Draft Ethan 브랜드 시그니처 테마: Royal Blue & Modern Electric Violet
const THEMES: ColorTheme[] = [
    {
        grad1: '#2563EB', grad2: '#7C3AED', grad3: '#06B6D4',
        coral: '#2563EB', violet: '#7C3AED', bgGradEnd: '#EFF6FF',
        itemColors: [
            { bg: '#EFF6FF', border: '#2563EB', badge: '#2563EB', text: '#1D4ED8' },
            { bg: '#F5F3FF', border: '#7C3AED', badge: '#7C3AED', text: '#6D28D9' },
            { bg: '#ECFDF5', border: '#10B981', badge: '#10B981', text: '#047857' },
            { bg: '#FFF1F1', border: '#EF4444', badge: '#EF4444', text: '#DC2626' },
        ]
    }
];

const FONT_FAMILY = '"NanumGothic", "NanumSquare", "NanumBarunGothic", "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

let currentTheme = THEMES[0];

export function setRandomTheme() {
    currentTheme = THEMES[0];
}

const BASE_COLORS = {
    bg: '#FFFFFF',
    bgSoft: '#F8FAFC',
    textDark: '#0F172A',
    textBody: '#334155',
    textMuted: '#64748B',
    textLight: '#94A3B8',
    textWhite: '#FFFFFF',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
};

const COLORS = new Proxy(BASE_COLORS, {
    get(target, prop: string) {
        if (prop in target) return (target as any)[prop];
        if (prop === 'grad1') return currentTheme.grad1;
        if (prop === 'grad2') return currentTheme.grad2;
        if (prop === 'grad3') return currentTheme.grad3;
        if (prop === 'coral') return currentTheme.coral;
        if (prop === 'violet') return currentTheme.violet;
        if (prop === 'indigo') return currentTheme.grad3;
        if (prop === 'bgGradEnd') return currentTheme.bgGradEnd;
        return undefined;
    }
}) as typeof BASE_COLORS & {
    grad1: string; grad2: string; grad3: string;
    coral: string; violet: string; indigo: string; bgGradEnd: string;
};

const ITEM_COLORS = currentTheme.itemColors;

function stripEmojis(text: string): string {
    if (!text) return '';
    return text
        .replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .trim();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        if (ctx.measureText(currentLine + ' ' + word).width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

// ─── 공통 헤더 / 푸터 ───────────────────────────────────────────────────────────

function drawHeader(ctx: CanvasRenderingContext2D, slideNumber: number, totalSlides: number, isDark: boolean = false) {
    // 상단 멀티 컬러 그라데이션 포인트 바
    const headerGrad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, 0);
    headerGrad.addColorStop(0, '#2563EB');
    headerGrad.addColorStop(0.5, '#7C3AED');
    headerGrad.addColorStop(1, '#06B6D4');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, CANVAS_SIZE, 14);

    // 브랜드 서비스 로고
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.fillStyle = isDark ? '#FFFFFF' : COLORS.textDark;
    ctx.textAlign = 'left';
    ctx.fillText('Draft Ethan', 60, 74);

    // AI 뱃지
    const badgeX = 60 + ctx.measureText('Draft Ethan').width + 12;
    roundRect(ctx, badgeX, 53, 44, 26, 8);
    const aiBg = ctx.createLinearGradient(badgeX, 0, badgeX + 44, 0);
    aiBg.addColorStop(0, '#2563EB');
    aiBg.addColorStop(1, '#7C3AED');
    ctx.fillStyle = aiBg;
    ctx.fill();
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('AI', badgeX + 22, 70);

    // 페이지 번호
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.7)' : COLORS.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText(`${slideNumber} / ${totalSlides}`, CANVAS_SIZE - 60, 74);
}

function drawFooter(ctx: CanvasRenderingContext2D, slideNumber: number, totalSlides: number, isDark: boolean = false) {
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : COLORS.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, CANVAS_SIZE - 100);
    ctx.lineTo(CANVAS_SIZE - 60, CANVAS_SIZE - 100);
    ctx.stroke();

    const dotCount = totalSlides;
    const dotStartX = (CANVAS_SIZE - dotCount * 28) / 2;
    for (let i = 0; i < dotCount; i++) {
        const dotX = dotStartX + i * 28 + 10;
        if (i === slideNumber - 1) {
            roundRect(ctx, dotX - 16, CANVAS_SIZE - 82, 32, 10, 5);
            const pg = ctx.createLinearGradient(dotX - 16, 0, dotX + 16, 0);
            pg.addColorStop(0, '#2563EB');
            pg.addColorStop(1, '#7C3AED');
            ctx.fillStyle = pg;
            ctx.fill();
        } else {
            ctx.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : COLORS.cardBorder;
            ctx.beginPath();
            ctx.arc(dotX, CANVAS_SIZE - 77, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : COLORS.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText('draft-ethan.vercel.app', CANVAS_SIZE - 60, CANVAS_SIZE - 45);
}

// ─── 1. 커버 슬라이드 (Cover Slide - Bright & Modern Light Hero) ──────────────────────────

function drawCoverSlide(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 화사하고 밝은 백그라운드 (클린 라이트 블루 & 화이트)
    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(0.5, '#F8FAFC');
    bgGrad.addColorStop(1, '#EFF6FF');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 상단 은은한 네온 블러 포인트 (밝은 그래디언트 오라)
    const glow1 = ctx.createRadialGradient(200, 150, 0, 200, 150, 350);
    glow1.addColorStop(0, 'rgba(37,99,235,0.08)');
    glow1.addColorStop(1, 'rgba(37,99,235,0)');
    ctx.fillStyle = glow1; ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const glow2 = ctx.createRadialGradient(900, 300, 0, 900, 300, 400);
    glow2.addColorStop(0, 'rgba(124,58,237,0.08)');
    glow2.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = glow2; ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 헤더/푸터 (라이트 모드)
    drawHeader(ctx, slide.slideNumber, 3, false);
    drawFooter(ctx, slide.slideNumber, 3, false);

    // 카테고리 칩
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    const chipText = '⚡ 3초 AI 자소서 교정리포트';
    const chipW = ctx.measureText(chipText).width + 40;
    roundRect(ctx, 60, 140, chipW, 48, 24);
    const chipGrad = ctx.createLinearGradient(60, 0, 60 + chipW, 0);
    chipGrad.addColorStop(0, '#2563EB');
    chipGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = chipGrad; ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(chipText, 80, 171);

    // 메인 타이틀 (선명한 다크 블루/다크 슬레이트 폰트, 그림자 일체 제거하여 시인성 최상)
    ctx.font = `bold 72px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.shadowBlur = 0; // 그림자 제거로 가독성 극대화
    const titleClean = stripEmojis(slide.title);
    const titleLines = wrapText(ctx, titleClean, CANVAS_SIZE - 120);
    let titleY = 310;
    for (const line of titleLines) {
        ctx.fillText(line, 60, titleY);
        titleY += 92;
    }

    // 서브 정보 카키/화이트 카드
    if (slide.subtitle) {
        const subBoxY = titleY + 30;
        const subBoxH = 140;
        roundRect(ctx, 60, subBoxY, CANVAS_SIZE - 120, subBoxH, 24);
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();

        // 좌측 포인트 바
        roundRect(ctx, 60, subBoxY, 8, subBoxH, 4);
        const barGrad = ctx.createLinearGradient(0, subBoxY, 0, subBoxY + subBoxH);
        barGrad.addColorStop(0, '#2563EB');
        barGrad.addColorStop(1, '#7C3AED');
        ctx.fillStyle = barGrad; ctx.fill();

        ctx.font = `28px ${FONT_FAMILY}`;
        ctx.fillStyle = '#334155';
        const subLines = wrapText(ctx, stripEmojis(slide.subtitle), CANVAS_SIZE - 180);
        let subY = subBoxY + 52;
        for (const line of subLines) {
            ctx.fillText(line, 94, subY);
            subY += 44;
        }
    }

    // 하단 태그 (밝고 선명한 뱃지)
    const tags = ['#자소서첨삭', '#AI교정', '#서류합격', '#DraftEthan'];
    let tagX = 60;
    const tagY = CANVAS_SIZE - 170;
    tags.forEach(tag => {
        ctx.font = `bold 20px ${FONT_FAMILY}`;
        const tw = ctx.measureText(tag).width + 32;
        roundRect(ctx, tagX, tagY, tw, 42, 21);
        ctx.fillStyle = '#EFF6FF';
        ctx.fill();
        ctx.strokeStyle = '#BFDBFE';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#1D4ED8';
        ctx.fillText(tag, tagX + 16, tagY + 28);
        tagX += tw + 14;
    });
}

// ─── 2. 본문 슬라이드 (Before vs After Diff Card UI) ───────────────────────────

function drawBodySlide(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 깔끔하고 선명한 배경
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    drawHeader(ctx, slide.slideNumber, 3, false);
    drawFooter(ctx, slide.slideNumber, 3, false);

    // 상단 섹션 제목
    ctx.font = `bold 46px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'left';
    ctx.fillText(stripEmojis(slide.title), 60, 150);

    // 언더라인
    const uGrad = ctx.createLinearGradient(60, 0, 360, 0);
    uGrad.addColorStop(0, '#2563EB');
    uGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = uGrad;
    ctx.fillRect(60, 168, 300, 5);

    if (slide.subtitle) {
        ctx.font = `24px ${FONT_FAMILY}`;
        ctx.fillStyle = '#64748B';
        ctx.fillText(stripEmojis(slide.subtitle), 60, 212);
    }

    const cardX = 60;
    const cardW = CANVAS_SIZE - 120;

    // Content lines 중 Before, After, Score 추출
    let beforeText = '';
    let afterText = '';
    let scoreText = '';

    slide.contentLines.forEach(line => {
        if (/before/i.test(line)) beforeText = line.replace(/before:\s*/i, '').trim();
        else if (/after/i.test(line)) afterText = line.replace(/after:\s*/i, '').trim();
        else scoreText = line.trim();
    });

    if (beforeText && afterText) {
        // [Before 카드 - 서류 탈락] (밝은 레드 톤)
        const beforeY = 240;
        const beforeH = 210;
        roundRect(ctx, cardX, beforeY, cardW, beforeH, 24);
        ctx.fillStyle = '#FEF2F2';
        ctx.strokeStyle = '#FCA5A5';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.fill(); ctx.stroke();

        // Before 뱃지
        roundRect(ctx, cardX + 24, beforeY + 24, 150, 40, 20);
        ctx.fillStyle = '#EF4444'; ctx.fill();
        ctx.font = `bold 18px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('❌ BEFORE (탈락)', cardX + 99, beforeY + 50);

        ctx.font = `26px ${FONT_FAMILY}`;
        ctx.fillStyle = '#991B1B';
        ctx.textAlign = 'left';
        const bLines = wrapText(ctx, stripEmojis(beforeText), cardW - 60);
        let bY = beforeY + 105;
        for (const bl of bLines) {
            ctx.fillText(bl, cardX + 30, bY);
            bY += 38;
        }

        // [중간 AI 변환 뱃지]
        const midY = 468;
        roundRect(ctx, CANVAS_SIZE / 2 - 190, midY, 380, 48, 24);
        const midGrad = ctx.createLinearGradient(CANVAS_SIZE / 2 - 190, 0, CANVAS_SIZE / 2 + 190, 0);
        midGrad.addColorStop(0, '#2563EB');
        midGrad.addColorStop(1, '#7C3AED');
        ctx.fillStyle = midGrad;
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.font = `bold 20px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ Draft Ethan AI 1:1 맞춤 교정', CANVAS_SIZE / 2, midY + 31);

        // [After 카드 - 대기업 합격] (선명한 바이올렛/블루 톤)
        const afterY = 535;
        const afterH = 220;
        roundRect(ctx, cardX, afterY, cardW, afterH, 24);
        ctx.fillStyle = '#F5F3FF';
        ctx.strokeStyle = '#8B5CF6';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 0;
        ctx.fill(); ctx.stroke();

        // After 뱃지
        roundRect(ctx, cardX + 24, afterY + 24, 150, 40, 20);
        ctx.fillStyle = '#7C3AED'; ctx.fill();
        ctx.font = `bold 18px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('✅ AFTER (합격)', cardX + 99, afterY + 50);

        ctx.font = `bold 28px ${FONT_FAMILY}`;
        ctx.fillStyle = '#3730A3';
        ctx.textAlign = 'left';
        const aLines = wrapText(ctx, stripEmojis(afterText), cardW - 60);
        let aY = afterY + 110;
        for (const al of aLines) {
            ctx.fillText(al, cardX + 30, aY);
            aY += 40;
        }

        // [하단 스코어 상승 배너]
        const scoreY = 775;
        roundRect(ctx, cardX, scoreY, cardW, 80, 20);
        const scoreGrad = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
        scoreGrad.addColorStop(0, '#EFF6FF');
        scoreGrad.addColorStop(1, '#DBEAFE');
        ctx.fillStyle = scoreGrad;
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.fill(); ctx.stroke();

        ctx.font = `bold 24px ${FONT_FAMILY}`;
        ctx.fillStyle = '#1E40AF';
        ctx.textAlign = 'center';
        ctx.fillText(stripEmojis(scoreText || '📈 직무 적합성 +35pt | 논리성 +40pt 상승!'), CANVAS_SIZE / 2, scoreY + 49);

    } else {
        // 일반 본문 리스트
        let curY = 250;
        slide.contentLines.forEach((lineText, idx) => {
            roundRect(ctx, cardX, curY, cardW, 130, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 0;
            ctx.fill(); ctx.stroke();

            roundRect(ctx, cardX + 24, curY + 35, 60, 60, 16);
            ctx.fillStyle = idx === 0 ? '#2563EB' : (idx === 1 ? '#7C3AED' : '#06B6D4');
            ctx.fill();
            ctx.font = `bold 28px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(`${idx + 1}`, cardX + 54, curY + 74);

            ctx.font = `26px ${FONT_FAMILY}`;
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'left';
            ctx.fillText(stripEmojis(lineText), cardX + 104, curY + 74);

            curY += 150;
        });
    }

    // POINT 핵심 하단 포인트 팁
    const tipY = 875;
    roundRect(ctx, cardX, tipY, cardW, 75, 20);
    const tipGrad = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
    tipGrad.addColorStop(0, '#2563EB');
    tipGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = tipGrad; ctx.fill();

    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    const highlight = slide.highlightText ? stripEmojis(slide.highlightText) : '추상적인 표현 대신 직무 성과와 수치를 명시하세요!';
    ctx.fillText(`💡 TIP: ${highlight}`, CANVAS_SIZE / 2, tipY + 46);
}

// ─── 3. CTA 슬라이드 (CTA Slide - Premium Bright Conversion Card) ──────────────────────

function drawCtaSlide(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 화사하고 신뢰감을 주는 라이트 테마 배경
    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgGrad.addColorStop(0, '#F8FAFC');
    bgGrad.addColorStop(0.5, '#EFF6FF');
    bgGrad.addColorStop(1, '#EEF2FF');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    drawHeader(ctx, slide.slideNumber, 3, false);

    // 중앙 화이트 포커스 카드
    const cardX = 60, cardY = 115, cardW = CANVAS_SIZE - 120, cardH = 820;
    roundRect(ctx, cardX, cardY, cardW, cardH, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0; // 어두운 그림자 제거
    ctx.fill(); ctx.stroke();

    // 상단 뱃지
    roundRect(ctx, CANVAS_SIZE / 2 - 120, cardY + 36, 240, 44, 22);
    ctx.fillStyle = '#EFF6FF'; ctx.fill();
    ctx.strokeStyle = '#BFDBFE'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = '#2563EB';
    ctx.textAlign = 'center';
    ctx.fillText('🎁 FREE TRIAL', CANVAS_SIZE / 2, cardY + 65);

    // 메인 헤드라인 타이틀 (선명한 다크 네이비)
    ctx.font = `bold 52px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    const tLines = wrapText(ctx, stripEmojis(slide.title), cardW - 80);
    let tY = cardY + 145;
    for (const tl of tLines) {
        ctx.fillText(tl, CANVAS_SIZE / 2, tY);
        tY += 66;
    }

    ctx.font = `25px ${FONT_FAMILY}`;
    ctx.fillStyle = '#64748B';
    ctx.fillText(stripEmojis(slide.subtitle || '지금 프로필 링크에서 바로 확인해보세요!'), CANVAS_SIZE / 2, tY + 10);

    // 구분선
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(150, tY + 40, CANVAS_SIZE - 300, 2);

    // 핵심 혜택 리스트 (USP)
    let featureY = tY + 75;
    const defaultFeatures = [
        '⚡ 3초 만에 끝나는 문장 단위 (Diff) 1:1 교정',
        '📊 4대 역량 스코어링 (직무적합/가독성/논리성/구체성)',
        '🎁 비용 부담 Zero! 프로필 링크에서 무료 시작'
    ];
    const features = slide.contentLines.length >= 3 ? slide.contentLines : defaultFeatures;

    features.forEach((feat, idx) => {
        roundRect(ctx, cardX + 40, featureY, cardW - 80, 76, 20);
        ctx.fillStyle = idx === 0 ? '#EFF6FF' : (idx === 1 ? '#F5F3FF' : '#ECFDF5');
        ctx.strokeStyle = idx === 0 ? '#93C5FD' : (idx === 1 ? '#C4B5FD' : '#6EE7B7');
        ctx.lineWidth = 1.5;
        ctx.fill(); ctx.stroke();

        ctx.font = `bold 24px ${FONT_FAMILY}`;
        ctx.fillStyle = idx === 0 ? '#1E40AF' : (idx === 1 ? '#5B21B6' : '#065F46');
        ctx.textAlign = 'left';
        ctx.fillText(stripEmojis(feat), cardX + 66, featureY + 46);

        featureY += 92;
    });

    // 메인 CTA 버튼 (선명하고 강렬한 로얄 블루 버튼)
    const btnW = cardW - 80, btnH = 88;
    const btnX = cardX + 40;
    const btnY = cardY + cardH - 120;
    roundRect(ctx, btnX, btnY, btnW, btnH, 44);
    const btnGrad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
    btnGrad.addColorStop(0, '#2563EB');
    btnGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = btnGrad;
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.font = `bold 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('지금 프로필 링크에서 무료 교정 받기 ➔', CANVAS_SIZE / 2, btnY + 55);

    // 하단 URL
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText('draft-ethan.vercel.app', CANVAS_SIZE / 2, CANVAS_SIZE - 40);
}


// ─── 공개 API ────────────────────────────────────────────────────────────────────

export async function renderSlideImage(slide: CardNewsSlide, totalSlides: number = 3): Promise<Buffer> {
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');

    if (slide.type === 'COVER') {
        drawCoverSlide(ctx, slide);
    } else if (slide.type === 'BODY') {
        drawBodySlide(ctx, slide);
    } else if (slide.type === 'CTA') {
        drawCtaSlide(ctx, slide);
    } else {
        drawBodySlide(ctx, slide);
    }

    return canvas.toBuffer('image/jpeg', 95);
}

export async function renderAllCardNewsSlides(
    slides: CardNewsSlide[],
    outputDir: string = path.join(process.cwd(), 'output_cardnews')
): Promise<string[]> {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    setRandomTheme();
    const generatedFilePaths: string[] = [];
    for (let i = 0; i < slides.length; i++) {
        const imageBuffer = await renderSlideImage(slides[i], slides.length);
        const filePath = path.join(outputDir, `slide_${i + 1}.jpg`);
        fs.writeFileSync(filePath, imageBuffer);
        generatedFilePaths.push(filePath);
        console.log(`[ImageRenderer] 슬라이드 ${i + 1}/${slides.length} 렌더링 완료: ${filePath}`);
    }
    return generatedFilePaths;
}
