# monitor-bi-dsh — Monitor BI 报表工作室(DeepSeek Harness 插件)

装好后 **DeepSeek Harness(DSH)左侧导航栏多一个"Monitor BI"入口**。点进去是 Harness 原生对话界面(零自制前端),但这个房间**只做 Monitor BI 报表**——上下文干净,不与日常对话混杂;一切 BI 操作在插件进程内完成,**不申请任何系统权限**。

A community plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): adds a "Monitor BI" room to the left navigation. The room embeds Harness's own native conversation, dedicated to building dashboards in **Monitor BI** via natural language. All BI calls run in-process (no child processes, no elevated permissions). Bundled: zero-install toolchain, operating manual, 9 proven dashboard templates, an 8-module data dictionary, and a spec template. On first use it asks for the four connection facts (BI address incl. port / company number with instance suffix / username / password) — every site differs, it never guesses.

## 功能 / Features

- **独立入口**:左侧导航"Monitor BI"图标 → 专属房间(细头栏 + 新对话按钮 + 原生对话)
- **干净上下文**:BI 知识只挂在本房间创建的会话上,其他对话零污染
- **4 个 Agent 工具**:`bi_api`(执行 BI 操作:config/login/list/import/save/get/verify/backup/delete/lang)、`bi_write`(存 XML 草稿)、`bi_guide`(读操作手册)、`bi_read`(查模板/字典/spec 模板)
- **改盘纪律**:改已有看板用 save(ID/网址不变);部署自动英文环境→切回中文
- **零权限**:进程内 HTTP 直连 BI 网页接口,与浏览器访问无异

## 安装 / Install

从 [Releases](../../releases) 下载 `monitor-bi-dsh-<version>.tgz`,然后:

```
dsh plugin --profile desktop add "/绝对路径/monitor-bi-dsh-0.4.0.tgz"
```

(建议专用档:`--profile bi`,与日常档物理隔离。)装完重启对应 profile,左侧导航点 Monitor BI,直接说"做 Monitor BI"。

兼容:已在 DSH `0.2.0-rc.2` 端到端实测(安装→侧边栏→房间→工具调用→真实报表产出);peer 区间亦含 `0.2.1-rc.2`。其他版本如遇安装校验拒绝,请提 issue 附报错。

## 从源码构建 / Build from source

需要 Node.js 22+:

```
git clone <本仓库> && cd monitor-bi-dsh
npm install        # 安装 esbuild
npm pack           # 自动构建 lib/ 并为 skill/tools 装好 undici,产出 tgz
```

`skill/` 目录是技能本体(操作手册 SKILL.md、说明书、模板、数据字典、双版客户端 bi_api.js/.ps1),与通用分发版同源。

## 致谢与声明 / Credits & Disclaimer

- 机制参考了社区插件 qiaomu-rss-dsh 与 dsh-context-structurer 的公开做法(本文全部代码为独立重写,MIT)。
- **本插件为个人社区作品,非官方产品,与所用产品的开发商均无关联,未获其背书或支持。** 文中出现的产名仅为兼容性描述,相关商标归各自权利人所有。
- 本插件不包含任何上述厂商的代码或专有资料;它只通过 Monitor BI 自带的网页接口工作,等同于一个浏览器会话。
- 连接信息只保存在本机插件目录的 `skill/tools/bi_config.env`,不上传、不外发。再分发本仓库/安装包前请删除该文件、`session.json` 与 `skill/work/`。

## License

[MIT](./LICENSE)
