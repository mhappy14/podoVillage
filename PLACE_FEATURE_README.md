# 필지 기반 설계·계획 성과물 플랫폼 (Place)

조경·도시계획·건축 전공 학생이 지도에서 **대상지 필지**를 선택해 본인의 설계·계획안을
업로드하고, 공원·녹지 담당 공무원 등 **열람자**가 지도를 탐색하며 성과물을 열람하는 기능입니다.

## 동작 개요

- **학생(로그인)**: 지도에서 대상지를 지정 → 설계·계획안 업로드
  - 필지 선택 두 가지 방식 모두 지원
    - **필지 자동인식**: 지도를 확대해 필지를 클릭하면 VWorld 연속지적도에서 경계(폴리곤)와 PNU·지번을 자동 인식 (여러 필지 이어붙이기 가능)
    - **직접 그리기**: Leaflet.draw 도구로 대상지 영역을 다각형/사각형으로 직접 그리기
  - 업로드: 제목·전공분야·대상지유형·개요·상세설명·외부링크 + 이미지(설계도판/투시도)·PDF(계획보고서) 첨부
- **열람자(누구나)**: 지도에서 전공별 색상으로 표시된 대상지를 클릭 → 상세 열람(미니맵·이미지 갤러리·PDF·설명·면적·지번)

## 추가/변경된 파일

### 백엔드 (Django)
- `app/models.py` — `ProjectSite`, `SiteFile` 모델 추가
- `app/migrations/0029_projectsite_sitefile.py` — 마이그레이션
- `app/serializers.py` — `ProjectSiteSerializer`, `ProjectSiteListSerializer`, `SiteFileSerializer`
- `app/views.py` — `ProjectSiteViewSet`(목록/상세/생성/수정/삭제/업로드/파일삭제/좋아요/내 성과물/geojson), `vworld_parcel`(필지 조회 프록시)
- `app/urls.py` — `place/sites/` 라우터 + `place/parcel/`
- `auth/settings.py` — `MEDIA_URL`/`MEDIA_ROOT`, 업로드 용량, `VWORLD_KEY`
- `auth/urls.py` — DEBUG 시 미디어 서빙

### 프론트엔드 (React)
- `src/components/Place.jsx` — 지도 탐색·열람(재작성)
- `src/components/PlaceUpload.jsx` — 등록/수정 폼(필지 선택·그리기·파일 업로드)
- `src/components/PlaceSiteDetail.jsx` — 상세 열람
- `src/components/PlaceMine.jsx` — 내 성과물 목록
- `src/components/place/placeMap.js` — Leaflet/VWorld 공용 유틸
- `src/components/place/placeApi.js` — API 호출 모음
- `src/App.jsx` — `/place/new`, `/place/edit/:id`, `/place/site/:id`, `/place/mine` 라우트

## 적용 방법

### 1) 백엔드
```bash
cd backend
python manage.py makemigrations app   # (0029 가 이미 있으면 No changes 또는 그대로 사용)
python manage.py migrate
python manage.py runserver
```
> 업로드 파일은 `backend/media/` 아래에 저장되고 개발 환경에서 `/media/...` 로 서빙됩니다.

### 2) 프론트엔드
```bash
cd frontend
npm run dev
```
> Leaflet 과 Leaflet.draw 는 CDN 에서 자동 로드되므로 별도 설치가 필요 없습니다.

## API 요약

| 메서드 | 경로 | 권한 | 설명 |
|---|---|---|---|
| GET | `/place/sites/` | 누구나 | 목록(경량) |
| GET | `/place/sites/geojson/` | 누구나 | 지도 오버레이용 FeatureCollection |
| GET | `/place/sites/{id}/` | 누구나 | 상세 |
| POST | `/place/sites/` | 로그인 | 등록(multipart: 필드 + geometry(JSON) + files[]) |
| PATCH | `/place/sites/{id}/` | 본인 | 수정 |
| DELETE | `/place/sites/{id}/` | 본인 | 삭제 |
| POST | `/place/sites/{id}/upload/` | 본인 | 파일 추가 |
| DELETE | `/place/sites/{id}/files/{fileId}/` | 본인 | 파일 삭제 |
| POST | `/place/sites/{id}/like/` | 로그인 | 좋아요 토글 |
| GET | `/place/sites/mine/` | 로그인 | 내 성과물 |
| GET | `/place/parcel/?lat=&lng=` | 누구나 | 좌표→연속지적 필지(PNU·지번·geometry) |

## 참고

- 필지 자동인식은 VWorld **Data API**(`LP_PA_CBND_BUBUN`)를 백엔드에서 프록시해 CORS·도메인
  검증 문제를 회피합니다. 운영 시 `VWORLD_KEY` 를 환경변수로 옮기고, 키 발급 시 등록한 도메인을
  맞춰 주세요.
- geometry 는 GeoJSON 으로 `JSONField` 에 저장합니다(PostGIS 불필요). 면적·중심좌표는 등록
  시 근사 계산해 함께 저장합니다.
- 전공분야 색상: 조경=녹색, 도시계획=파랑, 건축=빨강, 기타=갈색.
