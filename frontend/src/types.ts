export interface Component {
  qty: number
  catalog: string
  user1: string
  manufacturer: string
  description: string
  price: number
  unit: string
  match_type: string
  price_found: boolean
  _issues?: string[]
}

export interface ProcessResult {
  components: Component[]
  page_count: number
  excel_quote: string
  excel_parts: string
}

export type AppState = 'idle' | 'ready' | 'processing' | 'results'

export interface ProjectMeta {
  projectName: string
  managerName: string
  date: string
}
