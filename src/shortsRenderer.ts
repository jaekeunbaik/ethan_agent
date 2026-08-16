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
        .replace(/[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]/gu, '')
        .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2018-\u201F]|\uD83E[\uDD10-\uDDFF]/g, '')
        .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
        .replace(/[⚡🔥❌✅⬇️⬆️🎉👉📈📊🎁📰📌🤫🎭💥🤖➔]/g, '')
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
    ctx.fillText(stripEmojis(titleText), WIDTH / 2, 160);
}

function drawBottomSubtitle(ctx: CanvasRenderingContext2D, subtitleText: string) {
    const cleanStr = stripEmojis(subtitleText);
    if (!cleanStr) return;

    ctx.font = `bold 42px ${FONT_FAMILY}`;
    const lines = wrapText(ctx, cleanStr, WIDTH - 140);
    const lineH = 50;
    const boxH = Math.max(90, lines.length * lineH + 30);
    const boxW = WIDTH - 100;
    const boxX = 50;
    const boxY = HEIGHT - 250;

    // 형광 노란색 자막 배너 (#FFE800)
    roundRect(ctx, boxX, boxY, boxW, boxH, 20);
    ctx.fillStyle = '#FFE800';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = `bold 40px ${FONT_FAMILY}`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    for (let l = 0; l < lines.length; l++) {
        ctx.fillText(lines[l], WIDTH / 2, boxY + 30 + (l + 0.75) * lineH);
    }
}

// ─── 1. 커버 슬라이드 (Cover Slide) ──────────────────────────────────────────

function renderShortsCover(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawTopHeader(ctx, '3초 만에 바뀌는 합격 자소서..!');

    const cardY = 250, cardH = 1180;
    roundRect(ctx, 50, cardY, WIDTH - 100, cardH, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 3;
    ctx.fill(); ctx.stroke();

    // 상단 뱃지
    roundRect(ctx, WIDTH / 2 - 210, cardY + 50, 420, 76, 38);
    const badgeGrad = ctx.createLinearGradient(WIDTH / 2 - 210, 0, WIDTH / 2 + 210, 0);
    badgeGrad.addColorStop(0, '#2563EB');
    badgeGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = badgeGrad; ctx.fill();

    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('오늘의 AI 팩폭 레포트', WIDTH / 2, cardY + 100);

    // 메인 메인 타일 텍스트 (대형 80px 볼드)
    const cleanTitle = stripEmojis(slide.title);
    ctx.font = `bold 80px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    const lines = wrapText(ctx, cleanTitle, WIDTH - 180);
    
    let curY = cardY + 280;
    for (const l of lines) {
        ctx.fillText(l, WIDTH / 2, curY);
        curY += 108;
    }

    if (slide.subtitle) {
        const subClean = stripEmojis(slide.subtitle);
        const subLines = wrapText(ctx, subClean, WIDTH - 220);
        const boxH = Math.max(160, 60 + subLines.length * 56);
        const boxY = Math.min(curY + 30, cardY + cardH - boxH - 60);

        roundRect(ctx, 90, boxY, WIDTH - 180, boxH, 28);
        ctx.fillStyle = '#EFF6FF';
        ctx.strokeStyle = '#BFDBFE';
        ctx.lineWidth = 2.5;
        ctx.fill(); ctx.stroke();

        ctx.font = `bold 40px ${FONT_FAMILY}`;
        ctx.fillStyle = '#1E40AF';
        let sy = boxY + 65;
        for (const sl of subLines) {
            ctx.fillText(sl, WIDTH / 2, sy);
            sy += 56;
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
        if (/before|비포|탈락/i.test(line)) {
            beforeText = line.replace(/^(before|비포|탈락)[:\s]*/i, '').trim();
        } else if (/after|애프터|합격/i.test(line)) {
            afterText = line.replace(/^(after|애프터|합격)[:\s]*/i, '').trim();
        } else {
            scoreText = line.trim();
        }
    });

    // Fallback: If regex didn't find before/after explicitly but we have lines, use lines[0] as before, lines[1] as after
    if (!beforeText && !afterText && slide.contentLines.length >= 2) {
        beforeText = slide.contentLines[0];
        afterText = slide.contentLines[1];
        if (slide.contentLines.length >= 3) {
            scoreText = slide.contentLines.slice(2).join(' ');
        }
    }

    if (beforeText && afterText) {
        const cleanB = stripEmojis(beforeText);
        const cleanA = stripEmojis(afterText);

        // 1) BEFORE 카드 (동적 높이 & 대형 폰트)
        ctx.font = `bold 46px ${FONT_FAMILY}`;
        const bls = wrapText(ctx, cleanB, WIDTH - 200);
        const bLineH = 62;
        const bTextH = bls.length * bLineH;
        const bH = Math.max(260, 110 + bTextH + 30);
        const bY = 240;

        roundRect(ctx, 50, bY, WIDTH - 100, bH, 32);
        ctx.fillStyle = '#FEF2F2';
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3.5;
        ctx.fill(); ctx.stroke();

        // BEFORE 뱃지
        roundRect(ctx, 80, bY + 30, 240, 54, 27);
        ctx.fillStyle = '#EF4444'; ctx.fill();
        ctx.font = `bold 28px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('[BEFORE] 탈락', 200, bY + 66);

        // BEFORE 본문 텍스트 (46px 대형 볼드)
        ctx.font = `bold 46px ${FONT_FAMILY}`;
        ctx.fillStyle = '#991B1B';
        ctx.textAlign = 'left';
        let by = bY + 140;
        for (const l of bls) {
            ctx.fillText(l, 90, by);
            by += bLineH;
        }

        // 2) 중간 AI 변환 구분 뱃지
        const midY = bY + bH + 25;
        roundRect(ctx, WIDTH / 2 - 240, midY, 480, 60, 30);
        const midGrad = ctx.createLinearGradient(WIDTH / 2 - 240, 0, WIDTH / 2 + 240, 0);
        midGrad.addColorStop(0, '#2563EB');
        midGrad.addColorStop(1, '#7C3AED');
        ctx.fillStyle = midGrad; ctx.fill();

        ctx.font = `bold 30px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('dethan (디든) AI 1:1 맞춤 교정', WIDTH / 2, midY + 41);

        // 3) AFTER 카드 (동적 높이 & 대형 48px 폰트)
        ctx.font = `bold 48px ${FONT_FAMILY}`;
        const als = wrapText(ctx, cleanA, WIDTH - 200);
        const aLineH = 64;
        const aTextH = als.length * aLineH;
        const aH = Math.max(280, 110 + aTextH + 30);
        const aY = midY + 85;

        roundRect(ctx, 50, aY, WIDTH - 100, aH, 32);
        ctx.fillStyle = '#F5F3FF';
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = 4;
        ctx.fill(); ctx.stroke();

        // AFTER 뱃지
        roundRect(ctx, 80, aY + 30, 240, 54, 27);
        ctx.fillStyle = '#7C3AED'; ctx.fill();
        ctx.font = `bold 28px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('[AFTER] 합격', 200, aY + 66);

        // AFTER 본문 텍스트 (48px 대형 볼드)
        ctx.font = `bold 48px ${FONT_FAMILY}`;
        ctx.fillStyle = '#4C1D95';
        ctx.textAlign = 'left';
        let ay = aY + 145;
        for (const l of als) {
            ctx.fillText(l, 90, ay);
            ay += aLineH;
        }
    } else {
        // 백업: 일반 본문 3단 카드 리스트 렌더링 (절대 빈 스크린 방지!)
        let curY = 250;
        const list = slide.contentLines.length > 0 ? slide.contentLines : [slide.title, slide.subtitle || '치트키 리포트'];
        list.forEach((lineText, idx) => {
            const cleanLine = stripEmojis(lineText);
            roundRect(ctx, 50, curY, WIDTH - 100, 180, 28);
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = idx === 0 ? '#2563EB' : (idx === 1 ? '#7C3AED' : '#06B6D4');
            ctx.lineWidth = 3;
            ctx.fill(); ctx.stroke();

            roundRect(ctx, 80, curY + 45, 80, 80, 20);
            ctx.fillStyle = idx === 0 ? '#2563EB' : (idx === 1 ? '#7C3AED' : '#06B6D4');
            ctx.fill();

            ctx.font = `bold 36px ${FONT_FAMILY}`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText(`${idx + 1}`, 120, curY + 98);

            ctx.font = `bold 40px ${FONT_FAMILY}`;
            ctx.fillStyle = '#0F172A';
            ctx.textAlign = 'left';
            const lines = wrapText(ctx, cleanLine, WIDTH - 260);
            let ly = curY + 80;
            for (const l of lines) {
                ctx.fillText(l, 185, ly);
                ly += 48;
            }

            curY += 220;
        });
    }

    drawBottomSubtitle(ctx, scoreText || '직무 수치와 구체적 성과를 명시하세요!');
}

// ─── 3. CTA 슬라이드 (Call To Action) ───────────────────────────────────────

function renderShortsCta(ctx: CanvasRenderingContext2D, slide: CardNewsSlide) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawTopHeader(ctx, '나도 합격 자소서 만들기');

    const cardY = 250, cardH = 1180;
    roundRect(ctx, 50, cardY, WIDTH - 100, cardH, 40);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3.5;
    ctx.fill(); ctx.stroke();

    ctx.font = `bold 52px ${FONT_FAMILY}`;
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    const tls = wrapText(ctx, stripEmojis(slide.title), WIDTH - 200);
    let ty = cardY + 180;
    for (const tl of tls) { ctx.fillText(tl, WIDTH / 2, ty); ty += 72; }

    ctx.font = `bold 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#475569';
    ctx.fillText('지금 바로 3초 만에 AI 교정을 받아보세요!', WIDTH / 2, ty + 50);

    const btnY = cardY + cardH - 240;
    roundRect(ctx, 80, btnY, WIDTH - 160, 140, 70);
    const btnGrad = ctx.createLinearGradient(80, 0, WIDTH - 80, 0);
    btnGrad.addColorStop(0, '#2563EB');
    btnGrad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = btnGrad; ctx.fill();

    ctx.font = `bold 44px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('무료 교정 받으러 가기 >', WIDTH / 2, btnY + 85);

    ctx.font = `bold 38px ${FONT_FAMILY}`;
    ctx.fillStyle = '#2563EB';
    ctx.fillText('dethan.co.kr (디든)', WIDTH / 2, cardY + cardH - 50);

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
        let cleanText = text
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
            .replace(/Diff/gi, '디프')
            .replace(/ROAS/gi, '로아스')
            .replace(/AI/gi, '에이아이')
            .replace(/CTA/gi, '씨티에이')
            .replace(/URL/gi, '유알엘')
            .replace(/VS/gi, ' 대 ')
            .replace(/PT/gi, '점')
            .replace(/Score/gi, '스코어')
            .replace(/TIP/gi, '팁')
            .replace(/FREE/gi, '프리')
            .replace(/TRIAL/gi, '트라이얼')
            .replace(/https?:\/\/[^\s]+/gi, '프로필 링크 사이트')
            .replace(/draft-ethan\.vercel\.app/gi, '디든 사이트')
            .replace(/dethan\.co\.kr/gi, '디든 사이트')
            .replace(/출처:.*$/gm, '')
            .trim();

        if (!cleanText) return '';

        const candidateVoices = ['ko-KR-InJoonNeural', 'ko-KR-SunHiNeural'];
        const voice = process.env.SHORTS_VOICE || candidateVoices[Math.floor(Math.random() * candidateVoices.length)];
        try {
            const { execSync } = require('child_process');
            execSync(`python -m edge_tts --voice ${voice} --rate=+32% --text ${JSON.stringify(cleanText)} --write-media ${JSON.stringify(outputPath)}`, { stdio: 'pipe' });
            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                console.log(`[ShortsRenderer] 🎙️ 고품질 신경망 성우(${voice}) 음성 생성 완료!`);
                return outputPath;
            }
        } catch (edgeErr: any) {
            console.warn('[ShortsRenderer] ⚠️ Edge TTS 실행 실패, 구글 기본 TTS로 폴백:', edgeErr.message);
        }

        const rawGooglePath = outputPath.replace(/\.mp3$/, '_raw.mp3');
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

        // 2) 'dethan' / '디든' / 'Draft Ethan' / '에단' 발음을 모두 확실하게 '[디든]'으로 변환
        speechText = speechText
            .replace(/Draft\s*Ethan/gi, '디든')
            .replace(/드래프트\s*이든/gi, '디든')
            .replace(/드래프트\s*에단/gi, '디든')
            .replace(/dethan/gi, '디든')
            .replace(/Ethan/gi, '디든')
            .replace(/에단/gi, '디든');

        const aPath = path.join(outputDir, `tts_slide_${i + 1}.mp3`);
        await generateTTSAudioForText(speechText, aPath);
        const rawDur = await getAudioDuration(aPath);

        // 슬라이드 1, 2는 음성 끝난 후 0.2초 여백, 마지막 CTA 슬라이드는 1.0초 여백 보장!
        const padding = (i === slides.length - 1) ? 1.0 : 0.2;
        const segDuration = Math.max(2.5, rawDur + padding);
        console.log(`[ShortsRenderer] 🎙️ 슬라이드 ${i + 1} TTS 음성: ${rawDur.toFixed(1)}초 -> 슬라이드 유지: ${segDuration.toFixed(1)}초`);

        const segPath = path.join(outputDir, `segment_${i + 1}.mp4`);
        const hasAudio = fs.existsSync(aPath) && fs.statSync(aPath).size > 0;

        await new Promise((resolve, reject) => {
            const totalFrames = Math.ceil(segDuration * 30);
            const zoomFilter = `zoompan=z='min(zoom+0.001,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1080x1920:fps=30`;

            const cmd = ffmpeg(framePaths[i])
                .loop(segDuration);

            if (hasAudio) {
                cmd.input(aPath);
                cmd.outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-preset ultrafast',
                    '-vf', zoomFilter,
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

    // 3. 1:1 오디오가 매핑된 3개 슬라이드 동영상을 부드럽게 하나로 병합 (Concat)
    const concatListPath = path.join(outputDir, 'concat_list.txt');
    const concatContent = segmentPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    const finalShortsVideo = path.join(outputDir, 'youtube_shorts.mp4');

    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f concat', '-safe 0'])
            .outputOptions(['-c copy'])
            .output(finalShortsVideo)
            .on('end', resolve)
            .on('error', (err) => {
                console.error('[ShortsRenderer] ❌ 세그먼트 병합 실패:', err.message);
                reject(err);
            })
            .run();
    });

    // 4. 배경음악(BGM) 파일이 assets/bgm.mp3 에 존재할 경우 은은하게 오디오 오버레이 합성
    const bgmPath = path.join(process.cwd(), 'assets', 'bgm.mp3');
    if (fs.existsSync(bgmPath)) {
        console.log('[ShortsRenderer] 🎵 배경음악(BGM) 은은하게(-20dB) 오버레이 합성 중...');
        const finalWithBgm = path.join(outputDir, 'youtube_shorts_bgm.mp4');
        await new Promise((resolve) => {
            ffmpeg(finalShortsVideo)
                .input(bgmPath)
                .outputOptions([
                    '-filter_complex', '[1:a]volume=0.12[bgm];[0:a][bgm]amix=inputs=2:duration=first[aout]',
                    '-map 0:v:0',
                    '-map [aout]',
                    '-c:v copy',
                    '-c:a aac'
                ])
                .output(finalWithBgm)
                .on('end', () => {
                    if (fs.existsSync(finalWithBgm)) {
                        fs.copyFileSync(finalWithBgm, finalShortsVideo);
                        fs.unlinkSync(finalWithBgm);
                    }
                    console.log('[ShortsRenderer] 🎵 BGM 합성 완성!');
                    resolve(true);
                })
                .on('error', (err) => {
                    console.warn('[ShortsRenderer] ⚠️ BGM 합성 실패, 기본 나레이션 유지:', err.message);
                    resolve(false);
                })
                .run();
        });
    }

    console.log(`[ShortsRenderer] 🎉 9:16 알고리즘 폭격 쇼츠 동영상 완성!: ${finalShortsVideo}`);
    return finalShortsVideo;
}
