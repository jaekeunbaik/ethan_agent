import { MsEdgeTTS, OUTPUT_FORMAT } from 'edge-tts';

async function main() {
    const tts = new MsEdgeTTS();
    await tts.setMetadata('ko-KR-SunHiNeural', OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const filePath = await tts.toFile('./edge_test.mp3', '야 너 이번에 한화에서 20조 부어서 채용 시작했거든? 당장 드래프트 이든 AI에서 3초 만에 팩폭 교정받아봐!');
    console.log('✅ MS Edge Neural 고품질 성우 음성 생성 완료:', filePath);
}

main().catch(console.error);
