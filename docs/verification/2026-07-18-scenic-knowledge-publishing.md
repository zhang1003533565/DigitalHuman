# 景点知识发布链路验证（2026-07-20）

## 结论

景点正式资料的 Markdown 预览、管理员目标选择门禁、Observer 只读访问、发布状态模型、MaxKB 删除代理与补偿逻辑均通过自动化和真实浏览器验证。管理端已发现配置账号“线上 · 本地”和目标知识库“景区知识库”，但本次没有点击最终“发布到知识库”，因此没有向真实 MaxKB 创建、重发或撤回文档。

## 自动化验证

### DigitalHuman 后端

```bash
cd backend-java
mvn test
```

结果：退出码 0；224 项测试，0 failures，0 errors，0 skipped；`BUILD SUCCESS`。

覆盖包括：

- 正式景点快照到白名单 Markdown 的渲染与内容哈希。
- 首发、同目标重发、切换目标、远端删除失败补偿、失败审计、撤回和 outdated 状态。
- 数据库按景点全局唯一的发布槽约束；跨账号或知识库的并发发布同样冲突。
- 即使内容哈希相同，改选目标也会完成新目标发布、撤回旧记录并删除旧目标文档。
- 生产迁移先输出并阻断历史双活或跨目标预留槽，要求按运行手册完成远端和本地对账后才能修改索引。
- DigitalHuman 到 MaxKB 的文档删除代理及账号、知识库、文档参数编码。

### MySQL 迁移实测

- 迁移前索引列：`facility_id,account_id,knowledge_id,publish_slot`。
- 双活文档和并行预留槽预检：零行。
- 在本地 MySQL 开发库执行手工迁移：退出码 0。
- 迁移后 `information_schema.STATISTICS`：`facility_id,publish_slot`。
- 冲突处理、远端清理、状态对账和回滚步骤见 `docs/operations/scenic-knowledge-single-target-migration.md`。

### 管理端

```bash
cd frontend-admin
node --test
npm run lint
npm run build
```

结果：Node 34/34 通过；ESLint 通过；TypeScript 与 Vite production build 通过。构建仅报告既有大 chunk 警告。

### MaxKB 删除接口

工作树：`maxkb-knowledge-document-delete`，分支：`codex/knowledge-document-delete`，最终提交：`8cf17ac`。

```bash
uv run python apps/manage.py test knowledge.test_open_api_document_import
```

结果：16 项测试通过。覆盖精确 DELETE 路由、manage 权限、workspace/knowledge/document 所有权校验、字面量路由优先级和错误语义。测试环境报告既有 staticfiles、URL pattern 与 namespace 警告，不影响结果。

## 浏览器验证

地址：`http://127.0.0.1:5241/admin/scenic-structured`。

- ADMIN：已应用记录“灵山大照壁”展示“发布到知识库”；预览文件为 `scenic-facility-1.md`，内容版本 2，正文来自正式景点并展示 SHA-256 摘要。
- ADMIN：账号“线上 · 本地”可发现；目标知识库列表包含“景区知识库”。未选择知识库时发布按钮禁用，选择后按钮启用。
- OBSERVER：已应用记录只展示“查看知识状态”；账号与知识库控件禁用，不渲染发布或撤回动作。
- OBSERVER：可读取相同的正式 Markdown 预览和当前“未发布”状态，不再依赖管理员专属的 MaxKB 账号发现接口。
- 未应用记录只显示“请先应用到正式景点”，没有知识发布入口。
- 修复后页面未产生本次组件的 Drawer、Space、Alert、Table pagination 弃用告警。

## 安全边界

- 发布正文只读取正式景点和正式详情，不读取导入暂存文本。
- 未选择账号、知识库或预览已过期时，前端发布门禁保持关闭；后端仍执行权限和状态校验。
- Observer 不请求管理员专属的 MaxKB 账号/知识库发现接口，避免暴露连接配置。
- 同一景点不允许跨多个 MaxKB 目标并存；改选目标使用带补偿的安全切换流程。
- 验证记录不包含 OpenAPI Key、登录令牌或其他认证信息。

## 未执行的外部写入验证

本次没有获得针对“线上 · 本地 / 景区知识库”执行真实创建、重发、删除和 hit-test 的动作时授权，因此未点击最终发布按钮，也没有生成远端文档 ID。发布、补偿、撤回与删除契约已有自动化覆盖，但真实远端索引切换仍需在明确授权后执行一次发布 → 修改正式资料 → 重发 → 撤回冒烟。
