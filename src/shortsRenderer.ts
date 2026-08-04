import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import { getAudioUrl } from 'google-tts-api';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
// @ts-ignore
import ffprobePath from 'ffprobe-static';
import { CardNewsSlide } from './contentGenerator';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath && (ffprobePath.path || ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath.path || ffprobePath);
}

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT_FAMILY = '"NanumGothic", "NanumSquare", "NanumBarunGothic", "Noto Sans CJK KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

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

// ─── 트렌디 유튜브 쇼츠 자막 스타일 (상단 헤드라인 + 중앙 비주얼 + 하단 강조 자막) ───

function drawTopHeader(ctx: CanvasRenderingContext2D, titleText: string) {
    ctx.font = `bold 52px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, WIDTH / 2, 160);
}

function drawBottomSubtitle(ctx: CanvasRenderingContext2D, subtitleText: string) {
    const cleanStr = stripEmojis(subtitleText);
    if (!cleanStr) return;

    ctx.font = `bold 48px ${FONT_FAMILY}`;
    const textW = ctx.measureText(cleanStr).width + 60;
    const boxW = Math.min(textW, WIDTH - 100);
    const boxH = 90;
    const boxX = (WIDTH - boxW) / 2;
    const boxY = HEIGHT - 240;

    // 형광 노란색 자막 배너 (#FFE800)
    roundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fillStyle = '#FFE800';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = `bold 44px ${FONT_FAMILY}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(cleanStr.substring(0, 30), WIDTH / 2, boxY + 60);
}

// ─── 1. 커버 슬라이드 (Cover Slide - 깔끔한 화이트/블루 트렌드) ───────────────

function renderShortsCover(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    // 배경 (화사한 크림 화이트)
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 상단 헤드라인
    drawTopHeader(ctx, '⚡ 3초 만에 바뀌는 합격 자소서..!');

    // 중앙 메인 포커스 카드
    const cardY = 280, cardH = 1100;
    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.fill(); ctx.stroke();

    // 상단 그래디언트 뱃지
    roundRect(ctx, WIDTH / 2 - 200, cardY + 60, 400, 70, 35);
    const badgeGrad = ctx.createLinearGradient(WIDTH / 2 - 200, 0, WIDTH / 2 + 200, 0);
    badgeGrad.addColorStop(0, '#2563EB');
    badgeGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = badgeGrad; ctx.fill();

    ctx.font = `bold 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 오늘의 AI 팩폭 레포트', WIDTH / 2, cardY + 107);

    // 타이틀
    ctx.font = `bold 72px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    const lines = wrapText(ctx, stripEmojis(slide.title), WIDTH - 200);
    let curY = cardY + 280;
    for (const l of lines) {
        ctx.fillText(l, WIDTH / 2, curY);
        curY += 100;
    }

    // 서브타이틀
    if (slide.subtitle) {
        const boxY = curY + 40;
        roundRect(ctx, 110, boxY, WIDTH - 220, 200, 24);
        ctx.fillStyle = '#EFF6FF';
        ctx.strokeStyle = '#BFDBFE';
        ctx.lineWidth = 2;
        ctx.fill(); ctx.stroke();

        ctx.font = `34px ${FONT_FAMILY}`;
        ctx.fillStyle = '#1E40AF';
        const subLines = wrapText(ctx, stripEmojis(slide.subtitle), WIDTH - 280);
        let sy = boxY + 75;
        for (const sl of subLines) {
            ctx.fillText(sl, WIDTH / 2, sy);
            sy += 52;
        }
    }

    // 하단 자막
    drawBottomSubtitle(ctx, slide.subtitle || slide.title);
}

// ─── 2. 본문 슬라이드 (BEFORE vs AFTER 비교) ───────────────────────────────

function renderShortsBody(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawTopHeader(ctx, stripEmojis(slide.title));

    let beforeText = '', afterText = '', scoreText = '';
    slide.contentLines.forEach(line => {
        if (/before/i.test(line)) beforeText = line.replace(/before:\s*/i, '').trim();
        else if (/after/i.test(line)) afterText = line.replace(/after:\s*/i, '').trim();
        else scoreText = line.trim();
    });

    if (beforeText && afterText) {
        // Before (Red Card)
        const bY = 260, bH = 430;
        roundRect(ctx, 60, bY, WIDTH - 120, bH, 32);
        ctx.fillStyle = '#FEF2F2';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.fill(); ctx.stroke();

        roundRect(ctx, 100, bY + 35, 230, 50, 25);
        ctx.fillStyle = '#EF4444'; ctx.fill();
        ctx.font = `bold 26px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('❌ BEFORE 탈락', 215, bY + 69);

        ctx.font = `36px ${FONT_FAMILY}`;
        ctx.fillStyle = '#991B1B';
        ctx.textAlign = 'left';
        const bls = wrapText(ctx, stripEmojis(beforeText), WIDTH - 200);
        let by = bY + 145;
        for (const l of bls) { ctx.fillText(l, 100, by); by += 54; }

        // Arrow
        ctx.font = `bold 48px ${FONT_FAMILY}`;
        ctx.fillStyle = '#7C3AED';
        ctx.textAlign = 'center';
        ctx.fillText('⬇️ Draft Ethan AI 1:1 맞춤 교정 ⬇️', WIDTH / 2, bY + bH + 75);

        // After (Purple Card)
        const aY = bY + bH + 130, aH = 450;
        roundRect(ctx, 60, aY, WIDTH - 120, aH, 32);
        ctx.fillStyle = '#F5F3FF';
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = 3.5;
        ctx.fill(); ctx.stroke();

        roundRect(ctx, 100, aY + 35, 230, 50, 25);
        ctx.fillStyle = '#7C3AED'; ctx.fill();
        ctx.font = `bold 26px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('✅ AFTER 합격', 215, aY + 69);

        ctx.font = `bold 38px ${FONT_FAMILY}`;
        ctx.fillStyle = '#4C1D95';
        ctx.textAlign = 'left';
        const als = wrapText(ctx, stripEmojis(afterText), WIDTH - 200);
        let ay = aY + 150;
        for (const l of als) { ctx.fillText(l, 100, ay); ay += 56; }
    }

    drawBottomSubtitle(ctx, scoreText || '직무 수치와 구체적 성과를 명시하세요!');
}

// ─── 3. CTA 슬라이드 (Call To Action) ───────────────────────────────────────

function renderShortsCta(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawTopHeader(ctx, '🎉 나도 합격 자소서 만들기');

    const cardY = 280, cardH = 1100;
    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3.5;
    ctx.fill(); ctx.stroke();

    ctx.font = `bold 64px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    const tls = wrapText(ctx, stripEmojis(slide.title), WIDTH - 200);
    let ty = cardY + 160;
    for (const tl of tls) { ctx.fillText(tl, WIDTH / 2, ty); ty += 90; }

    ctx.font = `34px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText('지금 바로 3초 만에 AI 교정을 받아보세요!', WIDTH / 2, ty + 30);

    const btnY = cardY + cardH - 240;
    roundRect(ctx, 100, btnY, WIDTH - 200, 130, 65);
    const btnGrad = ctx.createLinearGradient(100, 0, WIDTH - 100, 0);
    btnGrad.addColorStop(0, '#2563EB');
    btnGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = btnGrad; ctx.fill();

    ctx.font = `bold 42px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('무료 교정 받으러 가기 ➔', WIDTH / 2, btnY + 80);

    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#2563EB';
    ctx.fillText('draft-ethan.vercel.app', WIDTH / 2, cardY + cardH - 50);

    drawBottomSubtitle(ctx, '프로필 링크 클릭시 100% 무료 교정!');
}

export async function generateShortsSlideImages(
    slides: CardNewsSlide[],
    outputDir: string
): Promise<string[]> {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const imagePaths: string[] = [];

    for (let i = 0; i < slides.length; i++) {
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');

        const slide = slides[i];
        if (slide.type === 'COVER') renderShortsCover(ctx, slide);
        else if (slide.type === 'BODY') renderShortsBody(ctx, slide);
        else if (slide.type === 'CTA') renderShortsCta(ctx, slide);
        else renderShortsBody(ctx, slide);

        const imgPath = path.join(outputDir, `shorts_frame_${i + 1}.jpg`);
        fs.writeFileSync(imgPath, canvas.toBuffer('image/jpeg', 95));
        imagePaths.push(imgPath);
    }

    return imagePaths;
}

// ─── TTS 음성 다운로드 (긴 문장 조각별 자동 분할 지원) ──────────────────────

async function generateTTSAudioForText(text: string, outputPath: string): Promise<string> {
    try {
        const cleanText = stripEmojis(text);
        if (!cleanText) return '';

        const chunks: string[] = [];
        let remaining = cleanText;
        while (remaining.length > 0) {
            if (remaining.length <= 180) {
                chunks.push(remaining);
                break;
            } {
                let cutIndex = remaining.lastIndexOf('.', 180);
                if (cutIndex === -1) cutIndex = remaining.lastIndexOf(' ', 180);
                if (cutIndex === -1) cutIndex = 180;
                chunks.push(remaining.substring(0, cutIndex + 1));
                remaining = remaining.substring(cutIndex + 1).trim();
            }
        }

        const buffers: Buffer[] = [];
        for (const chunk of chunks) {
            const url = getAudioUrl(chunk, {
                lang: 'ko',
                slow: false,
                host: 'https://translate.google.com'
            });
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            buffers.push(Buffer.from(response.data));
        }

        const finalBuffer = Buffer.concat(buffers);
        fs.writeFileSync(outputPath, finalBuffer);
        return outputPath;
    } catch (err: any) {
        console.warn('[ShortsRenderer] ⚠️ TTS 다운로드 경고:', err.message);
        return '';
    }
}

// ─── 오디오 파일 재생 시간 측정 (ffprobe) ─────────────────────────────────

function getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
        if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
            return resolve(5.0);
        }
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) {
                return resolve(5.0);
            }
            resolve(metadata.format.duration);
        });
    });
}

// ─── FFmpeg 9:16 쇼츠 동영상 (.mp4) 합성 ─────────────────────────────────────

export async function createShortsVideo(
    slides: CardNewsSlide[],
    outputDir: string = path.join(process.cwd(), 'output_shorts')
): Promise<string> {
    console.log('[ShortsRenderer] 🎬 9:16 세로 쇼츠 영상 렌더링 시작...');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. 9:16 슬라이드 이미지 3장 생성
    const framePaths = await generateShortsSlideImages(slides, outputDir);

    // 2. 슬라이드별 개별 TTS 및 전체 TTS 생성
    const audioPaths: string[] = [];
    const audioDurations: number[] = [];

    for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        let text = `${s.title}. ${s.subtitle || ''}. `;
        s.contentLines.forEach(l => text += `${l}. `);

        const aPath = path.join(outputDir, `tts_slide_${i + 1}.mp3`);
        await generateTTSAudioForText(text, aPath);
        const duration = await getAudioDuration(aPath);

        audioPaths.push(aPath);
        // 마지막 슬라이드는 말끝 잘림 방지를 위해 +2.5초 추가, 그 외 슬라이드는 +1.2초 여유 추가
        const padding = (i === slides.length - 1) ? 2.5 : 1.2;
        audioDurations.push(Math.max(4.0, duration + padding));
        console.log(`[ShortsRenderer] 🎤 슬라이드 ${i + 1} 음성 길이: ${duration.toFixed(1)}초 -> 비디오 재생시간: ${audioDurations[i].toFixed(1)}초`);
    }

    // 3. 개별 슬라이드 비디오 세그먼트 생성
    const segmentPaths: string[] = [];
    for (let i = 0; i < framePaths.length; i++) {
        const segPath = path.join(outputDir, `segment_${i + 1}.mp4`);
        const duration = audioDurations[i];

        await new Promise((resolve, reject) => {
            ffmpeg(framePaths[i])
                .loop(duration)
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-preset ultrafast',
                    '-r 30',
                    `-t ${duration}`
                ])
                .output(segPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        segmentPaths.push(segPath);
    }

    // 4. 비디오 세그먼트 Concat
    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const concatContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const mergedVideoPath = path.join(outputDir, 'video_merged.mp4');
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .output(mergedVideoPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    // 5. 전체 통합 음성 스크립트 생성 및 최종 합성 (apad=pad_dur=3으로 말끝 완벽 2.5초 보장)
    let fullScript = '';
    slides.forEach(s => {
        fullScript += `${s.title}. ${s.subtitle || ''}. `;
        s.contentLines.forEach(l => fullScript += `${l}. `);
    });

    const fullAudioPath = path.join(outputDir, 'tts_voice_full.mp3');
    await generateTTSAudioForText(fullScript, fullAudioPath);

    const finalShortsVideo = path.join(outputDir, 'youtube_shorts.mp4');
    const hasAudio = fs.existsSync(fullAudioPath) && fs.statSync(fullAudioPath).size > 0;

    return new Promise((resolve, reject) => {
        const cmd = ffmpeg().input(mergedVideoPath);

        if (hasAudio) {
            cmd.input(fullAudioPath);
            cmd.outputOptions([
                '-c:v copy',
                '-c:a aac',
                '-af apad=pad_dur=3', // 말 끝난 후 무조건 2.5~3초 여백 보장
                '-map 0:v:0',
                '-map 1:a:0',
                '-shortest'
            ]);
        } else {
            cmd.outputOptions(['-c copy']);
        }

        cmd.output(finalShortsVideo)
            .on('end', () => {
                console.log(`[ShortsRenderer] 🎉 자막 완벽 수용 + 말끝 2.5초 여유 쇼츠 비디오 완성!: ${finalShortsVideo}`);
                resolve(finalShortsVideo);
            })
            .on('error', (err) => {
                console.error('[ShortsRenderer] ❌ 오디오 합성 실패:', err.message);
                reject(err);
            })
            .run();
    });
}
