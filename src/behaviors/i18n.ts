/*
 * @icen.ai/ui — Behavior: i18n（本地化注册表：文案唯一事实源）
 *
 * 顶层设计（业界 LocaleProvider/LocalizationProvider 的「注册表 + 合并覆盖」模式，框架无关纯函数层）：
 *
 *   - ICEN_LOCALE_ZH_CN = 全库行为层硬编码中文文案的扁平 key 注册表（默认语言）。
 *   - ICEN_LOCALE_EN_US = 完整英文翻译；消费方 setIcenLocale(ICEN_LOCALE_EN_US) 一键切换，
 *     或传任意 Partial<IcenLocale> 逐 key 覆盖（合并进当前语言，不清表）。
 *   - t(key) 是行为层取文案的唯一入口：渲染时取值 → 切换语言后「新渲染」即新文案；
 *     模块级注册表（ai-core kind 标签 / ai-tools schema / provider 标签等）在导入时按当时语言快照。
 *   - 数组型 key（datePicker.weekdays 等）返回 string[]，t() 泛型按 key 推断返回值。
 *   - 插值：t(key, { p0, p1 }) 以 {p0}/{p1} 占位符替换（缺省变量原样保留）。
 *   - setIcenLocale / resetIcenLocale 后自 document 派发 icen:locale-change 广播
 *     （detail = { changed: string[] }，传播只经 [document, window]，见 events.ts 广播约定），
 *     组件可据此重渲染；SSR 下静默 no-op。
 *   - getIcenLocale() 返回冻结浅快照（数组克隆），改它不影响内部状态。
 *
 * 文案盘点表（组件/模块 → key；生成自 src/behaviors 全量 CJK 字面量扫描）：
 *
 *   aiBranch（ai-branch 分支切换）：nextVersion prevVersion version
 *   aiChat（ai-chat 消息流）：backToBottom backToBottomCount continue download file roleSystem roleTool roleUser thinking
 *   aiComposer（ai-composer 输入台）：attachAgent attachDoc attachFile attachFolder cacheInvalidHint commands currentTodos done justNow modelAria noCommandMatch noModelMatch noRefMatch placeholder refs removeAttachment removeQueued removeRef searchModels selectModel send stop todoChip todoHasError
 *   aiCore（ai-core 状态机/kind 注册表）：kindBrowser kindChart kindDelete kindEdit kindFetch kindGlob kindGrep kindNote kindPlan kindRead kindSearch kindShell kindSkill kindSubagent kindTodo kindWrite statusApproval statusCancelled statusDone statusError statusPending statusRunning statusStreaming todoProgress
 *   aiDiff（ai-diff 差异卡）：accepted binary empty rejected
 *   aiFeedback（ai-feedback 反馈）：helpful notHelpful reasonCitationMismatch reasonOutdated reasonUnauthorized reasonUnsourced reasonWrong thanks
 *   aiPanel（ai-panel 任务/用量/审计/上下文）：audit cacheRead cacheWrite callsTokens clearAudit context contextWindow errorsCount files itemStatus noAudit noUsage reasoning requestsCount ringPercent ringUsed taskProgress toolsCount usage usageAria
 *   aiProvider（ai-provider 提供商与线协议错误）：audioUrlOnly audioUrlOnlyAnthropic base64File corsHint emptyResponse glmLabel invalidJson kimiLabel networkFailed nonPdfDocument requestCancelled resourceRef streamError toolRoleNoCallId toolRoleNoUseId unsupported videoUnsupported videoUnsupportedAnthropic
 *   aiThreads（ai-threads 会话列表）：actionsAria archived
 *   aiTool（ai-tool 工具/子代理卡）：allow reject
 *   aiTools（ai-tools 工具校验消息与 render_chart / render_datatable schema）：chart.area chart.data chart.dates chart.description chart.dims chart.format chart.labels chart.legend chart.lttb chart.marks chart.points chart.radarAxes chart.segments chart.series chart.stacked chart.title chart.tooltip chart.type chart.values chart.zoom datatable.columns datatable.description datatable.rows datatable.title execFailed execTimeout manifestHeader missingRequired none notInEnum numMax numMin removeMount strMax strMin typeMismatch validationFailed
 *   autocomplete（autocomplete 自动补全）：empty
 *   backTop（back-top）：label
 *   carousel（carousel 轮播）：item
 *   charts（charts 图表（空态/缩放/图例/日历标签））：calendarWeekdays few hideLegend loading many monthLabel noData resetZoom sampled seriesName showLegend value
 *   common（通用动作/状态词（跨模块复用））：accept add all approve cancel close confirm copied copy delete enable exportCsv healthy input loadingEllipsis official output page reject remove requestAccess requestAccessFor restricted retry rows run steps submit unknown
 *   contextMenu（context-menu 内建菜单项）：back copyPageLink forward refresh
 *   copy（copy 复制反馈）：copied denied unavailable unknown
 *   datatable（datatable 数据表）：clear collapseGroup columnSettingsAria countUnit editHint empty emptyValue expandGroup expandRow filterChipAria pageSizeAria paginationAria reset resizeAria searchAria searchPlaceholder selectAll selectRow selectedCount totalCount totalLabel
 *   datePicker（date-picker 日期选择）：clear nextMonth prevMonth selectDate today weekdays weekdaysSunFirst yearMonth
 *   formValidate（form-validate 校验消息与 render_form schema）：email invalid matches max maxlength min minlength number pattern required selectPlaceholder step summary tool.description tool.fields tool.help tool.label tool.max tool.min tool.name tool.options tool.pattern tool.required tool.submitText tool.title tool.type url
 *   input（input 密码显隐/OTP）：hidePassword otpPosition showPassword
 *   kbAccess（kb-access 访问申请（权限域））：approveTip approvedBadge approverNotePlaceholder daysLeft defaultSubject deniedHint denyNoteLabel duration30d duration7d durationForever durationLabel expired expiresAt grantAsPrefix grantRoleLabel hoursLeft minutesLeft ownerLabel ownerPrefix reapply reasonLabel reasonPlaceholder rejectTip requestRenewal requestToPrefix restrictedContent restrictedHint revokedHint roleLabel submitRequest switchIdentity switchIdentityTip unknownRequester waitingApproval
 *   kbAcl（kb-acl 权限继承（权限域））：breakHint breakInheritance brokenNotice detachedChildren directAccess exception expiredOn expiresIn grantAccess inheritedFrom inheritedFromLabel linkAccess noDirect noLinks removeEntry restoreHint restoreInheritance rootNotice systemBadge systemNote unnamedResource visibleToCount
 *   kbAnswer（kb-answer 认证答案/问数）：chartBar chartLine chartPie exportNoun filtered filteredDetail followups hitAssets kindCurated kindFunction kindParameterized maskedPrefix rerunTip truncated verifiedBadge
 *   kbAudit（kb-audit 审计（权限域））：actionDetail actionLabel alertedNote channelFilterAria channelPermission channelRead channelRequest channelSystem empty exportTip hygieneLabel noHygiene
 *   kbCanvas（kb-canvas 画布）：splitterAria splitterTip
 *   kbCheckpoint（kb-checkpoint 检查点）：chatAuditNote label restore scopeBoth scopeChat scopeContent scopeMissing
 *   kbChunks（kb-chunks 切片）：addKeyword chunkAddKeywordAria chunkContentAria chunkEnableAria deleteChunkAria disableNote edited empty modeFull modeLabel modeVector removeKeyword searchAria searchFullPlaceholder searchVectorPlaceholder
 *   kbCitation（kb-citation 引用角标）：sourceN unavailable
 *   kbClarify（kb-clarify 澄清）：parsedPrefix
 *   kbConflict（kb-conflict 冲突）：owner
 *   kbConnector（kb-connector 连接器）：changeRate crawlRate credentials credentialsExpired editSchedule empty failing lastSync neverSynced notConfigured off perDay reauth stale syncNow synced
 *   kbCore（kb-core 契约层格式化（来源类型/状态/权限级/审计事件/异味））：accessDenied accessExpired accessExpiring accessGranted accessNotRequested accessPending accessRequested accessRevoked auditApprove auditBreakGlass auditDelegation auditDeny auditGrant auditPermissionChange auditPreview auditRead auditRequest auditRevoke auditSync daysAgo hoursAgo hygieneBroadGroup hygieneBrokenInheritance hygieneOrgWideLink hygieneOrphanedOwner hygieneOverexposed hygieneSensitiveMismatch justNow levelComment levelEdit levelNone levelOwner levelView minutesAgo runCancelled runDone runFailed runQueued runRunning runUnstarted stageAgent stageChunk stageEmbed stageGeneration stageGuard stageQuery stageRerank stageRetrieval stageTool typeApi typeCode typeDatabase typeDocument typeEmail typeImage typeKb typeTable typeTicket typeWebpage unnamedSource unnamedSubject visHidden visMetadataOnly visSummaryOnly visVisible
 *   kbEval（kb-eval 求值对比）：avgA avgB compare expected gradeImprovement gradeRegression gradeTie gradeTradeoff noData onlyRegression outputA outputB outputN
 *   kbExplain（kb-explain 口径解释）：empty groupAgg groupColumn groupFilter groupTable trigger viewDefinition
 *   kbFilter（kb-filter 过滤器）：addGroup addRule and combineMode copyDsl deleteGroup deleteRule fieldLabel fieldPlaceholder noValueNeeded none opContains opEq opExists opGt opGte opIn opLt opLte opNe operatorLabel or toggleAndOr valueAria valueLabel valuePlaceholder
 *   kbGap（kb-gap 缺口分析）：addSynonym colCount colLastSeen colQuery colShare createDoc empty title zeroClickHint zeroClickRate zeroClickTitle
 *   kbHittest（kb-hittest 命中测试）：addAria addPlaceholder avgScore deleteQuestion empty expectHit expectMiss hitRate noExpectation notRun pass pin runAll sessionOnly sessionOnlyHint unpin
 *   kbMetadata（kb-metadata 元数据）：addField builtIn colField colType colValue empty nameLabel namePlaceholder removeField typeLabel valueOf
 *   kbPassage（kb-passage 原文段落）：blockRange close expandContext locate none pageRange restricted unitByte unitChar
 *   kbPipeline（kb-pipeline 解析管线）：empty progress rerun unknownStage
 *   kbQa（kb-qa 问答对）：colAnswer colQuestion csvHint deleteRow empty importCsv
 *   kbRerank（kb-rerank 重排对比）：after before compareTitle down dropped empty enableCompare newIn unmarked up
 *   kbRetrieval（kb-retrieval 检索 playground（过滤层说明与 kb-visibility 共用））：breakdown copyParams decreaseTopK empty failOpenNotice hybridWeight identityLabel identityShort increaseTopK keywordHint layerLabel layerNone layerPost layerPre leakNote modeHybrid modeKeyword modeLabel modeVector postFilterNotice queryLabel queryPlaceholder rerankLabel rerankThresholdOff rerankThresholdOn running thresholdLabel thresholdValue vectorHint vectorPercent weightValue
 *   kbReview（kb-review 审查队列）：assignee doneNext empty emptyAssignee emptyQueue kbCloseHint kbSelectOption kbSwitchItem kbToggleHint shortcuts typeAnswer typeMessage typeTrace unassigned
 *   kbSandbox（kb-sandbox 应用沙箱）：noResolver notReady resolveFailed timeout title
 *   kbSegment（kb-segment 分段）：avgLength childNote cleanBlankLines cleanEmails cleanLinks empty maxLengthLabel maxLengthPlaceholder modeAuto modeCustom modeLabel modeNote modeParentChild overlapInvalid overlapLabel overlapPlaceholder previewNote segmentsCount separatorLabel separatorPlaceholder toggleTip
 *   kbSources（kb-sources 来源列表）：cited empty
 *   kbSql（kb-sql 生成的 SQL）：adminOnly applyFix confirmRerun editRerun fixReady generated
 *   kbTrace（kb-trace 调用链）：empty hits
 *   kbVisibility（kb-visibility 可见性对照（权限域））：adminOnlyNote adminWarn failOpenNote focusColumn layerValue leakageNote postFilterNote queryLabel safeCount sourceUnavailable unnamedHit
 *   kbWhoCan（kb-who-can 谁能看（权限域））：check checkIdentity daysUntil deniedBy denyVeto direct expiresSoon hoursUntil inherit link noDeny noIdentity none recheckTip stackRule
 *   mentions（mentions 提及）：loading
 *   notification（notification 通知）：ariaLabel viewDetails
 *   pagination（pagination 分页（datatable 工具栏））：next pageSize prev
 *   select（select 搜索/空态）：noMatch remove searchPlaceholder
 *   tagInput（tag-input 标签输入）：ariaLabel remove
 *   upload（upload 上传校验）：remove tooBig tooMany typeNotAllowed
 *
 * 不进 locale 的 CJK 字面量（开发者向，非 UI 文案，保持硬编码）：
 *   console 警告/排障信息——command-palette/modal 的 backdrop 缺失提示、charts 的
 *   markWarnOnce 标记告警与 append 类型告警、ai-composer 的 client 降级提示、
 *   ai-provider 的未注册 provider 抛错。
 */

import { emitIcen } from './events';

/** 本地化注册表：扁平 key → 文案（string；数组型 key 为 string[]）。 */
export interface IcenLocale {
  /* ── aiBranch ── */
  'aiBranch.nextVersion': string;
  'aiBranch.prevVersion': string;
  'aiBranch.version': string;
  /* ── aiChat ── */
  'aiChat.backToBottom': string;
  'aiChat.backToBottomCount': string;
  'aiChat.continue': string;
  'aiChat.download': string;
  'aiChat.file': string;
  'aiChat.roleSystem': string;
  'aiChat.roleTool': string;
  'aiChat.roleUser': string;
  'aiChat.thinking': string;
  /* ── aiComposer ── */
  'aiComposer.attachAgent': string;
  'aiComposer.attachDoc': string;
  'aiComposer.attachFile': string;
  'aiComposer.attachFolder': string;
  'aiComposer.cacheInvalidHint': string;
  'aiComposer.commands': string;
  'aiComposer.currentTodos': string;
  'aiComposer.done': string;
  'aiComposer.justNow': string;
  'aiComposer.modelAria': string;
  'aiComposer.noCommandMatch': string;
  'aiComposer.noModelMatch': string;
  'aiComposer.noRefMatch': string;
  'aiComposer.placeholder': string;
  'aiComposer.refs': string;
  'aiComposer.removeAttachment': string;
  'aiComposer.removeQueued': string;
  'aiComposer.removeRef': string;
  'aiComposer.searchModels': string;
  'aiComposer.selectModel': string;
  'aiComposer.send': string;
  'aiComposer.stop': string;
  'aiComposer.todoChip': string;
  'aiComposer.todoHasError': string;
  /* ── aiCore ── */
  'aiCore.kindBrowser': string;
  'aiCore.kindChart': string;
  'aiCore.kindDelete': string;
  'aiCore.kindEdit': string;
  'aiCore.kindFetch': string;
  'aiCore.kindGlob': string;
  'aiCore.kindGrep': string;
  'aiCore.kindNote': string;
  'aiCore.kindPlan': string;
  'aiCore.kindRead': string;
  'aiCore.kindSearch': string;
  'aiCore.kindShell': string;
  'aiCore.kindSkill': string;
  'aiCore.kindSubagent': string;
  'aiCore.kindTodo': string;
  'aiCore.kindWrite': string;
  'aiCore.statusApproval': string;
  'aiCore.statusCancelled': string;
  'aiCore.statusDone': string;
  'aiCore.statusError': string;
  'aiCore.statusPending': string;
  'aiCore.statusRunning': string;
  'aiCore.statusStreaming': string;
  'aiCore.todoProgress': string;
  /* ── aiDiff ── */
  'aiDiff.accepted': string;
  'aiDiff.binary': string;
  'aiDiff.empty': string;
  'aiDiff.rejected': string;
  /* ── aiFeedback ── */
  'aiFeedback.helpful': string;
  'aiFeedback.notHelpful': string;
  'aiFeedback.reasonCitationMismatch': string;
  'aiFeedback.reasonOutdated': string;
  'aiFeedback.reasonUnauthorized': string;
  'aiFeedback.reasonUnsourced': string;
  'aiFeedback.reasonWrong': string;
  'aiFeedback.thanks': string;
  /* ── aiPanel ── */
  'aiPanel.audit': string;
  'aiPanel.cacheRead': string;
  'aiPanel.cacheWrite': string;
  'aiPanel.callsTokens': string;
  'aiPanel.clearAudit': string;
  'aiPanel.context': string;
  'aiPanel.contextWindow': string;
  'aiPanel.errorsCount': string;
  'aiPanel.files': string;
  'aiPanel.itemStatus': string;
  'aiPanel.noAudit': string;
  'aiPanel.noUsage': string;
  'aiPanel.reasoning': string;
  'aiPanel.requestsCount': string;
  'aiPanel.ringPercent': string;
  'aiPanel.ringUsed': string;
  'aiPanel.taskProgress': string;
  'aiPanel.toolsCount': string;
  'aiPanel.usage': string;
  'aiPanel.usageAria': string;
  /* ── aiProvider ── */
  'aiProvider.audioUrlOnly': string;
  'aiProvider.audioUrlOnlyAnthropic': string;
  'aiProvider.base64File': string;
  'aiProvider.corsHint': string;
  'aiProvider.emptyResponse': string;
  'aiProvider.glmLabel': string;
  'aiProvider.invalidJson': string;
  'aiProvider.kimiLabel': string;
  'aiProvider.networkFailed': string;
  'aiProvider.nonPdfDocument': string;
  'aiProvider.requestCancelled': string;
  'aiProvider.resourceRef': string;
  'aiProvider.streamError': string;
  'aiProvider.toolRoleNoCallId': string;
  'aiProvider.toolRoleNoUseId': string;
  'aiProvider.unsupported': string;
  'aiProvider.videoUnsupported': string;
  'aiProvider.videoUnsupportedAnthropic': string;
  /* ── aiThreads ── */
  'aiThreads.actionsAria': string;
  'aiThreads.archived': string;
  /* ── aiTool ── */
  'aiTool.allow': string;
  'aiTool.reject': string;
  /* ── aiTools ── */
  'aiTools.chart.area': string;
  'aiTools.chart.data': string;
  'aiTools.chart.dates': string;
  'aiTools.chart.description': string;
  'aiTools.chart.dims': string;
  'aiTools.chart.format': string;
  'aiTools.chart.labels': string;
  'aiTools.chart.legend': string;
  'aiTools.chart.lttb': string;
  'aiTools.chart.marks': string;
  'aiTools.chart.points': string;
  'aiTools.chart.radarAxes': string;
  'aiTools.chart.segments': string;
  'aiTools.chart.series': string;
  'aiTools.chart.stacked': string;
  'aiTools.chart.title': string;
  'aiTools.chart.tooltip': string;
  'aiTools.chart.type': string;
  'aiTools.chart.values': string;
  'aiTools.chart.zoom': string;
  'aiTools.datatable.columns': string;
  'aiTools.datatable.description': string;
  'aiTools.datatable.rows': string;
  'aiTools.datatable.title': string;
  'aiTools.execFailed': string;
  'aiTools.execTimeout': string;
  'aiTools.manifestHeader': string;
  'aiTools.missingRequired': string;
  'aiTools.none': string;
  'aiTools.notInEnum': string;
  'aiTools.numMax': string;
  'aiTools.numMin': string;
  'aiTools.removeMount': string;
  'aiTools.strMax': string;
  'aiTools.strMin': string;
  'aiTools.typeMismatch': string;
  'aiTools.validationFailed': string;
  /* ── autocomplete ── */
  'autocomplete.empty': string;
  /* ── backTop ── */
  'backTop.label': string;
  /* ── carousel ── */
  'carousel.item': string;
  /* ── charts ── */
  'charts.calendarWeekdays': string[];
  'charts.few': string;
  'charts.hideLegend': string;
  'charts.loading': string;
  'charts.many': string;
  'charts.monthLabel': string;
  'charts.noData': string;
  'charts.resetZoom': string;
  'charts.sampled': string;
  'charts.seriesName': string;
  'charts.showLegend': string;
  'charts.value': string;
  /* ── themeSwitcher ── */
  'themeSwitcher.appearance': string;
  'themeSwitcher.theme': string;
  'themeSwitcher.primitive': string;
  'themeSwitcher.mode': string;
  'themeSwitcher.light': string;
  'themeSwitcher.dark': string;
  'themeSwitcher.benzhen': string;
  'themeSwitcher.clay': string;
  'themeSwitcher.piano': string;
  'themeSwitcher.art': string;
  'themeSwitcher.vangogh': string;
  'themeSwitcher.ink': string;
  'themeSwitcher.pixel': string;
  /* ── codeBlock ── */
  'codeBlock.collapse': string;
  'codeBlock.copy': string;
  'codeBlock.foldCollapse': string;
  'codeBlock.foldExpand': string;
  'codeBlock.linesTotal': string;
  'codeBlock.numHide': string;
  'codeBlock.numShow': string;
  'codeBlock.tailAria': string;
  'codeBlock.wrapOff': string;
  'codeBlock.wrapOn': string;
  /* ── common ── */
  'common.accept': string;
  'common.add': string;
  'common.all': string;
  'common.approve': string;
  'common.cancel': string;
  'common.actionFailed': string;
  'common.close': string;
  'common.confirm': string;
  'common.copied': string;
  'common.copy': string;
  'common.delete': string;
  'common.enable': string;
  'common.exportCsv': string;
  'common.healthy': string;
  'common.input': string;
  'common.loadingEllipsis': string;
  'common.official': string;
  'common.output': string;
  'common.page': string;
  'common.reject': string;
  'common.remove': string;
  'common.requestAccess': string;
  'common.requestAccessFor': string;
  'common.restricted': string;
  'common.retry': string;
  'common.rows': string;
  'common.run': string;
  'common.steps': string;
  'common.submit': string;
  'common.unknown': string;
  /* ── contextMenu ── */
  'contextMenu.back': string;
  'contextMenu.copyPageLink': string;
  'contextMenu.forward': string;
  'contextMenu.refresh': string;
  /* ── copy ── */
  'copy.copied': string;
  'copy.denied': string;
  'copy.unavailable': string;
  'copy.unknown': string;
  /* ── datatable ── */
  'datatable.clear': string;
  'datatable.collapseGroup': string;
  'datatable.columnSettingsAria': string;
  'datatable.countUnit': string;
  'datatable.editHint': string;
  'datatable.editHintWithValue': string;
  'datatable.empty': string;
  'datatable.emptyValue': string;
  'datatable.expandGroup': string;
  'datatable.expandRow': string;
  'datatable.filterChipAria': string;
  'datatable.pageSizeAria': string;
  'datatable.paginationAria': string;
  'datatable.reset': string;
  'datatable.resizeAria': string;
  'datatable.searchAria': string;
  'datatable.searchPlaceholder': string;
  'datatable.selectAll': string;
  'datatable.selectRow': string;
  'datatable.selectedCount': string;
  'datatable.totalCount': string;
  'datatable.totalLabel': string;
  /* ── datePicker ── */
  'datePicker.clear': string;
  'datePicker.nextMonth': string;
  'datePicker.prevMonth': string;
  'datePicker.selectDate': string;
  'datePicker.today': string;
  'datePicker.weekdays': string[];
  'datePicker.weekdaysSunFirst': string[];
  'datePicker.yearMonth': string;
  /* ── formValidate ── */
  'formValidate.email': string;
  'formValidate.invalid': string;
  'formValidate.matches': string;
  'formValidate.max': string;
  'formValidate.maxlength': string;
  'formValidate.min': string;
  'formValidate.minlength': string;
  'formValidate.number': string;
  'formValidate.pattern': string;
  'formValidate.required': string;
  'formValidate.selectPlaceholder': string;
  'formValidate.step': string;
  'formValidate.summary': string;
  'formValidate.tool.description': string;
  'formValidate.tool.fields': string;
  'formValidate.tool.help': string;
  'formValidate.tool.label': string;
  'formValidate.tool.max': string;
  'formValidate.tool.min': string;
  'formValidate.tool.name': string;
  'formValidate.tool.options': string;
  'formValidate.tool.pattern': string;
  'formValidate.tool.required': string;
  'formValidate.tool.submitText': string;
  'formValidate.tool.title': string;
  'formValidate.tool.type': string;
  'formValidate.url': string;
  /* ── input ── */
  'input.clearSearch': string;
  'input.hidePassword': string;
  'input.otpPosition': string;
  'panel.expand': string;
  'panel.collapse': string;
  'input.showPassword': string;
  /* ── kbAccess ── */
  'kbAccess.approveTip': string;
  'kbAccess.approvedBadge': string;
  'kbAccess.approverNotePlaceholder': string;
  'kbAccess.daysLeft': string;
  'kbAccess.defaultSubject': string;
  'kbAccess.deniedHint': string;
  'kbAccess.denyNoteLabel': string;
  'kbAccess.duration30d': string;
  'kbAccess.duration7d': string;
  'kbAccess.durationForever': string;
  'kbAccess.durationLabel': string;
  'kbAccess.expired': string;
  'kbAccess.expiresAt': string;
  'kbAccess.grantAsPrefix': string;
  'kbAccess.grantRoleLabel': string;
  'kbAccess.hoursLeft': string;
  'kbAccess.minutesLeft': string;
  'kbAccess.ownerLabel': string;
  'kbAccess.ownerPrefix': string;
  'kbAccess.reapply': string;
  'kbAccess.reasonLabel': string;
  'kbAccess.reasonPlaceholder': string;
  'kbAccess.rejectTip': string;
  'kbAccess.requestRenewal': string;
  'kbAccess.requestToPrefix': string;
  'kbAccess.restrictedContent': string;
  'kbAccess.restrictedHint': string;
  'kbAccess.revokedHint': string;
  'kbAccess.roleLabel': string;
  'kbAccess.submitRequest': string;
  'kbAccess.switchIdentity': string;
  'kbAccess.switchIdentityTip': string;
  'kbAccess.unknownRequester': string;
  'kbAccess.waitingApproval': string;
  /* ── kbAcl ── */
  'kbAcl.breakHint': string;
  'kbAcl.breakInheritance': string;
  'kbAcl.brokenNotice': string;
  'kbAcl.detachedChildren': string;
  'kbAcl.directAccess': string;
  'kbAcl.exception': string;
  'kbAcl.expiredOn': string;
  'kbAcl.expiresIn': string;
  'kbAcl.grantAccess': string;
  'kbAcl.inheritedFrom': string;
  'kbAcl.inheritedFromLabel': string;
  'kbAcl.linkAccess': string;
  'kbAcl.noDirect': string;
  'kbAcl.noLinks': string;
  'kbAcl.removeEntry': string;
  'kbAcl.restoreHint': string;
  'kbAcl.restoreInheritance': string;
  'kbAcl.rootNotice': string;
  'kbAcl.systemBadge': string;
  'kbAcl.systemNote': string;
  'kbAcl.unnamedResource': string;
  'kbAcl.visibleToCount': string;
  /* ── kbAnswer ── */
  'kbAnswer.chartBar': string;
  'kbAnswer.chartLine': string;
  'kbAnswer.chartPie': string;
  'kbAnswer.exportNoun': string;
  'kbAnswer.filtered': string;
  'kbAnswer.filteredDetail': string;
  'kbAnswer.followups': string;
  'kbAnswer.hitAssets': string;
  'kbAnswer.kindCurated': string;
  'kbAnswer.kindFunction': string;
  'kbAnswer.kindParameterized': string;
  'kbAnswer.maskedPrefix': string;
  'kbAnswer.rerunTip': string;
  'kbAnswer.truncated': string;
  'kbAnswer.verifiedBadge': string;
  /* ── kbAudit ── */
  'kbAudit.actionDetail': string;
  'kbAudit.actionLabel': string;
  'kbAudit.alertedNote': string;
  'kbAudit.channelFilterAria': string;
  'kbAudit.channelPermission': string;
  'kbAudit.channelRead': string;
  'kbAudit.channelRequest': string;
  'kbAudit.channelSystem': string;
  'kbAudit.empty': string;
  'kbAudit.exportTip': string;
  'kbAudit.hygieneLabel': string;
  'kbAudit.noHygiene': string;
  /* ── kbCanvas ── */
  'kbCanvas.splitterAria': string;
  'kbCanvas.splitterTip': string;
  /* ── kbCheckpoint ── */
  'kbCheckpoint.chatAuditNote': string;
  'kbCheckpoint.label': string;
  'kbCheckpoint.restore': string;
  'kbCheckpoint.scopeBoth': string;
  'kbCheckpoint.scopeChat': string;
  'kbCheckpoint.scopeContent': string;
  'kbCheckpoint.scopeMissing': string;
  /* ── kbChunks ── */
  'kbChunks.addKeyword': string;
  'kbChunks.chunkAddKeywordAria': string;
  'kbChunks.chunkContentAria': string;
  'kbChunks.chunkEnableAria': string;
  'kbChunks.deleteChunkAria': string;
  'kbChunks.disableNote': string;
  'kbChunks.edited': string;
  'kbChunks.empty': string;
  'kbChunks.modeFull': string;
  'kbChunks.modeLabel': string;
  'kbChunks.modeVector': string;
  'kbChunks.removeKeyword': string;
  'kbChunks.searchAria': string;
  'kbChunks.searchFullPlaceholder': string;
  'kbChunks.searchVectorPlaceholder': string;
  /* ── kbCitation ── */
  'kbCitation.sourceN': string;
  'kbCitation.unavailable': string;
  /* ── kbClarify ── */
  'kbClarify.parsedPrefix': string;
  /* ── kbConflict ── */
  'kbConflict.owner': string;
  /* ── kbConnector ── */
  'kbConnector.changeRate': string;
  'kbConnector.crawlRate': string;
  'kbConnector.credentials': string;
  'kbConnector.credentialsExpired': string;
  'kbConnector.editSchedule': string;
  'kbConnector.empty': string;
  'kbConnector.failing': string;
  'kbConnector.lastSync': string;
  'kbConnector.neverSynced': string;
  'kbConnector.notConfigured': string;
  'kbConnector.off': string;
  'kbConnector.perDay': string;
  'kbConnector.reauth': string;
  'kbConnector.stale': string;
  'kbConnector.syncNow': string;
  'kbConnector.synced': string;
  /* ── kbCore ── */
  'kbCore.accessDenied': string;
  'kbCore.accessExpired': string;
  'kbCore.accessExpiring': string;
  'kbCore.accessGranted': string;
  'kbCore.accessNotRequested': string;
  'kbCore.accessPending': string;
  'kbCore.accessRequested': string;
  'kbCore.accessRevoked': string;
  'kbCore.auditApprove': string;
  'kbCore.auditBreakGlass': string;
  'kbCore.auditDelegation': string;
  'kbCore.auditDeny': string;
  'kbCore.auditGrant': string;
  'kbCore.auditPermissionChange': string;
  'kbCore.auditPreview': string;
  'kbCore.auditRead': string;
  'kbCore.auditRequest': string;
  'kbCore.auditRevoke': string;
  'kbCore.auditSync': string;
  'kbCore.daysAgo': string;
  'kbCore.hoursAgo': string;
  'kbCore.hygieneBroadGroup': string;
  'kbCore.hygieneBrokenInheritance': string;
  'kbCore.hygieneOrgWideLink': string;
  'kbCore.hygieneOrphanedOwner': string;
  'kbCore.hygieneOverexposed': string;
  'kbCore.hygieneSensitiveMismatch': string;
  'kbCore.justNow': string;
  'kbCore.levelComment': string;
  'kbCore.levelEdit': string;
  'kbCore.levelNone': string;
  'kbCore.levelOwner': string;
  'kbCore.levelView': string;
  'kbCore.minutesAgo': string;
  'kbCore.runCancelled': string;
  'kbCore.runDone': string;
  'kbCore.runFailed': string;
  'kbCore.runQueued': string;
  'kbCore.runRunning': string;
  'kbCore.runUnstarted': string;
  'kbCore.stageAgent': string;
  'kbCore.stageChunk': string;
  'kbCore.stageEmbed': string;
  'kbCore.stageGeneration': string;
  'kbCore.stageGuard': string;
  'kbCore.stageQuery': string;
  'kbCore.stageRerank': string;
  'kbCore.stageRetrieval': string;
  'kbCore.stageTool': string;
  'kbCore.typeApi': string;
  'kbCore.typeCode': string;
  'kbCore.typeDatabase': string;
  'kbCore.typeDocument': string;
  'kbCore.typeEmail': string;
  'kbCore.typeImage': string;
  'kbCore.typeKb': string;
  'kbCore.typeTable': string;
  'kbCore.typeTicket': string;
  'kbCore.typeWebpage': string;
  'kbCore.unnamedSource': string;
  'kbCore.unnamedSubject': string;
  'kbCore.visHidden': string;
  'kbCore.visMetadataOnly': string;
  'kbCore.visSummaryOnly': string;
  'kbCore.visVisible': string;
  /* ── kbEval ── */
  'kbEval.avgA': string;
  'kbEval.avgB': string;
  'kbEval.compare': string;
  'kbEval.expected': string;
  'kbEval.gradeImprovement': string;
  'kbEval.gradeRegression': string;
  'kbEval.gradeTie': string;
  'kbEval.gradeTradeoff': string;
  'kbEval.noData': string;
  'kbEval.onlyRegression': string;
  'kbEval.outputA': string;
  'kbEval.outputB': string;
  'kbEval.outputN': string;
  /* ── kbExplain ── */
  'kbExplain.empty': string;
  'kbExplain.groupAgg': string;
  'kbExplain.groupColumn': string;
  'kbExplain.groupFilter': string;
  'kbExplain.groupTable': string;
  'kbExplain.trigger': string;
  'kbExplain.viewDefinition': string;
  /* ── kbFilter ── */
  'kbFilter.addGroup': string;
  'kbFilter.addRule': string;
  'kbFilter.and': string;
  'kbFilter.combineMode': string;
  'kbFilter.copyDsl': string;
  'kbFilter.deleteGroup': string;
  'kbFilter.deleteRule': string;
  'kbFilter.fieldLabel': string;
  'kbFilter.fieldPlaceholder': string;
  'kbFilter.noValueNeeded': string;
  'kbFilter.none': string;
  'kbFilter.opContains': string;
  'kbFilter.opEq': string;
  'kbFilter.opExists': string;
  'kbFilter.opGt': string;
  'kbFilter.opGte': string;
  'kbFilter.opIn': string;
  'kbFilter.opLt': string;
  'kbFilter.opLte': string;
  'kbFilter.opNe': string;
  'kbFilter.operatorLabel': string;
  'kbFilter.or': string;
  'kbFilter.toggleAndOr': string;
  'kbFilter.valueAria': string;
  'kbFilter.valueLabel': string;
  'kbFilter.valuePlaceholder': string;
  /* ── kbGap ── */
  'kbGap.addSynonym': string;
  'kbGap.colCount': string;
  'kbGap.colLastSeen': string;
  'kbGap.colQuery': string;
  'kbGap.colShare': string;
  'kbGap.createDoc': string;
  'kbGap.empty': string;
  'kbGap.title': string;
  'kbGap.zeroClickHint': string;
  'kbGap.zeroClickRate': string;
  'kbGap.zeroClickTitle': string;
  /* ── kbHittest ── */
  'kbHittest.addAria': string;
  'kbHittest.addPlaceholder': string;
  'kbHittest.avgScore': string;
  'kbHittest.deleteQuestion': string;
  'kbHittest.empty': string;
  'kbHittest.expectHit': string;
  'kbHittest.expectMiss': string;
  'kbHittest.hitRate': string;
  'kbHittest.noExpectation': string;
  'kbHittest.notRun': string;
  'kbHittest.pass': string;
  'kbHittest.pin': string;
  'kbHittest.runAll': string;
  'kbHittest.sessionOnly': string;
  'kbHittest.sessionOnlyHint': string;
  'kbHittest.unpin': string;
  /* ── kbMetadata ── */
  'kbMetadata.addField': string;
  'kbMetadata.builtIn': string;
  'kbMetadata.colField': string;
  'kbMetadata.colType': string;
  'kbMetadata.colValue': string;
  'kbMetadata.empty': string;
  'kbMetadata.nameLabel': string;
  'kbMetadata.namePlaceholder': string;
  'kbMetadata.removeField': string;
  'kbMetadata.typeLabel': string;
  'kbMetadata.valueOf': string;
  /* ── kbPassage ── */
  'kbPassage.blockRange': string;
  'kbPassage.close': string;
  'kbPassage.expandContext': string;
  'kbPassage.locate': string;
  'kbPassage.none': string;
  'kbPassage.pageRange': string;
  'kbPassage.restricted': string;
  'kbPassage.unitByte': string;
  'kbPassage.unitChar': string;
  /* ── kbPipeline ── */
  'kbPipeline.empty': string;
  'kbPipeline.progress': string;
  'kbPipeline.rerun': string;
  'kbPipeline.unknownStage': string;
  /* ── kbQa ── */
  'kbQa.colAnswer': string;
  'kbQa.colQuestion': string;
  'kbQa.csvHint': string;
  'kbQa.deleteRow': string;
  'kbQa.empty': string;
  'kbQa.importCsv': string;
  /* ── kbRerank ── */
  'kbRerank.after': string;
  'kbRerank.before': string;
  'kbRerank.compareTitle': string;
  'kbRerank.down': string;
  'kbRerank.dropped': string;
  'kbRerank.empty': string;
  'kbRerank.enableCompare': string;
  'kbRerank.newIn': string;
  'kbRerank.unmarked': string;
  'kbRerank.up': string;
  /* ── kbRetrieval ── */
  'kbRetrieval.breakdown': string;
  'kbRetrieval.copyParams': string;
  'kbRetrieval.decreaseTopK': string;
  'kbRetrieval.empty': string;
  'kbRetrieval.failOpenNotice': string;
  'kbRetrieval.hybridWeight': string;
  'kbRetrieval.identityLabel': string;
  'kbRetrieval.identityShort': string;
  'kbRetrieval.increaseTopK': string;
  'kbRetrieval.keywordHint': string;
  'kbRetrieval.layerLabel': string;
  'kbRetrieval.layerNone': string;
  'kbRetrieval.layerPost': string;
  'kbRetrieval.layerPre': string;
  'kbRetrieval.leakNote': string;
  'kbRetrieval.modeHybrid': string;
  'kbRetrieval.modeKeyword': string;
  'kbRetrieval.modeLabel': string;
  'kbRetrieval.modeVector': string;
  'kbRetrieval.postFilterNotice': string;
  'kbRetrieval.queryLabel': string;
  'kbRetrieval.queryPlaceholder': string;
  'kbRetrieval.rerankLabel': string;
  'kbRetrieval.rerankThresholdOff': string;
  'kbRetrieval.rerankThresholdOn': string;
  'kbRetrieval.running': string;
  'kbRetrieval.thresholdLabel': string;
  'kbRetrieval.thresholdValue': string;
  'kbRetrieval.vectorHint': string;
  'kbRetrieval.vectorPercent': string;
  'kbRetrieval.weightValue': string;
  /* ── kbReview ── */
  'kbReview.assignee': string;
  'kbReview.doneNext': string;
  'kbReview.empty': string;
  'kbReview.emptyAssignee': string;
  'kbReview.emptyQueue': string;
  'kbReview.kbCloseHint': string;
  'kbReview.kbSelectOption': string;
  'kbReview.kbSwitchItem': string;
  'kbReview.kbToggleHint': string;
  'kbReview.shortcuts': string;
  'kbReview.typeAnswer': string;
  'kbReview.typeMessage': string;
  'kbReview.typeTrace': string;
  'kbReview.unassigned': string;
  /* ── kbSandbox ── */
  'kbSandbox.noResolver': string;
  'kbSandbox.notReady': string;
  'kbSandbox.resolveFailed': string;
  'kbSandbox.timeout': string;
  'kbSandbox.title': string;
  /* ── kbSegment ── */
  'kbSegment.avgLength': string;
  'kbSegment.childNote': string;
  'kbSegment.cleanBlankLines': string;
  'kbSegment.cleanEmails': string;
  'kbSegment.cleanLinks': string;
  'kbSegment.empty': string;
  'kbSegment.maxLengthLabel': string;
  'kbSegment.maxLengthPlaceholder': string;
  'kbSegment.modeAuto': string;
  'kbSegment.modeCustom': string;
  'kbSegment.modeLabel': string;
  'kbSegment.modeNote': string;
  'kbSegment.modeParentChild': string;
  'kbSegment.overlapInvalid': string;
  'kbSegment.overlapLabel': string;
  'kbSegment.overlapPlaceholder': string;
  'kbSegment.previewNote': string;
  'kbSegment.segmentsCount': string;
  'kbSegment.separatorLabel': string;
  'kbSegment.separatorPlaceholder': string;
  'kbSegment.toggleTip': string;
  /* ── kbSources ── */
  'kbSources.cited': string;
  'kbSources.empty': string;
  /* ── kbSql ── */
  'kbSql.adminOnly': string;
  'kbSql.applyFix': string;
  'kbSql.confirmRerun': string;
  'kbSql.editRerun': string;
  'kbSql.fixReady': string;
  'kbSql.generated': string;
  /* ── kbTrace ── */
  'kbTrace.empty': string;
  'kbTrace.hits': string;
  /* ── kbVisibility ── */
  'kbVisibility.adminOnlyNote': string;
  'kbVisibility.adminWarn': string;
  'kbVisibility.failOpenNote': string;
  'kbVisibility.focusColumn': string;
  'kbVisibility.layerValue': string;
  'kbVisibility.leakageNote': string;
  'kbVisibility.postFilterNote': string;
  'kbVisibility.queryLabel': string;
  'kbVisibility.safeCount': string;
  'kbVisibility.sourceUnavailable': string;
  'kbVisibility.unnamedHit': string;
  /* ── kbWhoCan ── */
  'kbWhoCan.check': string;
  'kbWhoCan.checkIdentity': string;
  'kbWhoCan.daysUntil': string;
  'kbWhoCan.deniedBy': string;
  'kbWhoCan.denyVeto': string;
  'kbWhoCan.direct': string;
  'kbWhoCan.expiresSoon': string;
  'kbWhoCan.hoursUntil': string;
  'kbWhoCan.inherit': string;
  'kbWhoCan.link': string;
  'kbWhoCan.noDeny': string;
  'kbWhoCan.noIdentity': string;
  'kbWhoCan.none': string;
  'kbWhoCan.recheckTip': string;
  'kbWhoCan.stackRule': string;
  /* ── mentions ── */
  'mentions.loading': string;
  /* ── notification ── */
  'notification.groupBusy': string;
  'notification.groupUnread': string;
  'notification.groupCount': string;
  'notification.groupExpanded': string;
  'notification.ariaLabel': string;
  'notification.viewDetails': string;
  /* ── pagination ── */
  'pagination.next': string;
  'pagination.pageSize': string;
  'pagination.prev': string;
  /* ── select ── */
  'select.fieldLabel': string;
  'select.noMatch': string;
  'select.remove': string;
  'select.searchPlaceholder': string;
  /* ── cascader / tree-select ── */
  'cascader.placeholder': string;
  'cascader.noMatch': string;
  'cascader.search': string;
  'treeSelect.placeholder': string;
  'treeSelect.noMatch': string;
  'treeSelect.search': string;
  /* ── tagInput ── */
  'tagInput.ariaLabel': string;
  'tagInput.remove': string;
  /* ── upload ── */
  'upload.remove': string;
  'upload.tooBig': string;
  'upload.tooMany': string;
  'upload.typeNotAllowed': string;
}

/** 默认语言：zh-CN（= 库内历史硬编码文案，逐字迁移）。 */
export const ICEN_LOCALE_ZH_CN: IcenLocale = {
  /* ── aiBranch ── */
  'aiBranch.nextVersion': '下一版本',
  'aiBranch.prevVersion': '上一版本',
  'aiBranch.version': '分支版本',
  /* ── aiChat ── */
  'aiChat.backToBottom': '回到底部',
  'aiChat.backToBottomCount': '回到底部 · {p0} 条新消息',
  'aiChat.continue': '继续生成',
  'aiChat.download': '下载',
  'aiChat.file': '文件',
  'aiChat.roleSystem': '系',
  'aiChat.roleTool': '工',
  'aiChat.roleUser': '我',
  'aiChat.thinking': '思考 {p0}',
  /* ── aiComposer ── */
  'aiComposer.attachAgent': '代理',
  'aiComposer.attachDoc': '文档',
  'aiComposer.attachFile': '文件',
  'aiComposer.attachFolder': '文件夹',
  'aiComposer.cacheInvalidHint': '切换模型会使 prompt 缓存失效',
  'aiComposer.commands': '命令',
  'aiComposer.currentTodos': '当前待办',
  'aiComposer.done': '完成',
  'aiComposer.justNow': '刚刚 · {p0}',
  'aiComposer.modelAria': '模型 {p0}（{p1}）',
  'aiComposer.noCommandMatch': '无匹配命令',
  'aiComposer.noModelMatch': '无匹配模型',
  'aiComposer.noRefMatch': '无匹配引用',
  'aiComposer.placeholder': '输入消息，/ 命令 · @ 引用 · Enter 发送',
  'aiComposer.refs': '引用',
  'aiComposer.removeAttachment': '移除附件 {p0}',
  'aiComposer.removeQueued': '移除排队消息 {p0}',
  'aiComposer.removeRef': '移除引用 {p0}',
  'aiComposer.searchModels': '搜索模型',
  'aiComposer.selectModel': '选择模型',
  'aiComposer.send': '发送',
  'aiComposer.stop': '停止生成',
  'aiComposer.todoChip': '当前待办 {p0}/{p1}{p2}',
  'aiComposer.todoHasError': '（有失败项）',
  /* ── aiCore ── */
  'aiCore.kindBrowser': '浏览',
  'aiCore.kindChart': '图表',
  'aiCore.kindDelete': '删除',
  'aiCore.kindEdit': '编辑',
  'aiCore.kindFetch': '请求',
  'aiCore.kindGlob': '匹配',
  'aiCore.kindGrep': '搜索',
  'aiCore.kindNote': '笔记',
  'aiCore.kindPlan': '计划',
  'aiCore.kindRead': '读取',
  'aiCore.kindSearch': '检索',
  'aiCore.kindShell': '命令',
  'aiCore.kindSkill': '技能',
  'aiCore.kindSubagent': '子代理',
  'aiCore.kindTodo': '待办',
  'aiCore.kindWrite': '写入',
  'aiCore.statusApproval': '待确认',
  'aiCore.statusCancelled': '已取消',
  'aiCore.statusDone': '完成',
  'aiCore.statusError': '失败',
  'aiCore.statusPending': '等待',
  'aiCore.statusRunning': '执行中',
  'aiCore.statusStreaming': '流式中',
  'aiCore.todoProgress': '{p0}/{p1} 完成',
  /* ── aiDiff ── */
  'aiDiff.accepted': '已接受',
  'aiDiff.binary': '二进制文件，无法显示文本差异',
  'aiDiff.empty': '无差异内容',
  'aiDiff.rejected': '已拒绝',
  /* ── aiFeedback ── */
  'aiFeedback.helpful': '有帮助',
  'aiFeedback.notHelpful': '无帮助',
  'aiFeedback.reasonCitationMismatch': '引用不符',
  'aiFeedback.reasonOutdated': '内容过时',
  'aiFeedback.reasonUnauthorized': '越权信息',
  'aiFeedback.reasonUnsourced': '无引用依据',
  'aiFeedback.reasonWrong': '答案有误',
  'aiFeedback.thanks': '感谢反馈，已关联到该条回答的追踪记录',
  /* ── aiPanel ── */
  'aiPanel.audit': '审计',
  'aiPanel.cacheRead': '缓存读',
  'aiPanel.cacheWrite': '缓存写',
  'aiPanel.callsTokens': '{p0} 次 · {p1} tok{p2}',
  'aiPanel.clearAudit': '清除审计',
  'aiPanel.context': '上下文',
  'aiPanel.contextWindow': '上下文窗口',
  'aiPanel.errorsCount': '{p0} 失败',
  'aiPanel.files': '文件 ({p0})',
  'aiPanel.itemStatus': '{p0}，状态：{p1}',
  'aiPanel.noAudit': '暂无审计记录',
  'aiPanel.noUsage': '暂无用量',
  'aiPanel.reasoning': '推理',
  'aiPanel.requestsCount': '{p0} 次请求',
  'aiPanel.ringPercent': '上下文窗口占用 {p0}%，点击查看详情',
  'aiPanel.ringUsed': '已用 {p0}，点击查看详情',
  'aiPanel.taskProgress': '任务进度',
  'aiPanel.toolsCount': '{p0} 工具',
  'aiPanel.usage': '用量',
  'aiPanel.usageAria': '用量：{p0}',
  /* ── aiProvider ── */
  'aiProvider.audioUrlOnly': '仅 URL 的音频（input_audio 需 base64，请先取回内联）',
  'aiProvider.audioUrlOnlyAnthropic': '仅 URL 的音频（audio 块需 base64 source）',
  'aiProvider.base64File': 'base64 文件（file 部件需 Files API file_id，请置于 url 槽）',
  'aiProvider.corsHint': '；浏览器直连 {p0}（{p1}）很可能被 CORS 拦截，建议经代理/自建网关转发',
  'aiProvider.emptyResponse': '响应为空',
  'aiProvider.glmLabel': 'GLM（智谱）',
  'aiProvider.invalidJson': '响应不是合法 JSON',
  'aiProvider.kimiLabel': 'Kimi（月之暗面）',
  'aiProvider.networkFailed': '网络请求失败：{p0}{p1}',
  'aiProvider.nonPdfDocument': '非 PDF 文件块（document 块为 application/pdf，收到 {p0}）',
  'aiProvider.requestCancelled': '请求已取消',
  'aiProvider.resourceRef': '[资源] {p0} ({p1})',
  'aiProvider.streamError': '流式响应错误',
  'aiProvider.toolRoleNoCallId': 'role \'tool\' 且缺 toolCallId（openai 族需 tool_call_id）',
  'aiProvider.toolRoleNoUseId': 'role \'tool\' 且缺 toolCallId（anthropic 族映射 tool_result 需 tool_use_id）',
  'aiProvider.unsupported': '{p0} 线协议不支持 {p1}',
  'aiProvider.videoUnsupported': 'video 输入（无主流 chat API 支持）',
  'aiProvider.videoUnsupportedAnthropic': 'video 输入',
  /* ── aiThreads ── */
  'aiThreads.actionsAria': '会话操作',
  'aiThreads.archived': '已归档',
  /* ── aiTool ── */
  'aiTool.allow': '允许',
  'aiTool.reject': '拒绝',
  /* ── aiTools ── */
  'aiTools.chart.area': 'line 多系列填充面积',
  'aiTools.chart.data': '任意维度原始记录 + dims 字段映射（自动透视成 类目 × 系列）',
  'aiTools.chart.dates': '贡献日历 ISO 日期（与 values 配对）',
  'aiTools.chart.description': '在用户界面渲染一张图表可视化。输入一份图表规格（纯 JSON）：labels+values（类目数值）、series（多系列）、segments（占比）、points（散点气泡）、dates（贡献日历）任给其一；type 缺省时按数据形态自动选型（时间序列→折线、占比→环形、日期→贡献日历、坐标点→散点）。图表带交互（悬停提示/点击/右键）与可隐藏图例。',
  'aiTools.chart.dims': 'data[] 的字段映射：{label?, series?, value?, x?, y?}',
  'aiTools.chart.format': '数值格式化：{notation?: compact|percent|ms, unit?}',
  'aiTools.chart.labels': '类目轴（line/vbar/hbar）',
  'aiTools.chart.legend': 'false = 初始隐藏图例',
  'aiTools.chart.lttb': '大数据量降采样：true=自动上限，数字=最大保留点数（渲染层契约，随图表重度场景落地）',
  'aiTools.chart.marks': '标记层（阈值线/参考区间/强调点），元素为纯 JSON 描述子（渲染层契约，随图表重度场景落地）',
  'aiTools.chart.points': '散点/气泡：[{x,y,size?,label?}]',
  'aiTools.chart.radarAxes': '雷达轴名',
  'aiTools.chart.segments': '占比型（donut/stack）：[{label,value}]',
  'aiTools.chart.series': '多系列（line/vbar/radar）',
  'aiTools.chart.stacked': 'vbar 多系列堆叠（默认分组）',
  'aiTools.chart.title': '图表标题（渲染在头部行左侧）',
  'aiTools.chart.tooltip': 'false = 关闭内置提示',
  'aiTools.chart.type': '图表类型，缺省自动推断',
  'aiTools.chart.values': '单系列数值（与 labels 配对）',
  'aiTools.chart.zoom': '缩放交互：\'x\'=类目轴区间缩放，\'brush\'=刷选缩放',
  'aiTools.datatable.columns': '列定义数组：每项 { key, title, sortable?, filterable? }（key 对应 rows 元素字段名）',
  'aiTools.datatable.description': '在用户界面渲染一个可搜索、分页、可导出 CSV 的数据表格。输入纯 JSON：columns 为列定义（key/title 必填），rows 为行对象数组（字段名对齐列 key）。返回 { title, rows: 行数 } 摘要。',
  'aiTools.datatable.rows': '行数据数组：每项为一个对象，字段名对齐 columns[].key',
  'aiTools.datatable.title': '表格标题（渲染在工具栏左侧）',
  'aiTools.execFailed': '工具执行失败：{p0}',
  'aiTools.execTimeout': '执行超时（{p0}ms）',
  'aiTools.manifestHeader': '可用 UI 工具（调用后在用户界面挂载可视化结果）：',
  'aiTools.missingRequired': '缺少必填字段',
  'aiTools.none': '（无已注册的 UI 工具）',
  'aiTools.notInEnum': '不在允许取值内（{p0}）',
  'aiTools.numMax': '数值 {p0} 大于最大值 {p1}',
  'aiTools.numMin': '数值 {p0} 小于最小值 {p1}',
  'aiTools.removeMount': '移除 {p0} 挂载',
  'aiTools.strMax': '长度 {p0} 超过上限 {p1}',
  'aiTools.strMin': '长度 {p0} 小于下限 {p1}',
  'aiTools.typeMismatch': '期望 {p0}，实得 {p1}',
  'aiTools.validationFailed': '参数校验失败（{p0} 项）',
  /* ── autocomplete ── */
  'autocomplete.empty': '无匹配结果',
  /* ── backTop ── */
  'backTop.label': '回到顶部',
  /* ── carousel ── */
  'carousel.item': '第 {p0} 张',
  /* ── charts ── */
  'charts.calendarWeekdays': ['一', '', '三', '', '五', '', '日'],
  'charts.few': '少',
  'charts.hideLegend': '隐藏图例',
  'charts.loading': '加载中',
  'charts.many': '多',
  'charts.monthLabel': '{p0}月',
  'charts.noData': '暂无数据',
  'charts.resetZoom': '重置缩放',
  'charts.sampled': '已抽样 {p0}→{p1} 点',
  'charts.seriesName': '系列{p0}',
  'charts.showLegend': '显示图例',
  'charts.value': '数值',
  /* ── themeSwitcher ── */
  'themeSwitcher.appearance': '外观',
  'themeSwitcher.theme': '主题',
  'themeSwitcher.primitive': '原语',
  'themeSwitcher.mode': '明暗',
  'themeSwitcher.light': '浅色',
  'themeSwitcher.dark': '深色',
  'themeSwitcher.benzhen': '本真',
  'themeSwitcher.clay': '陶土',
  'themeSwitcher.piano': '钢琴',
  'themeSwitcher.art': '艺术',
  'themeSwitcher.vangogh': '梵高',
  'themeSwitcher.ink': '墨',
  'themeSwitcher.pixel': '像素',
  /* ── codeBlock ── */
  'codeBlock.collapse': '收起',
  'codeBlock.copy': '复制',
  'codeBlock.foldCollapse': '折叠代码',
  'codeBlock.foldExpand': '展开代码',
  'codeBlock.linesTotal': '共 {p0} 行',
  'codeBlock.numHide': '隐藏行号',
  'codeBlock.numShow': '显示行号',
  'codeBlock.tailAria': '展开或收起代码',
  'codeBlock.wrapOff': '关闭换行',
  'codeBlock.wrapOn': '自动换行',
  /* ── common ── */
  'common.accept': '接受',
  'common.add': '新增',
  'common.all': '全部',
  'common.approve': '批准',
  'common.cancel': '取消',
  'common.actionFailed': '操作未完成，请重试。',
  'common.close': '关闭',
  'common.confirm': '确认',
  'common.copied': '已复制',
  'common.copy': '复制',
  'common.delete': '删除',
  'common.enable': '启用',
  'common.exportCsv': '导出 CSV',
  'common.healthy': '正常',
  'common.input': '输入',
  'common.loadingEllipsis': '加载中…',
  'common.official': '官方',
  'common.output': '输出',
  'common.page': '第 {p0} 页',
  'common.reject': '拒绝',
  'common.remove': '移除',
  'common.requestAccess': '申请访问',
  'common.requestAccessFor': '申请访问 {p0}',
  'common.restricted': '受限',
  'common.retry': '重试',
  'common.rows': '{p0} 行',
  'common.run': '运行',
  'common.steps': '{p0} 步',
  'common.submit': '提交',
  'common.unknown': '未知',
  /* ── contextMenu ── */
  'contextMenu.back': '后退',
  'contextMenu.copyPageLink': '复制页面链接',
  'contextMenu.forward': '前进',
  'contextMenu.refresh': '刷新',
  /* ── copy ── */
  'copy.copied': '已复制',
  'copy.denied': 'clipboard API 被拒（{p0}）且回退 execCommand 失败',
  'copy.unavailable': '剪贴板不可用（无 clipboard API 且 execCommand 回退失败）',
  'copy.unknown': '未知错误',
  /* ── datatable ── */
  'datatable.clear': '清空',
  'datatable.collapseGroup': '折叠分组 {p0}',
  'datatable.columnSettingsAria': '列设置',
  'datatable.countUnit': '{p0} 条',
  'datatable.editHint': '编辑「{p0}」：双击或按 Enter',
  'datatable.editHintWithValue': '{p0}（双击或按 Enter 编辑「{p1}」）',
  'datatable.empty': '暂无数据',
  'datatable.emptyValue': '（空）',
  'datatable.expandGroup': '展开分组 {p0}',
  'datatable.expandRow': '展开行',
  'datatable.filterChipAria': '筛选「{p0}」',
  'datatable.pageSizeAria': '每页条数',
  'datatable.paginationAria': '分页',
  'datatable.reset': '重置',
  'datatable.resizeAria': '调整「{p0}」列宽',
  'datatable.searchAria': '搜索表格',
  'datatable.searchPlaceholder': '搜索…',
  'datatable.selectAll': '全选',
  'datatable.selectRow': '选择该行',
  'datatable.selectedCount': '已选 {p0} 项',
  'datatable.totalCount': '共 {p0} 条',
  'datatable.totalLabel': '合计',
  /* ── datePicker ── */
  'datePicker.clear': '清除',
  'datePicker.nextMonth': '下一月',
  'datePicker.prevMonth': '上一月',
  'datePicker.selectDate': '选择日期',
  'datePicker.today': '今天',
  'datePicker.weekdays': ['一', '二', '三', '四', '五', '六', '日'],
  'datePicker.weekdaysSunFirst': ['日', '一', '二', '三', '四', '五', '六'],
  'datePicker.yearMonth': '{p0} 年 {p1} 月',
  /* ── formValidate ── */
  'formValidate.email': '请输入有效的邮箱地址',
  'formValidate.invalid': '输入不合法',
  'formValidate.matches': '两次输入不一致',
  'formValidate.max': '不能大于 {max}',
  'formValidate.maxlength': '最多输入 {max} 个字符',
  'formValidate.min': '不能小于 {min}',
  'formValidate.minlength': '至少输入 {min} 个字符',
  'formValidate.number': '请输入有效的数字',
  'formValidate.pattern': '输入格式不正确',
  'formValidate.required': '此项为必填项',
  'formValidate.selectPlaceholder': '请选择',
  'formValidate.step': '数值必须是 {step} 的倍数',
  'formValidate.summary': '表单有 {p0} 项内容需要修正，请修改后重新提交',
  'formValidate.tool.description': '向用户渲染一个结构化表单收集输入',
  'formValidate.tool.fields': '字段列表',
  'formValidate.tool.help': '字段下方的帮助文案',
  'formValidate.tool.label': '字段标签',
  'formValidate.tool.max': '最大值（number 用）',
  'formValidate.tool.min': '最小值（number 用）',
  'formValidate.tool.name': '字段名（提交值的 key）',
  'formValidate.tool.options': 'select 选项（字符串或 {label,value}）',
  'formValidate.tool.pattern': '正则约束（HTML pattern 语法，整串匹配）',
  'formValidate.tool.required': '是否必填',
  'formValidate.tool.submitText': '提交按钮文案，默认「提交」',
  'formValidate.tool.title': '表单标题（可选）',
  'formValidate.tool.type': '控件类型，默认 text',
  'formValidate.url': '请输入有效的链接地址',
  /* ── input ── */
  'input.clearSearch': '清空搜索',
  'input.hidePassword': '隐藏密码',
  'input.otpPosition': '第 {p0} 位，共 {p1} 位',
  'panel.expand': '展开',
  'panel.collapse': '折叠',
  'input.showPassword': '显示密码',
  /* ── kbAccess ── */
  'kbAccess.approveTip': '批准该访问申请',
  'kbAccess.approvedBadge': '已批准 · {p0}',
  'kbAccess.approverNotePlaceholder': '给请求人的留言（可选）',
  'kbAccess.daysLeft': '{p0} 天后',
  'kbAccess.defaultSubject': '该内容',
  'kbAccess.deniedHint': '未通过——可调整理由后重新申请',
  'kbAccess.denyNoteLabel': '拒绝留言（可选）',
  'kbAccess.duration30d': '30 天',
  'kbAccess.duration7d': '7 天',
  'kbAccess.durationForever': '永久',
  'kbAccess.durationLabel': '访问时长',
  'kbAccess.expired': '已到期',
  'kbAccess.expiresAt': '{p0}到期',
  'kbAccess.grantAsPrefix': '批准为{p0}',
  'kbAccess.grantRoleLabel': '批准角色',
  'kbAccess.hoursLeft': '{p0} 小时后',
  'kbAccess.minutesLeft': '{p0} 分钟后',
  'kbAccess.ownerLabel': '内容负责人',
  'kbAccess.ownerPrefix': '负责人：{p0}',
  'kbAccess.reapply': '重新申请',
  'kbAccess.reasonLabel': '申请理由',
  'kbAccess.reasonPlaceholder': '说明业务原因（审批人可见）',
  'kbAccess.rejectTip': '拒绝该访问申请',
  'kbAccess.requestRenewal': '申请续期',
  'kbAccess.requestToPrefix': '请求将发送给：{p0}',
  'kbAccess.restrictedContent': '受限内容',
  'kbAccess.restrictedHint': '此内容仅对授权者开放',
  'kbAccess.revokedHint': '访问已被收回',
  'kbAccess.roleLabel': '申请角色',
  'kbAccess.submitRequest': '提交申请',
  'kbAccess.switchIdentity': '切换身份',
  'kbAccess.switchIdentityTip': '切换身份后重新检查权限',
  'kbAccess.unknownRequester': '未知请求人',
  'kbAccess.waitingApproval': '等待 {p0} 审批',
  /* ── kbAcl ── */
  'kbAcl.breakHint': '停止从父级继承，改为独立管理本项权限',
  'kbAcl.breakInheritance': '停止继承',
  'kbAcl.brokenNotice': '已停止继承——本项权限独立于父级',
  'kbAcl.detachedChildren': '{p0}：{p1} 个子项已脱离',
  'kbAcl.directAccess': '直接访问',
  'kbAcl.exception': '例外',
  'kbAcl.expiredOn': '已过期（{p0}）',
  'kbAcl.expiresIn': '{p0} 到期',
  'kbAcl.grantAccess': '授予访问',
  'kbAcl.inheritedFrom': '继承自 {p0}',
  'kbAcl.inheritedFromLabel': '继承自',
  'kbAcl.linkAccess': '链接访问',
  'kbAcl.noDirect': '暂无直接授权',
  'kbAcl.noLinks': '无链接',
  'kbAcl.removeEntry': '移除 {p0}',
  'kbAcl.restoreHint': '恢复继承将丢弃本项自定义的权限',
  'kbAcl.restoreInheritance': '恢复继承',
  'kbAcl.rootNotice': '根级资源——无父级继承',
  'kbAcl.systemBadge': '系统管理',
  'kbAcl.systemNote': '系统自动，不可手工移除',
  'kbAcl.unnamedResource': '未命名资源',
  'kbAcl.visibleToCount': '对 {p0} 人可见',
  /* ── kbAnswer ── */
  'kbAnswer.chartBar': '柱状',
  'kbAnswer.chartLine': '折线',
  'kbAnswer.chartPie': '饼图',
  'kbAnswer.exportNoun': '导出 {p0}',
  'kbAnswer.filtered': '已按你的数据权限过滤',
  'kbAnswer.filteredDetail': '已按你的数据权限过滤：{p0}',
  'kbAnswer.followups': '追问建议',
  'kbAnswer.hitAssets': '命中资产：{p0}',
  'kbAnswer.kindCurated': '人工策展',
  'kbAnswer.kindFunction': '函数',
  'kbAnswer.kindParameterized': '参数化查询',
  'kbAnswer.maskedPrefix': '已脱敏列：',
  'kbAnswer.rerunTip': '参数可改重跑',
  'kbAnswer.truncated': '已截断：显示 {p0}/{p1} 行{p2}',
  'kbAnswer.verifiedBadge': '认证答案',
  /* ── kbAudit ── */
  'kbAudit.actionDetail': '处置：{p0} · {p1}',
  'kbAudit.actionLabel': '处置',
  'kbAudit.alertedNote': '已实时告警安全团队',
  'kbAudit.channelFilterAria': '审计通道过滤',
  'kbAudit.channelPermission': '权限变更',
  'kbAudit.channelRead': '读取',
  'kbAudit.channelRequest': '申请',
  'kbAudit.channelSystem': '系统',
  'kbAudit.empty': '暂无审计事件',
  'kbAudit.exportTip': '导出当前过滤视图为 CSV',
  'kbAudit.hygieneLabel': '权限异味',
  'kbAudit.noHygiene': '未发现权限异味',
  /* ── kbCanvas ── */
  'kbCanvas.splitterAria': '调整画布双栏比例',
  'kbCanvas.splitterTip': '拖拽调整比例（←/→ 微调，双击复位）',
  /* ── kbCheckpoint ── */
  'kbCheckpoint.chatAuditNote': '讨论历史有审计价值',
  'kbCheckpoint.label': '检查点',
  'kbCheckpoint.restore': '恢复检查点',
  'kbCheckpoint.scopeBoth': '内容与对话',
  'kbCheckpoint.scopeChat': '仅对话',
  'kbCheckpoint.scopeContent': '仅内容（保留对话）',
  'kbCheckpoint.scopeMissing': '该检查点未包含此恢复范围',
  /* ── kbChunks ── */
  'kbChunks.addKeyword': '+ 关键词',
  'kbChunks.chunkAddKeywordAria': 'chunk {p0} 新增关键词',
  'kbChunks.chunkContentAria': 'chunk {p0} 内容',
  'kbChunks.chunkEnableAria': 'chunk {p0} 启用',
  'kbChunks.deleteChunkAria': '删除 chunk {p0}',
  'kbChunks.disableNote': '关闭后不删除，仅排除出检索',
  'kbChunks.edited': '已编辑',
  'kbChunks.empty': '暂无 chunk',
  'kbChunks.modeFull': '全文',
  'kbChunks.modeLabel': '搜索模式',
  'kbChunks.modeVector': '语义',
  'kbChunks.removeKeyword': '移除关键词 {p0}',
  'kbChunks.searchAria': '搜索 chunk',
  'kbChunks.searchFullPlaceholder': '全文搜索 chunk…',
  'kbChunks.searchVectorPlaceholder': '语义搜索 chunk…',
  /* ── kbCitation ── */
  'kbCitation.sourceN': '来源 {p0}',
  'kbCitation.unavailable': '来源已不可用',
  /* ── kbClarify ── */
  'kbClarify.parsedPrefix': '已解析：',
  /* ── kbConflict ── */
  'kbConflict.owner': '责任人 {p0}',
  /* ── kbConnector ── */
  'kbConnector.changeRate': '变更率',
  'kbConnector.crawlRate': '抓取率',
  'kbConnector.credentials': '凭证',
  'kbConnector.credentialsExpired': '凭证过期',
  'kbConnector.editSchedule': '编辑计划',
  'kbConnector.empty': '暂无连接器',
  'kbConnector.failing': '异常',
  'kbConnector.lastSync': '最近同步 {p0}',
  'kbConnector.neverSynced': '从未同步',
  'kbConnector.notConfigured': '未配置',
  'kbConnector.off': '已停用',
  'kbConnector.perDay': '{p0}/天',
  'kbConnector.reauth': '重新授权',
  'kbConnector.stale': '停滞',
  'kbConnector.syncNow': '立即同步',
  'kbConnector.synced': '已同步',
  /* ── kbCore ── */
  'kbCore.accessDenied': '未通过',
  'kbCore.accessExpired': '已过期',
  'kbCore.accessExpiring': '即将到期',
  'kbCore.accessGranted': '已开通',
  'kbCore.accessNotRequested': '未申请',
  'kbCore.accessPending': '待审批',
  'kbCore.accessRequested': '已提交',
  'kbCore.accessRevoked': '已收回',
  'kbCore.auditApprove': '批准',
  'kbCore.auditBreakGlass': '应急访问',
  'kbCore.auditDelegation': '委派',
  'kbCore.auditDeny': '拒绝',
  'kbCore.auditGrant': '授予',
  'kbCore.auditPermissionChange': '权限变更',
  'kbCore.auditPreview': '预览',
  'kbCore.auditRead': '读取',
  'kbCore.auditRequest': '申请',
  'kbCore.auditRevoke': '收回',
  'kbCore.auditSync': '权限同步',
  'kbCore.daysAgo': '{p0} 天前',
  'kbCore.hoursAgo': '{p0} 小时前',
  'kbCore.hygieneBroadGroup': '过宽组授权',
  'kbCore.hygieneBrokenInheritance': '断继承',
  'kbCore.hygieneOrgWideLink': '组织级链接',
  'kbCore.hygieneOrphanedOwner': '负责人缺位',
  'kbCore.hygieneOverexposed': '过度暴露',
  'kbCore.hygieneSensitiveMismatch': '敏感度错配',
  'kbCore.justNow': '刚刚',
  'kbCore.levelComment': '可评论',
  'kbCore.levelEdit': '可编辑',
  'kbCore.levelNone': '无权限',
  'kbCore.levelOwner': '负责人',
  'kbCore.levelView': '可查看',
  'kbCore.minutesAgo': '{p0} 分钟前',
  'kbCore.runCancelled': '已取消',
  'kbCore.runDone': '已完成',
  'kbCore.runFailed': '失败',
  'kbCore.runQueued': '排队中',
  'kbCore.runRunning': '进行中',
  'kbCore.runUnstarted': '未开始',
  'kbCore.stageAgent': '代理',
  'kbCore.stageChunk': '切片',
  'kbCore.stageEmbed': '向量化',
  'kbCore.stageGeneration': '生成',
  'kbCore.stageGuard': '护栏',
  'kbCore.stageQuery': '查询',
  'kbCore.stageRerank': '重排',
  'kbCore.stageRetrieval': '检索',
  'kbCore.stageTool': '工具',
  'kbCore.typeApi': '接口',
  'kbCore.typeCode': '代码',
  'kbCore.typeDatabase': '数据库',
  'kbCore.typeDocument': '文档',
  'kbCore.typeEmail': '邮件',
  'kbCore.typeImage': '图片',
  'kbCore.typeKb': '知识库',
  'kbCore.typeTable': '表格',
  'kbCore.typeTicket': '工单',
  'kbCore.typeWebpage': '网页',
  'kbCore.unnamedSource': '未命名来源',
  'kbCore.unnamedSubject': '未命名主体',
  'kbCore.visHidden': '不可见',
  'kbCore.visMetadataOnly': '仅元数据',
  'kbCore.visSummaryOnly': '仅摘要',
  'kbCore.visVisible': '可见',
  /* ── kbEval ── */
  'kbEval.avgA': 'A 均分 {p0}',
  'kbEval.avgB': 'B 均分 {p0}',
  'kbEval.compare': '对比',
  'kbEval.expected': '期望',
  'kbEval.gradeImprovement': '提升',
  'kbEval.gradeRegression': '回归',
  'kbEval.gradeTie': '持平',
  'kbEval.gradeTradeoff': '权衡',
  'kbEval.noData': '没有对比数据',
  'kbEval.onlyRegression': '仅看回归',
  'kbEval.outputA': '输出 A',
  'kbEval.outputB': '输出 B',
  'kbEval.outputN': '输出 {p0}',
  /* ── kbExplain ── */
  'kbExplain.empty': '暂无口径信息',
  'kbExplain.groupAgg': '聚合',
  'kbExplain.groupColumn': '列',
  'kbExplain.groupFilter': '筛选',
  'kbExplain.groupTable': '表',
  'kbExplain.trigger': '这个数字是怎么算出来的',
  'kbExplain.viewDefinition': '查看口径',
  /* ── kbFilter ── */
  'kbFilter.addGroup': '+ 组',
  'kbFilter.addRule': '+ 规则',
  'kbFilter.and': '且',
  'kbFilter.combineMode': '组合方式 {p0}',
  'kbFilter.copyDsl': '复制 DSL',
  'kbFilter.deleteGroup': '删除组',
  'kbFilter.deleteRule': '删除规则',
  'kbFilter.fieldLabel': '字段',
  'kbFilter.fieldPlaceholder': '过滤字段',
  'kbFilter.noValueNeeded': '（无需值）',
  'kbFilter.none': '（无过滤）',
  'kbFilter.opContains': '包含',
  'kbFilter.opEq': '等于',
  'kbFilter.opExists': '存在',
  'kbFilter.opGt': '大于',
  'kbFilter.opGte': '大于等于',
  'kbFilter.opIn': '属于',
  'kbFilter.opLt': '小于',
  'kbFilter.opLte': '小于等于',
  'kbFilter.opNe': '不等于',
  'kbFilter.operatorLabel': '操作符',
  'kbFilter.or': '或',
  'kbFilter.toggleAndOr': '切换 AND / OR',
  'kbFilter.valueAria': '过滤值',
  'kbFilter.valueLabel': '值',
  'kbFilter.valuePlaceholder': '值 1, 值 2（逗号分隔）',
  /* ── kbGap ── */
  'kbGap.addSynonym': '加同义词',
  'kbGap.colCount': '次数',
  'kbGap.colLastSeen': '最近出现',
  'kbGap.colQuery': '查询',
  'kbGap.colShare': '占比',
  'kbGap.createDoc': '建文档',
  'kbGap.empty': '没有未命中查询——覆盖良好',
  'kbGap.title': '未命中查询趋势',
  'kbGap.zeroClickHint': '用户可能已从引用片段得到答案；零点击需人工判读，不直接视为失败',
  'kbGap.zeroClickRate': '零点击率',
  'kbGap.zeroClickTitle': '零点击 ≠ 失败',
  /* ── kbHittest ── */
  'kbHittest.addAria': '新增测试问题',
  'kbHittest.addPlaceholder': '新增问题，Enter 添加',
  'kbHittest.avgScore': '均分',
  'kbHittest.deleteQuestion': '删除问题',
  'kbHittest.empty': '暂无测试问题——添加第一条，开始召回回归',
  'kbHittest.expectHit': '期望命中在前排命中中',
  'kbHittest.expectMiss': '期望未命中',
  'kbHittest.hitRate': '命中率',
  'kbHittest.noExpectation': '未设期望',
  'kbHittest.notRun': '未运行',
  'kbHittest.pass': '通过',
  'kbHittest.pin': '置顶固定',
  'kbHittest.runAll': '运行全部',
  'kbHittest.sessionOnly': '参数仅本次会话生效',
  'kbHittest.sessionOnlyHint': '测试运行的检索参数（topK/阈值/重排）不落库，仅本次会话生效',
  'kbHittest.unpin': '取消置顶',
  /* ── kbMetadata ── */
  'kbMetadata.addField': '新增字段',
  'kbMetadata.builtIn': '内置',
  'kbMetadata.colField': '字段',
  'kbMetadata.colType': '类型',
  'kbMetadata.colValue': '值',
  'kbMetadata.empty': '暂无元数据字段',
  'kbMetadata.nameLabel': '新字段名',
  'kbMetadata.namePlaceholder': '字段名，如 department',
  'kbMetadata.removeField': '移除字段 {p0}',
  'kbMetadata.typeLabel': '新字段类型',
  'kbMetadata.valueOf': '{p0} 的值',
  /* ── kbPassage ── */
  'kbPassage.blockRange': '块 {p0}–{p1}',
  'kbPassage.close': '关闭原文',
  'kbPassage.expandContext': '展开上下文',
  'kbPassage.locate': '原文定位',
  'kbPassage.none': '（无原文）',
  'kbPassage.pageRange': '第 {p0}–{p1} 页',
  'kbPassage.restricted': '内容受限',
  'kbPassage.unitByte': '字节',
  'kbPassage.unitChar': '字符',
  /* ── kbPipeline ── */
  'kbPipeline.empty': '暂无解析任务',
  'kbPipeline.progress': '解析进度',
  'kbPipeline.rerun': '重跑',
  'kbPipeline.unknownStage': '未知阶段',
  /* ── kbQa ── */
  'kbQa.colAnswer': '答案',
  'kbQa.colQuestion': '问题',
  'kbQa.csvHint': 'CSV 模板：question,answer（每行一对，UTF-8）',
  'kbQa.deleteRow': '删除第 {p0} 行',
  'kbQa.empty': '暂无认证问答对',
  'kbQa.importCsv': '导入 CSV',
  /* ── kbRerank ── */
  'kbRerank.after': '重排后',
  'kbRerank.before': '重排前',
  'kbRerank.compareTitle': '重排对比',
  'kbRerank.down': '下降 {p0} 位',
  'kbRerank.dropped': '落选',
  'kbRerank.empty': '两侧均为空——运行检索后再对比',
  'kbRerank.enableCompare': '启用重排对比',
  'kbRerank.newIn': '新进',
  'kbRerank.unmarked': '未标',
  'kbRerank.up': '上升 {p0} 位',
  /* ── kbRetrieval ── */
  'kbRetrieval.breakdown': '拆解',
  'kbRetrieval.copyParams': '复制参数 JSON',
  'kbRetrieval.decreaseTopK': '减少 topK',
  'kbRetrieval.empty': '输入问题并运行，命中结果将出现在这里',
  'kbRetrieval.failOpenNotice': 'fail-open：当前查询未携带身份过滤，将返回全部候选（仅限调试）',
  'kbRetrieval.hybridWeight': '混合权重（左语义右关键词）',
  'kbRetrieval.identityLabel': '检索身份',
  'kbRetrieval.identityShort': '身份',
  'kbRetrieval.increaseTopK': '增加 topK',
  'kbRetrieval.keywordHint': '关键词：大库快速精确',
  'kbRetrieval.layerLabel': '过滤层',
  'kbRetrieval.layerNone': 'none：fail-open，无身份过滤返回全部——危险，仅演示',
  'kbRetrieval.layerPost': 'post-filter：分数已可观察——缺陷层，仅演示',
  'kbRetrieval.layerPre': 'pre-filter：ACL 在检索执行体内生效——安全基线',
  'kbRetrieval.leakNote': '分母未过滤前计数属泄露，不显示',
  'kbRetrieval.modeHybrid': '混合',
  'kbRetrieval.modeKeyword': '关键词',
  'kbRetrieval.modeLabel': '检索模式',
  'kbRetrieval.modeVector': '向量',
  'kbRetrieval.postFilterNotice': 'post-filter：分数已在过滤前产生（缺陷层演示）',
  'kbRetrieval.queryLabel': '检索问题',
  'kbRetrieval.queryPlaceholder': '检索问题，Enter 运行',
  'kbRetrieval.rerankLabel': '重排',
  'kbRetrieval.rerankThresholdOff': '阈值 关 · 存活 {p0}',
  'kbRetrieval.rerankThresholdOn': '阈值 {p0} · 存活 {p1}',
  'kbRetrieval.running': '运行中…',
  'kbRetrieval.thresholdLabel': '分数阈值',
  'kbRetrieval.thresholdValue': '阈值 N/A',
  'kbRetrieval.vectorHint': '语义：跨语言/无精确词',
  'kbRetrieval.vectorPercent': '语义 {p0}',
  'kbRetrieval.weightValue': '向量 {p0}% / 关键词 {p1}%',
  /* ── kbReview ── */
  'kbReview.assignee': '分配人',
  'kbReview.doneNext': '完成并下一条',
  'kbReview.empty': '没有待审查条目',
  'kbReview.emptyAssignee': '该分配人下没有条目',
  'kbReview.emptyQueue': '队列为空',
  'kbReview.kbCloseHint': '关闭提示',
  'kbReview.kbSelectOption': '选择选项',
  'kbReview.kbSwitchItem': '切换条目',
  'kbReview.kbToggleHint': '显示/隐藏本提示',
  'kbReview.shortcuts': '? 快捷键',
  'kbReview.typeAnswer': '回答',
  'kbReview.typeMessage': '消息',
  'kbReview.typeTrace': '轨迹',
  'kbReview.unassigned': '未分配',
  /* ── kbSandbox ── */
  'kbSandbox.noResolver': '宿主未提供 ui:// 解析器',
  'kbSandbox.notReady': 'kb-sandbox: 应用未就绪',
  'kbSandbox.resolveFailed': 'ui:// 解析失败：{p0}',
  'kbSandbox.timeout': 'kb-sandbox: 调用超时（{p0}ms）',
  'kbSandbox.title': 'MCP App 沙箱',
  /* ── kbSegment ── */
  'kbSegment.avgLength': '均长 {p0}',
  'kbSegment.childNote': '子分段按长度自动生成',
  'kbSegment.cleanBlankLines': '合并连续空行',
  'kbSegment.cleanEmails': '去除邮箱',
  'kbSegment.cleanLinks': '去除链接',
  'kbSegment.empty': '样本为空，暂无可预览分段',
  'kbSegment.maxLengthLabel': '最大长度',
  'kbSegment.maxLengthPlaceholder': '分段最大长度',
  'kbSegment.modeAuto': '自动',
  'kbSegment.modeCustom': '自定义',
  'kbSegment.modeLabel': '分段模式',
  'kbSegment.modeNote': '分段模式创建后不可更改，参数可随时调整',
  'kbSegment.modeParentChild': '父子',
  'kbSegment.overlapInvalid': '重叠需小于最大长度',
  'kbSegment.overlapLabel': '重叠',
  'kbSegment.overlapPlaceholder': '分段重叠',
  'kbSegment.previewNote': '共 {p0} 段，仅预览前 {p1} 段',
  'kbSegment.segmentsCount': '{p0} 段',
  'kbSegment.separatorLabel': '分隔符',
  'kbSegment.separatorPlaceholder': '分段分隔符',
  'kbSegment.toggleTip': '点击展开/收起',
  /* ── kbSources ── */
  'kbSources.cited': '被引 ×{p0}',
  'kbSources.empty': '下一条答案引用的段落将出现在这里',
  /* ── kbSql ── */
  'kbSql.adminOnly': '仅管理员可见',
  'kbSql.applyFix': '应用修复并重跑',
  'kbSql.confirmRerun': '确认并重跑',
  'kbSql.editRerun': '编辑重跑',
  'kbSql.fixReady': '检测到上版报错，修复建议已就绪',
  'kbSql.generated': '生成的 SQL',
  /* ── kbTrace ── */
  'kbTrace.empty': '暂无调用链数据',
  'kbTrace.hits': '命中 {p0}',
  /* ── kbVisibility ── */
  'kbVisibility.adminOnlyNote': '以上对照仅限 admin 审计',
  'kbVisibility.adminWarn': 'admin 审计视图——命中差异对照对普通用户构成泄露，勿嵌入终端用户界面',
  'kbVisibility.failOpenNote': 'fail-open：Kendra 无身份上下文返回全部文档——检索必须携带服务端身份',
  'kbVisibility.focusColumn': '聚焦身份 {p0} 的列',
  'kbVisibility.layerValue': '过滤层：{p0}',
  'kbVisibility.leakageNote': '计数差异即 volume leakage：对普通用户只可给「已按权限过滤」恒定文案，缓解只有 padding 取整',
  'kbVisibility.postFilterNote': 'post-filter：topK 被无权结果占用且相似度分数可被观察',
  'kbVisibility.queryLabel': '查询：{p0}',
  'kbVisibility.safeCount': '安全计数 {p0}',
  'kbVisibility.sourceUnavailable': '原文不可用',
  'kbVisibility.unnamedHit': '未命名命中',
  /* ── kbWhoCan ── */
  'kbWhoCan.check': '检查',
  'kbWhoCan.checkIdentity': '检查身份',
  'kbWhoCan.daysUntil': '{p0} 天后',
  'kbWhoCan.deniedBy': '被策略拒绝：{p0}',
  'kbWhoCan.denyVeto': '被 Deny 一票否决',
  'kbWhoCan.direct': '直接',
  'kbWhoCan.expiresSoon': '最近到期 {p0}',
  'kbWhoCan.hoursUntil': '{p0} 小时后',
  'kbWhoCan.inherit': '继承',
  'kbWhoCan.link': '链接',
  'kbWhoCan.noDeny': '无 Deny 生效',
  'kbWhoCan.noIdentity': '未提供可检查的身份',
  'kbWhoCan.none': '未命中任何授权——默认拒绝',
  'kbWhoCan.recheckTip': '重新检查当前身份的有效权限',
  'kbWhoCan.stackRule': '叠加规则：多来源并集 → {p0}；{p1}',
  /* ── mentions ── */
  'mentions.loading': '加载中…',
  /* ── notification ── */
  'notification.groupBusy': '操作结束后可以收起这组通知。',
  'notification.groupUnread': '{count} 条同组通知，{unread} 条未读',
  'notification.groupCount': '{count} 条同组通知',
  'notification.groupExpanded': '收起这组通知',
  'notification.ariaLabel': '通知',
  'notification.viewDetails': '查看详情',
  /* ── pagination ── */
  'pagination.next': '下一页',
  'pagination.pageSize': '{p0} 条/页',
  'pagination.prev': '上一页',
  /* ── select ── */
  'select.fieldLabel': '选择选项',
  'select.noMatch': '无匹配项',
  'select.remove': '移除 {p0}',
  'select.searchPlaceholder': '搜索…',
  /* ── cascader / tree-select ── */
  'cascader.placeholder': '请选择',
  'cascader.noMatch': '无匹配',
  'cascader.search': '搜索',
  'treeSelect.placeholder': '请选择',
  'treeSelect.noMatch': '无匹配',
  'treeSelect.search': '搜索',
  /* ── tagInput ── */
  'tagInput.ariaLabel': '标签输入，共 {p0} 个',
  'tagInput.remove': '移除 {p0}',
  /* ── upload ── */
  'upload.remove': '移除 {p0}',
  'upload.tooBig': '文件超过 {p0}',
  'upload.tooMany': '最多 {p0} 个文件',
  'upload.typeNotAllowed': '文件类型不支持',
};

/** 完整英文翻译。 */
export const ICEN_LOCALE_EN_US: IcenLocale = {
  /* ── aiBranch ── */
  'aiBranch.nextVersion': 'Next version',
  'aiBranch.prevVersion': 'Previous version',
  'aiBranch.version': 'Branch version',
  /* ── aiChat ── */
  'aiChat.backToBottom': 'Back to bottom',
  'aiChat.backToBottomCount': 'Back to bottom · {p0} new messages',
  'aiChat.continue': 'Continue generating',
  'aiChat.download': 'Download',
  'aiChat.file': 'File',
  'aiChat.roleSystem': 'Sys',
  'aiChat.roleTool': 'Tool',
  'aiChat.roleUser': 'Me',
  'aiChat.thinking': 'Thinking {p0}',
  /* ── aiComposer ── */
  'aiComposer.attachAgent': 'Agent',
  'aiComposer.attachDoc': 'Document',
  'aiComposer.attachFile': 'File',
  'aiComposer.attachFolder': 'Folder',
  'aiComposer.cacheInvalidHint': 'Switching models invalidates the prompt cache',
  'aiComposer.commands': 'Commands',
  'aiComposer.currentTodos': 'Current todos',
  'aiComposer.done': 'Done',
  'aiComposer.justNow': 'Just now · {p0}',
  'aiComposer.modelAria': 'Model {p0} ({p1})',
  'aiComposer.noCommandMatch': 'No matching commands',
  'aiComposer.noModelMatch': 'No matching models',
  'aiComposer.noRefMatch': 'No matching references',
  'aiComposer.placeholder': 'Type a message, / for commands · @ for references · Enter to send',
  'aiComposer.refs': 'References',
  'aiComposer.removeAttachment': 'Remove attachment {p0}',
  'aiComposer.removeQueued': 'Remove queued message {p0}',
  'aiComposer.removeRef': 'Remove reference {p0}',
  'aiComposer.searchModels': 'Search models',
  'aiComposer.selectModel': 'Select model',
  'aiComposer.send': 'Send',
  'aiComposer.stop': 'Stop generating',
  'aiComposer.todoChip': 'Todos {p0}/{p1}',
  'aiComposer.todoHasError': ' (has failures)',
  /* ── aiCore ── */
  'aiCore.kindBrowser': 'Browse',
  'aiCore.kindChart': 'Chart',
  'aiCore.kindDelete': 'Delete',
  'aiCore.kindEdit': 'Edit',
  'aiCore.kindFetch': 'Fetch',
  'aiCore.kindGlob': 'Match',
  'aiCore.kindGrep': 'Search',
  'aiCore.kindNote': 'Note',
  'aiCore.kindPlan': 'Plan',
  'aiCore.kindRead': 'Read',
  'aiCore.kindSearch': 'Search',
  'aiCore.kindShell': 'Shell',
  'aiCore.kindSkill': 'Skill',
  'aiCore.kindSubagent': 'Subagent',
  'aiCore.kindTodo': 'Todo',
  'aiCore.kindWrite': 'Write',
  'aiCore.statusApproval': 'Awaiting approval',
  'aiCore.statusCancelled': 'Cancelled',
  'aiCore.statusDone': 'Done',
  'aiCore.statusError': 'Failed',
  'aiCore.statusPending': 'Pending',
  'aiCore.statusRunning': 'Running',
  'aiCore.statusStreaming': 'Streaming',
  'aiCore.todoProgress': '{p0}/{p1} done',
  /* ── aiDiff ── */
  'aiDiff.accepted': 'Accepted',
  'aiDiff.binary': 'Binary file — text diff unavailable',
  'aiDiff.empty': 'No diff content',
  'aiDiff.rejected': 'Rejected',
  /* ── aiFeedback ── */
  'aiFeedback.helpful': 'Helpful',
  'aiFeedback.notHelpful': 'Not helpful',
  'aiFeedback.reasonCitationMismatch': 'Citations do not match',
  'aiFeedback.reasonOutdated': 'Outdated content',
  'aiFeedback.reasonUnauthorized': 'Unauthorized information',
  'aiFeedback.reasonUnsourced': 'No citation basis',
  'aiFeedback.reasonWrong': 'Incorrect answer',
  'aiFeedback.thanks': 'Thanks for the feedback — it is linked to this answer’s tracking record',
  /* ── aiPanel ── */
  'aiPanel.audit': 'Audit',
  'aiPanel.cacheRead': 'Cache read',
  'aiPanel.cacheWrite': 'Cache write',
  'aiPanel.callsTokens': '{p0} calls · {p1} tok',
  'aiPanel.clearAudit': 'Clear audit',
  'aiPanel.context': 'Context',
  'aiPanel.contextWindow': 'Context window',
  'aiPanel.errorsCount': '{p0} failed',
  'aiPanel.files': 'Files ({p0})',
  'aiPanel.itemStatus': '{p0}, status: {p1}',
  'aiPanel.noAudit': 'No audit records',
  'aiPanel.noUsage': 'No usage yet',
  'aiPanel.reasoning': 'Reasoning',
  'aiPanel.requestsCount': '{p0} requests',
  'aiPanel.ringPercent': 'Context window {p0}% full, click for details',
  'aiPanel.ringUsed': '{p0} used, click for details',
  'aiPanel.taskProgress': 'Task progress',
  'aiPanel.toolsCount': '{p0} tools',
  'aiPanel.usage': 'Usage',
  'aiPanel.usageAria': 'Usage: {p0}',
  /* ── aiProvider ── */
  'aiProvider.audioUrlOnly': 'audio with URL only (input_audio requires base64 — fetch and inline it first)',
  'aiProvider.audioUrlOnlyAnthropic': 'audio with URL only (audio blocks need a base64 source)',
  'aiProvider.base64File': 'base64 file (file parts need a Files API file_id — use the url slot)',
  'aiProvider.corsHint': '; direct browser access to {p0} ({p1}) will likely be blocked by CORS — route through a proxy or self-hosted gateway',
  'aiProvider.emptyResponse': 'Empty response',
  'aiProvider.glmLabel': 'GLM (Zhipu)',
  'aiProvider.invalidJson': 'Response is not valid JSON',
  'aiProvider.kimiLabel': 'Kimi (Moonshot)',
  'aiProvider.networkFailed': 'Network request failed: {p0}{p1}',
  'aiProvider.nonPdfDocument': 'non-PDF file block (document blocks must be application/pdf, got {p0})',
  'aiProvider.requestCancelled': 'Request cancelled',
  'aiProvider.resourceRef': '[resource] {p0} ({p1})',
  'aiProvider.streamError': 'Streaming response error',
  'aiProvider.toolRoleNoCallId': 'role \'tool\' without toolCallId (OpenAI family requires tool_call_id)',
  'aiProvider.toolRoleNoUseId': 'role \'tool\' without toolCallId (Anthropic family needs tool_use_id for tool_result)',
  'aiProvider.unsupported': '{p0} wire protocol does not support {p1}',
  'aiProvider.videoUnsupported': 'video input (no mainstream chat API supports it)',
  'aiProvider.videoUnsupportedAnthropic': 'video input',
  /* ── aiThreads ── */
  'aiThreads.actionsAria': 'Conversation actions',
  'aiThreads.archived': 'Archived',
  /* ── aiTool ── */
  'aiTool.allow': 'Allow',
  'aiTool.reject': 'Reject',
  /* ── aiTools ── */
  'aiTools.chart.area': 'fill area under multi-series line',
  'aiTools.chart.data': 'raw records of any dimensionality + dims field mapping (auto-pivoted into category × series)',
  'aiTools.chart.dates': 'contribution-calendar ISO dates (paired with values)',
  'aiTools.chart.description': 'Render a chart visualization in the user interface. Input is a chart spec (pure JSON): give one of labels+values (categories and values), series (multi-series), segments (share), points (scatter/bubble), dates (contribution calendar); when type is omitted the chart type is inferred from the data shape (time series→line, share→donut, dates→contribution calendar, coordinate points→scatter). The chart has interactions (hover tooltip/click/right-click) and a hideable legend.',
  'aiTools.chart.dims': 'Field mapping for data[]: {label?, series?, value?, x?, y?}',
  'aiTools.chart.format': 'value format: {notation?: compact|percent|ms, unit?}',
  'aiTools.chart.labels': 'category axis (line/vbar/hbar)',
  'aiTools.chart.legend': 'false = hide legend initially',
  'aiTools.chart.lttb': 'downsample large datasets: true=auto cap, number=max points kept (renderer contract, lands with the chart heavy-data track)',
  'aiTools.chart.marks': 'marker layer (threshold lines/reference ranges/highlighted points), elements are plain JSON descriptors (renderer contract, lands with chart heavy scenarios)',
  'aiTools.chart.points': 'scatter/bubble: [{x,y,size?,label?}]',
  'aiTools.chart.radarAxes': 'radar axis names',
  'aiTools.chart.segments': 'share data (donut/stack): [{label,value}]',
  'aiTools.chart.series': 'multi-series (line/vbar/radar)',
  'aiTools.chart.stacked': 'stack multi-series vbar (grouped by default)',
  'aiTools.chart.title': 'chart title (rendered at the left of the header row)',
  'aiTools.chart.tooltip': 'false = disable built-in tooltip',
  'aiTools.chart.type': 'chart type; auto-inferred when omitted',
  'aiTools.chart.values': 'single-series values (paired with labels)',
  'aiTools.chart.zoom': 'zoom interaction: \'x\'=category-axis range zoom, \'brush\'=brush zoom',
  'aiTools.datatable.columns': 'column definitions: [{ key, title, sortable?, filterable? }] (key maps to a field name in rows)',
  'aiTools.datatable.description': 'Render a searchable, paginated, CSV-exportable data table in the user interface. Input is pure JSON: columns = column definitions (key/title required), rows = array of row objects whose field names align with columns[].key. Returns a { title, rows: count } summary.',
  'aiTools.datatable.rows': 'row data array: each item is an object whose field names align with columns[].key',
  'aiTools.datatable.title': 'table title (rendered at the left of the toolbar)',
  'aiTools.execFailed': 'Tool execution failed: {p0}',
  'aiTools.execTimeout': 'timed out ({p0}ms)',
  'aiTools.manifestHeader': 'Available UI tools (results mount in the UI when called):',
  'aiTools.missingRequired': 'missing required field',
  'aiTools.none': '(no UI tools registered)',
  'aiTools.notInEnum': 'not in allowed values ({p0})',
  'aiTools.numMax': 'value {p0} is above maximum {p1}',
  'aiTools.numMin': 'value {p0} is below minimum {p1}',
  'aiTools.removeMount': 'Remove {p0} mount',
  'aiTools.strMax': 'length {p0} exceeds maximum {p1}',
  'aiTools.strMin': 'length {p0} is below minimum {p1}',
  'aiTools.typeMismatch': 'expected {p0}, got {p1}',
  'aiTools.validationFailed': 'argument validation failed ({p0} issues)',
  /* ── autocomplete ── */
  'autocomplete.empty': 'No matches',
  /* ── backTop ── */
  'backTop.label': 'Back to top',
  /* ── carousel ── */
  'carousel.item': 'Item {p0}',
  /* ── charts ── */
  'charts.calendarWeekdays': ['M', '', 'W', '', 'F', '', 'S'],
  'charts.few': 'Few',
  'charts.hideLegend': 'Hide legend',
  'charts.loading': 'Loading',
  'charts.many': 'Many',
  'charts.monthLabel': '{p0}',
  'charts.noData': 'No data',
  'charts.resetZoom': 'Reset zoom',
  'charts.sampled': 'Sampled → {p0} points',
  'charts.seriesName': 'Series {p0}',
  'charts.showLegend': 'Show legend',
  'charts.value': 'Value',
  /* ── themeSwitcher ── */
  'themeSwitcher.appearance': 'Appearance',
  'themeSwitcher.theme': 'Theme',
  'themeSwitcher.primitive': 'Primitive',
  'themeSwitcher.mode': 'Color mode',
  'themeSwitcher.light': 'Light',
  'themeSwitcher.dark': 'Dark',
  'themeSwitcher.benzhen': 'Benzhen',
  'themeSwitcher.clay': 'Clay',
  'themeSwitcher.piano': 'Piano',
  'themeSwitcher.art': 'Art',
  'themeSwitcher.vangogh': 'Van Gogh',
  'themeSwitcher.ink': 'Ink',
  'themeSwitcher.pixel': 'Pixel',
  /* ── codeBlock ── */
  'codeBlock.collapse': 'Collapse',
  'codeBlock.copy': 'Copy',
  'codeBlock.foldCollapse': 'Collapse code',
  'codeBlock.foldExpand': 'Expand code',
  'codeBlock.linesTotal': '{p0} lines total',
  'codeBlock.numHide': 'Hide line numbers',
  'codeBlock.numShow': 'Show line numbers',
  'codeBlock.tailAria': 'Expand or collapse code',
  'codeBlock.wrapOff': 'Disable wrapping',
  'codeBlock.wrapOn': 'Wrap lines',
  /* ── common ── */
  'common.accept': 'Accept',
  'common.add': 'Add',
  'common.all': 'All',
  'common.approve': 'Approve',
  'common.cancel': 'Cancel',
  'common.actionFailed': 'Action failed. Try again.',
  'common.close': 'Close',
  'common.confirm': 'Confirm',
  'common.copied': 'Copied',
  'common.copy': 'Copy',
  'common.delete': 'Delete',
  'common.enable': 'Enable',
  'common.exportCsv': 'Export CSV',
  'common.healthy': 'Healthy',
  'common.input': 'Input',
  'common.loadingEllipsis': 'Loading…',
  'common.official': 'Official',
  'common.output': 'Output',
  'common.page': 'Page {p0}',
  'common.reject': 'Reject',
  'common.remove': 'Remove',
  'common.requestAccess': 'Request access',
  'common.requestAccessFor': 'Request access to {p0}',
  'common.restricted': 'Restricted',
  'common.retry': 'Retry',
  'common.rows': '{p0} rows',
  'common.run': 'Run',
  'common.steps': '{p0} steps',
  'common.submit': 'Submit',
  'common.unknown': 'Unknown',
  /* ── contextMenu ── */
  'contextMenu.back': 'Back',
  'contextMenu.copyPageLink': 'Copy page link',
  'contextMenu.forward': 'Forward',
  'contextMenu.refresh': 'Reload',
  /* ── copy ── */
  'copy.copied': 'Copied',
  'copy.denied': 'Clipboard API denied ({p0}) and execCommand fallback failed',
  'copy.unavailable': 'Clipboard unavailable (no Clipboard API and execCommand fallback failed)',
  'copy.unknown': 'Unknown error',
  /* ── datatable ── */
  'datatable.clear': 'Clear',
  'datatable.collapseGroup': 'Collapse group {p0}',
  'datatable.columnSettingsAria': 'Column settings',
  'datatable.countUnit': '{p0} items',
  'datatable.editHint': 'Edit {p0}: double-click or press Enter',
  'datatable.editHintWithValue': '{p0} (double-click or press Enter to edit {p1})',
  'datatable.empty': 'No data',
  'datatable.emptyValue': '(empty)',
  'datatable.expandGroup': 'Expand group {p0}',
  'datatable.expandRow': 'Expand row',
  'datatable.filterChipAria': 'Filter: {p0}',
  'datatable.pageSizeAria': 'Items per page',
  'datatable.paginationAria': 'Pagination',
  'datatable.reset': 'Reset',
  'datatable.resizeAria': 'Resize column {p0}',
  'datatable.searchAria': 'Search table',
  'datatable.searchPlaceholder': 'Search…',
  'datatable.selectAll': 'Select all',
  'datatable.selectRow': 'Select this row',
  'datatable.selectedCount': '{p0} selected',
  'datatable.totalCount': '{p0} items total',
  'datatable.totalLabel': 'Total',
  /* ── datePicker ── */
  'datePicker.clear': 'Clear',
  'datePicker.nextMonth': 'Next month',
  'datePicker.prevMonth': 'Previous month',
  'datePicker.selectDate': 'Select date',
  'datePicker.today': 'Today',
  'datePicker.weekdays': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'datePicker.weekdaysSunFirst': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  'datePicker.yearMonth': '{p1} {p0}',
  /* ── formValidate ── */
  'formValidate.email': 'Enter a valid email address',
  'formValidate.invalid': 'Invalid input',
  'formValidate.matches': 'The two entries do not match',
  'formValidate.max': 'Must not be greater than {max}',
  'formValidate.maxlength': 'Enter at most {max} characters',
  'formValidate.min': 'Must not be less than {min}',
  'formValidate.minlength': 'Enter at least {min} characters',
  'formValidate.number': 'Enter a valid number',
  'formValidate.pattern': 'Invalid format',
  'formValidate.required': 'This field is required',
  'formValidate.selectPlaceholder': 'Please select',
  'formValidate.step': 'Must be a multiple of {step}',
  'formValidate.summary': '{p0} fields need attention — fix them and submit again',
  'formValidate.tool.description': 'Render a structured form to the user to collect input',
  'formValidate.tool.fields': 'Field list',
  'formValidate.tool.help': 'help text below the field',
  'formValidate.tool.label': 'Field label',
  'formValidate.tool.max': 'maximum value (for number)',
  'formValidate.tool.min': 'minimum value (for number)',
  'formValidate.tool.name': 'field name (the submitted value key)',
  'formValidate.tool.options': 'select options (string or {label,value})',
  'formValidate.tool.pattern': 'regex constraint (HTML pattern syntax, full-string match)',
  'formValidate.tool.required': 'whether the field is required',
  'formValidate.tool.submitText': 'submit button label, defaults to "Submit"',
  'formValidate.tool.title': 'form title (optional)',
  'formValidate.tool.type': 'control type, default text',
  'formValidate.url': 'Enter a valid URL',
  /* ── input ── */
  'input.clearSearch': 'Clear search',
  'input.hidePassword': 'Hide password',
  'input.otpPosition': 'Digit {p0} of {p1}',
  'panel.expand': 'Expand',
  'panel.collapse': 'Collapse',
  'input.showPassword': 'Show password',
  /* ── kbAccess ── */
  'kbAccess.approveTip': 'Approve this access request',
  'kbAccess.approvedBadge': 'Approved · {p0}',
  'kbAccess.approverNotePlaceholder': 'Note to the requester (optional)',
  'kbAccess.daysLeft': 'in {p0} days',
  'kbAccess.defaultSubject': 'this content',
  'kbAccess.deniedHint': 'Denied — adjust the reason and apply again',
  'kbAccess.denyNoteLabel': 'Denial note (optional)',
  'kbAccess.duration30d': '30 days',
  'kbAccess.duration7d': '7 days',
  'kbAccess.durationForever': 'Permanent',
  'kbAccess.durationLabel': 'Access duration',
  'kbAccess.expired': 'Expired',
  'kbAccess.expiresAt': 'expires {p0}',
  'kbAccess.grantAsPrefix': 'Approve as {p0}',
  'kbAccess.grantRoleLabel': 'Approve role',
  'kbAccess.hoursLeft': 'in {p0} h',
  'kbAccess.minutesLeft': 'in {p0} min',
  'kbAccess.ownerLabel': 'Content owner',
  'kbAccess.ownerPrefix': 'Owner: {p0}',
  'kbAccess.reapply': 'Apply again',
  'kbAccess.reasonLabel': 'Request reason',
  'kbAccess.reasonPlaceholder': 'Explain the business reason (visible to approvers)',
  'kbAccess.rejectTip': 'Deny this access request',
  'kbAccess.requestRenewal': 'Request renewal',
  'kbAccess.requestToPrefix': 'The request will be sent to: {p0}',
  'kbAccess.restrictedContent': 'Restricted content',
  'kbAccess.restrictedHint': 'This content is open to authorized viewers only',
  'kbAccess.revokedHint': 'Access has been revoked',
  'kbAccess.roleLabel': 'Requested role',
  'kbAccess.submitRequest': 'Submit request',
  'kbAccess.switchIdentity': 'Switch identity',
  'kbAccess.switchIdentityTip': 'Re-check permissions after switching identity',
  'kbAccess.unknownRequester': 'Unknown requester',
  'kbAccess.waitingApproval': 'Awaiting approval by {p0}',
  /* ── kbAcl ── */
  'kbAcl.breakHint': 'Stop inheriting from the parent and manage this item’s permissions independently',
  'kbAcl.breakInheritance': 'Stop inheriting',
  'kbAcl.brokenNotice': 'Inheritance stopped — this item’s permissions are independent of the parent',
  'kbAcl.detachedChildren': ': {p0} child items detached',
  'kbAcl.directAccess': 'Direct access',
  'kbAcl.exception': 'Exception',
  'kbAcl.expiredOn': 'Expired ({p0})',
  'kbAcl.expiresIn': 'expires {p0}',
  'kbAcl.grantAccess': 'Grant access',
  'kbAcl.inheritedFrom': 'Inherited from {p0}',
  'kbAcl.inheritedFromLabel': 'Inherited from',
  'kbAcl.linkAccess': 'Link access',
  'kbAcl.noDirect': 'No direct grants yet',
  'kbAcl.noLinks': 'No links',
  'kbAcl.removeEntry': 'Remove {p0}',
  'kbAcl.restoreHint': 'Restoring inheritance discards the custom permissions on this item',
  'kbAcl.restoreInheritance': 'Restore inheritance',
  'kbAcl.rootNotice': 'Root resource — no parent to inherit from',
  'kbAcl.systemBadge': 'System managed',
  'kbAcl.systemNote': 'Managed by the system; cannot be removed manually',
  'kbAcl.unnamedResource': 'Unnamed resource',
  'kbAcl.visibleToCount': 'Visible to {p0} people',
  /* ── kbAnswer ── */
  'kbAnswer.chartBar': 'Bar',
  'kbAnswer.chartLine': 'Line',
  'kbAnswer.chartPie': 'Pie',
  'kbAnswer.exportNoun': 'Export {p0}',
  'kbAnswer.filtered': 'Filtered by your data permissions',
  'kbAnswer.filteredDetail': 'Filtered by your data permissions: {p0}',
  'kbAnswer.followups': 'Suggested follow-ups',
  'kbAnswer.hitAssets': 'Matched assets: {p0}',
  'kbAnswer.kindCurated': 'Curated',
  'kbAnswer.kindFunction': 'Function',
  'kbAnswer.kindParameterized': 'Parameterized query',
  'kbAnswer.maskedPrefix': 'Masked columns: {p0}',
  'kbAnswer.rerunTip': 'Parameters editable — rerun anytime',
  'kbAnswer.truncated': 'Truncated: showing {p0} / {p1} rows',
  'kbAnswer.verifiedBadge': 'Verified answer',
  /* ── kbAudit ── */
  'kbAudit.actionDetail': 'Action: {p0} · {p1}',
  'kbAudit.actionLabel': 'Action',
  'kbAudit.alertedNote': 'Security team alerted in real time',
  'kbAudit.channelFilterAria': 'Filter audit channels',
  'kbAudit.channelPermission': 'Permission change',
  'kbAudit.channelRead': 'Read',
  'kbAudit.channelRequest': 'Request',
  'kbAudit.channelSystem': 'System',
  'kbAudit.empty': 'No audit events',
  'kbAudit.exportTip': 'Export the current filtered view as CSV',
  'kbAudit.hygieneLabel': 'Permission hygiene issues',
  'kbAudit.noHygiene': 'No hygiene issues found',
  /* ── kbCanvas ── */
  'kbCanvas.splitterAria': 'Adjust canvas split ratio',
  'kbCanvas.splitterTip': 'Drag to resize (←/→ to nudge, double-click to reset)',
  /* ── kbCheckpoint ── */
  'kbCheckpoint.chatAuditNote': 'Discussion history has audit value',
  'kbCheckpoint.label': 'Checkpoint',
  'kbCheckpoint.restore': 'Restore checkpoint',
  'kbCheckpoint.scopeBoth': 'Content and conversation',
  'kbCheckpoint.scopeChat': 'Conversation only',
  'kbCheckpoint.scopeContent': 'Content only (keep conversation)',
  'kbCheckpoint.scopeMissing': 'This checkpoint does not cover the selected restore scope',
  /* ── kbChunks ── */
  'kbChunks.addKeyword': '+ Keyword',
  'kbChunks.chunkAddKeywordAria': 'chunk {p0} add keyword',
  'kbChunks.chunkContentAria': 'chunk {p0} content',
  'kbChunks.chunkEnableAria': 'chunk {p0} enable',
  'kbChunks.deleteChunkAria': 'Delete chunk {p0}',
  'kbChunks.disableNote': 'Disabling does not delete — the chunk is only excluded from retrieval',
  'kbChunks.edited': 'Edited',
  'kbChunks.empty': 'No chunks',
  'kbChunks.modeFull': 'Full-text',
  'kbChunks.modeLabel': 'Search mode',
  'kbChunks.modeVector': 'Semantic',
  'kbChunks.removeKeyword': 'Remove keyword {p0}',
  'kbChunks.searchAria': 'Search chunks',
  'kbChunks.searchFullPlaceholder': 'Full-text search chunks…',
  'kbChunks.searchVectorPlaceholder': 'Semantic search chunks…',
  /* ── kbCitation ── */
  'kbCitation.sourceN': 'Source {p0}',
  'kbCitation.unavailable': 'Source unavailable',
  /* ── kbClarify ── */
  'kbClarify.parsedPrefix': 'Parsed: {p0}',
  /* ── kbConflict ── */
  'kbConflict.owner': 'Owner {p0}',
  /* ── kbConnector ── */
  'kbConnector.changeRate': 'Change rate',
  'kbConnector.crawlRate': 'Crawl rate',
  'kbConnector.credentials': 'Credentials',
  'kbConnector.credentialsExpired': 'Credentials expired',
  'kbConnector.editSchedule': 'Edit schedule',
  'kbConnector.empty': 'No connectors',
  'kbConnector.failing': 'Failing',
  'kbConnector.lastSync': 'Last synced {p0}',
  'kbConnector.neverSynced': 'Never synced',
  'kbConnector.notConfigured': 'Not configured',
  'kbConnector.off': 'Disabled',
  'kbConnector.perDay': '{p0}/day',
  'kbConnector.reauth': 'Re-authorize',
  'kbConnector.stale': 'Stale',
  'kbConnector.syncNow': 'Sync now',
  'kbConnector.synced': 'Synced',
  /* ── kbCore ── */
  'kbCore.accessDenied': 'Denied',
  'kbCore.accessExpired': 'Expired',
  'kbCore.accessExpiring': 'Expiring soon',
  'kbCore.accessGranted': 'Granted',
  'kbCore.accessNotRequested': 'Not requested',
  'kbCore.accessPending': 'Pending review',
  'kbCore.accessRequested': 'Submitted',
  'kbCore.accessRevoked': 'Revoked',
  'kbCore.auditApprove': 'Approve',
  'kbCore.auditBreakGlass': 'Break-glass access',
  'kbCore.auditDelegation': 'Delegation',
  'kbCore.auditDeny': 'Deny',
  'kbCore.auditGrant': 'Grant',
  'kbCore.auditPermissionChange': 'Permission change',
  'kbCore.auditPreview': 'Preview',
  'kbCore.auditRead': 'Read',
  'kbCore.auditRequest': 'Request',
  'kbCore.auditRevoke': 'Revoke',
  'kbCore.auditSync': 'Permission sync',
  'kbCore.daysAgo': '{p0} d ago',
  'kbCore.hoursAgo': '{p0} h ago',
  'kbCore.hygieneBroadGroup': 'Over-broad group grant',
  'kbCore.hygieneBrokenInheritance': 'Broken inheritance',
  'kbCore.hygieneOrgWideLink': 'Org-wide link',
  'kbCore.hygieneOrphanedOwner': 'Owner missing',
  'kbCore.hygieneOverexposed': 'Overexposed',
  'kbCore.hygieneSensitiveMismatch': 'Sensitivity mismatch',
  'kbCore.justNow': 'Just now',
  'kbCore.levelComment': 'Can comment',
  'kbCore.levelEdit': 'Can edit',
  'kbCore.levelNone': 'No access',
  'kbCore.levelOwner': 'Owner',
  'kbCore.levelView': 'Can view',
  'kbCore.minutesAgo': '{p0} min ago',
  'kbCore.runCancelled': 'Cancelled',
  'kbCore.runDone': 'Done',
  'kbCore.runFailed': 'Failed',
  'kbCore.runQueued': 'Queued',
  'kbCore.runRunning': 'Running',
  'kbCore.runUnstarted': 'Not started',
  'kbCore.stageAgent': 'Agent',
  'kbCore.stageChunk': 'Chunking',
  'kbCore.stageEmbed': 'Embedding',
  'kbCore.stageGeneration': 'Generation',
  'kbCore.stageGuard': 'Guardrail',
  'kbCore.stageQuery': 'Query',
  'kbCore.stageRerank': 'Rerank',
  'kbCore.stageRetrieval': 'Retrieval',
  'kbCore.stageTool': 'Tool',
  'kbCore.typeApi': 'API',
  'kbCore.typeCode': 'Code',
  'kbCore.typeDatabase': 'Database',
  'kbCore.typeDocument': 'Document',
  'kbCore.typeEmail': 'Email',
  'kbCore.typeImage': 'Image',
  'kbCore.typeKb': 'Knowledge base',
  'kbCore.typeTable': 'Table',
  'kbCore.typeTicket': 'Ticket',
  'kbCore.typeWebpage': 'Webpage',
  'kbCore.unnamedSource': 'Unnamed source',
  'kbCore.unnamedSubject': 'Unnamed subject',
  'kbCore.visHidden': 'Hidden',
  'kbCore.visMetadataOnly': 'Metadata only',
  'kbCore.visSummaryOnly': 'Summary only',
  'kbCore.visVisible': 'Visible',
  /* ── kbEval ── */
  'kbEval.avgA': 'A avg {p0}',
  'kbEval.avgB': 'B avg {p0}',
  'kbEval.compare': 'Compare',
  'kbEval.expected': 'Expected',
  'kbEval.gradeImprovement': 'Improvement',
  'kbEval.gradeRegression': 'Regression',
  'kbEval.gradeTie': 'Tie',
  'kbEval.gradeTradeoff': 'Trade-off',
  'kbEval.noData': 'No comparison data',
  'kbEval.onlyRegression': 'Regressions only',
  'kbEval.outputA': 'Output A',
  'kbEval.outputB': 'Output B',
  'kbEval.outputN': 'Output {p0}',
  /* ── kbExplain ── */
  'kbExplain.empty': 'No definition available',
  'kbExplain.groupAgg': 'Aggregation',
  'kbExplain.groupColumn': 'Column',
  'kbExplain.groupFilter': 'Filter',
  'kbExplain.groupTable': 'Table',
  'kbExplain.trigger': 'How is this number calculated?',
  'kbExplain.viewDefinition': 'View definition',
  /* ── kbFilter ── */
  'kbFilter.addGroup': '+ Group',
  'kbFilter.addRule': '+ Rule',
  'kbFilter.and': 'AND',
  'kbFilter.combineMode': 'Combination: {p0}',
  'kbFilter.copyDsl': 'Copy DSL',
  'kbFilter.deleteGroup': 'Delete group',
  'kbFilter.deleteRule': 'Delete rule',
  'kbFilter.fieldLabel': 'Field',
  'kbFilter.fieldPlaceholder': 'Filter field',
  'kbFilter.noValueNeeded': '(no value needed)',
  'kbFilter.none': '(no filter)',
  'kbFilter.opContains': 'contains',
  'kbFilter.opEq': 'equals',
  'kbFilter.opExists': 'exists',
  'kbFilter.opGt': 'greater than',
  'kbFilter.opGte': 'at least',
  'kbFilter.opIn': 'in',
  'kbFilter.opLt': 'less than',
  'kbFilter.opLte': 'at most',
  'kbFilter.opNe': 'not equals',
  'kbFilter.operatorLabel': 'Operator',
  'kbFilter.or': 'OR',
  'kbFilter.toggleAndOr': 'Toggle AND / OR',
  'kbFilter.valueAria': 'Filter value',
  'kbFilter.valueLabel': 'Value',
  'kbFilter.valuePlaceholder': 'Value 1, value 2 (comma-separated)',
  /* ── kbGap ── */
  'kbGap.addSynonym': 'Add synonym',
  'kbGap.colCount': 'Count',
  'kbGap.colLastSeen': 'Last seen',
  'kbGap.colQuery': 'Query',
  'kbGap.colShare': 'Share',
  'kbGap.createDoc': 'Create doc',
  'kbGap.empty': 'No missed queries — coverage looks good',
  'kbGap.title': 'Missed-query trends',
  'kbGap.zeroClickHint': 'Users may have gotten the answer from the cited snippet; zero-click needs manual interpretation and is not directly a failure',
  'kbGap.zeroClickRate': 'Zero-click rate',
  'kbGap.zeroClickTitle': 'Zero clicks ≠ failure',
  /* ── kbHittest ── */
  'kbHittest.addAria': 'Add test question',
  'kbHittest.addPlaceholder': 'Add a test question, Enter to add',
  'kbHittest.avgScore': 'Avg score',
  'kbHittest.deleteQuestion': 'Delete question',
  'kbHittest.empty': 'No test questions yet — add the first one to start recall regression',
  'kbHittest.expectHit': 'Expected hit in top results',
  'kbHittest.expectMiss': 'Expected miss',
  'kbHittest.hitRate': 'Hit rate',
  'kbHittest.noExpectation': 'No expectation set',
  'kbHittest.notRun': 'Not run',
  'kbHittest.pass': 'Pass',
  'kbHittest.pin': 'Pin',
  'kbHittest.runAll': 'Run all',
  'kbHittest.sessionOnly': 'Parameters apply to this session only',
  'kbHittest.sessionOnlyHint': 'Retrieval parameters of test runs (topK/threshold/rerank) are not persisted — this session only',
  'kbHittest.unpin': 'Unpin',
  /* ── kbMetadata ── */
  'kbMetadata.addField': 'Add field',
  'kbMetadata.builtIn': 'Built-in',
  'kbMetadata.colField': 'Field',
  'kbMetadata.colType': 'Type',
  'kbMetadata.colValue': 'Value',
  'kbMetadata.empty': 'No metadata fields',
  'kbMetadata.nameLabel': 'New field name',
  'kbMetadata.namePlaceholder': 'Field name, e.g. department',
  'kbMetadata.removeField': 'Remove field {p0}',
  'kbMetadata.typeLabel': 'New field type',
  'kbMetadata.valueOf': 'value of {p0}',
  /* ── kbPassage ── */
  'kbPassage.blockRange': 'Blocks {p0}–{p1}',
  'kbPassage.close': 'Close source text',
  'kbPassage.expandContext': 'Expand context',
  'kbPassage.locate': 'Locate in source',
  'kbPassage.none': '(no source text)',
  'kbPassage.pageRange': 'Pages {p0}–{p1}',
  'kbPassage.restricted': 'Content restricted',
  'kbPassage.unitByte': 'bytes',
  'kbPassage.unitChar': 'chars',
  /* ── kbPipeline ── */
  'kbPipeline.empty': 'No parsing tasks',
  'kbPipeline.progress': 'Parsing progress',
  'kbPipeline.rerun': 'Rerun',
  'kbPipeline.unknownStage': 'Unknown stage',
  /* ── kbQa ── */
  'kbQa.colAnswer': 'Answer',
  'kbQa.colQuestion': 'Question',
  'kbQa.csvHint': 'CSV template: question,answer (one pair per line, UTF-8)',
  'kbQa.deleteRow': 'Delete row {p0}',
  'kbQa.empty': 'No curated Q&A pairs',
  'kbQa.importCsv': 'Import CSV',
  /* ── kbRerank ── */
  'kbRerank.after': 'After rerank',
  'kbRerank.before': 'Before rerank',
  'kbRerank.compareTitle': 'Rerank comparison',
  'kbRerank.down': 'Down {p0}',
  'kbRerank.dropped': 'Dropped',
  'kbRerank.empty': 'Both sides empty — run a retrieval first',
  'kbRerank.enableCompare': 'Enable rerank comparison',
  'kbRerank.newIn': 'New',
  'kbRerank.unmarked': 'Unmarked',
  'kbRerank.up': 'Up {p0}',
  /* ── kbRetrieval ── */
  'kbRetrieval.breakdown': 'Breakdown',
  'kbRetrieval.copyParams': 'Copy params JSON',
  'kbRetrieval.decreaseTopK': 'Decrease topK',
  'kbRetrieval.empty': 'Enter a question and run — hits will appear here',
  'kbRetrieval.failOpenNotice': 'fail-open: the current query carries no identity filter and will return all candidates (debug only)',
  'kbRetrieval.hybridWeight': 'Hybrid weight (semantic left, keyword right)',
  'kbRetrieval.identityLabel': 'Retrieval identity',
  'kbRetrieval.identityShort': 'Identity',
  'kbRetrieval.increaseTopK': 'Increase topK',
  'kbRetrieval.keywordHint': 'Keyword: fast and exact on large corpora',
  'kbRetrieval.layerLabel': 'Filter layer',
  'kbRetrieval.layerNone': 'none: fail-open, no identity filter returns everything — dangerous, demo only',
  'kbRetrieval.layerPost': 'post-filter: scores already observable — flawed layer, demo only',
  'kbRetrieval.layerPre': 'pre-filter: ACL applies inside retrieval — the security baseline',
  'kbRetrieval.leakNote': 'Pre-filter counts are leakage — not shown',
  'kbRetrieval.modeHybrid': 'Hybrid',
  'kbRetrieval.modeKeyword': 'Keyword',
  'kbRetrieval.modeLabel': 'Retrieval mode',
  'kbRetrieval.modeVector': 'Vector',
  'kbRetrieval.postFilterNotice': 'post-filter: scores were produced before filtering (flawed-layer demo)',
  'kbRetrieval.queryLabel': 'Retrieval question',
  'kbRetrieval.queryPlaceholder': 'Retrieval question, Enter to run',
  'kbRetrieval.rerankLabel': 'Rerank',
  'kbRetrieval.rerankThresholdOff': 'threshold off · keep {p0}',
  'kbRetrieval.rerankThresholdOn': 'threshold {p0} · keep {p1}',
  'kbRetrieval.running': 'Running…',
  'kbRetrieval.thresholdLabel': 'Score threshold',
  'kbRetrieval.thresholdValue': 'Threshold {p0}',
  'kbRetrieval.vectorHint': 'Semantic: cross-lingual / no exact terms',
  'kbRetrieval.vectorPercent': 'Semantic {p0}',
  'kbRetrieval.weightValue': 'Vector {p0}% / keyword {p1}%',
  /* ── kbReview ── */
  'kbReview.assignee': 'Assignee',
  'kbReview.doneNext': 'Done, next item',
  'kbReview.empty': 'No items to review',
  'kbReview.emptyAssignee': 'No items under this assignee',
  'kbReview.emptyQueue': 'Queue is empty',
  'kbReview.kbCloseHint': 'Close hint',
  'kbReview.kbSelectOption': 'Select option',
  'kbReview.kbSwitchItem': 'Switch item',
  'kbReview.kbToggleHint': 'Show/hide this hint',
  'kbReview.shortcuts': '? Shortcuts',
  'kbReview.typeAnswer': 'Answer',
  'kbReview.typeMessage': 'Message',
  'kbReview.typeTrace': 'Trace',
  'kbReview.unassigned': 'Unassigned',
  /* ── kbSandbox ── */
  'kbSandbox.noResolver': 'The host provides no ui:// resolver',
  'kbSandbox.notReady': 'kb-sandbox: app not ready',
  'kbSandbox.resolveFailed': 'ui:// resolution failed: {p0}',
  'kbSandbox.timeout': 'kb-sandbox: call timed out ({p0} ms)',
  'kbSandbox.title': 'MCP App sandbox',
  /* ── kbSegment ── */
  'kbSegment.avgLength': 'avg {p0}',
  'kbSegment.childNote': 'Child segments are generated automatically by length',
  'kbSegment.cleanBlankLines': 'Merge consecutive blank lines',
  'kbSegment.cleanEmails': 'Strip emails',
  'kbSegment.cleanLinks': 'Strip links',
  'kbSegment.empty': 'Sample is empty — nothing to preview',
  'kbSegment.maxLengthLabel': 'Max length',
  'kbSegment.maxLengthPlaceholder': 'Max segment length',
  'kbSegment.modeAuto': 'Auto',
  'kbSegment.modeCustom': 'Custom',
  'kbSegment.modeLabel': 'Segmentation mode',
  'kbSegment.modeNote': 'The segmentation mode cannot be changed after creation; parameters can be adjusted anytime',
  'kbSegment.modeParentChild': 'Parent-child',
  'kbSegment.overlapInvalid': 'Overlap must be smaller than max length',
  'kbSegment.overlapLabel': 'Overlap',
  'kbSegment.overlapPlaceholder': 'Segment overlap',
  'kbSegment.previewNote': '{p0} segments total, previewing the first {p1}',
  'kbSegment.segmentsCount': '{p0} segments',
  'kbSegment.separatorLabel': 'Separator',
  'kbSegment.separatorPlaceholder': 'Segment separator',
  'kbSegment.toggleTip': 'Click to expand/collapse',
  /* ── kbSources ── */
  'kbSources.cited': 'Cited ×{p0}',
  'kbSources.empty': 'Passages cited by the next answer will appear here',
  /* ── kbSql ── */
  'kbSql.adminOnly': 'Admins only',
  'kbSql.applyFix': 'Apply fix and rerun',
  'kbSql.confirmRerun': 'Confirm and rerun',
  'kbSql.editRerun': 'Edit & rerun',
  'kbSql.fixReady': 'The previous run errored — a fix suggestion is ready',
  'kbSql.generated': 'Generated SQL',
  /* ── kbTrace ── */
  'kbTrace.empty': 'No trace data',
  'kbTrace.hits': '{p0} hits',
  /* ── kbVisibility ── */
  'kbVisibility.adminOnlyNote': 'The comparison above is admin-audit only',
  'kbVisibility.adminWarn': 'Admin audit view — hit-difference comparison leaks to regular users; do not embed in end-user UI',
  'kbVisibility.failOpenNote': 'fail-open: Kendra returns all documents without identity context — retrieval must carry the server-side identity',
  'kbVisibility.focusColumn': 'Column for identity {p0}',
  'kbVisibility.layerValue': 'Filter layer: {p0}',
  'kbVisibility.leakageNote': 'Count differences are volume leakage: regular users may only see a constant “filtered by permissions” message; the only mitigation is padding to rounded numbers',
  'kbVisibility.postFilterNote': 'post-filter: topK is consumed by unauthorized results and similarity scores are observable',
  'kbVisibility.queryLabel': 'Query: {p0}',
  'kbVisibility.safeCount': 'Safe count {p0}',
  'kbVisibility.sourceUnavailable': 'Source text unavailable',
  'kbVisibility.unnamedHit': 'Unnamed hit',
  /* ── kbWhoCan ── */
  'kbWhoCan.check': 'Check',
  'kbWhoCan.checkIdentity': 'Check identity',
  'kbWhoCan.daysUntil': 'in {p0} days',
  'kbWhoCan.deniedBy': 'Denied by policy: {p0}',
  'kbWhoCan.denyVeto': 'Vetoed by an explicit Deny',
  'kbWhoCan.direct': 'Direct',
  'kbWhoCan.expiresSoon': 'Expires soon {p0}',
  'kbWhoCan.hoursUntil': 'in {p0} hours',
  'kbWhoCan.inherit': 'Inherited',
  'kbWhoCan.link': 'Link',
  'kbWhoCan.noDeny': 'No Deny applies',
  'kbWhoCan.noIdentity': 'No identity provided to check',
  'kbWhoCan.none': 'No grant matched — deny by default',
  'kbWhoCan.recheckTip': 'Re-check effective permissions for the current identity',
  'kbWhoCan.stackRule': 'Stacking rule: union of sources → {p0};',
  /* ── mentions ── */
  'mentions.loading': 'Loading…',
  /* ── notification ── */
  'notification.groupBusy': 'This group can be collapsed when its action finishes.',
  'notification.groupUnread': '{count} grouped notifications, {unread} unread',
  'notification.groupCount': '{count} grouped notifications',
  'notification.groupExpanded': 'Collapse group',
  'notification.ariaLabel': 'Notifications',
  'notification.viewDetails': 'View details',
  /* ── pagination ── */
  'pagination.next': 'Next page',
  'pagination.pageSize': '{p0} / page',
  'pagination.prev': 'Previous page',
  /* ── select ── */
  'select.fieldLabel': 'Select options',
  'select.noMatch': 'No matches',
  'select.remove': 'Remove {p0}',
  'select.searchPlaceholder': 'Search…',
  /* ── cascader / tree-select ── */
  'cascader.placeholder': 'Select…',
  'cascader.noMatch': 'No matches',
  'cascader.search': 'Search',
  'treeSelect.placeholder': 'Select…',
  'treeSelect.noMatch': 'No matches',
  'treeSelect.search': 'Search',
  /* ── tagInput ── */
  'tagInput.ariaLabel': 'Tag input, {p0} tags',
  'tagInput.remove': 'Remove {p0}',
  /* ── upload ── */
  'upload.remove': 'Remove {p0}',
  'upload.tooBig': 'File exceeds {p0}',
  'upload.tooMany': 'At most {p0} files',
  'upload.typeNotAllowed': 'File type not supported',
};

let current: IcenLocale = { ...ICEN_LOCALE_ZH_CN };

/** 读取当前语言（冻结浅快照；数组克隆——改返回值不影响内部状态）。 */
export function getIcenLocale(): IcenLocale {
  const snap: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(current)) {
    snap[k] = Array.isArray(v) ? Object.freeze([...v]) as unknown as string[] : v;
  }
  return Object.freeze(snap) as unknown as IcenLocale;
}

/** 取文案（行为层唯一入口）；vars 以 {name} 占位符插值（缺省变量原样保留）。 */
export function t<K extends keyof IcenLocale>(key: K): IcenLocale[K];
export function t<K extends keyof IcenLocale>(key: K, vars: Record<string, string | number>): string;
export function t(key: keyof IcenLocale, vars?: Record<string, string | number>): unknown {
  const raw = current[key] ?? ICEN_LOCALE_ZH_CN[key];
  if (vars == null || Array.isArray(raw)) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

/** 合并覆盖进当前语言（不清表），并广播 icen:locale-change { changed }（SSR 静默）。 */
export function setIcenLocale(patch: Partial<IcenLocale>): void {
  const changed = Object.keys(patch).filter((k) => patch[k as keyof IcenLocale] !== undefined);
  if (changed.length === 0) return;
  current = { ...current, ...patch };
  if (typeof document === 'undefined') return;
  emitIcen(document, 'icen:locale-change', { changed });
}

/** 回默认 zh-CN（全量 key 广播一次，组件可整体重渲染；SSR 静默）。 */
export function resetIcenLocale(): void {
  current = { ...ICEN_LOCALE_ZH_CN };
  if (typeof document === 'undefined') return;
  emitIcen(document, 'icen:locale-change', { changed: Object.keys(ICEN_LOCALE_ZH_CN) });
}
