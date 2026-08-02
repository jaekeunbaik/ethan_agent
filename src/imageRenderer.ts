import { createCanvas, CanvasRenderingContext2D, GlobalFonts } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { CardNewsSlide } from './contentGenerator';

// 리눅스(GitHub Actions) 환경 한글 폰트 자동 등록
const fontPaths = [
    { path: '/usr/share/fonts/truetype/nanum/NanumGothic.ttf', name: 'NanumGothic' },
    { path: '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf', name: 'NanumGothic' },
    { path: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', name: 'Noto Sans CJK KR' },
];

for (const font of fontPaths) {
    if (fs.existsSync(font.path)) {
        try {
            GlobalFonts.registerFromPath(font.path, font.name);
        } catch { /* 이미 등록되었거나 패스 */ }
    }
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

const THEMES: ColorTheme[] = [
    // 1. Coral Violet (기본 화사함)
    {
        grad1: '#FF6B6B', grad2: '#A855F7', grad3: '#6366F1',
        coral: '#FF6B6B', violet: '#A855F7', bgGradEnd: '#F3F0FF',
        itemColors: [
            { bg: '#FFF1F1', border: '#FF6B6B', badge: '#FF6B6B', text: '#FF6B6B' },
            { bg: '#F5F3FF', border: '#A855F7', badge: '#A855F7', text: '#A855F7' },
            { bg: '#EEF2FF', border: '#6366F1', badge: '#6366F1', text: '#6366F1' },
            { bg: '#F0FDF4', border: '#10B981', badge: '#10B981', text: '#10B981' },
        ]
    },
    // 2. Mint & Teal (청량한 민트 에메랄드)
    {
        grad1: '#0D9488', grad2: '#0284C7', grad3: '#6366F1',
        coral: '#0D9488', violet: '#0284C7', bgGradEnd: '#F0FDFA',
        itemColors: [
            { bg: '#CCFBF1', border: '#0D9488', badge: '#0D9488', text: '#0D9488' },
            { bg: '#E0F2FE', border: '#0284C7', badge: '#0284C7', text: '#0284C7' },
            { bg: '#EEF2FF', border: '#6366F1', badge: '#6366F1', text: '#6366F1' },
            { bg: '#ECFDF5', border: '#10B981', badge: '#10B981', text: '#10B981' },
        ]
    },
    // 3. Sunset Orange & Amber (열정적인 오렌지/골드)
    {
        grad1: '#F97316', grad2: '#EF4444', grad3: '#8B5CF6',
        coral: '#F97316', violet: '#EF4444', bgGradEnd: '#FFF7ED',
        itemColors: [
            { bg: '#FFEDD5', border: '#F97316', badge: '#F97316', text: '#EA580C' },
            { bg: '#FEE2E2', border: '#EF4444', badge: '#EF4444', text: '#DC2626' },
            { bg: '#F3E8FF', border: '#8B5CF6', badge: '#8B5CF6', text: '#7C3AED' },
            { bg: '#FEF3C7', border: '#F59E0B', badge: '#F59E0B', text: '#D97706' },
        ]
    },
    // 4. Royal Blue & Violet (전문적이고 세련된 인디고)
    {
        grad1: '#2563EB', grad2: '#7C3AED', grad3: '#EC4899',
        coral: '#2563EB', violet: '#7C3AED', bgGradEnd: '#EFF6FF',
        itemColors: [
            { bg: '#DBEAFE', border: '#2563EB', badge: '#2563EB', text: '#1D4ED8' },
            { bg: '#EDE9FE', border: '#7C3AED', badge: '#7C3AED', text: '#6D28D9' },
            { bg: '#FCE7F3', border: '#EC4899', badge: '#EC4899', text: '#DB2777' },
            { bg: '#E0F2FE', border: '#0284C7', badge: '#0284C7', text: '#0369A1' },
        ]
    },
    // 5. Rose & Peach (화사한 핑크 피치)
    {
        grad1: '#F43F5E', grad2: '#FB7185', grad3: '#A855F7',
        coral: '#F43F5E', violet: '#FB7185', bgGradEnd: '#FFF1F2',
        itemColors: [
            { bg: '#FFE4E6', border: '#F43F5E', badge: '#F43F5E', text: '#E11D48' },
            { bg: '#FECDD3', border: '#FB7185', badge: '#FB7185', text: '#E11D48' },
            { bg: '#F5F3FF', border: '#A855F7', badge: '#A855F7', text: '#7E22CE' },
            { bg: '#FFEDD5', border: '#F97316', badge: '#F97316', text: '#C2410C' },
        ]
    }
];

const FONT_FAMILY = '"NanumGothic", "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

// 랜덤 테마 선택
let currentTheme = THEMES[Math.floor(Math.random() * THEMES.length)];

export function setRandomTheme() {
    currentTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
}

const BASE_COLORS = {
    bg: '#FFFFFF',
    bgSoft: '#F8F7FF',
    textDark: '#1A1A2E',
    textBody: '#374151',
    textMuted: '#6B7280',
    textLight: '#9CA3AF',
    textWhite: '#FFFFFF',
    cardBg: '#FFFFFF',
    cardBorder: '#E5E7EB',
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

const ITEM_COLORS = new Proxy([], {
    get(target, prop: string) {
        const index = Number(prop);
        if (!isNaN(index)) {
            const items = currentTheme.itemColors;
            return items[index % items.length];
        }
        if (prop === 'length') return currentTheme.itemColors.length;
        return (currentTheme.itemColors as any)[prop];
    }
}) as Array<{ bg: string; border: string; badge: string; text: string }>;

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

// ─── 장식용 추상 일러스트 요소들 ────────────────────────────────────────────────

/** 커버용: 우측 원형 클러스터 일러스트 */
function drawCoverIllustration(ctx: CanvasRenderingContext2D) {
    const cx = 820, cy = 520;

    // 큰 반투명 배경 원 (연한 바이올렛)
    const bigCircle = ctx.createRadialGradient(cx, cy, 0, cx, cy, 260);
    bigCircle.addColorStop(0, 'rgba(168,85,247,0.10)');
    bigCircle.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = bigCircle;
    ctx.beginPath();
    ctx.arc(cx, cy, 260, 0, Math.PI * 2);
    ctx.fill();

    // 바깥 링 (점선 느낌 = 여러 호)
    ctx.strokeStyle = 'rgba(168,85,247,0.18)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.arc(cx, cy, 230, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 중간 그라데이션 원
    const midGrad = ctx.createLinearGradient(cx - 160, cy - 160, cx + 160, cy + 160);
    midGrad.addColorStop(0, 'rgba(255,107,107,0.55)');
    midGrad.addColorStop(1, 'rgba(168,85,247,0.55)');
    ctx.fillStyle = midGrad;
    ctx.shadowColor = 'rgba(168,85,247,0.25)';
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 중앙 밝은 원 (하이라이트)
    const innerGrad = ctx.createRadialGradient(cx - 30, cy - 30, 0, cx, cy, 80);
    innerGrad.addColorStop(0, 'rgba(255,255,255,0.70)');
    innerGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 130, 0, Math.PI * 2);
    ctx.fill();

    // 우상단 작은 위성 원
    const sat1x = cx + 145, sat1y = cy - 160;
    const s1g = ctx.createLinearGradient(sat1x - 50, sat1y - 50, sat1x + 50, sat1y + 50);
    s1g.addColorStop(0, '#FF6B6B');
    s1g.addColorStop(1, '#FF8E53');
    ctx.fillStyle = s1g;
    ctx.shadowColor = 'rgba(255,107,107,0.4)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(sat1x, sat1y, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 좌하단 중간 위성 원
    const sat2x = cx - 160, sat2y = cy + 140;
    const s2g = ctx.createLinearGradient(sat2x - 40, sat2y - 40, sat2x + 40, sat2y + 40);
    s2g.addColorStop(0, '#6366F1');
    s2g.addColorStop(1, '#A855F7');
    ctx.fillStyle = s2g;
    ctx.shadowColor = 'rgba(99,102,241,0.4)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(sat2x, sat2y, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 우하단 작은 위성 원
    const sat3x = cx + 170, sat3y = cy + 110;
    ctx.fillStyle = 'rgba(20,184,166,0.75)';
    ctx.shadowColor = 'rgba(20,184,166,0.3)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(sat3x, sat3y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 작은 도트 장식들
    const dots = [
        { x: cx - 220, y: cy - 80, r: 8, color: 'rgba(255,107,107,0.5)' },
        { x: cx + 60, y: cy - 230, r: 6, color: 'rgba(99,102,241,0.5)' },
        { x: cx + 230, y: cy - 30, r: 10, color: 'rgba(168,85,247,0.4)' },
        { x: cx - 100, y: cy + 230, r: 7, color: 'rgba(20,184,166,0.5)' },
        { x: cx + 100, y: cy + 220, r: 5, color: 'rgba(245,158,11,0.55)' },
    ];
    for (const d of dots) {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
    }

    // 아이콘: 중앙에 별표(★) 형태로 선 그리기
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    // 심플 체크마크 모양
    ctx.beginPath();
    ctx.moveTo(cx - 38, cy + 5);
    ctx.lineTo(cx - 12, cy + 32);
    ctx.lineTo(cx + 42, cy - 30);
    ctx.stroke();
    ctx.lineCap = 'butt';
}

/** 본문용: 우상단 장식 아이콘 (번호에 따라 다른 모양) */
function drawBodyDecoration(ctx: CanvasRenderingContext2D, slideNumber: number) {
    const x = CANVAS_SIZE - 100, y = 170, r = 48;
    const palette = ITEM_COLORS[(slideNumber - 2) % ITEM_COLORS.length];

    // 바깥 링
    ctx.strokeStyle = palette.border + '30';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, r + 18, 0, Math.PI * 2);
    ctx.stroke();

    // 내부 원
    const grad = ctx.createRadialGradient(x - 15, y - 15, 0, x, y, r);
    grad.addColorStop(0, palette.badge + 'cc');
    grad.addColorStop(1, palette.badge + '88');
    ctx.fillStyle = grad;
    ctx.shadowColor = palette.badge + '44';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 번호 텍스트
    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`${slideNumber - 1}`, x, y + 13);
}

/** 배경 도트 패턴 */
function drawDotPattern(ctx: CanvasRenderingContext2D, color: string = 'rgba(99,102,241,0.06)') {
    ctx.fillStyle = color;
    const gap = 38;
    for (let px = gap; px < CANVAS_SIZE; px += gap) {
        for (let py = gap; py < CANVAS_SIZE; py += gap) {
            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/** CTA 컨페티 장식 */
function drawConfetti(ctx: CanvasRenderingContext2D) {
    const shapes = [
        { x: 120, y: 100, size: 14, color: 'rgba(255,107,107,0.6)', type: 'circle' },
        { x: 200, y: 60,  size: 10, color: 'rgba(168,85,247,0.5)', type: 'rect' },
        { x: 60,  y: 220, size: 8,  color: 'rgba(99,102,241,0.5)', type: 'circle' },
        { x: 960, y: 80,  size: 12, color: 'rgba(20,184,166,0.6)', type: 'circle' },
        { x: 1020,y: 200, size: 9,  color: 'rgba(245,158,11,0.55)', type: 'rect' },
        { x: 920, y: 140, size: 7,  color: 'rgba(255,107,107,0.4)', type: 'circle' },
        { x: 100, y: 950, size: 13, color: 'rgba(168,85,247,0.5)', type: 'circle' },
        { x: 50,  y: 860, size: 8,  color: 'rgba(99,102,241,0.4)', type: 'rect' },
        { x: 980, y: 900, size: 11, color: 'rgba(255,107,107,0.5)', type: 'circle' },
        { x: 1000,y: 980, size: 7,  color: 'rgba(20,184,166,0.4)', type: 'circle' },
        { x: 160, y: 170, size: 6,  color: 'rgba(245,158,11,0.5)', type: 'circle' },
        { x: 880, y: 60,  size: 10, color: 'rgba(168,85,247,0.45)', type: 'rect' },
    ];
    for (const s of shapes) {
        ctx.fillStyle = s.color;
        if (s.type === 'circle') {
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
            ctx.restore();
        }
    }
}

// ─── 공통 헤더 / 푸터 ───────────────────────────────────────────────────────────

function drawHeader(ctx: CanvasRenderingContext2D, slideNumber: number, totalSlides: number) {
    const headerGrad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, 0);
    headerGrad.addColorStop(0, COLORS.coral);
    headerGrad.addColorStop(0.5, COLORS.violet);
    headerGrad.addColorStop(1, COLORS.indigo);
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, CANVAS_SIZE, 14);

    ctx.font = `bold 22px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textDark;
    ctx.textAlign = 'left';
    ctx.fillText('Draft Ethan', 60, 74);

    const badgeX = 60 + ctx.measureText('Draft Ethan').width + 12;
    roundRect(ctx, badgeX, 53, 42, 26, 8);
    const aiBg = ctx.createLinearGradient(badgeX, 0, badgeX + 42, 0);
    aiBg.addColorStop(0, COLORS.coral);
    aiBg.addColorStop(1, COLORS.violet);
    ctx.fillStyle = aiBg;
    ctx.fill();
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textWhite;
    ctx.textAlign = 'center';
    ctx.fillText('AI', badgeX + 21, 70);

    ctx.font = `bold 20px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText(`${slideNumber} / ${totalSlides}`, CANVAS_SIZE - 60, 74);
}

function drawFooter(ctx: CanvasRenderingContext2D, slideNumber: number, totalSlides: number) {
    ctx.strokeStyle = COLORS.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(60, CANVAS_SIZE - 110);
    ctx.lineTo(CANVAS_SIZE - 60, CANVAS_SIZE - 110);
    ctx.stroke();

    const dotCount = totalSlides;
    const dotStartX = (CANVAS_SIZE - dotCount * 24) / 2;
    for (let i = 0; i < dotCount; i++) {
        const dotX = dotStartX + i * 24 + 8;
        if (i === slideNumber - 1) {
            roundRect(ctx, dotX - 14, CANVAS_SIZE - 90, 28, 10, 5);
            const pg = ctx.createLinearGradient(dotX - 14, 0, dotX + 14, 0);
            pg.addColorStop(0, COLORS.coral);
            pg.addColorStop(1, COLORS.violet);
            ctx.fillStyle = pg;
            ctx.fill();
        } else {
            ctx.fillStyle = COLORS.cardBorder;
            ctx.beginPath();
            ctx.arc(dotX, CANVAS_SIZE - 85, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.font = `18px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textLight;
    ctx.textAlign = 'right';
    ctx.fillText('draft-ethan.vercel.app', CANVAS_SIZE - 60, CANVAS_SIZE - 55);
}

// ─── 슬라이드별 렌더 ────────────────────────────────────────────────────────────

function drawCoverSlide(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 배경
    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(1, '#F3F0FF');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 좌측 상단 부드러운 블롭
    const blob = ctx.createRadialGradient(0, 300, 0, 0, 300, 350);
    blob.addColorStop(0, 'rgba(255,107,107,0.08)');
    blob.addColorStop(1, 'rgba(255,107,107,0)');
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 우측 추상 일러스트 (화면 절반 차지)
    drawCoverIllustration(ctx);

    // 카테고리 칩 태그
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    const chipText = '자소서 합격 전략';
    const chipW = ctx.measureText(chipText).width + 36;
    roundRect(ctx, 60, 130, chipW, 44, 22);
    const chipGrad = ctx.createLinearGradient(60, 0, 60 + chipW, 0);
    chipGrad.addColorStop(0, COLORS.coral);
    chipGrad.addColorStop(1, COLORS.violet);
    ctx.fillStyle = chipGrad;
    ctx.fill();
    ctx.fillStyle = COLORS.textWhite;
    ctx.textAlign = 'left';
    ctx.fillText(chipText, 78, 158);

    // 메인 타이틀 — 왼쪽 절반에만 배치
    ctx.font = `bold 78px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textDark;
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 8;
    const titleLines = wrapText(ctx, stripEmojis(slide.title), 580);
    let titleY = 275;
    for (const line of titleLines) {
        ctx.fillText(line, 60, titleY);
        titleY += 96;
    }
    ctx.shadowBlur = 0;

    // 언더라인
    const lineGrad = ctx.createLinearGradient(60, 0, 340, 0);
    lineGrad.addColorStop(0, COLORS.coral);
    lineGrad.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(60, titleY - 62, 300, 6);

    // 서브타이틀 카드
    if (slide.subtitle) {
        const subBoxY = titleY + 24;
        const subBoxH = 110;
        roundRect(ctx, 60, subBoxY, 600, subBoxH, 18);
        ctx.fillStyle = COLORS.cardBg;
        ctx.shadowColor = 'rgba(0,0,0,0.07)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

        roundRect(ctx, 60, subBoxY, 6, subBoxH, 3);
        const barGrad = ctx.createLinearGradient(0, subBoxY, 0, subBoxY + subBoxH);
        barGrad.addColorStop(0, COLORS.coral);
        barGrad.addColorStop(1, COLORS.violet);
        ctx.fillStyle = barGrad;
        ctx.fill();

        ctx.font = `26px ${FONT_FAMILY}`;
        ctx.fillStyle = COLORS.textBody;
        ctx.textAlign = 'left';
        const subLines = wrapText(ctx, stripEmojis(slide.subtitle), 520);
        let subY = subBoxY + 40;
        for (const line of subLines) {
            ctx.fillText(line, 94, subY);
            subY += 40;
        }
    }

    // 하단 키워드 칩 행
    const chips = ['합격 전략', 'AI 맞춤 교정', '취준생 필수', '서류 통과'];
    const chipRowY = CANVAS_SIZE - 210;
    let chipX = 60;
    chips.forEach((chip, idx) => {
        const p = ITEM_COLORS[idx % ITEM_COLORS.length];
        ctx.font = `bold 20px ${FONT_FAMILY}`;
        const cw = ctx.measureText(chip).width + 32;
        roundRect(ctx, chipX, chipRowY, cw, 42, 21);
        ctx.fillStyle = p.bg;
        ctx.fill();
        roundRect(ctx, chipX, chipRowY, cw, 42, 21);
        ctx.strokeStyle = p.border;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = p.text;
        ctx.textAlign = 'left';
        ctx.fillText(chip, chipX + 16, chipRowY + 28);
        chipX += cw + 14;
    });
}

function drawBodySlide(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 배경 + 도트 패턴
    ctx.fillStyle = '#F8F7FF';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawDotPattern(ctx);

    // 상단 화이트 타이틀 영역
    ctx.fillStyle = COLORS.cardBg;
    ctx.fillRect(0, 14, CANVAS_SIZE, 210);

    // 우상단 장식 원형 아이콘
    drawBodyDecoration(ctx, slide.slideNumber);

    // 타이틀
    ctx.font = `bold 48px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textDark;
    ctx.textAlign = 'left';
    const titleClean = stripEmojis(slide.title);
    ctx.fillText(titleClean, 60, 155);

    // 언더라인
    const underlineGrad = ctx.createLinearGradient(60, 0, 400, 0);
    underlineGrad.addColorStop(0, COLORS.coral);
    underlineGrad.addColorStop(1, COLORS.violet);
    ctx.fillStyle = underlineGrad;
    ctx.fillRect(60, 175, Math.min(ctx.measureText(titleClean).width, CANVAS_SIZE - 200), 5);

    if (slide.subtitle) {
        ctx.font = `24px ${FONT_FAMILY}`;
        ctx.fillStyle = COLORS.textMuted;
        ctx.fillText(stripEmojis(slide.subtitle), 60, 218);
    }

    // 카드 영역: 콘텐츠 균등 분배
    const cardPadX = 60;
    const cardWidth = CANVAS_SIZE - 120;
    const tipH = 82;
    const tipY = CANVAS_SIZE - 130 - tipH;
    const availableH = tipY - 248 - 16;
    const n = slide.contentLines.length;
    const cardH = Math.max(110, Math.floor(availableH / Math.max(n, 1)) - 20);
    let cardY = 248;

    slide.contentLines.forEach((lineText, index) => {
        const palette = ITEM_COLORS[index % ITEM_COLORS.length];
        const cleanText = stripEmojis(lineText);

        // 카드 배경
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 4;
        roundRect(ctx, cardPadX, cardY, cardWidth, cardH, 20);
        ctx.fillStyle = COLORS.cardBg;
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

        // 좌측 컬러 바
        roundRect(ctx, cardPadX, cardY, 8, cardH, 4);
        ctx.fillStyle = palette.border;
        ctx.fill();

        // 번호 뱃지 (링 + 숫자)
        const badgeCX = cardPadX + 58;
        const badgeCY = cardY + cardH / 2;
        ctx.fillStyle = palette.bg;
        ctx.beginPath();
        ctx.arc(badgeCX, badgeCY, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = palette.badge;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(badgeCX, badgeCY, 28, -Math.PI / 2, Math.PI);
        ctx.stroke();
        ctx.font = `bold 24px ${FONT_FAMILY}`;
        ctx.fillStyle = palette.text;
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, badgeCX, badgeCY + 9);

        // 본문 텍스트
        ctx.font = `28px ${FONT_FAMILY}`;
        ctx.fillStyle = COLORS.textBody;
        ctx.textAlign = 'left';
        const textLines = wrapText(ctx, cleanText, cardWidth - 130);
        let textY = cardY + (cardH / 2) - ((textLines.length - 1) * 40) / 2 + 10;
        for (const tl of textLines) {
            ctx.fillText(tl, cardPadX + 106, textY);
            textY += 40;
        }

        cardY += cardH + 20;
    });

    // POINT 팁 바 (항상 하단 고정)
    roundRect(ctx, cardPadX, tipY, cardWidth, tipH, 16);
    const tipGrad = ctx.createLinearGradient(cardPadX, 0, cardPadX + cardWidth, 0);
    tipGrad.addColorStop(0, COLORS.coral);
    tipGrad.addColorStop(1, COLORS.violet);
    ctx.fillStyle = tipGrad;
    ctx.fill();

    // 팁 아이콘 (별 대신 ⚡ 느낌 삼각형)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(cardPadX + 28, tipY + tipH / 2 - 16);
    ctx.lineTo(cardPadX + 44, tipY + tipH / 2 + 16);
    ctx.lineTo(cardPadX + 16, tipY + tipH / 2 + 4);
    ctx.closePath();
    ctx.fill();

    const tipLabel = slide.highlightText ? stripEmojis(slide.highlightText) : '핵심 포인트를 기억하세요!';
    ctx.font = `bold 26px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textWhite;
    ctx.textAlign = 'left';
    ctx.fillText(`POINT  ${tipLabel}`, cardPadX + 58, tipY + 52);
}

function drawCtaSlide(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 전체 그라데이션 배경
    const bgGrad = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    bgGrad.addColorStop(0, '#FF6B6B');
    bgGrad.addColorStop(0.5, '#A855F7');
    bgGrad.addColorStop(1, '#6366F1');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 컨페티 장식
    drawConfetti(ctx);

    // 큰 반투명 원 배경 장식들
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.arc(120, 120, 180, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.arc(CANVAS_SIZE - 100, CANVAS_SIZE - 120, 220, 0, Math.PI * 2); ctx.fill();

    // 중앙 흰 카드
    ctx.shadowColor = 'rgba(0,0,0,0.20)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, 70, 120, CANVAS_SIZE - 140, 720, 36);
    ctx.fillStyle = COLORS.cardBg;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // 카드 상단 포인트 바
    ctx.beginPath();
    ctx.moveTo(70 + 6, 120);
    ctx.lineTo(70 + CANVAS_SIZE - 140 - 6, 120);
    ctx.arcTo(70 + CANVAS_SIZE - 140, 120, 70 + CANVAS_SIZE - 140, 120 + 14, 6);
    ctx.lineTo(70 + CANVAS_SIZE - 140, 120 + 14);
    ctx.lineTo(70, 120 + 14);
    ctx.arcTo(70, 120, 70 + 6, 120, 6);
    ctx.closePath();
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // 카드 상단 별 장식
    const starX = CANVAS_SIZE / 2, starY = 225;
    for (let i = 0; i < 3; i++) {
        const sx = starX - 40 + i * 40;
        ctx.fillStyle = ITEM_COLORS[i].badge + 'cc';
        ctx.beginPath();
        ctx.arc(sx, starY, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    // 타이틀
    ctx.font = `bold 56px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textDark;
    ctx.textAlign = 'center';
    const titleLines = wrapText(ctx, stripEmojis(slide.title), CANVAS_SIZE - 220);
    let titleY = 310;
    for (const line of titleLines) {
        ctx.fillText(line, CANVAS_SIZE / 2, titleY);
        titleY += 72;
    }

    // 구분선
    const divGrad = ctx.createLinearGradient(250, 0, CANVAS_SIZE - 250, 0);
    divGrad.addColorStop(0, 'rgba(255,107,107,0)');
    divGrad.addColorStop(0.3, COLORS.coral);
    divGrad.addColorStop(0.7, COLORS.violet);
    divGrad.addColorStop(1, 'rgba(99,102,241,0)');
    ctx.fillStyle = divGrad;
    ctx.fillRect(250, titleY - 10, CANVAS_SIZE - 500, 4);

    // 리스트 아이템
    let listY = titleY + 28;
    slide.contentLines.forEach((item, idx) => {
        const p = ITEM_COLORS[idx % ITEM_COLORS.length];
        // 컬러 도트
        ctx.fillStyle = p.badge;
        ctx.beginPath();
        ctx.arc(CANVAS_SIZE / 2 - 195, listY - 9, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `28px ${FONT_FAMILY}`;
        ctx.fillStyle = COLORS.textBody;
        ctx.textAlign = 'left';
        ctx.fillText(stripEmojis(item), CANVAS_SIZE / 2 - 175, listY);
        listY += 52;
    });

    // CTA 버튼
    const btnW = 520, btnH = 80;
    const btnX = (CANVAS_SIZE - btnW) / 2;
    const btnY = listY + 30;
    roundRect(ctx, btnX, btnY, btnW, btnH, 40);
    ctx.shadowColor = 'rgba(255,107,107,0.35)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    const btnGrad = ctx.createLinearGradient(btnX, 0, btnX + btnW, 0);
    btnGrad.addColorStop(0, COLORS.coral);
    btnGrad.addColorStop(1, COLORS.violet);
    ctx.fillStyle = btnGrad;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    ctx.font = `bold 28px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.textWhite;
    ctx.textAlign = 'center';
    ctx.fillText('지금 무료로 자소서 교정 받기', CANVAS_SIZE / 2, btnY + 52);

    // URL
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('draft-ethan.vercel.app', CANVAS_SIZE / 2, CANVAS_SIZE - 50);
}

// ─── 공개 API ────────────────────────────────────────────────────────────────────

export async function renderSlideImage(slide: CardNewsSlide, totalSlides: number = 5): Promise<Buffer> {
    const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE);
    const ctx = canvas.getContext('2d');

    if (slide.type === 'COVER') {
        drawCoverSlide(ctx, slide);
        drawHeader(ctx, slide.slideNumber, totalSlides);
        drawFooter(ctx, slide.slideNumber, totalSlides);
    } else if (slide.type === 'BODY') {
        drawBodySlide(ctx, slide);
        drawHeader(ctx, slide.slideNumber, totalSlides);
        drawFooter(ctx, slide.slideNumber, totalSlides);
    } else if (slide.type === 'CTA') {
        drawCtaSlide(ctx, slide);
        ctx.font = `bold 20px ${FONT_FAMILY}`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.textAlign = 'right';
        ctx.fillText(`${slide.slideNumber} / ${totalSlides}`, CANVAS_SIZE - 60, 60);
    } else {
        drawBodySlide(ctx, slide);
        drawHeader(ctx, slide.slideNumber, totalSlides);
        drawFooter(ctx, slide.slideNumber, totalSlides);
    }

    return canvas.toBuffer('image/jpeg', 92);
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
