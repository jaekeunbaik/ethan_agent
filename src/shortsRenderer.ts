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
    const clean = stripEmojis(text);
    if (!clean) return [];

    const words = clean.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width <= maxWidth) {
            currentLine = testLine;
        } else {
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
            // 단어 자체가 maxWidth보다 클 경우 문자 단위로 강제 분할
            if (ctx.measureText(word).width > maxWidth) {
                let charLine = '';
                for (const char of word) {
                    if (ctx.measureText(charLine + char).width > maxWidth) {
                        lines.push(charLine);
                        charLine = char;
                    } else {
                        charLine += char;
                    }
                }
                currentLine = charLine;
            } else {
                currentLine = word;
            }
        }
    }
    if (currentLine) lines.push(currentLine);
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

// ─── 공통 헤드라인 & 형광 자막 배너 ──────────────────────────────────────────

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

// ─── 1. 커버 슬라이드 (Cover Slide) ──────────────────────────────────────────

function renderShortsCover(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawTopHeader(ctx, '⚡ 3초 만에 바뀌는 합격 자소서..!');

    const cardY = 280, cardH = 1100;
    roundRect(ctx, 60, cardY, WIDTH - 120, cardH, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.fill(); ctx.stroke();

    roundRect(ctx, WIDTH / 2 - 200, cardY + 60, 400, 70, 35);
    const badgeGrad = ctx.createLinearGradient(WIDTH / 2 - 200, 0, WIDTH / 2 + 200, 0);
    badgeGrad.addColorStop(0, '#2563EB');
    badgeGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = badgeGrad; ctx.fill();

    ctx.font = `bold 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 오늘의 AI 팩폭 레포트', WIDTH / 2, cardY + 107);

    ctx.font = `bold 72px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    const lines = wrapText(ctx, stripEmojis(slide.title), WIDTH - 200);
    let curY = cardY + 280;
    for (const l of lines) {
        ctx.fillText(l, WIDTH / 2, curY);
        curY += 100;
    }

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

        ctx.font = `bold 48px ${FONT_FAMILY}`;
        ctx.fillStyle = '#7C3AED';
        ctx.textAlign = 'center';
        ctx.fillText('⬇️ Draft Ethan AI 1:1 맞춤 교정 ⬇️', WIDTH / 2, bY + bH + 75);

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

    ctx.font = `bold 46px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    const tls = wrapText(ctx, slide.title, WIDTH - 240);
    let ty = cardY + 180;
    for (const tl of tls) { ctx.fillText(tl, WIDTH / 2, ty); ty += 68; }

    ctx.font = `32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText('지금 바로 3초 만에 AI 교정을 받아보세요!', WIDTH / 2, ty + 40);

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

// ─── TTS 음성 다운로드 ───────────────────────────────────────────────────────

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
            } else {
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
            return resolve(4.0);
        }
        ffmpeg.ffprobe(audioPath, (err: any, metadata: any) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) {
                return resolve(4.0);
            }
            resolve(metadata.format.duration);
        });
    });
}

// ─── FFmpeg 9:16 쇼츠 동영상 (.mp4) 합성 (슬라이드별 1:1 오디오 싱크 연동) ──

export async function createShortsVideo(
    slides: CardNewsSlide[],
    outputDir: string = path.join(process.cwd(), 'output_shorts')
): Promise<string> {
    console.log('[ShortsRenderer] 🎬 9:16 세로 쇼츠 영상 렌더링 시작 (슬라이드별 1:1 음성 싱크 적용)...');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // 1. 9:16 슬라이드 이미지 3장 생성
    const framePaths = await generateShortsSlideImages(slides, outputDir);

    // 2. 슬라이드별 개별 TTS 생성 및 해당 슬라이드 비디오 세그먼트 직접 합성
    const segmentPaths: string[] = [];

    for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        
        // 1) 출처 텍스트는 화면 하단에만 표시하고 음성(TTS)에서는 읽지 않도록 제외
        const cleanTitle = s.title.replace(/출처\s*:\s*.*$/gi, '').trim();
        const cleanSubtitle = (s.subtitle || '').replace(/출처\s*:\s*.*$/gi, '').trim();
        const readContentLines = s.contentLines.filter(l => !/출처/i.test(l));

        let speechText = `${cleanTitle}. ${cleanSubtitle}. `;
        readContentLines.forEach(l => speechText += `${l}. `);

        // 2) 'Ethan' / 'ETHAN' / '에단' 발음을 모두 확실하게 '[이든]'으로 변환
        speechText = speechText
            .replace(/Draft\s*Ethan/gi, '드래프트 이든')
            .replace(/드래프트\s*에단/gi, '드래프트 이든')
            .replace(/Ethan/gi, '이든')
            .replace(/에단/gi, '이든');

        const aPath = path.join(outputDir, `tts_slide_${i + 1}.mp3`);
        await generateTTSAudioForText(speechText, aPath);
        const rawDur = await getAudioDuration(aPath);

        // 슬라이드 1, 2는 음성 끝난 후 0.5초 여백, 마지막 CTA 슬라이드는 2.5초 여백 보장!
        const padding = (i === slides.length - 1) ? 2.5 : 0.6;
        const segDuration = Math.max(3.5, rawDur + padding);
        console.log(`[ShortsRenderer] 🎙️ 슬라이드 ${i + 1} TTS 음성: ${rawDur.toFixed(1)}초 -> 슬라이드 유지: ${segDuration.toFixed(1)}초`);

        const segPath = path.join(outputDir, `segment_${i + 1}.mp4`);
        const hasAudio = fs.existsSync(aPath) && fs.statSync(aPath).size > 0;

        await new Promise((resolve, reject) => {
            const cmd = ffmpeg(framePaths[i])
                .loop(segDuration);

            if (hasAudio) {
                cmd.input(aPath);
                cmd.outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-preset ultrafast',
                    '-c:a aac',
                    '-af', `apad=pad_dur=${padding}`, // 말 끝난 후 여유 여백 추가
                    '-map 0:v:0',
                    '-map 1:a:0',
                    '-r 30',
                    `-t ${segDuration}`
                ]);
            } else {
                cmd.outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-preset ultrafast',
                    '-r 30',
                    `-t ${segDuration}`
                ]);
            }

            cmd.output(segPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        segmentPaths.push(segPath);
    }

    // 3. 1:1 오디오가 매핑된 3개 슬라이드 동영상을 부드럽게 하나로 병합 (Concat)
    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const concatContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const finalShortsVideo = path.join(outputDir, 'youtube_shorts.mp4');

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .output(finalShortsVideo)
            .on('end', () => {
                console.log(`[ShortsRenderer] 🎉 슬라이드별 1:1 완벽 음성 싱크 쇼츠 동영상 완성!: ${finalShortsVideo}`);
                resolve(finalShortsVideo);
            })
            .on('error', (err) => {
                console.error('[ShortsRenderer] ❌ 세그먼트 병합 실패:', err.message);
                reject(err);
            })
            .run();
    });
}
