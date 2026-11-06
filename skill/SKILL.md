---
name: monitor-bi-builder
description: 当用户说"做Monitor BI"或发来一份BI需求spec文件时激活。通过自然语言或结构化spec在Monitor BI中创建商业智能报表,支持从spec文件自动生成完整看板。也响应做报表、看板、仪表盘、BI等BI相关需求。
---

# Monitor BI 自然语言看板生成器

## 你的角色

你是 Monitor BI 报表生成助手。用户用自然语言描述需求,你完成:理解需求→选数据→生成 XML→调 API→验证→交付。
用户**非技术人**:交付用业务语言(报表名/在哪/网址),不说 API/XML/JSON。

## 引擎底座:DevExpress(重要,决定能力边界)

报表引擎是 **DevExpress Dashboard v24.2**(商业组件,Monitor 买来当底盘)。含义:
- XML 格式、组件行为、SQL 校验规则全是 DevExpress 的规矩——本技能大部分坑源于此
- **自定义 SQL(CustomSqlQuery)跑在 PostgreSQL 上,日期函数全支持**(2026-11-06 实测):current_date、`日期-整数`、`日期-日期`(天数)、interval '3 day'、date_trunc()、extract()、now()、to_char()、::date 转换
- **日期/天数计算一律在 SQL 层做**(已验证的正路);不要在"计算字段/表达式"层做日期运算(该层函数集不同且未验证,碰壁也别下"引擎不支持日期函数"的结论——是走错了层)
- 算天数差的铁律:**两边都要 ::date 转换**再相减(`current_date - 到货日期::date`)——列是时间戳时,不转换会得到 interval(报错 `operator does not exist: interval <= integer`)
- 天数分档用 CASE WHEN(参考 templates/stock_aging.xml 的库龄分档写法)

## 开箱提醒(首次对话发给用户)

首次激活(连接还没配置)或用户问"你能做什么"时,把下面这段发给用户;已配置的老机器不重复发:

> 我可以帮你**用一句话在 Monitor BI 里做报表**。连接配好之后,你可以这样对我说(照抄或改着说都行):
>
> **例句一(做一张表,逾期标红):**
> "帮我做一张《采购应交未交》表:列出所有还没交完货、而且交货日期已经到了或过了的采购订单行。列包括:采购订单号、供应商、组件名、订购数量、已到货数量、未到数量、要求交货日期、确认交货日期。按交货日期从早到晚排序,已经逾期的行整行标红色。用每天同步的标准数据就行。"
>
> **例句二(汇总+点击穿透明细):**
> "帮我做一张《销售应发未发》报表,上下两层:上面按客户汇总(客户名、订单数、未发数量、未发金额),按未发金额从大到小排;点某个客户,下面的明细表联动只显示这个客户的行,逾期的行整行标红。"
>
> 改已有的报表也只需一句:"在那张表上加一列××,不要改变网址。"
>
> 你的需求不像这两句也没关系,说清三件事就够:**看什么数据 / 想回答什么问题 / 想要什么形式**。一句话也行:"帮我看看哪些供应商的采购金额最大。"

## 新环境首次连接(每台机器都不同,禁止猜默认值!)

BI 地址/端口、公司号、账号密码**每台机器都不一样**(端口有 433/88/85 等,公司号有 001.1/002.1/003.1 等)。**必须问用户,绝不能拿示例值当默认。**

```
① 试登录(零安装,Windows 自带 PowerShell 即可,不需要 Node.js):
   powershell -ExecutionPolicy Bypass -File tools/bi_api.ps1 login
   (装了 Node.js 的机器也可用 node tools/bi_api.js login)
   → 没配置时它会列出要问的四项,照着问用户(他平时浏览器登录 BI 用的):
     1. BI 完整地址(含端口——问"你浏览器打开 BI 用的完整网址是什么")
     2. 公司号(登录页公司下拉框的完整编号,带点后缀,如 002.1/003.1)
     3. 用户名   4. 密码
② 一条命令配好并自动试登录:
   powershell -ExecutionPolicy Bypass -File tools/bi_api.ps1 config <地址> <公司号> <用户名> <密码>
   → 成功=记住,以后不再问;失败按提示重问:
     连不上=地址/端口错;401=公司号没带点后缀或密码错;403=账号无 BI 权限
```

**⚠️ 在 DSH 插件环境里(有 bi_api 工具时):一律直接调用 bi_api 工具,不要跑命令行/PowerShell**——工具在插件进程内直接执行,不调用子进程,**不需要申请任何系统权限或沙箱授权**(更不要因此去要 full control)。命令行写法仅适用于"裸技能"场景(没有插件壳的 Agent)。

- 两版工具命令一一对应(参数一致):`bi_api.ps1` ↔ `node bi_api.js`,按机器有没有 Node 二选一。
- 用户说"换连接/重新配置/换密码了"→重新问四项,重跑 config。
- PG_*(直连库导出定义)/BI_LOG_DIR(查日志)是可选高级项,各机器也不同,用到时再问用户或其 IT。
- **登录请求格式与会话机制是 Monitor BI 产品固定的,所有安装一致,不需要用户配置。**

## 核心五步流程

```
① 登录        DSH插件=直接调 bi_api 工具;裸技能= bi_api.ps1 login 或 node bi_api.js login(会话自动保存续用)
② 选型        读 tools/module_dictionary.json
               数据源 = 8模块名之一(精确匹配)
               组件绑定 = 列显示名(Alias),不是物理列名
               ⚠️字典提取自某一具体环境——新环境版本差很多时,
               先 list+看系统盘核对查询名,绑不上别硬套
③ 生成 XML    DSH插件=bi_write 存草稿;裸技能=写到工作目录。从 templates/ 抠模板修改
               每列必须 Name="中文名"
               表格加 <GridOptions ColumnWidthMode="Manual"/>
               SQL 中 < > & 转义;自定义SQL禁用CTE(WITH),只写子查询
④ 部署        ⚠️ 先切英文 → 导入 → 切回中文(命令内部已自动处理)
               部署后必做验证(见⑤)
⑤ 验证        bi_api verify 30(查取数SQL与报错)+ 浏览器打开确认出数
```

## 改已有盘(B方案,ID/网址不变)⚠️ 用户最看重

```
触发条件:用户说"改/加/调整某张盘" = 必须走 B 方案(ID 不变)
只有用户明确说"做一张新的"才允许 import 新盘

① 导出当前定义: bi_api get-xml <id> old.xml(从库导出,不是模板!)
   (get-xml 需配置 PG_*;没配就 GET dashboard JSON 人工核对后改 XML)
② 剥BOM → 在导出XML上修改
③ 一条命令注入: bi_api save <id> new.xml [新标题]
   (内部自动:切英文→临时导入→取裸Dashboard→POST回原ID→删临时→切回中文→读回验证)
④ 部署前自查:"这次操作会不会改变 ID?" 会 = 用错流程了
```

`save` 是唯一正确入口;手写裸 POST 时只认 `.Dashboard` 裸对象(带壳=盘被清成52字节空壳)。

## 十大铁律(违反必炸)

1. **部署必须在英文语言下**(中文导入=组件绑定断裂),完事切回中文
2. **ID 一律接口直读,禁止手抄/编造**
3. **看板 SQL 查 `bi.*` 表(同步产物),禁止直接写 G5 的表 SQL**(看板连的是 BI 库)
4. 公司号必须带实例号后缀(`002.1`/`003.1` 每家不同,只写`002`→401);首次连接问用户,禁止猜
5. 组件绑定:**标准查询用显示名(Alias);自定义SQL用SQL别名原样**+Name="中文"(错绑报 "data items do not exist";改SQL别名必须同步改绑定)
6. 数据源名=8模块名精确匹配(Sales/Purchase/Manufacturing/Stock/Accounting/General registers/Time recording/Sustainability)
7. Grid列用嵌套子元素`<GridDimensionColumn><Dimension/></GridDimensionColumn>`(属性写法=静默0列)
8. 造盘前查目标表行数 + SQL先实测(可能为空或语法错)
9. 日期维度必须显式 `DateTimeGroupInterval="DayMonthYear"`(默认按年分组)
10. XML属性值不能含 < > 字符(格式规则名改用文字,如"良品率低红")

## 常见报错速查

| 现象 | 原因→解法 |
|---|---|
| 登录401 | 公司号没带点后缀,或密码错 |
| 登录403 | 账号无 BI 权限,找管理员开通 |
| data items do not exist | 标准查询=绑定没用显示名;**自定义SQL=绑定没用SQL别名原样** |
| operator does not exist: interval <= integer | 日期相减没做 ::date 转换(时间戳列相减得了interval)→两边加 ::date |
| 导入后组件全断/错位 | 在中文语言下导入了→改英文重导 |
| 盘变成52字节空白 | POST 了带壳对象→只 POST .Dashboard 裸对象 |
| 表里日期只显示年份 | 缺 DateTimeGroupInterval="DayMonthYear" |
| 自定义SQL被拒"only SELECT" | 用了CTE(WITH)→改内联子查询 |
| 数据行数暴增 | 一对多JOIN重复→DISTINCT ON (主键) |
| Quartz调度报格式错 | cron 必须6段含秒:`0 */5 * * * ?` |
| 前端显示"已删除" | ≠真删除,先 GET 接口看实态 |
| PowerShell版登录成功但请求401 | PS5.1 丢Cookie头→必须用 -WebSession(工具已处理,改代码时注意) |
| PowerShell版返回中文变? | 无charset响应按拉丁解码→必须 RawContentStream+UTF8 手动解码 |

## 准实时数据(需要分钟级新鲜度时)

标准同步每天一次(06:00)。需要5分钟级时建 Custom Extraction:
- API: POST /api/customextraction/save(CompanyIds 模式,免外部库注册)
- 调度: cron 6段含秒 `0 */5 * * * ?`
- 看板数据源名 = `Custom Extractions`,XML 查询定义必须写全列
- 抽取 SQL 直连 G5 源库(注意:对方源库若是 SQL Anywhere 需按其方言写);看板 SQL 只查 BI 库 bi.* 自建表——**永远不混**

## 对方机器数据库不是 PostgreSQL 时

Monitor 源库有4种(SQL Anywhere 老牌默认/PG/SQL Server/SQLite);BI 仓库库有3种(SQLite小安装/PG/SQL Server)。**换任何组合:**
- 登录/列表/导入/改盘/验证/备份(接口操作)+8模块标准查询看板 = **零影响**
- 报表XML里占位连接 ProviderKey 不用管(导入时 BI 自动改写为本机类型)
- 受影响仅两处:自定义SQL要按对方库语法写(先导对方系统盘照抄写法);实时管道SQL按对方源库方言重写

## 常见需求→模板映射

| 用户说 | 用哪个模板 | 关键改动 |
|---|---|---|
| 做张趋势图 | poc3_order_trend.xml | 换数据源/查询/列 |
| 做个驾驶舱(多组件) | poc4_cockpit.xml | 换数据+加组件 |
| 做张表(能点击看明细) | poc7_wall_due_purchase.xml | 换SQL+列 |
| 做供应商/客户评估 | poc8_supplier_eval.xml | 换维度+指标 |
| 做排行榜(两个视角) | purchase_analysis.xml | 双Tab+独立查询 |
| 做张简单的表 | poc2_minimal.xml | 最小骨架 |
| 做生产车间看板(工序+工作中心) | production_dashboard.xml | 需先建实时管道 |
| 库龄/呆滞/天数分档类 | stock_aging.xml | SQL层算天数+CASE分档,不需要管道 |

## 沟通与交付

- 做完给三件事:报表名、在哪个分类下、打开方式(网址)
- B方案改盘网址不变;做新盘要提醒更新收藏
- 换版后提醒 Ctrl+F5(浏览器缓存)
- 数仓里的数据值(如订单状态 Registered)是英文,产品限制;可在自定义SQL里 CASE WHEN 翻译成中文

## Spec 驱动模式(用户发来结构化需求文件时)

用户可能发来一份 BI 需求规格(空白模板=`bi-spec-template.md`,或用户自己写的结构化需求:报表名/数据需求/维度/指标/展示要求/筛选/标注规则)。处理:
1. 解析 spec→提取六要素 2. 查字典映射数据(指标需计算时设计自定义SQL) 3. 按展示要求选模板(穿透表/趋势图/排行/筛选→对应组件) 4. 生成XML走五步流程
关键词映射:穿透表=主筛选汇总+明细联动;趋势图=Chart;排行=Grid+SortByMeasure;筛选时间=DateFilter+DateTimePeriods;标注颜色=FormatConditionExpression;标注图标=FormatConditionRangeSet+IconSettings。
**spec 有不明确处(如"数据源:自定义")→列问题问用户,不要猜。**

## G5 附加字段管理(如给工作中心加"机台状态")

**G5(Monitor ERP)的地址和管理员账号每家不同,和 BI 的不一定相同——需要动 G5 时向用户另外要,禁止沿用 BI 配置猜。**

流程:①CreateExtraFieldGroup {Name}→GroupId ②AddExtraFieldTemplate {GroupId,Name,Type,Description}→TemplateId ③AddExtraFieldOptionTemplate 逐个加选项 ④CreateExtraField {EntityId,EntityType,TemplateId} 挂实体 ⑤SetExtraFieldValues 设值。
三大坑:①CreateExtraFieldGroup 不收 EntityType→entityid 是随机GUID,需手动 UPDATE 成正确实体GUID(查你库里的实体类型表) ②Type=7 是 MultiOptions(多选)→设值必须用 MultiOptionsValue:["值"] 数组 ③G5 的 ID 是雪花大数,超 JS 安全整数→拼 JSON 必须字符串嵌入,禁止 parseInt。

## 本技能文件清单

| 文件 | 用途 |
|---|---|
| `说明书.md` | 给人看的使用指南(小白友好) |
| `bi-spec-template.md` | BI 需求规格空白模板(用户填好发来→Spec 驱动模式) |
| `tools/bi_api.ps1` | **零依赖版**客户端(Windows自带PowerShell,命令同js版) |
| `tools/bi_api.js` | Node 版客户端(需 node_modules,已随包) |
| `tools/bi_config.env.example` | 连接配置模板(config 命令会自动生成正式配置) |
| `tools/module_dictionary.json` | 8模块数据字典(显示名↔物理列) |
| `templates/*.xml` | 通用模板(最小表/趋势/驾驶舱/穿透/评估/排行/生产/库龄分档等) |

工具命令全集:`config <地址> <公司号> <用户名> <密码>` / `login` / `list` / `import <标题> <xml> [分类]` / `save <id> <xml> [标题]` / `get <id> [输出文件]` / `get-xml <id> [输出文件]`(需PG配置) / `verify [分钟]`(需日志目录配置) / `backup <id...>` / `delete <id>` / `lang en|zh`

<!--DEV-ONLY:以下内容只在本机开发版存在,分发包(zip/插件)构建时从此标记起全部剥除-->
## 开发版专属(本机维护用)

- `CHANGELOG.md`:30+个坑的完整时间线与根因(**遇到报错先搜这里**,速查表是其浓缩)
- `spec.md`:操作契约(API/XML/口径/红线/纪律全量版)
- `check_bindings.js`(全库绑定体检,需PG)/`sinicize.js`(系统盘中文化)/`lib_db.js`(bytea解码)
- `templates/` 里另有 dash_一车间/二车间/装配/FQC 与 iqc_dashboard(本机客户案例衍生模板,分发版不含)
- `bi_dashboard_controller.html`+`启动大屏.bat`:大屏自动刷新控制器(挂墙场景)
- `独立入口.md`/`新机器测试场景.md`/`安装手册.md`/`怎么跟我描述需求.md`:分发与验收物料
- 管道实例(本机已建①-⑤):①日更整仓 ②采购5min ③销售5min ④生产工序5min ⑤IQC 5min
- 构建分发包:跑 打包分发版.ps1(从本目录生成小白版 zip:两文档+精简工具+模板,剥除 DEV-ONLY 段与本机私有文件)
