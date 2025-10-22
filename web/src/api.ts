import { TrackProject, TrackMetadata, APIResponse, BOMSummary, User } from './types'

const API_BASE = '/api'

// 认证相关
export async function getCurrentUser(): Promise<APIResponse<User>> {
  const res = await fetch(`${API_BASE}/auth/user`, { credentials: 'include' })
  return res.json()
}

export async function logout(): Promise<APIResponse> {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
  return res.json()
}

// 赛道相关
export async function uploadTrack(
  project: TrackProject,
  name: string,
  description: string,
  thumbnail: string,
  tags: string[] = []
): Promise<APIResponse> {
  const body = JSON.stringify({
    name,
    description,
    thumbnail,
    project,
    tags,
  })

  const res = await fetch(`${API_BASE}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body,
  })
  return res.json()
}

export async function listTracks(
  page = 1,
  size = 20,
  query = '',
  tags: string[] = [],
  minLength?: number,
  maxLength?: number
): Promise<APIResponse<{
  items: TrackMetadata[]
  total: number
  page: number
  size: number
}>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (query) params.set('q', query)
  if (tags.length > 0) params.set('tags', tags.join(','))
  if (minLength !== undefined) params.set('minLength', String(minLength))
  if (maxLength !== undefined) params.set('maxLength', String(maxLength))

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
