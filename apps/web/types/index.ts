export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Analysis {
  id: string
  project_id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  project_id: string
  name: string
  file_url: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email?: string
  user_metadata?: {
    name?: string
  }
}