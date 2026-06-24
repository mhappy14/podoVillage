// 필지 기반 성과물 API 호출 모음
import AxiosInstance from "../AxiosInstance";
import { DOMAIN } from "./placeMap";

export const isLoggedIn = () => !!localStorage.getItem("Token");

// 지도 오버레이용 FeatureCollection
export async function fetchSitesGeojson(params = {}) {
  const res = await AxiosInstance.get("place/sites/geojson/", { params });
  return res.data;
}

// 목록(페이지네이션)
export async function fetchSites(params = {}) {
  const res = await AxiosInstance.get("place/sites/", { params });
  return res.data;
}

// 상세
export async function fetchSite(id) {
  const res = await AxiosInstance.get(`place/sites/${id}/`);
  return res.data;
}

// 내 성과물
export async function fetchMySites(params = {}) {
  const res = await AxiosInstance.get("place/sites/mine/", { params });
  return res.data;
}

// 좌표 → 연속지적 필지 조회 (백엔드 VWorld 프록시)
export async function fetchParcel(lat, lng) {
  const res = await AxiosInstance.get("place/parcel/", {
    params: { lat, lng, domain: DOMAIN },
  });
  return res.data;
}

// 생성: FormData(필드 + geometry(JSON 문자열) + files[])
export async function createSite(formData) {
  const res = await AxiosInstance.post("place/sites/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// 수정
export async function updateSite(id, formData) {
  const res = await AxiosInstance.patch(`place/sites/${id}/`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteSite(id) {
  await AxiosInstance.delete(`place/sites/${id}/`);
}

export async function deleteSiteFile(siteId, fileId) {
  await AxiosInstance.delete(`place/sites/${siteId}/files/${fileId}/`);
}

export async function toggleLike(id) {
  const res = await AxiosInstance.post(`place/sites/${id}/like/`);
  return res.data;
}
