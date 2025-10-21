import { TrackProject, TrackMetadata, APIResponse, BOMSummary } from './types'

const API_BASE = '/api'

export async function uploadTrack(data: TrackProject | string): Promise<APIResponse> {
  const body = typeof data === 'string' ? data : JSON.stringify(data)
  
  const res = await fetch(`${API_BASE}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return res.json()
}

export async function listTracks(page = 1, size = 20, query = ''): Promise<APIResponse<{
  items: TrackMetadata[]
  total: number
  page: number
  size: number
}>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (query) params.set('q', query)
  
  const res = await fetch(`${API_BASE}/tracks?${params}`)
  return res.json()
}

export async function getTrack(id: string): Promise<APIResponse<{
  project: TrackProject
  bom: BOMSummary
}>> {
  const res = await fetch(`${API_BASE}/tracks/${id}`)
  return res.json()
}

export async function downloadTrack(id: string): Promise<TrackProject> {
  const res = await fetch(`${API_BASE}/tracks/${id}/download`)
  return res.json()
}

export async function deleteTrack(id: string): Promise<APIResponse> {
  const res = await fetch(`${API_BASE}/tracks/${id}`, { method: 'DELETE' })
  return res.json()
}
