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
export type ActiveView = 'main' | 'prices'

export interface ProjectMeta {
  projectName: string
  managerName: string
  date: string
}

export interface PriceRow {
  row: number
  catalog_number: string
  item_name: string
  unit_price: number
  unit: string
  manufacturer: string
}
