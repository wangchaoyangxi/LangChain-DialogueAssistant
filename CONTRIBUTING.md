# 贡献指南

感谢你对本项目的关注！以下是参与贡献的方式。

## 提交 Issue

- 提交前请先搜索现有 Issue，避免重复
- Bug 报告请使用 Bug Report 模板，尽量提供复现步骤
- 功能请求请使用 Feature Request 模板，说明使用场景

## 提交 Pull Request

1. Fork 本仓库并创建新分支：
   ```bash
   git checkout -b feat/your-feature
   ```

2. 安装依赖并确保项目可以正常运行：
   ```bash
   npm install
   cd client && npm install && cd ..
   cp .env.example .env  # 填写 API_KEY
   npm run dev
   ```

3. 进行修改，确保 TypeScript 类型检查通过：
   ```bash
   npx tsc --noEmit
   cd client && npx tsc --noEmit
   ```

4. 提交代码，commit message 格式参考：
   ```
   feat: 添加 XXX 功能
   fix: 修复 XXX 问题
   docs: 更新文档
   refactor: 重构 XXX 模块
   ```

5. 发起 Pull Request，描述改动内容和原因

## 添加新的 Skill

在 [src/skills.ts](src/skills.ts) 中按照 `Skill` 接口实现新工具，添加到 `SKILLS` 数组即可，无需修改其他文件。

## 代码规范

- 使用 TypeScript，避免 `any`
- 注释使用中文
- 保持函数简短，单一职责

## 许可证

提交代码即表示你同意将贡献内容以 MIT 协议授权。
