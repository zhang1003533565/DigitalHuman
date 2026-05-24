declare module 'xlsx' {
  export const read: (data: ArrayBuffer, options?: Record<string, unknown>) => {
    SheetNames: string[]
    Sheets: Record<string, WorkSheet>
  }

  export const utils: {
    sheet_to_json: <T = unknown>(sheet: WorkSheet, options?: Record<string, unknown>) => T[]
  }

  export type WorkSheet = Record<string, unknown> & {
    '!cols'?: Array<{ wpx?: number; wch?: number }>
  }
}
