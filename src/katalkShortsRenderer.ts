import { createCanvas, CanvasRenderingContext2D } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import { getAudioUrl } from 'google-tts-api';
import { KatalkScriptResponse, KatalkChatMessage } from './katalkContentGenerator';

const WIDTH = 1080;
const HEIGHT = 1920;
const FONT_FAMILY = 'NanumGothic, "Malgun Gothic", sans-serif';

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

// ─── 카카오톡 채팅 화면 렌더링 ───────────────────────────────────────────────

export function renderKatalkFrame(
    ctx: CanvasRenderingContext2D,
    script: KatalkScriptResponse,
    visibleCount: number
) {
    // 배경색: 카카오톡 시그니처 연파랑 배경 (#BACEE0)
    ctx.fillStyle = '#BACEE0';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // 상단 노란색 헤더 (#FEE500)
    ctx.fillStyle = '#FEE500';
    ctx.fillRect(0, 0, WIDTH, 180);

    // 헤더 타이틀 (상대방 이름 또는 썰 제목)
    const otherName = script.messages.find(m => m.sender === 'other')?.name || '팀장님';
    ctx.font = `bold 44px ${FONT_FAMILY}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(otherName, WIDTH / 2, 115);

    // 하단 카톡 서류/CTA 안내 배너 (#FFFFFF)
    const btmH = 220;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, HEIGHT - btmH, WIDTH, btmH);

    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#2563EB';
    ctx.textAlign = 'center';
    ctx.fillText('3초 만에 합격 자소서 만드는 치트키 >', WIDTH / 2, HEIGHT - btmH + 80);

    ctx.font = `bold 32px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(stripEmojis(script.ctaText).substring(0, 32), WIDTH / 2, HEIGHT - btmH + 150);

    // ─── 대화 메세지 말풍선 그리기 ─────────────────────────────────────────

    let curY = 240;
    const messagesToDraw = script.messages.slice(0, visibleCount);

    for (let i = 0; i < messagesToDraw.length; i++) {
        const msg = messagesToDraw[i];
        const cleanMsg = stripEmojis(msg.text);

        ctx.font = `bold 38px ${FONT_FAMILY}`;
        const textMetrics = ctx.measureText(cleanMsg);
        const textW = Math.min(textMetrics.width, WIDTH - 400);
        const bubbleW = textW + 60;
        const bubbleH = 90;

        if (msg.sender === 'other') {
            // [상대방 메세지 - 좌측 흰색 말풍선]
            // 1) 프로필 동그라미
            ctx.beginPath();
            ctx.arc(90, curY + 45, 40, 0, Math.PI * 2);
            ctx.fillStyle = '#99AAB5';
            ctx.fill();

            // 프로필 텍스트
            ctx.font = `bold 30px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(msg.name.substring(0, 1), 90, curY + 55);

            // 2) 이름
            ctx.font = `26px ${FONT_FAMILY}`;
            ctx.fillStyle = '#4A5568';
            ctx.textAlign = 'left';
            ctx.fillText(msg.name, 150, curY + 20);

            // 3) 말풍선
            roundRect(ctx, 150, curY + 30, bubbleW, bubbleH, 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            // 4) 메세지 텍스트
            ctx.font = `bold 36px ${FONT_FAMILY}`;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.fillText(cleanMsg, 180, curY + 88);

            curY += bubbleH + 60;
        } else {
            // [내 메세지 - 우측 노란색 말풍선 #FEE500]
            const bubbleX = WIDTH - 60 - bubbleW;

            // 1) 읽음 표시 '1' & 시간
            ctx.font = `bold 24px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFEB3B';
            ctx.textAlign = 'right';
            ctx.fillText('1', bubbleX - 15, curY + 45);

            ctx.font = `22px ${FONT_FAMILY}`;
            ctx.fillStyle = '#718096';
            ctx.fillText('오후 2:15', bubbleX - 15, curY + 75);

            // 2) 노란색 말풍선
            roundRect(ctx, bubbleX, curY + 10, bubbleW, bubbleH, 20);
            ctx.fillStyle = '#FEE500';
            ctx.fill();

            // 3) 메세지 텍스트
            ctx.font = `bold 36px ${FONT_FAMILY}`;
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.fillText(cleanMsg, bubbleX + 30, curY + 68);

            curY += bubbleH + 45;
        }
    }
}

// ─── TTS 음성 다운로드 ───────────────────────────────────────────────────────

async function generateTTSForMessage(msg: KatalkChatMessage, outputPath: string): Promise<string> {
    try {
        const cleanText = stripEmojis(msg.text)
            .replace(/BEFORE/gi, '비포')
            .replace(/AFTER/gi, '애프터')
            .replace(/Draft\s*Ethan/gi, '드래프트 이든')
            .replace(/Ethan/gi, '이든')
            .replace(/에단/g, '이든')
            .replace(/AI/gi, '에이아이');

        if (!cleanText) return '';

        // 성별/캐릭터에 맞춘 2인 성우 분이
        const voice = msg.sender === 'other' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';

        const { execSync } = require('child_process');
        execSync(`python -m edge_tts --voice ${voice} --rate=+20% --text ${JSON.stringify(cleanText)} --write-media ${JSON.stringify(outputPath)}`);

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            return outputPath;
        }
    } catch (e: any) {
        // 폴백 Google TTS
        const cleanText = stripEmojis(msg.text);
        const url = getAudioUrl(cleanText, { lang: 'ko', slow: false });
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(outputPath, Buffer.from(res.data));
        return outputPath;
    }
    return '';
}

function getAudioDuration(audioPath: string): Promise<number> {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
            if (err || !metadata || !metadata.format || !metadata.format.duration) {
                return resolve(2.5);
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

        // 2) TTS 음성 생성
        const aPath = path.join(outputDir, `katalk_tts_${i + 1}.mp3`);
        await generateTTSForMessage(msg, aPath);
        const rawDur = await getAudioDuration(aPath);
        const segDuration = Math.max(1.8, rawDur + 0.3);

        // 3) 세그먼트 MP4 비디오 합성
        const segPath = path.join(outputDir, `katalk_segment_${i + 1}.mp4`);
        const totalFrames = Math.ceil(segDuration * 30);
        const zoomFilter = `zoompan=z='min(zoom+0.001,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=30`;

        await new Promise((resolve, reject) => {
            const cmd = ffmpeg(imgPath).loop(segDuration);
            if (fs.existsSync(aPath) && fs.statSync(aPath).size > 0) {
                cmd.input(aPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-pix_fmt yuv420p',
                        '-preset ultrafast',
                        '-vf', zoomFilter,
                        '-c:a aac',
                        '-af', 'apad=pad_dur=0.3',
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
                    '-vf', zoomFilter,
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
