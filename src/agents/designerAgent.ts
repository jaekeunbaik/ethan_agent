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

// 카톡 단톡방 느낌의 아바타 색 (이름별 고정)
const AVATAR_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6', '#6366F1'];
const BG = '#B2C7D9';
const HEADER_H = 190;
const INPUT_H = 150;

interface Layout { msg: KatalkMessage; lines: string[]; bubbleW: number; bubbleH: number; showHead: boolean; totalH: number; }

function drawTail(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, color: string) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 14 * dir, y + 10);
    ctx.lineTo(x, y + 28);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

/**
 * 1080x1920 실제 카톡 단톡방 UI. 화면 전체를 대화가 채우고, 넘치면 위로 스크롤.
 * 광고/CTA 배너 없음 (광고는 고정 댓글로만). ctaQuiz는 하단 입력창 플레이스홀더로만 작게 표시.
 */
function renderKatalkFrame(ctx: CanvasRenderingContext2D, script: ScriptOutput, visibleCount: number) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const names: string[] = [];
    for (const m of script.messages) if (!names.includes(m.name)) names.push(m.name);
    const colorOf = (n: string) => AVATAR_COLORS[names.indexOf(n) % AVATAR_COLORS.length];

    // ── 메시지 레이아웃 ──
    const maxTextWidth = 620;
    const fontSize = 40, lineHeight = 56, padX = 28, padY = 20;
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    const layouts: Layout[] = [];
    script.messages.slice(0, visibleCount).forEach((msg, i, arr) => {
        const lines = wrapText(ctx, msg.text, maxTextWidth);
        const maxLine = Math.max(0, ...lines.map(l => ctx.measureText(l).width));
        const bubbleW = Math.max(110, maxLine + padX * 2);
        const bubbleH = lines.length * lineHeight + padY * 2;
        const showHead = msg.sender === 'other' && !(i > 0 && arr[i - 1].sender === 'other' && arr[i - 1].name === msg.name);
        const totalH = bubbleH + (showHead ? 44 : 0) + 22;
        layouts.push({ msg, lines, bubbleW, bubbleH, showHead, totalH });
    });

    // 마지막 메시지의 바닥이 입력창 바로 위에 오도록 스크롤 (위로 밀려 올라감)
    const bottomY = HEIGHT - INPUT_H - 24;
    const total = layouts.reduce((a, l) => a + l.totalH, 0);
    let curY = Math.min(HEADER_H + 30, bottomY - total);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HEADER_H, WIDTH, HEIGHT - HEADER_H - INPUT_H);
    ctx.clip();
    layouts.forEach((L, i) => {
        const { msg, lines, bubbleW, bubbleH, showHead } = L;
        // 같은 발신자 연속 묶음의 마지막 말풍선에만 시간 표시
        const next = layouts[i + 1];
        const showTime = !(next && next.msg.sender === msg.sender && next.msg.name === msg.name);
        const minute = 15 + Math.floor(i / 4);
        const timeStr = `오후 2:${String(minute).padStart(2, '0')}`;
        const prev = layouts[i - 1];
        const firstOfRun = !(prev && prev.msg.sender === msg.sender && prev.msg.name === msg.name);
        let bx: number, by: number, fill: string;
        if (msg.sender === 'other') {
            bx = 160;
            if (showHead) {
                ctx.beginPath();
                ctx.arc(85, curY + 40, 44, 0, Math.PI * 2);
                ctx.fillStyle = colorOf(msg.name);
                ctx.fill();
                ctx.font = `bold 38px ${FONT_FAMILY}`;
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.fillText(msg.name.substring(0, 1), 85, curY + 54);
                ctx.font = `26px ${FONT_FAMILY}`;
                ctx.fillStyle = '#3B4A59';
                ctx.textAlign = 'left';
                ctx.fillText(msg.name, bx, curY + 26);
            }
            by = curY + (showHead ? 44 : 0);
            fill = '#FFFFFF';
        } else {
            bx = WIDTH - 40 - bubbleW;
            by = curY;
            fill = '#FEE500';
        }
        roundRect(ctx, bx, by, bubbleW, bubbleH, 26);
        ctx.fillStyle = fill;
        ctx.fill();
        if (firstOfRun) {
            if (msg.sender === 'other') drawTail(ctx, bx, by + 6, 1, fill);
            else drawTail(ctx, bx + bubbleW, by + 6, -1, fill);
        }
        ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'left';
        lines.forEach((l, j) => ctx.fillText(l, bx + padX, by + padY + (j + 1) * lineHeight - 14));
        if (showTime) {
            ctx.font = `22px ${FONT_FAMILY}`;
            ctx.fillStyle = '#4B5B6B';
            if (msg.sender === 'other') { ctx.textAlign = 'left'; ctx.fillText(timeStr, bx + bubbleW + 14, by + bubbleH - 6); }
            else { ctx.textAlign = 'right'; ctx.fillText(timeStr, bx - 14, by + bubbleH - 6); }
        }
        curY += L.totalH;
    });
    ctx.restore();

    // ── 고정 헤더 (실제 카톡: 뒤로가기 / 방 제목 + 인원수 / 아이콘) ──
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEADER_H);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, HEADER_H - 2, WIDTH, 2);
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(70, 100); ctx.lineTo(48, 122); ctx.lineTo(70, 144); ctx.stroke();
    const title = stripEmojis(script.hookHeadline || script.title);
    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    const all = wrapText(ctx, title, 700);
    const tl = all.slice(0, 2);
    if (all.length > 2) tl[1] = tl[1].replace(/.$/, '…');
    tl.forEach((l, i) => ctx.fillText(l, 120, (tl.length === 1 ? 128 : 100) + i * 50));
    if (tl.length === 1) {
        const tw = ctx.measureText(tl[0]).width;
        ctx.font = `bold 32px ${FONT_FAMILY}`;
        ctx.fillStyle = '#6B7280';
        ctx.fillText(String(names.length), 120 + tw + 20, 128);
    }
    // 우측 아이콘 (돋보기, 메뉴)
    ctx.strokeStyle = '#1F2937'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(895, 118, 17, 0, Math.PI * 2); ctx.moveTo(907, 131); ctx.lineTo(922, 146); ctx.stroke();
    ctx.fillStyle = '#1F2937';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(1000, 100 + k * 18, 4.5, 0, Math.PI * 2); ctx.fill(); }

    // ── 하단 입력창 (화면 채우기용 UI; ctaQuiz는 작은 플레이스홀더로만) ──
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, HEIGHT - INPUT_H, WIDTH, INPUT_H);
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(0, HEIGHT - INPUT_H, WIDTH, 2);
    ctx.font = `bold 60px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'center';
    ctx.fillText('+', 60, HEIGHT - INPUT_H + 75);
    roundRect(ctx, 120, HEIGHT - INPUT_H + 30, WIDTH - 260, 76, 38);
    ctx.fillStyle = '#F3F4F6';
    ctx.fill();
    ctx.font = `26px ${FONT_FAMILY}`;
    ctx.fillStyle = '#9CA3AF';
    ctx.textAlign = 'left';
    const q = stripEmojis(script.ctaQuiz || '');
    ctx.fillText(q.length > 28 ? q.substring(0, 28) + '…' : q, 150, HEIGHT - INPUT_H + 78);
    roundRect(ctx, WIDTH - 125, HEIGHT - INPUT_H + 30, 90, 76, 38);
    ctx.fillStyle = '#FEE500';
    ctx.fill();
}

// 화자(이름)별 고정 음성. 처음 등장한 순서대로 배정. shortcut: edge-tts 한국어 음성이 3종뿐이라 4번째부터는 pitch만 다름.
const VOICES = [
    { v: 'ko-KR-SunHiNeural', p: '+0Hz' },
    { v: 'ko-KR-InJoonNeural', p: '+0Hz' },
    { v: 'ko-KR-HyunsuMultilingualNeural', p: '+0Hz' },
    { v: 'ko-KR-SunHiNeural', p: '+25Hz' },
    { v: 'ko-KR-InJoonNeural', p: '-25Hz' },
    { v: 'ko-KR-HyunsuMultilingualNeural', p: '+20Hz' },
];

async function generateTTSForMessage(msg: KatalkMessage, outputPath: string, voice: { v: string; p: string }): Promise<string> {
    const cleanText = stripEmojis(msg.text)
        .replace(/OK/gi, '오케이')
        .replace(/AI/gi, '에이아이')
        .replace(/ㅋ{2,}/g, '크크')
        .replace(/ㅎ{2,}/g, '하하')
        .replace(/ㅠ{2,}|ㅜ{2,}/g, '흑흑');

    if (!cleanText) return '';

    try {
        const { execFileSync } = require('child_process');
        execFileSync('python', ['-m', 'edge_tts', '--voice', voice.v, '--rate=+35%', `--pitch=${voice.p}`, '--text', cleanText, '--write-media', outputPath], { stdio: 'pipe' });
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return outputPath;
    } catch {
        // Edge-TTS 미설치 시 폴백
    }

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

// edge-tts 앞뒤 무음 제거 (긴 침묵 방지). 실패하면 원본 유지.
async function trimSilence(p: string): Promise<boolean> {
    const out = p.replace(/\.mp3$/, '_t.mp3');
    const f = 'silenceremove=start_periods=1:start_threshold=-40dB';
    try {
        await new Promise((res, rej) => ffmpeg(p).audioFilters([f, 'areverse', f, 'areverse']).output(out).on('end', res).on('error', rej).run());
        if (fs.statSync(out).size > 0) fs.renameSync(out, p);
    } catch { /* keep original */ }
    return fs.existsSync(p);
}

function getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) return resolve(1.2);
            resolve(metadata.format.duration);
        });
    });
}

/**
 * DesignerAgent: 말풍선이 하나씩 등장하고(메시지당 음성 길이 기준 1~1.5초), 등장 순간 해당 화자 음성이 나오는 9:16 쇼츠.
 */
export async function runDesignerAgent(
    script: ScriptOutput,
    outputDir: string = path.join(process.cwd(), 'output_shorts')
): Promise<RenderOutput> {
    console.log('\n[DesignerAgent] 1080x1920 세로형 카톡 쇼츠 비디오 렌더링 시작...');
    outputDir = path.resolve(outputDir);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const segmentPaths: string[] = [];
    let totalDuration = 0;
    const speakers: string[] = [];

    for (let i = 0; i < script.messages.length; i++) {
        const msg = script.messages[i];

        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');
        renderKatalkFrame(ctx, script, i + 1);
        const imgPath = path.join(outputDir, `frame_${i + 1}.jpg`);
        fs.writeFileSync(imgPath, canvas.toBuffer('image/jpeg', 92));

        if (!speakers.includes(msg.name)) speakers.push(msg.name);
        const aPath = path.join(outputDir, `tts_${i + 1}.mp3`);
        await generateTTSForMessage(msg, aPath, VOICES[speakers.indexOf(msg.name) % VOICES.length]);
        let hasAudio = fs.existsSync(aPath) && fs.statSync(aPath).size > 0;
        if (hasAudio) hasAudio = await trimSilence(aPath);
        const rawDur = hasAudio ? await getAudioDuration(aPath) : 0;
        const segDuration = Math.max(0.9, rawDur + 0.2);
        totalDuration += segDuration;

        const segPath = path.join(outputDir, `segment_${i + 1}.mp4`);
        await new Promise((resolve, reject) => {
            const cmd = ffmpeg(imgPath).loop(segDuration);
            const common = ['-c:v libx264', '-pix_fmt yuv420p', '-preset ultrafast', '-r 30', `-t ${segDuration}`];
            if (hasAudio) {
                // apad로 오디오를 영상 길이(-t)까지 채워 세그먼트 싱크 유지
                cmd.input(aPath).outputOptions([...common, '-c:a aac', '-ar 44100', '-ac 2', '-af', 'apad', '-map 0:v:0', '-map 1:a:0']);
            } else {
                cmd.input('anullsrc=r=44100:cl=stereo').inputFormat('lavfi')
                    .outputOptions([...common, '-c:a aac', '-map 0:v:0', '-map 1:a:0']);
            }
            cmd.output(segPath).on('end', resolve).on('error', reject).run();
        });
        segmentPaths.push(segPath);
    }

    const concatListPath = path.join(outputDir, 'segments_list.txt');
    fs.writeFileSync(concatListPath, segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalVideo = path.join(outputDir, `KatalkViral_${timestamp}.mp4`);

    // 영상은 복사, 음량은 loudnorm으로 크고 일정하게
    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c:v copy', '-c:a aac', '-b:a 160k', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7'])
            .output(finalVideo)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    console.log(`[DesignerAgent] 비디오 렌더링 완료! (길이: 약 ${Math.round(totalDuration)}초, 경로: ${finalVideo})`);

    return {
        videoPath: finalVideo,
        durationSeconds: Math.round(totalDuration),
        thumbnailPath: path.join(outputDir, 'frame_1.jpg')
    };
}
