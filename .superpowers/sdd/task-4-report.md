# Task 4 报告：MaxKB 两步式文档上传工作台

## 基线

- 要求基线 HEAD：`6f8dd12`
- 实际开始基线 HEAD：`6f8dd12`
- 最终提交：`待提交`

## 修改文件

- `frontend-admin/src/pages/knowledge-openapi/MaxKbDocumentUploadWorkbench.tsx`
- `frontend-admin/src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`
- `.superpowers/sdd/task-4-report.md`

## 完成内容

- 新增独立两步式 MaxKB 文档上传工作台：
  - 步骤一拖拽/选择文件，限制 50 个文件、单文件 100MB、扩展名 `txt/md/log/docx/pdf/html/zip/xlsx/xls/csv`
  - 步骤二选择 `智能分段`、`高级分段`、`模型分段`、`视觉模型分段`
- 模型列表按 `scope/provider` 分组，选项值使用真实模型 UUID；模型拉取失败时仍可继续使用智能/高级模式
- 创建任务固定 `autoApply=false`
- 轮询 `QUEUED`、`PROCESSING`、`APPLYING`，处理 `PREVIEW_READY`、`COMPLETED`、`FAILED`、`CANCELLED`
- 任务详情先归一化嵌套响应 record，再读取 `task_id/status`
- 任务历史列表通过 `extractRecords` 取数，并保留查看、刷新、预览、确认导入、取消、删除操作
- 导出关键纯函数到测试辅助块，覆盖文件校验、任务归一化、轮询判定、模型分组、上传载荷构建
- 使用 key 化内层组件和定时器清理，避免 `accountId/knowledgeId` 变化后的陈旧轮询状态

## 验证

- 组件测试：
  - `cd frontend-admin && node src/pages/knowledge-openapi/maxkb-document-upload-workbench.test.mjs`
  - 结果：`4/4` 通过
- ESLint：
  - `cd frontend-admin && npm run lint`
  - 结果：通过
- Vite build：
  - `cd frontend-admin && npm run build`
  - 结果：通过
  - 备注：Vite 继续报告现有大 chunk warning，未在本任务范围内处理

## 残余风险

- 新组件当前只在文件级完成实现与验证，未接入 `KnowledgeOpenApiPage.tsx`，因此没有浏览器级集成证据
- 预览面板按 `extractRecords` 渲染通用文档/段落块；若后端后续返回新的深层结构字段，可能需要补充更具体的展示映射

## 提交

- 提交哈希：`待提交`
- Commit message：按 Lore Commit Protocol 创建
