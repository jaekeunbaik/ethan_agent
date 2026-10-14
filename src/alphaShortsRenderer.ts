import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
// @ts-ignore
import ffprobePath from 'ffprobe-static';
import { exec } from 'child_process';
import util from 'util';
import { AlphaShortsScene, AlphaShortsContent } from './alphaContentGenerator';

const execAsync = util.promisify(exec);

// 시스템에 설치된 ffmpeg 우선 사용 (Linux EACCES 방지), 없으면 ffmpeg-static 사용
if (process.platform === 'linux' && fs.existsSync('/usr/bin/ffmpeg')) {
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
} else if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
}

if (process.platform === 'linux' && fs.existsSync('/usr/bin/ffprobe')) {
    ffmpeg.setFfprobePath('/usr/bin/ffprobe');
} else if (ffprobePath && (ffprobePath.path || ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath.path || ffprobePath);
}

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT_FAMILY = '"NanumSquare", "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

// ─── 공통 헬퍼: 텍스트 줄바꿈 및 둥근 사각형 ─────────────────────────────────

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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

// ─── 프리미엄 다크 글래스모피즘 배경 렌더러 ─────────────────────────────────

function drawPremiumDarkBackground(ctx: CanvasRenderingContext2D) {
    // 1. 심해 다크 그라데이션 베이스 (#070A12 -> #0F172A)
    const bgGrad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    bgGrad.addColorStop(0, '#060913');
    bgGrad.addColorStop(0.5, '#0B1120');
    bgGrad.addColorStop(1, '#05070D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 2. 상단 & 하단 앰비언트 글로우 오로라 (Bloomberg / TradingView 느낌)
    const topGlow = ctx.createRadialGradient(WIDTH / 2, 200, 50, WIDTH / 2, 200, 500);
    topGlow.addColorStop(0, 'rgba(37, 99, 235, 0.18)');
    topGlow.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, WIDTH, 700);

    const bottomGlow = ctx.createRadialGradient(WIDTH / 2, HEIGHT - 300, 50, WIDTH / 2, HEIGHT - 300, 600);
    bottomGlow.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
    bottomGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = bottomGlow;
    ctx.fillRect(0, HEIGHT - 800, WIDTH, 800);

    // 3. 은은한 금융 그리드 라인 (Grid pattern)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 60; x < WIDTH; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }
    for (let y = 60; y < HEIGHT; y += 120) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }
}

// ─── 상단 헤더: 실시간 금융 인디케이터 바 ──────────────────────────────────

function drawHeaderBar(ctx: CanvasRenderingContext2D, badgeText: string) {
    const barY = 110;

    // 헤더 컨테이너 알약 뱃지
    roundRect(ctx, 60, barY, WIDTH - 120, 90, 24);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // LIVE 녹색 펄스 점
    ctx.beginPath();
    ctx.arc(105, barY + 45, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#10B981';
    ctx.fill();

    // LIVE STATS 텍스트
    ctx.font = `bold 28px ${FONT_FAMILY}`;
    ctx.fillStyle = '#10B981';
    ctx.textAlign = 'left';
    ctx.fillText('MARKET PULSE', 128, barY + 54);

    // 우측 뱃지 (오늘의 테마)
    ctx.font = `bold 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'right';
    ctx.fillText(badgeText, WIDTH - 90, barY + 55);
}

// ─── 씬 1: 캔들스틱 & 지수 요약 비주얼라이저 ────────────────────────────────

function drawCandleSummaryVisual(ctx: CanvasRenderingContext2D, scene: AlphaShortsScene) {
    const cardY = 250;
    const cardH = 1040;

    // 메인 글래스 카드
    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 36);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 메인 타이틀
    ctx.font = `bold 64px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    const titleLines = wrapText(ctx, scene.title, WIDTH - 200);
    let ty = cardY + 120;
    for (const line of titleLines) {
        ctx.fillText(line, WIDTH / 2, ty);
        ty += 78;
    }

    // 부제목 (서브텍스트)
    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(scene.subtitle, WIDTH / 2, ty + 10);

    // 중앙 메인 대형 수치 박스 (네온 하이라이트 + 글로우 효과)
    const statBoxY = ty + 70;
    const statColor = scene.highlightStat.isPositive ? '#EF4444' : '#38BDF8'; // 국장 기준: 상승=빨강, 하락=스카이블루

    ctx.save();
    ctx.shadowColor = statColor;
    ctx.shadowBlur = 25;
    roundRect(ctx, 110, statBoxY, WIDTH - 220, 220, 28);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fill();
    ctx.strokeStyle = statColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.font = `600 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(scene.highlightStat.label, WIDTH / 2, statBoxY + 60);

    ctx.font = `bold 84px ${FONT_FAMILY}`;
    ctx.fillStyle = statColor;
    ctx.fillText(scene.highlightStat.value, WIDTH / 2, statBoxY + 145);

    if (scene.highlightStat.subValue) {
        ctx.font = `bold 40px ${FONT_FAMILY}`;
        ctx.fillStyle = statColor;
        ctx.fillText(scene.highlightStat.subValue, WIDTH / 2, statBoxY + 195);
    }

    // 하단 캔들스틱 그래픽 드로잉 (5개 캔들 차트 연출)
    const candleAreaY = statBoxY + 260;
    const candleWidth = 50;
    const startX = 220;
    const gap = 130;

    const mockCandles = [
        { open: 80, close: 40, high: 20, low: 110, isUp: false },
        { open: 50, close: 90, high: 100, low: 30, isUp: true },
        { open: 85, close: 30, high: 10, low: 120, isUp: false },
        { open: 35, close: 105, high: 120, low: 20, isUp: true },
        { open: 95, close: scene.highlightStat.isPositive ? 130 : 25, high: 140, low: 15, isUp: scene.highlightStat.isPositive }
    ];

    mockCandles.forEach((c, idx) => {
        const cx = startX + idx * gap;
        const color = c.isUp ? '#EF4444' : '#3B82F6';

        // 윗꼬리-아래꼬리 선
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx + candleWidth / 2, candleAreaY + 140 - c.low);
        ctx.lineTo(cx + candleWidth / 2, candleAreaY + 140 - c.high);
        ctx.stroke();

        // 캔들 몸통
        const topY = candleAreaY + 140 - Math.max(c.open, c.close);
        const bodyH = Math.max(8, Math.abs(c.open - c.close));
        roundRect(ctx, cx, topY, candleWidth, bodyH, 6);
        ctx.fillStyle = color;
        ctx.fill();
    });
}

// ─── 씬 2: 외국인 vs 기관 수급 게이지 바 비주얼라이저 ──────────────────────────

function drawSupplyBarVisual(ctx: CanvasRenderingContext2D, scene: AlphaShortsScene) {
    const cardY = 250;
    const cardH = 1040;

    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 36);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 64px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(scene.title, WIDTH / 2, cardY + 130);

    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(scene.subtitle, WIDTH / 2, cardY + 200);

    // 환율 메인 하이라이트 박스
    const boxY = cardY + 270;
    roundRect(ctx, 110, boxY, WIDTH - 220, 200, 28);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `600 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(scene.highlightStat.label, WIDTH / 2, boxY + 55);

    ctx.font = `bold 76px ${FONT_FAMILY}`;
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(scene.highlightStat.value, WIDTH / 2, boxY + 135);

    // 수급 바 시각화 (외국인 순매도 vs 기관 방어)
    const barAreaY = boxY + 250;

    // 외국인 수급 바
    ctx.font = `bold 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'left';
    ctx.fillText('외국인 수급 강도', 110, barAreaY);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#F43F5E';
    ctx.fillText('순매도 우위 (-)', WIDTH - 110, barAreaY);

    roundRect(ctx, 110, barAreaY + 15, WIDTH - 220, 40, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    roundRect(ctx, 110, barAreaY + 15, (WIDTH - 220) * 0.75, 40, 20);
    ctx.fillStyle = '#F43F5E';
    ctx.fill();

    // 기관 수급 바
    const bar2Y = barAreaY + 100;
    ctx.font = `bold 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'left';
    ctx.fillText('기관 수급 방어력', 110, bar2Y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#10B981';
    ctx.fillText('부분 방어 (+)', WIDTH - 110, bar2Y);

    roundRect(ctx, 110, bar2Y + 15, WIDTH - 220, 40, 20);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    roundRect(ctx, 110, bar2Y + 15, (WIDTH - 220) * 0.45, 40, 20);
    ctx.fillStyle = '#10B981';
    ctx.fill();
}

// ─── 씬 3: 대형주 비교 카드 비주얼라이저 ───────────────────────────────────

function drawStockCompareVisual(ctx: CanvasRenderingContext2D, scene: AlphaShortsScene) {
    const cardY = 250;
    const cardH = 1040;

    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 36);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 64px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(scene.title, WIDTH / 2, cardY + 130);

    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(scene.subtitle, WIDTH / 2, cardY + 200);

    // 종목 카드 1: 삼성전자
    const card1Y = cardY + 260;
    roundRect(ctx, 110, card1Y, WIDTH - 220, 220, 28);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 42px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText('삼성전자 (005930)', 150, card1Y + 70);

    ctx.font = `500 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('외국인 집중 매도 지속', 150, card1Y + 120);

    // 등락률 뱃지
    roundRect(ctx, WIDTH - 340, card1Y + 50, 190, 80, 20);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.fill();
    ctx.font = `bold 44px ${FONT_FAMILY}`;
    ctx.fillStyle = '#38BDF8';
    ctx.textAlign = 'center';
    ctx.fillText('-1.67%', WIDTH - 245, card1Y + 107);

    // 종목 카드 2: SK하이닉스
    const card2Y = card1Y + 260;
    roundRect(ctx, 110, card2Y, WIDTH - 220, 220, 28);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 42px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText('SK하이닉스 (000660)', 150, card2Y + 70);

    ctx.font = `500 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('HBM 실적 기대감 기관 방어', 150, card2Y + 120);

    roundRect(ctx, WIDTH - 340, card2Y + 50, 190, 80, 20);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
    ctx.fill();
    ctx.font = `bold 44px ${FONT_FAMILY}`;
    ctx.fillStyle = '#F87171';
    ctx.textAlign = 'center';
    ctx.fillText('+1.09%', WIDTH - 245, card2Y + 107);
}

// ─── 씬 4: 내일 장전 전략 체크리스트 ───────────────────────────────────────

function drawChecklistVisual(ctx: CanvasRenderingContext2D, scene: AlphaShortsScene) {
    const cardY = 250;
    const cardH = 1040;

    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 36);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `bold 64px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(scene.title, WIDTH / 2, cardY + 130);

    ctx.font = `500 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(scene.subtitle, WIDTH / 2, cardY + 200);

    const items = [
        { num: '01', title: '야간 미국 증시 마감 체크', desc: '빅테크 엔비디아/애플 실적 흐름 확인' },
        { num: '02', title: '원·달러 환율 진정 여부', desc: '1,370원 선 하향 안정화 확인 필수' },
        { num: '03', title: '내일 아침 8시 시초가 전략', desc: '분할 매수 및 퀀트 신호 확인 후 대응' }
    ];

    items.forEach((item, idx) => {
        const itemY = cardY + 270 + idx * 190;
        roundRect(ctx, 110, itemY, WIDTH - 220, 160, 24);
        ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.stroke();

        // 번호 뱃지
        roundRect(ctx, 135, itemY + 35, 70, 70, 18);
        ctx.fillStyle = '#10B981';
        ctx.fill();
        ctx.font = `bold 36px ${FONT_FAMILY}`;
        ctx.fillStyle = '#064E3B';
        ctx.textAlign = 'center';
        ctx.fillText(item.num, 170, itemY + 83);

        ctx.textAlign = 'left';
        ctx.font = `bold 36px ${FONT_FAMILY}`;
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(item.title, 230, itemY + 70);

        ctx.font = `500 28px ${FONT_FAMILY}`;
        ctx.fillStyle = '#94A3B8';
        ctx.fillText(item.desc, 230, itemY + 115);
    });
}

// ─── 하단 모던 네온 자막 박스 ──────────────────────────────────────────────

function drawModernSubtitle(ctx: CanvasRenderingContext2D, text: string) {
    const boxY = HEIGHT - 460;
    const boxH = 220;

    roundRect(ctx, 60, boxY, WIDTH - 120, boxH, 28);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = `bold 46px ${FONT_FAMILY}`;
    ctx.fillStyle = '#F8FAFC';
    ctx.textAlign = 'center';

    const lines = wrapText(ctx, text, WIDTH - 200);
    const lineH = 62;
    const totalTextH = lines.length * lineH;
    let startY = boxY + (boxH - totalTextH) / 2 + 45;

    lines.forEach(line => {
        ctx.fillText(line, WIDTH / 2, startY);
        startY += lineH;
    });
}

// ─── 슬라이드 이미지 단일 프레임 렌더링 ─────────────────────────────────────

export function renderSceneFrame(scene: AlphaShortsScene, outputPath: string) {
    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext('2d');

    // 1. 다크 글래스모피즘 베이스
    drawPremiumDarkBackground(ctx);

    // 2. 상단 인디케이터 헤더
    drawHeaderBar(ctx, scene.badge);

    // 3. 차트 비주얼라이저 본문
    switch (scene.chartType) {
        case 'CANDLE_SUMMARY':
            drawCandleSummaryVisual(ctx, scene);
            break;
        case 'SUPPLY_BAR':
            drawSupplyBarVisual(ctx, scene);
            break;
        case 'STOCK_COMPARE':
            drawStockCompareVisual(ctx, scene);
            break;
        case 'CHECKLIST':
        default:
            drawChecklistVisual(ctx, scene);
            break;
    }

    // 4. 하단 고대비 모던 자막
    drawModernSubtitle(ctx, scene.voiceScript);

    // 저장
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
}

// ─── Edge-TTS 오디오 생성 (빠르고 찰진 1.22배속) ─────────────────────────────

export async function generateEdgeTtsAudio(text: string, outputMp3Path: string): Promise<number> {
    const cleanText = text.replace(/["\n\r]/g, ' ').trim();

    try {
        // out/index.js 절대경로로 CJS 로드하여 ts-node 타입스트리핑 우회
        const edgeTtsModule = require(path.join(process.cwd(), 'node_modules', 'edge-tts', 'out', 'index.js'));
        await edgeTtsModule.ttsSave(cleanText, outputMp3Path, {
            voice: 'ko-KR-InJoonNeural',
            rate: '+22%',  // 쇼츠 특화 빠른 호흡 1.22배속
            pitch: '+0Hz'
        });
    } catch (err: any) {
        console.warn('⚠️ edge-tts ttsSave 실패, 구글 TTS 폴백 시도:', err.message);
        const { getAudioUrl } = await import('google-tts-api');
        const axios = (await import('axios')).default;
        const url = getAudioUrl(cleanText, { lang: 'ko', slow: false });
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        const rawMp3 = outputMp3Path + '.raw.mp3';
        fs.writeFileSync(rawMp3, Buffer.from(res.data));

        // ffmpeg로 1.45배속 초고속 딕션 변환 (쇼츠 최적화)
        await new Promise<void>((resFfmpeg, rejFfmpeg) => {
            ffmpeg(rawMp3)
                .audioFilters('atempo=1.45')
                .save(outputMp3Path)
                .on('end', () => {
                    try { fs.unlinkSync(rawMp3); } catch {}
                    resFfmpeg();
                })
                .on('error', (e) => {
                    fs.copyFileSync(rawMp3, outputMp3Path);
                    resFfmpeg();
                });
        });
    }

    // 오디오 길이(초) 추출 via ffprobe
    return new Promise((resolve) => {
        ffmpeg.ffprobe(outputMp3Path, (err, metadata) => {
            if (err || !metadata?.format?.duration) {
                resolve(5.5); // fallback: 5.5초
            } else {
                resolve(metadata.format.duration);
            }
        });
    });
}

// ─── 최종 1080x1920 60fps 고화질 비디오 합성 엔진 ─────────────────────────

export async function renderAlphaShortsVideo(content: AlphaShortsContent, outputVideoPath: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp_alpha_shorts');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const sceneVideos: string[] = [];

    for (let i = 0; i < content.scenes.length; i++) {
        const scene = content.scenes[i];
        console.log(`🎬 [AlphaRenderer] 씬 ${i + 1}/${content.scenes.length} 생성 중... (${scene.badge})`);

        const imgPath = path.join(tempDir, `scene_${i}.png`);
        const audioPath = path.join(tempDir, `scene_${i}.mp3`);
        const sceneVideoPath = path.join(tempDir, `scene_${i}.mp4`);

        // 1. 프레임 이미지 렌더링
        renderSceneFrame(scene, imgPath);

        // 2. TTS 생성 및 재생시간 측정
        const duration = await generateEdgeTtsAudio(scene.voiceScript, audioPath);
        const safeDuration = Math.max(duration + 0.4, 5); // 오디오 끝 여유 0.4초

        // 3. Ken-Burns subtle zoom 효과 + 오디오 합성 (FFmpeg)
        await new Promise<void>((resolve, reject) => {
            ffmpeg()
                .input(imgPath)
                .loop(safeDuration)
                .input(audioPath)
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-b:a 192k',
                    '-shortest',
                    // 흔들림 없는 완벽한 고해상도 1080x1920 록다운 프레임
                    '-vf scale=1080:1920,fps=30',
                    '-preset fast'
                ])
                .save(sceneVideoPath)
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });

        sceneVideos.push(sceneVideoPath);
    }

    // 4. 모든 씬 합치기 (Concat)
    console.log('🔄 [AlphaRenderer] 모든 씬 비디오를 최종 1080x1920 영상으로 병합 중...');
    const listFile = path.join(tempDir, 'concat_list.txt');
    const listContent = sceneVideos.map(v => `file '${v.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(listFile, listContent, 'utf-8');

    await new Promise<void>((resolve, reject) => {
        ffmpeg()
            .input(listFile)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .save(outputVideoPath)
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });

    console.log(`✅ [AlphaRenderer] 초고화질 금융 쇼츠 렌더링 완료: ${outputVideoPath}`);
    return outputVideoPath;
}
