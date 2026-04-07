# 安全策略

## 报告漏洞

**请勿通过公开 Issue 报告安全漏洞。**

如果你发现了安全问题，请通过以下方式私下告知我们：

- 使用 GitHub 的 [Private Security Advisory](https://github.com/security/advisories/new) 功能
- 或发送邮件，说明漏洞详情、复现步骤和潜在影响

我们会在收到报告后尽快响应。

## 注意事项

- `.env` 文件包含 API Key 等敏感信息，**禁止提交到版本控制**
- 生产部署时请使用环境变量注入，不要硬编码密钥
- API Key 应遵循最小权限原则
