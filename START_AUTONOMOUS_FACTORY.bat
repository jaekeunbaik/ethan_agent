@echo off
chcp 65001 > nul
echo ========================================================
echo  [KatalkViral] 24/7 완전 무인 자율 쇼츠 팩토리 가동
echo  - 5대 서브에이전트 (기획, 대본, 디자인, 배포, 피드백)
echo  - 도파민 유머 카톡썰 + 쿠팡 파트너스 자동 수익화
echo  - 이전 영상 실시간 성과 자가 진화 피드백 루프 탑재
echo ========================================================

cd /d "c:\ethan\git\ethan_agent"
start "" /b npx ts-node autonomous_daemon.ts > daemon.log 2>&1

echo.
echo ✅ 백그라운드에서 무인 데몬이 정상 실행되었습니다!
echo 💡 로그 확인: c:\ethan\git\ethan_agent\daemon.log
echo 💡 종료 방법: STOP_AUTONOMOUS_FACTORY.bat 실행
echo.
pause
