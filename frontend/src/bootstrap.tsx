import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.tsx'

// 拦截全局 fetch，处理 401 状态以触发前端自动退出登录并重定向
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401) {
    const tokenKey = 'code_shield_token';
    const pipelineTokenKey = 'code_pipeline_token';
    if (localStorage.getItem(tokenKey) || localStorage.getItem(pipelineTokenKey)) {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(pipelineTokenKey);
      window.location.reload();
    }
  }
  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
