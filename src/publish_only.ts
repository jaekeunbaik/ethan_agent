import * as fs from 'fs';
import { runPublisherAgent } from './agents/publisherAgent';

// upload_queue/의 영상+대본을 그대로 업로드 (로컬에서 만든 결과물용)
(async () => {
  const script = JSON.parse(fs.readFileSync('upload_queue/script.json', 'utf8'));
  const r = await runPublisherAgent(script, { videoPath: 'upload_queue/video.mp4', durationSeconds: 35 } as any);
  console.log('PUB', JSON.stringify(r));
  if (!r.success) process.exit(1);
})();
