import axios from 'axios';

const API_BASE = "http://localhost:3000";

export async function analyze(input: any, debug = false) {
  const res = await axios.post(`${API_BASE}/api/analyze`, input);
  return res.data.analysis;
}

export async function analyzeSession(session_id: string, debug = false) {
  const res = await axios.post(`${API_BASE}/api/analyze-session`, {
    session_id,
    debug
  });
  return res.data.analysis;
}

export async function getLatestCapture() {
  const res = await axios.get(`${API_BASE}/api/latest-capture`);
  return res.data;
}

export async function getSessions() {
  const res = await axios.get(`${API_BASE}/api/sessions`);
  return res.data.sessions;
}

export async function getTimeline(date: string, session: string) {
  const res = await axios.get(`${API_BASE}/api/session/timeline?date=${date}&session=${session}`);
  return res.data.timeline;
}

export async function getCapture(date: string, session: string, capture_id: string) {
  const res = await axios.get(`${API_BASE}/api/capture?date=${date}&session=${session}&capture_id=${capture_id}`);
  return res.data;
}

export async function getAgentAnalysis(date: string, session: string, capture_id: string, layer: string, agent: string) {
  const res = await axios.get(`${API_BASE}/api/session/${date}/${session}/captures/${capture_id}/analysis/${layer}/${agent}`);
  return res.data;
}
