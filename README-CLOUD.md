# NEON STRIKE 2 — GitHub → Google Cloud Run

이 프로젝트는 정적 Three.js FPS를 Google Cloud Run에 배포하도록 준비되어 있습니다.

## 1. GitHub 저장소 생성
이 폴더 전체를 GitHub 저장소의 `main` 브랜치에 업로드합니다.

## 2. Google Cloud 준비
Google Cloud에서 프로젝트를 만든 뒤 다음 API를 활성화합니다.

- Cloud Run Admin API
- Cloud Build API
- Artifact Registry API
- IAM Service Account Credentials API

Cloud Run 배포 지역은 기본적으로 `asia-northeast3`(서울)입니다.

## 3. GitHub Actions 인증
GitHub Actions에서 서비스 계정 키(JSON)를 저장하지 않고 Workload Identity Federation을 사용하는 것을 권장합니다.

GitHub 저장소 Secrets에 다음 두 값을 넣습니다.

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

서비스 계정에는 Cloud Run 배포와 Cloud Build/Artifact Registry에 필요한 권한을 부여합니다.

## 4. 자동 배포
`main`에 push하면 `.github/workflows/deploy-cloud-run.yml`이 실행됩니다.

배포가 끝나면 Actions 로그의 `Show service URL` 단계에서 게임 주소를 확인할 수 있습니다.

## 중요한 점
현재 NEON STRIKE 2는 브라우저에서 실행되는 싱글플레이어 구조입니다.
현재 코드에는 WebSocket/게임 서버 통신이 없으므로 Cloud Run은 '게임 파일을 제공하는 웹 서버' 역할을 합니다.

나중에 온라인 멀티플레이어를 추가한다면 별도의 실시간 서버 구조를 붙이는 것이 필요합니다.
