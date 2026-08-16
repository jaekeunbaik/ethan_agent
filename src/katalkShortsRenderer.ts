import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
// @ts-ignore
import ffprobePath from 'ffprobe-static';
import axios from 'axios';
import { getAudioUrl } from 'google-tts-api';
import { KatalkScriptResponse, KatalkChatMessage } from './katalkContentGenerator';

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

// 텍스트 줄바꿈 계산 함수 (말풍선 벗어남 100% 방지)
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
            // 단어 자체가 maxWidth보다 클 경우 글자 단위로 분할
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
    msg: KatalkChatMessage;
    cleanMsg: string;
    lines: string[];
    bubbleW: number;
    bubbleH: number;
    totalH: number;
}

// ─── 카카오톡 채팅 화면 렌더링 ───────────────────────────────────────────────

export function renderKatalkFrame(
    ctx: CanvasRenderingContext2D,
    script: KatalkScriptResponse,
    visibleCount: number
) {
    // 1. 배경색: 카카오톡 시그니처 연파랑 배경 (#BACEE0)
    ctx.fillStyle = '#BACEE0';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 2. 상단 노란색 헤더 (#FEE500)
    const headerH = 190;
    ctx.fillStyle = '#FEE500';
    ctx.fillRect(0, 0, WIDTH, headerH);

    // 상단 뒤로가기 아이콘 모양
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(60, 115);
    ctx.lineTo(85, 95);
    ctx.lineTo(85, 135);
    ctx.closePath();
    ctx.fill();

    // 헤더 타이틀 (상대방 이름 또는 썰 제목)
    const otherName = script.messages.find(m => m.sender === 'other')?.name || '팀장님';
    ctx.font = `bold 46px ${FONT_FAMILY}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(otherName, WIDTH / 2, 125);

    // 3. 하단 디든(dethan) CTA 배너 (#FFFFFF)
    const btmH = 220;
    const btmY = HEIGHT - btmH;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, btmY, WIDTH, btmH);

    // 배너 상단 구분선
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, btmY, WIDTH, 3);

    // CTA 뱃지 버튼
    roundRect(ctx, WIDTH / 2 - 320, btmY + 25, 640, 75, 38);
    const grad = ctx.createLinearGradient(WIDTH / 2 - 320, 0, WIDTH / 2 + 320, 0);
    grad.addColorStop(0, '#2563EB');
    grad.addColorStop(1, '#4F46E5');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.font = `bold 34px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('3초 만에 합격 자소서 만드는 치트키 >', WIDTH / 2, btmY + 74);

    ctx.font = `bold 30px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    const ctaText = stripEmojis(script.ctaText || '디든(dethan)에서 3초 무료 AI 자소서 진단 받자!');
    ctx.fillText(ctaText.substring(0, 36), WIDTH / 2, btmY + 155);

    // ─── 대화 메세지 크기 사전 계산 및 동적 오토 스크롤 ───────────────────
    const maxTextWidth = WIDTH - 420; // 660px
    const fontSize = 36;
    const lineHeight = 50;
    const padX = 28;
    const padY = 22;

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
        const bubbleW = Math.max(120, maxLineWidth + padX * 2);
        const bubbleH = Math.max(70, lines.length * lineHeight + padY * 2 - 10);
        const totalH = msg.sender === 'other' ? bubbleH + 65 : bubbleH + 40;
        return { msg, cleanMsg, lines, bubbleW, bubbleH, totalH };
    });

    // 화면 사용 가능 높이 (헤더 190 ~ 하단 배너 1700 사이: 약 1510px)
    const availableH = btmY - headerH - 60;
    let totalMessagesH = layouts.reduce((acc, cur) => acc + cur.totalH, 0);

    let startY = headerH + 40;
    if (totalMessagesH > availableH) {
        // 최신 메세지가 화면 아래 배너에 가려지지 않도록 위로 부드럽게 스크롤
        startY = headerH + 40 - (totalMessagesH - availableH);
    }

    // ─── 대화 메세지 말풍선 그리기 ─────────────────────────────────────────
    let curY = startY;

    for (let i = 0; i < layouts.length; i++) {
        const item = layouts[i];
        const { msg, lines, bubbleW, bubbleH } = item;

        // 클리핑 영역: 헤더 아래 ~ 하단 배너 위만 출력되도록 처리
        if (curY + bubbleH < headerH - 50) {
            curY += item.totalH;
            continue;
        }

        if (msg.sender === 'other') {
            // [상대방 메세지 - 좌측 흰색 말풍선]
            // 1) 프로필 아바타 원형
            ctx.beginPath();
            ctx.arc(85, curY + 45, 42, 0, Math.PI * 2);
            ctx.fillStyle = '#94A3B8';
            ctx.fill();

            // 프로필 첫 글자
            ctx.font = `bold 32px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(msg.name.substring(0, 1) || '팀', 85, curY + 56);

            // 2) 발신자 이름
            ctx.font = `bold 26px ${FONT_FAMILY}`;
            ctx.fillStyle = '#334155';
            ctx.textAlign = 'left';
            ctx.fillText(msg.name, 145, curY + 18);

            // 3) 말풍선 배경
            const bubbleX = 145;
            const bubbleY = curY + 30;
            roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // 말풍선 꼬리표 (좌측 방향)
            ctx.beginPath();
            ctx.moveTo(bubbleX, bubbleY + 16);
            ctx.lineTo(bubbleX - 10, bubbleY + 24);
            ctx.lineTo(bubbleX, bubbleY + 32);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // 4) 메세지 텍스트 (다중 행)
            ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
            ctx.fillStyle = '#0F172A';
            ctx.textAlign = 'left';
            for (let l = 0; l < lines.length; l++) {
                ctx.fillText(lines[l], bubbleX + padX, bubbleY + padY + (l + 0.75) * lineHeight);
            }

            // 5) 전송 시간
            ctx.font = `22px ${FONT_FAMILY}`;
            ctx.fillStyle = '#64748B';
            ctx.textAlign = 'left';
            ctx.fillText('오후 2:15', bubbleX + bubbleW + 12, bubbleY + bubbleH - 10);

            curY += item.totalH;
        } else {
            // [내 메세지 - 우측 노란색 말풍선 #FEE500]
            const bubbleX = WIDTH - 55 - bubbleW;
            const bubbleY = curY + 10;

            // 1) 읽음 표시 '1' & 시간
            ctx.font = `bold 24px ${FONT_FAMILY}`;
            ctx.fillStyle = '#F59E0B';
            ctx.textAlign = 'right';
            ctx.fillText('1', bubbleX - 14, bubbleY + bubbleH - 34);

            ctx.font = `22px ${FONT_FAMILY}`;
            ctx.fillStyle = '#64748B';
            ctx.fillText('오후 2:15', bubbleX - 14, bubbleY + bubbleH - 10);

            // 2) 노란색 말풍선
            roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 20);
            ctx.fillStyle = '#FEE500';
            ctx.fill();

            // 말풍선 꼬리표 (우측 방향)
            ctx.beginPath();
            ctx.moveTo(bubbleX + bubbleW, bubbleY + 16);
            ctx.lineTo(bubbleX + bubbleW + 10, bubbleY + 24);
            ctx.lineTo(bubbleX + bubbleW, bubbleY + 32);
            ctx.fillStyle = '#FEE500';
            ctx.fill();

            // 3) 메세지 텍스트 (다중 행)
            ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
            ctx.fillStyle = '#0F172A';
            ctx.textAlign = 'left';
            for (let l = 0; l < lines.length; l++) {
                ctx.fillText(lines[l], bubbleX + padX, bubbleY + padY + (l + 0.75) * lineHeight);
            }

            curY += item.totalH;
        }
    }
}

// ─── TTS 음성 다운로드 ───────────────────────────────────────────────────────

async function generateTTSForMessage(msg: KatalkChatMessage, outputPath: string): Promise<string> {
    const cleanText = stripEmojis(msg.text)
        .replace(/디든\s*\([^\)]*\)/gi, '디든')
        .replace(/\([Dd]ethan\)/gi, '')
        .replace(/\(디든\)/gi, '')
        .replace(/\([a-zA-Z0-9\s_.-]+\)/g, '')
        .replace(/BEFORE/gi, '비포')
        .replace(/AFTER/gi, '애프터')
        .replace(/Draft\s*Ethan/gi, '디든')
        .replace(/드래프트\s*이든/gi, '디든')
        .replace(/드래프트\s*에단/gi, '디든')
        .replace(/dethan/gi, '디든')
        .replace(/Ethan/gi, '디든')
        .replace(/에단/g, '디든')
        .replace(/AI/gi, '에이아이');

    if (!cleanText) return '';

    // 1. Edge TTS 시도 (빠른 호흡의 숏폼 속도 +32%)
    try {
        const voice = msg.sender === 'other' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
        const { execSync } = require('child_process');
        execSync(`python -m edge_tts --voice ${voice} --rate=+32% --text ${JSON.stringify(cleanText)} --write-media ${JSON.stringify(outputPath)}`, { stdio: 'pipe' });

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return outputPath;
        }
    } catch {
        // Edge TTS 미설치 시 폴백
    }

    // 2. Google TTS 폴백 (atempo=1.28배속 가속 처리로 빠르고 타이트한 숏폼 호흡)
    try {
        const rawGooglePath = outputPath.replace(/\.mp3$/, '_raw.mp3');
        const url = getAudioUrl(cleanText, { lang: 'ko', slow: false });
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(rawGooglePath, Buffer.from(res.data));

        // ffmpeg로 오디오를 1.28배속(빠른 구어체 속도)으로 가속
        await new Promise((resolve) => {
            ffmpeg(rawGooglePath)
                .audioFilters('atempo=1.28')
                .output(outputPath)
                .on('end', () => {
                    if (fs.existsSync(rawGooglePath)) fs.unlinkSync(rawGooglePath);
                    resolve(true);
                })
                .on('error', () => {
                    // 오류 시 원본 그대로 사용
                    if (fs.existsSync(rawGooglePath)) {
                        fs.renameSync(rawGooglePath, outputPath);
                    }
                    resolve(true);
                })
                .run();
        });

        return outputPath;
    } catch (err: any) {
        console.warn(`[KatalkShortsRenderer] TTS 생성 실패: ${err.message}`);
    }

    return '';
}

function getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) {
                return resolve(2.0);
            }
            resolve(metadata.format.duration);
        });
    });
}

// ─── 9:16 카톡 쇼츠 비디오 렌더링 ──────────────────────────────────────────

export async function createKatalkShortsVideo(
    script: KatalkScriptResponse,
    outputDir: string = path.join(process.cwd(), 'output_shorts')
): Promise<string> {
    console.log('[KatalkShortsRenderer] 🎬 카카오톡 썰 모션 쇼츠 영상 렌더링 시작...');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const segmentPaths: string[] = [];

    for (let i = 0; i < script.messages.length; i++) {
        const msg = script.messages[i];

        // 1) 비주얼 프레임 이미지 생성 (1번 메세지부터 i+1번째 메세지까지 차례로 나옴)
        const canvas = createCanvas(WIDTH, HEIGHT);
        const ctx = canvas.getContext('2d');
        renderKatalkFrame(ctx, script, i + 1);

        const imgPath = path.join(outputDir, `katalk_frame_${i + 1}.jpg`);
        fs.writeFileSync(imgPath, canvas.toBuffer('image/jpeg', 95));

        // 2) TTS 음성 생성 (빠른 호흡)
        const aPath = path.join(outputDir, `katalk_tts_${i + 1}.mp3`);
        await generateTTSForMessage(msg, aPath);
        const rawDur = await getAudioDuration(aPath);
        // 대화 간 여백을 0.12초로 타이트하게 줄여 빠른 숏폼 템포 유지
        const segDuration = Math.max(1.3, rawDur + 0.12);

        // 3) 세그먼트 MP4 비디오 합성 (줌 리셋으로 인한 덜컹거림 제거하여 안정적 렌더링)
        const segPath = path.join(outputDir, `katalk_segment_${i + 1}.mp4`);

        await new Promise((resolve, reject) => {
            const cmd = ffmpeg(imgPath).loop(segDuration);
            if (fs.existsSync(aPath) && fs.statSync(aPath).size > 0) {
                cmd.input(aPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-pix_fmt yuv420p',
                        '-preset ultrafast',
                        '-c:a aac',
                        '-af', 'apad=pad_dur=0.25',
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

    // 4. 모든 대화 세그먼트 Concat 병합
    const concatListPath = path.join(outputDir, 'katalk_concat.txt');
    const concatContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const finalVideo = path.join(outputDir, 'youtube_shorts.mp4');

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

    console.log(`[KatalkShortsRenderer] 🎉 카카오톡 썰 쇼츠 비디오 완성!: ${finalVideo}`);
    return finalVideo;
}
