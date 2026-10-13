const gtts = require('google-tts-api');
const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

async function run() {
    const text = '오늘 주식 계좌 열어보신 분들은 진짜 깜짝 놀라셨을 텐데요! 코스피가 무려 마이너스 8.9퍼센트나 출렁이며 6035선에서 마감했습니다.';
    const url = gtts.getAudioUrl(text, { lang: 'ko', slow: false });
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync('temp_base.mp3', Buffer.from(res.data));

    // 3번 스타일에서 속도를 더 올린 1.45배속 초고속 딕션
    execSync(`"${ffmpegPath}" -y -i temp_base.mp3 -af "atempo=1.45" sample_fast_punch_faster.mp3`);
    fs.unlinkSync('temp_base.mp3');

    console.log('✅ 1.45배속 초고속 샘플 생성 완료!');
    execSync('powershell -Command "Start-Process sample_fast_punch_faster.mp3"');
}

run().catch(console.error);
