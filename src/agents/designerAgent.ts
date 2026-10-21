import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
// @ts-ignore
import ffprobePath from 'ffprobe-static';
import axios from 'axios';
import { getAudioUrl } from 'google-tts-api';
import { ScriptOutput, KatalkMessage, RenderOutput } from './types';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath && (ffprobePath.path || ffprobePath)) {
    ffmpeg.setFfprobePath(ffprobePath.path || ffprobePath);
}

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT_FAMILY = '"NanumGothic", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

function stripEmojis(text: string): string {
    if (!text) return '';
    return text
        .replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, '')
        .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2018-\u201F]|\uD83E[\uDD10-\uDDFF]/g, '')
        .replace(/[⚡🔥❌✅⬇️⬆️🎉👉📈📊🎁📰📌🤫🎭💥🤖➔]/g, '')
        .trim();
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

interface MessageLayout {
    msg: KatalkMessage;
    lines: string[];
    bubbleW: number;
    bubbleH: number;
    totalH: number;
}

/**
 * 1080x1920 세로형 카카오톡 비주얼 프레임 렌더링
 * - 상단: 시선 강탈 고대비 후킹 배너 (초반 1~2초 이탈 방지)
 * - 중앙: 카카오톡 대화 말풍선 + 스크롤
 * - 하단: 댓글 유도 퀴즈(CTA) 및 투표 박스
 */
function renderKatalkFrame(
    ctx: CanvasRenderingContext2D,
    script: ScriptOutput,
    visibleCount: number
) {
    // 1. 전체 배경: 카카오톡 클래식 연파랑 (#BACEE0)
    ctx.fillStyle = '#BACEE0';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 2. 상단 헤더 영역 (높이 260px)
    const headerH = 260;
    ctx.fillStyle = '#FEE500'; // 카카오 옐로우
    ctx.fillRect(0, 0, WIDTH, headerH);

    // 2-1. 상단 타이틀 바: 상대방 이름 & 카톡 아이콘
    const otherName = script.messages.find(m => m.sender === 'other')?.name || '상대방';
    ctx.font = `bold 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#1E293B';
    ctx.textAlign = 'center';
    ctx.fillText(`💬 ${otherName}과의 대화`, WIDTH / 2, 75);

    // 2-2. 🚨 상단 시선 강탈 고대비 후킹 배너 (블랙 둥근 박스 + 옐로우/화이트 텍스트)
    roundRect(ctx, 40, 115, WIDTH - 80, 115, 24);
    ctx.fillStyle = '#0F172A';
    ctx.fill();

    ctx.font = `bold 42px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FACC15'; // 눈에 확 띄는 골드 옐로우
    ctx.textAlign = 'center';
    const bannerText = stripEmojis(script.hookHeadline);
    ctx.fillText(bannerText.length > 22 ? bannerText.substring(0, 22) + '...' : bannerText, WIDTH / 2, 188);

    // 3. 하단 댓글 유도 CTA 배너 (높이 220px)
    const btmH = 230;
    const btmY = HEIGHT - btmH;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, btmY, WIDTH, btmH);

    // 상단 얇은 라인
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(0, btmY, WIDTH, 3);

    // 댓글 유도 버튼
    roundRect(ctx, 50, btmY + 25, WIDTH - 100, 80, 40);
    const grad = ctx.createLinearGradient(50, 0, WIDTH - 50, 0);
    grad.addColorStop(0, '#EF4444');
    grad.addColorStop(1, '#F97316');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('🔥 당신의 생각은? 댓글로 투표해주세요! >', WIDTH / 2, btmY + 77);

    // 퀴즈 서브 텍스트
    ctx.font = `bold 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#334155';
    const ctaText = stripEmojis(script.ctaQuiz);
    ctx.fillText(ctaText.substring(0, 34), WIDTH / 2, btmY + 165);

    // 4. 대화 메시지 레이아웃 계산
    const maxTextWidth = WIDTH - 420;
    const fontSize = 38;
    const lineHeight = 54;
    const padX = 30;
    const padY = 24;

    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;

    const messagesToDraw = script.messages.slice(0, visibleCount);
    const layouts: MessageLayout[] = messagesToDraw.map(msg => {
        const cleanMsg = stripEmojis(msg.text);
        const lines = wrapText(ctx, cleanMsg, maxTextWidth);
        let maxLineWidth = 0;
        for (const line of lines) {
            const w = ctx.measureText(line).width;
            if (w > maxLineWidth) maxLineWidth = w;
        }
        const bubbleW = Math.max(140, maxLineWidth + padX * 2);
        const bubbleH = Math.max(76, lines.length * lineHeight + padY * 2 - 10);
        const totalH = msg.sender === 'other' ? bubbleH + 68 : bubbleH + 42;
        return { msg, lines, bubbleW, bubbleH, totalH };
    });

    const availableH = btmY - headerH - 60;
    let totalMessagesH = layouts.reduce((acc, cur) => acc + cur.totalH, 0);

    let startY = headerH + 40;
    if (totalMessagesH > availableH) {
        startY = headerH + 40 - (totalMessagesH - availableH);
    }

    let curY = startY;

    for (let i = 0; i < layouts.length; i++) {
        const item = layouts[i];
        const { msg, lines, bubbleW, bubbleH } = item;

        if (curY + bubbleH < headerH - 30) {
            curY += item.totalH;
            continue;
        }

        if (msg.sender === 'other') {
            // [상대방: 좌측 아바타 + 화이트 말풍선]
            ctx.beginPath();
            ctx.arc(85, curY + 45, 42, 0, Math.PI * 2);
            ctx.fillStyle = '#64748B';
            ctx.fill();

            ctx.font = `bold 32px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(msg.name.substring(0, 1) || '상', 85, curY + 56);

            ctx.font = `bold 28px ${FONT_FAMILY}`;
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'left';
            ctx.fillText(msg.name, 145, curY + 20);

            const bubbleX = 145;
            const bubbleY = curY + 36;
            roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // 텍스트 출력
            ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
            ctx.fillStyle = '#0F172A';
            ctx.textAlign = 'left';
            for (let j = 0; j < lines.length; j++) {
                ctx.fillText(lines[j], bubbleX + padX, bubbleY + padY + (j + 1) * lineHeight - 14);
            }

        } else {
            // [나: 우측 카카오 옐로우 말풍선]
            const bubbleX = WIDTH - 60 - bubbleW;
            const bubbleY = curY;

            roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 20);
            ctx.fillStyle = '#FEE500';
            ctx.fill();

            ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
            ctx.fillStyle = '#0F172A';
            ctx.textAlign = 'left';
            for (let j = 0; j < lines.length; j++) {
                ctx.fillText(lines[j], bubbleX + padX, bubbleY + padY + (j + 1) * lineHeight - 14);
            }
        }

        curY += item.totalH;
    }
}

/**
 * 2인 분리 음성 TTS 생성 (Edge-TTS 고속 생성 + Google TTS 자동 폴백)
 */
async function generateTTSForMessage(msg: KatalkMessage, outputPath: string): Promise<string> {
    const cleanText = stripEmojis(msg.text)
        .replace(/OK/gi, '오케이')
        .replace(/AI/gi, '에이아이');

    if (!cleanText) return '';

    // 1. Edge-TTS 시도 (+28% 빠른 속도감)
    try {
        const voice = msg.sender === 'other' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
        const { execSync } = require('child_process');
        execSync(`python -m edge_tts --voice ${voice} --rate=+28% --text ${JSON.stringify(cleanText)} --write-media ${JSON.stringify(outputPath)}`, { stdio: 'pipe' });

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return outputPath;
        }
    } catch {
        // Edge-TTS 미설치 시 폴백
    }

    // 2. Google TTS 폴백
    try {
        const rawPath = outputPath.replace(/\.mp3$/, '_raw.mp3');
        const url = getAudioUrl(cleanText, { lang: 'ko', slow: false });
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(rawPath, Buffer.from(res.data));

        await new Promise((resolve) => {
            ffmpeg(rawPath)
                .audioFilters('atempo=1.25')
                .output(outputPath)
                .on('end', () => {
                    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
                    resolve(true);
                })
                .on('error', () => {
                    if (fs.existsSync(rawPath)) fs.renameSync(rawPath, outputPath);
                    resolve(true);
                })
                .run();
        });

        return outputPath;
    } catch (err: any) {
        console.warn(`[DesignerAgent] TTS 생성 실패: ${err.message}`);
    }

    return '';
}

function getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) {
                return resolve(1.8);
            }
            resolve(metadata.format.duration);
        });
    });
}

/**
 * 🎨 DesignerAgent (디자인/렌더링 에이전트)
 * - 세로형 9:16 카카오톡 썰 쇼츠 비디오 렌더링 및 음성 믹싱 완수
 */
export async function runDesignerAgent(
    script: ScriptOutput,
    outputDir: string = path.join(process.cwd(), 'output_shorts')
): Promise<RenderOutput> {
    console.log('\n[🎨 DesignerAgent] 1080x1920 세로형 카톡 쇼츠 비디오 렌더링 시작...');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const segmentPaths: string[] = [];
    let totalDuration = 0;

    for (let i = 0; i < script.messages.length; i++) {
        const msg = script.messages[i];

        // 1) 비주얼 프레임 이미지 렌더링
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');
        renderKatalkFrame(ctx, script, i + 1);

        const imgPath = path.join(outputDir, `frame_${i + 1}.jpg`);
        fs.writeFileSync(imgPath, canvas.toBuffer('image/jpeg', 95));

        // 2) TTS 음성 생성
        const aPath = path.join(outputDir, `tts_${i + 1}.mp3`);
        await generateTTSForMessage(msg, aPath);
        const rawDur = await getAudioDuration(aPath);
        const segDuration = Math.max(1.2, rawDur + 0.1);
        totalDuration += segDuration;

        // 3) 세그먼트 비디오 생성
        const segPath = path.join(outputDir, `segment_${i + 1}.mp4`);

        await new Promise((resolve, reject) => {
            const cmd = ffmpeg(imgPath).loop(segDuration);
            if (fs.existsSync(aPath) && fs.statSync(aPath).size > 0) {
                cmd.input(aPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-pix_fmt yuv420p',
                        '-preset ultrafast',
                        '-c:a aac',
                        '-af', 'apad=pad_dur=0.2',
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

    // 4. 세그먼트 Concat 병합
    const concatListPath = path.join(outputDir, 'segments_list.txt');
    const concatContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalVideo = path.join(outputDir, `KatalkViral_${timestamp}.mp4`);

    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .output(finalVideo)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    console.log(`[DesignerAgent] ✅ 비디오 렌더링 완료! (길이: 약 ${Math.round(totalDuration)}초, 경로: ${finalVideo})`);

    return {
        videoPath: finalVideo,
        durationSeconds: Math.round(totalDuration),
        thumbnailPath: path.join(outputDir, 'frame_1.jpg')
    };
}
