import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Card, Table, Tooltip, message } from 'antd'
import type { TableColumnsType } from 'antd'
import * as XLSX from 'xlsx'

type DataRow = Record<string, string> & { key: string }

function renderTruncatedCell(
  value: string,
  rowHeight: number,
  fontSize: number,
  rowKey: string,
  onRowResizeStart: (event: ReactMouseEvent<HTMLDivElement>, rowKey: string, currentHeight: number) => void,
) {
  const text = (value ?? '').toString()
  const lineHeight = Math.max(18, fontSize + 6)
  const maxLines = Math.max(1, Math.floor(rowHeight / lineHeight))

  return (
    <Tooltip
      placement="topLeft"
      title={<div style={{ maxWidth: 900, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text || '-'}</div>}
    >
      <div
        style={{
          position: 'relative',
          minHeight: rowHeight,
          paddingBottom: 6,
          fontSize,
          lineHeight: `${lineHeight}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          cursor: 'pointer',
        }}
      >
        {text || '-'}
        <div
          role="separator"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -3,
            height: 8,
            cursor: 'row-resize',
            zIndex: 3,
          }}
          onMouseDown={(event) => {
            event.stopPropagation()
            onRowResizeStart(event, rowKey, rowHeight)
          }}
        />
      </div>
    </Tooltip>
  )
}

export default function TravelAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState<TableColumnsType<DataRow>>([])
  const [rows, setRows] = useState<DataRow[]>([])
  const [fontSize] = useState(16)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [baseColumnWidths, setBaseColumnWidths] = useState<Record<string, number>>({})
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const [headers, setHeaders] = useState<string[]>([])
  const [sourceRows, setSourceRows] = useState<DataRow[]>([])
  const tableScrollY = 'calc(100vh - 280px)'

  const colDragRef = useRef<{ header: string; startX: number; startWidth: number } | null>(null)
  const rowDragRef = useRef<{ rowKey: string; startY: number; startHeight: number } | null>(null)

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (colDragRef.current) {
        const { header, startX, startWidth } = colDragRef.current
        const nextWidth = Math.max(140, startWidth + event.clientX - startX)
        setColumnWidths((prev) => ({ ...prev, [header]: nextWidth }))
        return
      }

      if (rowDragRef.current) {
        const { rowKey, startY, startHeight } = rowDragRef.current
        const nextHeight = Math.max(44, startHeight + event.clientY - startY)
        setRowHeights((prev) => ({ ...prev, [rowKey]: nextHeight }))
      }
    }

    function onMouseUp() {
      colDragRef.current = null
      rowDragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    async function loadExcelFromPublic() {
      setLoading(true)
      try {
        const response = await fetch('/travel-analytics/景点景区旅游数据行为分析数据.xlsx')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const buffer = await response.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[firstSheetName]
        if (!sheet) {
          throw new Error('sheet not found')
        }

        const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          raw: false,
          defval: '',
        })

        const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? '').trim())
        const normalizedHeaders = headerRow.map((header, index) => (header ? header : `列${index + 1}`))
        const sheetCols = (sheet['!cols'] ?? []) as Array<{ wpx?: number; wch?: number }>
        const baseWidths: Record<string, number> = {}
        normalizedHeaders.forEach((header, colIndex) => {
          const rawWpx = sheetCols[colIndex]?.wpx
          const rawWch = sheetCols[colIndex]?.wch
          const computed = rawWpx ?? (rawWch ? Math.round(rawWch * 8 + 24) : 260)
          baseWidths[header] = Math.max(140, Math.min(900, computed))
        })

        const builtRows = matrix
          .slice(1)
          .map((row, rowIndex) => {
            const nextRow: DataRow = { key: String(rowIndex + 1) }
            normalizedHeaders.forEach((header, colIndex) => {
              nextRow[header] = String(row[colIndex] ?? '')
            })
            return nextRow
          })
          .filter((row) => normalizedHeaders.some((header) => (row[header] ?? '').trim() !== ''))

        setHeaders(normalizedHeaders)
        setBaseColumnWidths(baseWidths)
        setSourceRows(builtRows)
      } catch {
        message.error('读取 Excel 失败，请检查文件是否存在于 public/travel-analytics 目录')
      } finally {
        setLoading(false)
      }
    }

    void loadExcelFromPublic()
  }, [])

  useEffect(() => {
    const builtColumns: TableColumnsType<DataRow> = headers.map((header) => {
      const width = columnWidths[header] ?? baseColumnWidths[header] ?? 260
      return {
        title: (
          <div style={{ position: 'relative', paddingRight: 10 }}>
            <span>{header}</span>
            <span
              role="separator"
              style={{
                position: 'absolute',
                right: -6,
                top: 0,
                width: 12,
                height: '100%',
                cursor: 'col-resize',
                zIndex: 2,
              }}
              onMouseDown={(event) => {
                event.preventDefault()
                colDragRef.current = { header, startX: event.clientX, startWidth: width }
                document.body.style.userSelect = 'none'
                document.body.style.cursor = 'col-resize'
              }}
            />
          </div>
        ),
        dataIndex: header,
        key: header,
        width,
        render: (value: string, record: DataRow) => {
          const rowKey = String(record.key ?? '')
          const rowHeight = rowHeights[rowKey] ?? 64
          return renderTruncatedCell(value, rowHeight, fontSize, rowKey, setRowHeightDragStart)
        },
      }
    })

    setColumns(builtColumns)
    setRows(sourceRows)
  }, [headers, sourceRows, columnWidths, rowHeights, fontSize, baseColumnWidths])

  function setRowHeightDragStart(event: ReactMouseEvent<HTMLDivElement>, rowKey: string, currentHeight: number) {
    event.preventDefault()
    rowDragRef.current = { rowKey, startY: event.clientY, startHeight: currentHeight }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }

  return (
    <div className="admin-panel-grid travel-analytics-page">
      <Card title="表格数据" className="travel-analytics-card">
        <div className="travel-table-scroll">
          <Table
            className="travel-table"
            columns={columns}
            dataSource={rows}
            loading={loading}
            tableLayout="fixed"
            scroll={{ x: 2600, y: tableScrollY }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              position: ['bottomLeft'],
            }}
          />
        </div>
      </Card>
    </div>
  )
}
