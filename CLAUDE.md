# A股交易系统 - 项目规则

## 前端开发规则

### 必须使用 frontend-design skill

**当进行前端开发时（包括创建页面、组件、样式等），必须先使用 `frontend-design` skill 进行设计讨论和评审，拿到设计方案后再开始实现。**

禁止在没有设计方案的情况下直接写前端代码。

### 触发条件

当你看到以下类型的任务时，必须先调用 `frontend-design` skill：
- 创建新的页面
- 创建新的 UI 组件
- 修改页面布局或样式
- 添加新的交互功能
- 设计主题系统相关功能

### 使用流程

```
用户需求 → frontend-design skill 设计 → 评审通过 → 开始实现
```

## 技术栈

### 后端
- NestJS + TypeScript
- Prisma ORM
- MySQL + Redis
- Docker

### 前端
- React 18 + TypeScript + Vite
- TailwindCSS + Radix UI
- ECharts
- MSW + Faker (Mock)

## 开发约定

- 使用 pnpm 作为包管理器
- 使用 ESLint + Prettier 规范代码
- 提交信息遵循 Conventional Commits
- 所有代码必须有类型定义
