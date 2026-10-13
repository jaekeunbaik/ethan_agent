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

    // 1. 틱톡/릴스 앳되고 톡톡 튀는 하이톤 (인기 숏폼 스타일)
    execSync(`"${ffmpegPath}" -y -i temp_base.mp3 -af "asetrate=44100*1.18,aresample=44100,atempo=1.08" sample_high_viral.mp3`);

    // 2. 묵직하고 신뢰감 있는 저음 동굴톤 (미스터리/심층 분석 스타일)
    execSync(`"${ffmpegPath}" -y -i temp_base.mp3 -af "asetrate=44100*0.86,aresample=44100,atempo=1.3" sample_low_deep.mp3`);

    // 3. 1.35배속 초고속 딕션 (타다닥 꽂히는 팩트 폭격 스타일)
    execSync(`"${ffmpegPath}" -y -i temp_base.mp3 -af "atempo=1.35" sample_fast_punch.mp3`);

    fs.unlinkSync('temp_base.mp3');
    console.log('✅ 3가지 유행 스타일 샘플 생성 완료!');
}

run().catch(console.error);
