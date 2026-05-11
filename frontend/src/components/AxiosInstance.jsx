import axios from 'axios'

const baseUrl = 'http://127.0.0.1:8000/'

const AxiosInstance = axios.create({
	baseURL: baseUrl,
	timeout: 5000, 
	headers:{
		"Content-Type":"application/json",
		accept: "application/json"
	}
})

AxiosInstance.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem('Token')
		if(token){
			config.headers.Authorization = `Token ${token}`
		}
		else{
			config.headers.Authorization = ``
		}
		return config;
	}
)

AxiosInstance.interceptors.response.use(
	(response) => {
		return response
	},
	(error) => {
		if(error.response && error.response.status === 401){
			localStorage.removeItem('Token')
		}
		// ⚠️ 반드시 reject 로 던져야 호출측의 try/catch 가 동작합니다.
		// 이게 없으면 모든 HTTP 에러가 undefined 로 resolve 되어
		// "Cannot read properties of undefined (reading 'data')" 에러 발생.
		return Promise.reject(error);
	}
)

export default AxiosInstance;