# 청산왕 — 100만 원으로 100억 만들기

15초봉 자동 캔들차트 기반 코인 청산 피하기 모바일 웹 게임 MVP입니다.

## 포함 기능

- BTC / ETH / SOL / ONDO / HYPE 종목 선택
- 롱 / 숏 포지션 선택
- 3배 / 10배 / 50배 레버리지 선택
- 15초봉 자동 캔들차트
- 1초 단위 가격 변동 및 실시간 평가손익
- 청산가 터치 시 자동 청산
- 존댓말 팩폭 청산 문구
- 가짜 광고 시청 후 1회 부활
- 최고 자산 localStorage 저장
- 모바일 공유 / 결과 복사

## 로컬 실행

```bash
npm install
npm run dev
```

## 프로덕션 빌드

```bash
npm run build
npm run preview
```

## Vercel 배포

Vercel 계정이 연결된 상태에서 프로젝트 루트에서 실행합니다.

```bash
npm install
npm run build
npx vercel
```

Vercel 공식 문서 기준 Vite 프로젝트는 프로젝트 루트에서 `vercel` 명령으로 배포할 수 있습니다. `vercel.json`에는 SPA 라우팅을 위한 rewrite가 포함되어 있습니다.

## 주의

이 앱의 차트와 가격 변동은 게임용 랜덤 데이터입니다. 실제 투자 정보 또는 매매 권유가 아닙니다.
