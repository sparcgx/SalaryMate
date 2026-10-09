package com.salarymate.personal.data

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.community.database.sqlite.SQLite.Database as CapacitorDatabase
import java.util.Calendar
import java.util.Hashtable
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.roundToLong

class NativeSalaryMateRepository(context: Context) {
    private val appContext = context.applicationContext
    private val accessLock = Any()

    suspend fun loadSnapshot(): NativeSnapshot = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
            if (root == null) emptySnapshot() else buildSnapshot(root)
        }
    }

    suspend fun exportSnapshotPayload(): String = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: error("尚未建立薪資資料，無法建立備份。")
            validateSnapshot(root)
            JSONObject(root.toString()).apply {
                put("exportInfo", JSONObject().apply {
                    put("app", "個人薪資管理")
                    put("appVersion", NATIVE_APP_VERSION)
                    put("schemaVersion", root.optInt("schemaVersion", 0))
                    put("exportedAt", isoTimestamp())
                })
            }.toString(2)
        }
    }

    suspend fun restoreSnapshotPayload(payload: String): NativeSaveResult = onDatabaseThread {
        if (payload.toByteArray(Charsets.UTF_8).size > 20 * 1024 * 1024) {
            return@onDatabaseThread NativeSaveResult.Rejected("解密後的備份超過 20 MB 上限。")
        }
        val root = try {
            JSONObject(payload)
        } catch (_: Exception) {
            return@onDatabaseThread NativeSaveResult.Rejected("備份內容不是有效的薪資資料。")
        }
        try {
            validateSnapshot(root)
        } catch (error: Exception) {
            return@onDatabaseThread NativeSaveResult.Rejected(error.message ?: "備份資料驗證失敗。")
        }
        val schemaValue = root.opt("schemaVersion")
        if (schemaValue !is Number || schemaValue.toDouble() != 13.0) {
            return@onDatabaseThread NativeSaveResult.Rejected(
                "這份備份不是 Schema 13；請使用完整管理介面先完成安全遷移。"
            )
        }
        root.remove("exportInfo")
        withDatabase { database ->
            writeSnapshot(database, root)
            val verified = readLatestSnapshot(database)
                ?: return@withDatabase NativeSaveResult.Rejected("還原後讀取驗證失敗，已停止操作。")
            validateSnapshot(verified)
            NativeSaveResult.Saved(
                "備份已還原：公司 ${verified.requiredArray("companies").length()}、薪資 ${verified.requiredArray("records").length()}、加班 ${verified.requiredArray("overtimeLogs").length()} 筆"
            )
        }
    }

    suspend fun saveCompanyBasics(draft: NativeCompanyBasicsDraft): NativeSaveResult = onDatabaseThread {
        val name = draft.name.trim()
        if (name.isBlank()) return@onDatabaseThread NativeSaveResult.Rejected("請輸入公司名稱。")
        if (name.length > 80) return@onDatabaseThread NativeSaveResult.Rejected("公司名稱不可超過 80 個字。")
        if (draft.baseSalary < 0.0 || !draft.baseSalary.isFinite()) {
            return@onDatabaseThread NativeSaveResult.Rejected("基本月薪不可小於 0。")
        }
        if (NativePayrollMath.parseIsoDate(draft.employmentStartDate) == null) {
            return@onDatabaseThread NativeSaveResult.Rejected("請輸入有效到職日。")
        }
        withDatabase { database ->
            val root = readLatestSnapshot(database) ?: emptyWritableRoot()
            ensureWritableSchema(root)?.let { return@withDatabase it }
            val companies = root.requiredArray("companies")
            val items = companies.objectList()
            val existingIndex = items.indexOfFirst { it.optString("id") == draft.id && draft.id.isNotBlank() }
            val isCreate = existingIndex < 0
            if (draft.id.isNotBlank() && isCreate) {
                return@withDatabase NativeSaveResult.Rejected("找不到要編輯的公司，請重新整理後再試。")
            }
            val company = if (isCreate) {
                defaultCompanyJson(
                    id = "company_${UUID.randomUUID()}",
                    name = name,
                    baseSalary = draft.baseSalary,
                    employmentStartDate = draft.employmentStartDate,
                    isCurrent = companies.length() == 0
                )
            } else {
                JSONObject(items[existingIndex].toString()).apply {
                    put("name", name)
                    if (optString("employmentMode") != "dispatch_hourly") put("baseSalary", draft.baseSalary)
                    put("employmentStartDate", draft.employmentStartDate)
                }
            }
            if (isCreate) {
                companies.put(company)
            } else {
                companies.put(existingIndex, company)
            }
            if (company.optBoolean("isCurrent", false)) {
                companies.objectList().forEach { it.put("isCurrent", it.optString("id") == company.optString("id")) }
                root.optJSONObject("uiPreferences")?.put("companyFilter", company.optString("id"))
            }
            writeSnapshot(database, root)
            NativeSaveResult.Saved(
                if (isCreate && company.optBoolean("isCurrent", false)) "公司已建立並設為目前公司"
                else if (isCreate) "公司已建立；目前公司未切換"
                else "公司基本資料已更新"
            )
        }
    }

    suspend fun setCurrentCompany(companyId: String): NativeSaveResult = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: return@withDatabase NativeSaveResult.Rejected("尚未建立公司。")
            ensureWritableSchema(root)?.let { return@withDatabase it }
            val companies = root.requiredArray("companies")
            val target = companies.objectList().firstOrNull { it.optString("id") == companyId }
                ?: return@withDatabase NativeSaveResult.Rejected("找不到選擇的公司，請重新整理後再試。")
            companies.objectList().forEach { company ->
                company.put("isCurrent", company.optString("id") == companyId)
            }
            root.optJSONObject("uiPreferences")?.put("companyFilter", companyId)
            writeSnapshot(database, root)
            NativeSaveResult.Saved("目前公司已切換為「${target.optString("name", "未命名公司")}」")
        }
    }

    suspend fun addOvertime(draft: NativeOvertimeDraft): NativeSaveResult = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: return@withDatabase NativeSaveResult.Rejected("尚未建立薪資資料，請先到完整管理新增公司。")
            ensureWritableSchema(root)?.let { return@withDatabase it }
            val companies = root.requiredArray("companies")
            if (companies.objectList().none { it.optString("id") == draft.companyId }) {
                return@withDatabase NativeSaveResult.Rejected("找不到選擇的公司，請重新整理後再試。")
            }
            if (NativePayrollMath.parseIsoDate(draft.date) == null) {
                return@withDatabase NativeSaveResult.Rejected("請選擇有效的加班日期。")
            }
            val maxHours = if (draft.type == NativeOvertimeType.RestDay) 12.0 else 24.0
            if (draft.hours < 0.5 || draft.hours > maxHours) {
                return@withDatabase NativeSaveResult.Rejected("加班時數需介於 0.5 與 ${maxHours.cleanNumber()} 小時。")
            }
            if (!isHalfHourIncrement(draft.hours)) {
                return@withDatabase NativeSaveResult.Rejected("加班時數請以 0.5 小時為單位。")
            }
            val roundedRate = NativePayrollMath.roundHourlyRate(draft.hourlyRate)
            if (roundedRate <= 0.0) {
                return@withDatabase NativeSaveResult.Rejected("請輸入大於 0 的每日加班時薪。")
            }
            if (draft.type == NativeOvertimeType.Custom && draft.customRate <= 0.0) {
                return@withDatabase NativeSaveResult.Rejected("自訂倍率必須大於 0。")
            }
            if (draft.note.length > 160) {
                return@withDatabase NativeSaveResult.Rejected("備註不可超過 160 個字。")
            }

            val logs = root.requiredArray("overtimeLogs")
            val duplicate = logs.objectList().any { log ->
                log.optString("companyId") == draft.companyId &&
                    log.optString("date") == draft.date &&
                    normalizedOvertimeType(log.optString("type")) == draft.type.storageValue &&
                    nearlyEqual(log.safeDouble("hours"), draft.hours)
            }
            if (duplicate) {
                return@withDatabase NativeSaveResult.Rejected("相同日期、公司、類型與時數的紀錄已存在。")
            }

            logs.put(JSONObject().apply {
                put("id", "ot_${UUID.randomUUID()}")
                put("date", draft.date)
                put("companyId", draft.companyId)
                put("type", draft.type.storageValue)
                put("hours", draft.hours)
                put("hourlyRate", roundedRate)
                put("customRate", if (draft.customRate > 0.0) draft.customRate else 1.34)
                put("note", draft.note.trim())
            })
            writeSnapshot(database, root)
            NativeSaveResult.Saved("加班紀錄已新增")
        }
    }

    suspend fun addLeave(
        draft: NativeLeaveDraft,
        allowWarnings: Boolean = false
    ): NativeSaveResult = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: return@withDatabase NativeSaveResult.Rejected("尚未建立薪資資料，請先到完整管理新增公司。")
            ensureWritableSchema(root)?.let { return@withDatabase it }
            val companyJson = root.requiredArray("companies").objectList()
                .firstOrNull { it.optString("id") == draft.companyId }
                ?: return@withDatabase NativeSaveResult.Rejected("找不到選擇的公司，請重新整理後再試。")
            if (NativePayrollMath.parseIsoDate(draft.date) == null) {
                return@withDatabase NativeSaveResult.Rejected("請選擇有效的請假日期。")
            }
            val workHours = companyJson.safeDouble("workHoursPerDay").takeIf { it > 0 } ?: 8.0
            if (draft.duration == NativeLeaveDuration.Hours &&
                (draft.customHours < 0.5 || draft.customHours > workHours)
            ) {
                return@withDatabase NativeSaveResult.Rejected(
                    "單日小時請假需介於 0.5 與 ${workHours.cleanNumber()} 小時。"
                )
            }
            if (draft.duration == NativeLeaveDuration.Hours && !isHalfHourIncrement(draft.customHours)) {
                return@withDatabase NativeSaveResult.Rejected("請假時數請以 0.5 小時為單位。")
            }
            if (draft.paidRatio !in 0..100) {
                return@withDatabase NativeSaveResult.Rejected("給薪比例需介於 0% 與 100%。")
            }
            if (draft.note.length > 160) {
                return@withDatabase NativeSaveResult.Rejected("備註不可超過 160 個字。")
            }

            val leaves = root.optionalArray("leaveRecords")
            val overlap = leaves.objectList().firstOrNull { existing ->
                existing.optString("companyId") == draft.companyId &&
                    existing.optString("status", "confirmed") != "cancelled" &&
                    leaveCoversDate(existing, draft.date) &&
                    portionsOverlap(existingLeavePortion(existing, draft.date), draft.duration.portion())
            }
            if (overlap != null) {
                return@withDatabase NativeSaveResult.Rejected(
                    "這一天已有「${leaveTypeLabel(overlap.optString("type"))}」紀錄，請先到完整出勤頁確認。"
                )
            }

            val warnings = mutableListOf<String>()
            val sameDayOvertime = root.requiredArray("overtimeLogs").objectList().any { log ->
                log.optString("companyId") == draft.companyId && log.optString("date") == draft.date
            }
            if (sameDayOvertime) warnings += "${draft.date} 同日已有加班紀錄"

            if (draft.type == NativeLeaveType.Menstrual) {
                val month = draft.date.take(7)
                val usedDays = leaves.objectList()
                    .filter { record ->
                        record.optString("companyId") == draft.companyId &&
                            record.optString("type") == NativeLeaveType.Menstrual.storageValue &&
                            record.optString("status", "confirmed") != "cancelled" &&
                            record.optString("startDate", record.optString("date")).startsWith(month)
                    }
                    .sumOf(::leaveDays)
                if (usedDays + requestedLeaveDays(draft, workHours) > 1.0) {
                    warnings += "${month.replace("-", " 年 ")} 月生理假將超過每月 1 天額度"
                }
            }
            val policy = companyJson.optJSONObject("leavePolicies")?.optJSONObject(draft.type.storageValue)
            if (draft.type == NativeLeaveType.Annual &&
                policy?.optString("mode", "auto") == "auto" &&
                NativePayrollMath.parseIsoDate(companyJson.optString("employmentStartDate")) == null
            ) {
                warnings += "公司尚未設定第一天上班日，無法檢查特休額度"
            } else if (policy?.optString("mode") == "custom") {
                warnings += "此假別採公司自訂額度，儲存後請在完整出勤頁確認剩餘額度"
            }
            if (warnings.isNotEmpty() && !allowWarnings) {
                return@withDatabase NativeSaveResult.NeedsConfirmation(warnings)
            }

            val customHours = if (draft.duration == NativeLeaveDuration.Hours) draft.customHours else 0.0
            val quantity = if (draft.duration == NativeLeaveDuration.Hours) customHours else 1.0
            leaves.put(JSONObject().apply {
                put("id", "leave_${UUID.randomUUID()}")
                put("startDate", draft.date)
                put("endDate", draft.date)
                put("date", draft.date)
                put("companyId", draft.companyId)
                put("type", draft.type.storageValue)
                put("durationMode", draft.duration.storageValue)
                put("startPortion", "full")
                put("endPortion", "full")
                put("customHours", customHours)
                put("includeWeekends", false)
                put("status", draft.status.storageValue)
                put("unit", if (draft.duration == NativeLeaveDuration.Hours) "hour" else if (draft.duration.name.startsWith("Half")) "halfday" else "day")
                put("quantity", quantity)
                put("paidRatio", draft.paidRatio)
                put("attendanceDeduction", 0)
                put("note", draft.note.trim())
            })
            root.put("leaveRecords", leaves)
            writeSnapshot(database, root)
            NativeSaveResult.Saved("請假紀錄已新增")
        }
    }

    suspend fun prepareSalaryDraft(
        companyId: String? = null,
        year: Int,
        month: Int,
        recordId: String = "",
        copyFromId: String = ""
    ): NativeSalaryDraftResult = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: return@withDatabase NativeSalaryDraftResult.Rejected("尚未建立薪資資料，請先到公司管理新增公司。")
            if (root.optInt("schemaVersion", 0) != 13) {
                return@withDatabase NativeSalaryDraftResult.Rejected(
                    "目前資料 Schema 為 ${root.optInt("schemaVersion", 0)}；請先開啟完整管理完成安全遷移。"
                )
            }
            if (year !in 2000..2100 || month !in 1..12) {
                return@withDatabase NativeSalaryDraftResult.Rejected("請選擇有效的薪資年月。")
            }
            val companies = root.requiredArray("companies").objectList()
            val records = root.requiredArray("records").objectList()

            if (recordId.isNotBlank()) {
                val recordJson = records.firstOrNull { it.optString("id") == recordId }
                    ?: return@withDatabase NativeSalaryDraftResult.Rejected("找不到這筆薪資紀錄，請重新整理後再試。")
                val record = parseSalaryRecord(recordJson)
                val company = companies.firstOrNull { it.optString("id") == record.companyId }
                    ?: return@withDatabase NativeSalaryDraftResult.Rejected("這筆薪資的公司資料不存在，已停止原生編輯。")
                return@withDatabase NativeSalaryDraftResult.Ready(record.toDraft(root, company, autoTax = false))
            }

            if (copyFromId.isNotBlank()) {
                val sourceJson = records.firstOrNull { it.optString("id") == copyFromId }
                    ?: return@withDatabase NativeSalaryDraftResult.Rejected("找不到要複製的薪資紀錄，請重新整理後再試。")
                val source = parseSalaryRecord(sourceJson)
                val company = companies.firstOrNull { it.optString("id") == source.companyId }
                    ?: return@withDatabase NativeSalaryDraftResult.Rejected("來源薪資的公司資料不存在，無法安全複製。")
                val next = NativePayrollMath.nextSalaryMonth(source.year, source.month)
                val base = buildBlankSalaryDraft(root, company, next.year, next.month)
                val manualEarnings = source.customEarnings.filter { it.sourceType != "company-fixed" }
                val safeDeductions = source.customDeductions.filter { it.sourceType != "leave-sync" }
                val copied = base.copy(
                    customEarnings = base.customEarnings + manualEarnings.map { it.copy(id = "earn_${UUID.randomUUID()}") },
                    otherDeduction = source.otherDeduction,
                    customDeductions = safeDeductions.map { it.copy(id = "deduct_${UUID.randomUUID()}") },
                    pensionSelf = source.pensionSelf,
                    note = "複製自 ${source.year} 年 ${source.month} 月；請確認本月異動項目"
                ).withAutomaticTax()
                return@withDatabase NativeSalaryDraftResult.Ready(copied)
            }

            val company = companies.firstOrNull { it.optString("id") == companyId }
                ?: companies.firstOrNull { it.optBoolean("isCurrent", false) }
                ?: return@withDatabase NativeSalaryDraftResult.Rejected("目前公司尚未設定。請先到公司管理設為目前公司，再建立薪資。")
            NativeSalaryDraftResult.Ready(buildBlankSalaryDraft(root, company, year, month))
        }
    }

    suspend fun saveSalaryRecord(draft: NativeSalaryDraft): NativeSaveResult = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: return@withDatabase NativeSaveResult.Rejected("尚未建立薪資資料，請先到公司管理新增公司。")
            ensureWritableSchema(root)?.let { return@withDatabase it }
            if (draft.year !in 2000..2100 || draft.month !in 1..12) {
                return@withDatabase NativeSaveResult.Rejected("請選擇有效的薪資年月。")
            }
            if (draft.payDate.isNotBlank() && NativePayrollMath.parseIsoDate(draft.payDate) == null) {
                return@withDatabase NativeSaveResult.Rejected("請選擇有效的入帳日期。")
            }
            if (root.requiredArray("companies").objectList().none { it.optString("id") == draft.companyId }) {
                return@withDatabase NativeSaveResult.Rejected("找不到選擇的公司，請重新整理後再試。")
            }
            val mode = if (draft.employmentMode == "dispatch_hourly") "dispatch_hourly" else "monthly"
            if (mode == "dispatch_hourly" && (draft.baseHourlyRate <= 0.0 || draft.regularHours !in 0.5..744.0)) {
                return@withDatabase NativeSaveResult.Rejected("派遣薪資需填入大於 0 的基本時薪，以及 0.5～744 小時的正常工時。")
            }
            if (mode == "dispatch_hourly" && !isHalfHourIncrement(draft.regularHours)) {
                return@withDatabase NativeSaveResult.Rejected("正常工時請以 0.5 小時為單位。")
            }
            if (draft.note.length > 300) {
                return@withDatabase NativeSaveResult.Rejected("備註不可超過 300 個字。")
            }
            val amounts = listOf(
                draft.baseSalary, draft.baseHourlyRate, draft.regularHours, draft.mealAllowance,
                draft.positionAllowance, draft.overtime, draft.bonus, draft.laborIns,
                draft.healthIns, draft.taxWithheld, draft.otherDeduction, draft.pensionSelf,
                draft.sideIncome
            ) + draft.customEarnings.map { it.amount } + draft.customDeductions.map { it.amount }
            if (amounts.any { !it.isFinite() || it < 0.0 }) {
                return@withDatabase NativeSaveResult.Rejected("薪資與扣除金額不可為負數。")
            }

            val records = root.requiredArray("records").objectList()
            val existing = draft.id.takeIf { it.isNotBlank() }?.let { id -> records.firstOrNull { it.optString("id") == id } }
            if (draft.id.isNotBlank() && existing == null) {
                return@withDatabase NativeSaveResult.Rejected("這筆薪資已不存在，資料未變更。請重新整理後再試。")
            }
            val duplicate = records.any { record ->
                record.optString("id") != draft.id &&
                    record.optString("companyId") == draft.companyId &&
                    record.optInt("year") == draft.year &&
                    record.optInt("month") == draft.month
            }
            if (duplicate) {
                return@withDatabase NativeSaveResult.Rejected("這家公司已有 ${draft.year} 年 ${draft.month} 月薪資，請改為編輯既有紀錄。")
            }

            val normalizedBase = if (mode == "dispatch_hourly") {
                (NativePayrollMath.roundHourlyRate(draft.baseHourlyRate) * draft.regularHours).roundToLong().toDouble()
            } else {
                draft.baseSalary
            }
            var normalized = draft.copy(
                employmentMode = mode,
                baseHourlyRate = NativePayrollMath.roundHourlyRate(draft.baseHourlyRate),
                baseSalary = normalizedBase,
                payDate = draft.payDate.trim(),
                note = draft.note.trim()
            )
            if (normalized.autoTax) normalized = normalized.withAutomaticTax()
            val recordId = normalized.id.ifBlank { "record_${UUID.randomUUID()}" }
            val saved = normalized.toJson(recordId)
            val nextRecords = JSONArray()
            var replaced = false
            records.forEach { record ->
                if (record.optString("id") == recordId) {
                    nextRecords.put(saved)
                    replaced = true
                } else {
                    nextRecords.put(record)
                }
            }
            if (!replaced) nextRecords.put(saved)
            root.put("records", nextRecords)
            writeSnapshot(database, root)
            NativeSaveResult.Saved(if (existing == null) "${draft.year} 年 ${draft.month} 月薪資已建立" else "薪資紀錄已更新")
        }
    }

    suspend fun deleteSalaryRecord(recordId: String): NativeSaveResult = onDatabaseThread {
        withDatabase { database ->
            val root = readLatestSnapshot(database)
                ?: return@withDatabase NativeSaveResult.Rejected("尚未建立薪資資料。")
            ensureWritableSchema(root)?.let { return@withDatabase it }
            val records = root.requiredArray("records").objectList()
            val target = records.firstOrNull { it.optString("id") == recordId }
                ?: return@withDatabase NativeSaveResult.Rejected("這筆薪資已不存在，資料未變更。")
            val nextRecords = JSONArray()
            records.filter { it.optString("id") != recordId }.forEach { nextRecords.put(it) }
            root.put("records", nextRecords)
            writeSnapshot(database, root)
            NativeSaveResult.Saved("${target.optInt("year")} 年 ${target.optInt("month")} 月薪資已刪除")
        }
    }

    private fun buildSnapshot(root: JSONObject): NativeSnapshot {
        validateSnapshot(root)
        val companiesJson = root.requiredArray("companies").objectList()
        val companies = companiesJson.map(::parseCompany)
        val currentCompany = companies.firstOrNull { it.isCurrent }
        val records = root.requiredArray("records").objectList()
        val nativeRecords = records.map(::parseSalaryRecord).sortedWith(
            compareByDescending<NativeSalaryRecord> { it.year }
                .thenByDescending { it.month }
                .thenByDescending { it.payDate }
        )
        val overtime = root.requiredArray("overtimeLogs").objectList()
        val leaves = root.optionalArray("leaveRecords").objectList()
        val today = NativePayrollMath.todayIso()
        val todayParts = NativePayrollMath.parseIsoDate(today)
        val currentYear = todayParts?.first ?: Calendar.getInstance().get(Calendar.YEAR)
        val currentSalaryMonth = currentCompany?.let {
            NativePayrollMath.salaryMonthForDate(today, it.payrollPeriodType)
        } ?: SalaryMonth(currentYear, todayParts?.second ?: 1)

        val yearRecords = records.filter { it.optInt("year") == currentYear }
        val latestRecord = records.maxWithOrNull(
            compareBy<JSONObject>({ it.optInt("year") }, { it.optInt("month") }, { it.optString("payDate") })
        )
        val scopedOvertime = overtime.filter { log ->
            val company = companies.firstOrNull { it.id == log.optString("companyId") }
            company != null && company.id == currentCompany?.id &&
                NativePayrollMath.compareMonth(log.optString("date"), currentSalaryMonth, company.payrollPeriodType)
        }
        val scopedLeaves = leaves.filter { leave ->
            leave.optString("companyId") == currentCompany?.id &&
                leave.optString("status", "confirmed") != "cancelled" &&
                NativePayrollMath.compareMonth(
                    leave.optString("startDate", leave.optString("date")),
                    currentSalaryMonth,
                    currentCompany?.payrollPeriodType ?: "calendar"
                )
        }
        val todayOvertime = overtime.any { it.optString("date") == today }
        val todayLeave = leaves.any {
            it.optString("status", "confirmed") != "cancelled" && leaveCoversDate(it, today)
        }
        val todayStatus = when {
            todayOvertime && todayLeave -> "今天已登記加班與請假"
            todayOvertime -> "今天已登記加班"
            todayLeave -> "今天已有請假紀錄"
            else -> "今天尚未登記"
        }
        val latestRate = overtime
            .filter { it.safeDouble("hourlyRate") > 0 }
            .maxWithOrNull(compareBy<JSONObject>({ it.optString("date") }, { it.optString("id") }))
            ?.safeDouble("hourlyRate") ?: 0.0

        return NativeSnapshot(
            hasSnapshot = true,
            sourceAppVersion = root.optString("appVersion", "未知版本"),
            updatedAt = root.optString("updatedAt"),
            companies = companies,
            salaryRecords = nativeRecords,
            currentCompanyId = currentCompany?.id,
            latestOvertimeRate = NativePayrollMath.roundHourlyRate(latestRate),
            companyCount = companies.size,
            salaryRecordCount = records.size,
            overtimeRecordCount = overtime.size,
            leaveRecordCount = leaves.size,
            overview = NativeHomeOverview(
                currentCompanyName = currentCompany?.name ?: "尚未建立公司",
                salaryMonthLabel = "${currentSalaryMonth.year} 年 ${currentSalaryMonth.month} 月",
                latestSalaryMonth = latestRecord?.let { "${it.optInt("year")} 年 ${it.optInt("month")} 月" },
                latestNetPay = latestRecord?.let(::recordNetPay),
                latestGrossPay = latestRecord?.let(::recordGrossPay),
                year = currentYear,
                yearNetPay = yearRecords.sumOf(::recordNetPay),
                yearGrossPay = yearRecords.sumOf(::recordGrossPay),
                overtimeHours = scopedOvertime.sumOf { it.safeDouble("hours") },
                overtimePay = scopedOvertime.sumOf(::overtimeAmount),
                activeLeaveCount = scopedLeaves.size,
                todayRegistered = todayOvertime || todayLeave,
                todayStatus = todayStatus,
                recentItems = recentItems(records, overtime, leaves)
            )
        )
    }

    private fun recentItems(
        records: List<JSONObject>,
        overtime: List<JSONObject>,
        leaves: List<JSONObject>
    ): List<NativeActivityItem> {
        val items = mutableListOf<Pair<String, NativeActivityItem>>()
        records.forEach { record ->
            val date = record.optString("payDate").ifBlank {
                "%04d-%02d-01".format(Locale.US, record.optInt("year"), record.optInt("month"))
            }
            items += date to NativeActivityItem(
                kind = ActivityKind.Salary,
                title = "${record.optInt("year")} 年 ${record.optInt("month")} 月薪資",
                detail = "實領 ${formatMoney(recordNetPay(record))}",
                date = date
            )
        }
        overtime.forEach { log ->
            val date = log.optString("date")
            items += date to NativeActivityItem(
                kind = ActivityKind.Overtime,
                title = "${overtimeTypeLabel(log.optString("type"))}加班 ${log.safeDouble("hours").cleanNumber()} 小時",
                detail = "預估 ${formatMoney(overtimeAmount(log))}",
                date = date
            )
        }
        leaves.filter { it.optString("status", "confirmed") != "cancelled" }.forEach { leave ->
            val date = leave.optString("startDate", leave.optString("date"))
            items += date to NativeActivityItem(
                kind = ActivityKind.Leave,
                title = leaveTypeLabel(leave.optString("type")),
                detail = leaveDurationLabel(leave),
                date = date
            )
        }
        return items.sortedByDescending { it.first }.take(5).map { it.second }
    }

    private fun defaultLeavePoliciesJson(): JSONObject = JSONObject().apply {
        NativeLeaveType.entries.forEach { type ->
            put(type.storageValue, JSONObject().apply {
                put("mode", if (type == NativeLeaveType.Annual) "auto" else "unlimited")
                put("quotaDays", 0)
            })
        }
    }

    private fun defaultCompanyJson(
        id: String,
        name: String,
        baseSalary: Double,
        employmentStartDate: String,
        isCurrent: Boolean
    ): JSONObject = JSONObject().apply {
        put("id", id)
        put("name", name)
        put("position", "")
        put("isCurrent", isCurrent)
        put("employmentMode", "monthly")
        put("baseSalary", baseSalary)
        put("baseHourlyRate", 0)
        put("defaultRegularHours", 174)
        put("mealAllowance", 3000)
        put("positionAllowance", 0)
        put("fixedEarnings", JSONArray())
        put("laborIns", 0)
        put("healthIns", 0)
        put("taxWithheld", 0)
        put("employmentStartDate", employmentStartDate)
        put("workHoursPerDay", 8)
        put("leaveQuotaCycle", "calendar")
        put("leavePolicies", defaultLeavePoliciesJson())
        put("payrollPeriodType", "calendar")
        put("payrollCycleStartDay", 1)
        put("payrollCycleEndDay", 31)
        put("leaveDeductionEach", 500)
        put("deductionRuleNote", "事假、病假、曠職或遲到達門檻時，每次依設定金額扣款。")
    }

    private fun emptyWritableRoot(): JSONObject = JSONObject().apply {
        put("schemaVersion", 13)
        put("appVersion", NATIVE_APP_VERSION)
        put("updatedAt", isoTimestamp())
        put("companies", JSONArray())
        put("records", JSONArray())
        put("overtimeLogs", JSONArray())
        put("leaveRecords", JSONArray())
        put("yearEndEstimates", JSONArray())
        put("salaryAdjustments", JSONArray())
        put("overtimeCalculator", JSONObject())
        put("uiPreferences", JSONObject())
        put("hourlySettings", JSONObject())
    }

    private fun emptySnapshot(): NativeSnapshot {
        val today = NativePayrollMath.todayIso()
        val parts = NativePayrollMath.parseIsoDate(today)
        val year = parts?.first ?: Calendar.getInstance().get(Calendar.YEAR)
        val month = parts?.second ?: 1
        return NativeSnapshot(
            hasSnapshot = false,
            sourceAppVersion = NATIVE_APP_VERSION,
            updatedAt = "",
            companies = emptyList(),
            salaryRecords = emptyList(),
            currentCompanyId = null,
            latestOvertimeRate = 0.0,
            companyCount = 0,
            salaryRecordCount = 0,
            overtimeRecordCount = 0,
            leaveRecordCount = 0,
            overview = NativeHomeOverview(
                currentCompanyName = "尚未建立公司",
                salaryMonthLabel = "$year 年 $month 月",
                latestSalaryMonth = null,
                latestNetPay = null,
                latestGrossPay = null,
                year = year,
                yearNetPay = 0,
                yearGrossPay = 0,
                overtimeHours = 0.0,
                overtimePay = 0,
                activeLeaveCount = 0,
                todayRegistered = false,
                todayStatus = "今天尚未登記",
                recentItems = emptyList()
            )
        )
    }

    private fun payrollPeriodKey(value: JSONObject): String = when (value.optString("payrollPeriodType")) {
        "prev16" -> "prev16"
        "custom" -> "custom:${value.optInt("payrollCycleStartDay", 1).coerceIn(1, 31)}:${value.optInt("payrollCycleEndDay", 31).coerceIn(1, 31)}"
        else -> "calendar"
    }

    private fun parseCompany(value: JSONObject) = NativeCompany(
        id = value.optString("id"),
        name = value.optString("name", "未命名公司"),
        position = value.optString("position"),
        isCurrent = value.optBoolean("isCurrent", false),
        employmentMode = if (value.optString("employmentMode") == "dispatch_hourly") "dispatch_hourly" else "monthly",
        baseSalary = value.safeDouble("baseSalary"),
        baseHourlyRate = NativePayrollMath.roundHourlyRate(value.safeDouble("baseHourlyRate")),
        defaultRegularHours = value.safeDouble("defaultRegularHours").takeIf { it > 0 } ?: 174.0,
        mealAllowance = value.safeDouble("mealAllowance"),
        positionAllowance = value.safeDouble("positionAllowance"),
        fixedEarnings = parseMoneyItems(value.optJSONArray("fixedEarnings")),
        laborIns = value.safeDouble("laborIns"),
        healthIns = value.safeDouble("healthIns"),
        taxWithheld = value.safeDouble("taxWithheld"),
        payrollPeriodType = payrollPeriodKey(value),
        workHoursPerDay = value.safeDouble("workHoursPerDay").takeIf { it > 0 } ?: 8.0,
        employmentStartDate = value.optString("employmentStartDate")
    )

    private data class SalaryProfile(
        val employmentMode: String,
        val baseSalary: Double,
        val baseHourlyRate: Double,
        val regularHours: Double,
        val mealAllowance: Double,
        val positionAllowance: Double,
        val fixedEarnings: List<NativeMoneyItem>,
        val sourceLabel: String
    )

    private fun parseSalaryRecord(value: JSONObject): NativeSalaryRecord {
        val employmentMode = if (value.optString("employmentMode") == "dispatch_hourly") "dispatch_hourly" else "monthly"
        val baseHourlyRate = NativePayrollMath.roundHourlyRate(value.safeDouble("baseHourlyRate"))
        val regularHours = value.safeDouble("regularHours").takeIf { it > 0.0 }
            ?: if (employmentMode == "dispatch_hourly") 174.0 else 0.0
        val baseSalary = if (employmentMode == "dispatch_hourly") {
            (baseHourlyRate * regularHours).roundToLong().toDouble()
        } else {
            value.safeDouble("baseSalary")
        }
        return NativeSalaryRecord(
            id = value.optString("id"),
            companyId = value.optString("companyId"),
            year = value.optInt("year").takeIf { it in 2000..2100 } ?: Calendar.getInstance().get(Calendar.YEAR),
            month = value.optInt("month", 1).coerceIn(1, 12),
            payDate = value.optString("payDate"),
            employmentMode = employmentMode,
            baseHourlyRate = baseHourlyRate,
            regularHours = regularHours,
            baseSalary = baseSalary,
            mealAllowance = value.safeDouble("mealAllowance"),
            positionAllowance = value.safeDouble("positionAllowance"),
            overtime = value.safeDouble("overtime"),
            bonus = value.safeDouble("bonus"),
            customEarnings = parseMoneyItems(value.optJSONArray("customEarnings")),
            laborIns = value.safeDouble("laborIns"),
            healthIns = value.safeDouble("healthIns"),
            taxWithheld = value.safeDouble("taxWithheld"),
            otherDeduction = value.safeDouble("otherDeduction"),
            customDeductions = parseMoneyItems(value.optJSONArray("customDeductions")),
            pensionSelf = value.safeDouble("pensionSelf"),
            sideIncome = value.safeDouble("sideIncome"),
            note = value.optString("note")
        )
    }

    private fun parseMoneyItems(value: JSONArray?): List<NativeMoneyItem> = value?.objectList()?.map { item ->
        NativeMoneyItem(
            id = item.optString("id").ifBlank { "item_${UUID.randomUUID()}" },
            name = item.optString("name"),
            amount = item.safeDouble("amount"),
            affectsHourly = item.optBoolean("affectsHourly", false),
            sourceType = item.optString("sourceType"),
            sourceKey = item.optString("sourceKey")
        )
    }.orEmpty()

    private fun salaryProfileAt(
        root: JSONObject,
        company: JSONObject,
        month: SalaryMonth
    ): SalaryProfile {
        val profileDate = NativePayrollMath.salaryPeriodEnd(
            month,
            payrollPeriodKey(company)
        )
        val adjustment = root.optJSONArray("salaryAdjustments")?.objectList().orEmpty()
            .filter { record ->
                record.optString("companyId") == company.optString("id") &&
                    NativePayrollMath.parseIsoDate(record.optString("effectiveDate")) != null &&
                    record.optString("effectiveDate") <= profileDate
            }
            .maxWithOrNull(compareBy<JSONObject>({ it.optString("effectiveDate") }, { it.optString("id") }))
        val source = adjustment ?: company
        val mode = if (source.optString("employmentMode") == "dispatch_hourly") "dispatch_hourly" else "monthly"
        val regularHours = source.safeDouble(
            if (adjustment == null) "defaultRegularHours" else "regularHours"
        ).takeIf { it > 0.0 } ?: if (mode == "dispatch_hourly") 174.0 else 0.0
        return SalaryProfile(
            employmentMode = mode,
            baseSalary = source.safeDouble("baseSalary"),
            baseHourlyRate = NativePayrollMath.roundHourlyRate(source.safeDouble("baseHourlyRate")),
            regularHours = regularHours,
            mealAllowance = source.safeDouble("mealAllowance"),
            positionAllowance = source.safeDouble("positionAllowance"),
            fixedEarnings = parseMoneyItems(source.optJSONArray("fixedEarnings")),
            sourceLabel = adjustment?.let { "調薪生效 ${it.optString("effectiveDate")}" } ?: "公司固定薪資"
        )
    }

    private fun buildBlankSalaryDraft(
        root: JSONObject,
        company: JSONObject,
        year: Int,
        month: Int
    ): NativeSalaryDraft {
        val salaryMonth = SalaryMonth(year, month)
        val payrollPeriodType = payrollPeriodKey(company)
        val profile = salaryProfileAt(root, company, salaryMonth)
        val overtimeLogs = root.requiredArray("overtimeLogs").objectList().filter { log ->
            log.optString("companyId") == company.optString("id") &&
                NativePayrollMath.salaryMonthForDate(log.optString("date"), payrollPeriodType) == salaryMonth
        }
        val fixedEarnings = profile.fixedEarnings
            .filter { it.name.isNotBlank() || it.amount != 0.0 }
            .map { item ->
                NativeMoneyItem(
                    id = "earn_${UUID.randomUUID()}",
                    name = item.name,
                    amount = item.amount,
                    affectsHourly = true,
                    sourceType = "company-fixed",
                    sourceKey = item.id
                )
            }
        val baseSalary = if (profile.employmentMode == "dispatch_hourly") {
            (profile.baseHourlyRate * profile.regularHours).roundToLong().toDouble()
        } else {
            profile.baseSalary
        }
        return NativeSalaryDraft(
            id = "",
            companyId = company.optString("id"),
            year = year,
            month = month,
            payDate = NativePayrollMath.defaultPayDate(year, month),
            employmentMode = profile.employmentMode,
            baseHourlyRate = profile.baseHourlyRate,
            regularHours = profile.regularHours,
            baseSalary = baseSalary,
            mealAllowance = profile.mealAllowance,
            positionAllowance = profile.positionAllowance,
            overtime = overtimeLogs.sumOf(::overtimeAmount).toDouble(),
            bonus = 0.0,
            customEarnings = fixedEarnings,
            laborIns = company.safeDouble("laborIns"),
            healthIns = company.safeDouble("healthIns"),
            taxWithheld = 0.0,
            otherDeduction = 0.0,
            customDeductions = emptyList(),
            pensionSelf = 0.0,
            sideIncome = 0.0,
            note = "",
            autoTax = true,
            overtimeLogCount = overtimeLogs.size,
            salaryPeriodLabel = NativePayrollMath.salaryPeriodLabel(salaryMonth, payrollPeriodType),
            profileSourceLabel = profile.sourceLabel
        ).withAutomaticTax()
    }

    private fun NativeSalaryRecord.toDraft(
        root: JSONObject,
        company: JSONObject,
        autoTax: Boolean
    ): NativeSalaryDraft {
        val payrollPeriodType = payrollPeriodKey(company)
        val salaryMonth = SalaryMonth(year, month)
        val overtimeCount = root.requiredArray("overtimeLogs").objectList().count { log ->
            log.optString("companyId") == companyId &&
                NativePayrollMath.salaryMonthForDate(log.optString("date"), payrollPeriodType) == salaryMonth
        }
        return NativeSalaryDraft(
            id = id,
            companyId = companyId,
            year = year,
            month = month,
            payDate = payDate,
            employmentMode = employmentMode,
            baseHourlyRate = baseHourlyRate,
            regularHours = regularHours,
            baseSalary = baseSalary,
            mealAllowance = mealAllowance,
            positionAllowance = positionAllowance,
            overtime = overtime,
            bonus = bonus,
            customEarnings = customEarnings,
            laborIns = laborIns,
            healthIns = healthIns,
            taxWithheld = taxWithheld,
            otherDeduction = otherDeduction,
            customDeductions = customDeductions,
            pensionSelf = pensionSelf,
            sideIncome = sideIncome,
            note = note,
            autoTax = autoTax,
            overtimeLogCount = overtimeCount,
            salaryPeriodLabel = NativePayrollMath.salaryPeriodLabel(salaryMonth, payrollPeriodType),
            profileSourceLabel = "歷史薪資快照"
        )
    }

    private fun NativeSalaryDraft.withAutomaticTax(): NativeSalaryDraft {
        if (!autoTax) return this
        val gross = NativePayrollMath.salaryTotals(copy(taxWithheld = 0.0)).gross
        return copy(taxWithheld = NativePayrollMath.salaryTax(gross).toDouble())
    }

    private fun NativeSalaryDraft.toJson(recordId: String): JSONObject = JSONObject().apply {
        put("id", recordId)
        put("companyId", companyId)
        put("year", year)
        put("month", month)
        put("payDate", payDate)
        put("employmentMode", employmentMode)
        put("baseHourlyRate", baseHourlyRate)
        put("regularHours", regularHours)
        put("baseSalary", baseSalary)
        put("mealAllowance", mealAllowance)
        put("positionAllowance", positionAllowance)
        put("overtime", overtime)
        put("bonus", bonus)
        put("customEarnings", customItemsJson(customEarnings))
        put("laborIns", laborIns)
        put("healthIns", healthIns)
        put("taxWithheld", taxWithheld)
        put("otherDeduction", otherDeduction)
        put("customDeductions", customItemsJson(customDeductions))
        put("pensionSelf", pensionSelf)
        put("sideIncome", sideIncome)
        put("note", note)
    }

    private fun customItemsJson(items: List<NativeMoneyItem>): JSONArray = JSONArray().apply {
        items.forEach { item ->
            put(JSONObject().apply {
                put("id", item.id.ifBlank { "item_${UUID.randomUUID()}" })
                put("name", item.name)
                put("amount", item.amount)
                put("affectsHourly", item.affectsHourly)
                if (item.sourceType.isNotBlank()) put("sourceType", item.sourceType)
                if (item.sourceKey.isNotBlank()) put("sourceKey", item.sourceKey)
            })
        }
    }

    private fun ensureWritableSchema(root: JSONObject): NativeSaveResult.Rejected? {
        val schema = root.optInt("schemaVersion", 0)
        return if (schema == 13) null else NativeSaveResult.Rejected(
            "目前資料 Schema 為 $schema；請先開啟完整管理完成安全遷移，再使用原生快速登記。"
        )
    }

    private fun validateSnapshot(root: JSONObject) {
        val schema = root.optInt("schemaVersion", 0)
        require(schema in 1..13) { "不支援的資料版本：$schema" }
        root.requiredArray("companies")
        root.requiredArray("records")
        root.requiredArray("overtimeLogs")
        listOf("leaveRecords", "salaryAdjustments", "yearEndEstimates").forEach { field ->
            if (root.has(field) && root.opt(field) !is JSONArray) error("資料欄位 $field 格式不正確")
        }
    }

    private fun readLatestSnapshot(database: CapacitorDatabase): JSONObject? {
        val rows = database.selectSQL(
            "SELECT payload FROM snapshots ORDER BY id DESC LIMIT 1;",
            arrayListOf()
        )
        if (rows.length() == 0) return null
        val payload = rows.getJSONObject(0).getString("payload")
        return JSONObject(payload).also(::validateSnapshot)
    }

    private fun writeSnapshot(database: CapacitorDatabase, root: JSONObject) {
        validateSnapshot(root)
        val now = isoTimestamp()
        root.put("schemaVersion", 13)
        root.put("appVersion", NATIVE_APP_VERSION)
        root.put("updatedAt", now)
        val statements = JSArray()
        statements.put(JSObject().apply {
            put("statement", "INSERT INTO snapshots (payload, created_at) VALUES (?, ?);")
            put("values", JSArray().apply { put(root.toString()); put(now) })
        })
        statements.put(JSObject().apply {
            put("statement", "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 3);")
            put("values", JSArray())
        })
        database.executeSet(statements, true, "no")
    }

    private fun isoTimestamp(): String =
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(java.util.Date())

    private fun <T> withDatabase(block: (CapacitorDatabase) -> T): T {
        val database = CapacitorDatabase(
            appContext,
            DATABASE_NAME,
            false,
            "no-encryption",
            1,
            false,
            Hashtable<Int, JSONObject>(),
            appContext.getSharedPreferences("CapacitorSQLite", Context.MODE_PRIVATE),
            false
        )
        try {
            database.open()
            database.execute(arrayOf(CREATE_SQL))
            return block(database)
        } finally {
            runCatching { database.close() }
        }
    }

    private suspend fun <T> onDatabaseThread(block: () -> T): T = withContext(Dispatchers.IO) {
        synchronized(accessLock) { block() }
    }

    private fun JSONObject.requiredArray(name: String): JSONArray =
        optJSONArray(name) ?: error("資料缺少 $name")

    private fun JSONObject.optionalArray(name: String): JSONArray =
        optJSONArray(name) ?: JSONArray().also { put(name, it) }

    private fun JSONArray.objectList(): List<JSONObject> = buildList {
        for (index in 0 until length()) optJSONObject(index)?.let(::add)
    }

    private fun JSONObject.safeDouble(name: String): Double {
        val value = opt(name)
        return when (value) {
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull() ?: 0.0
            else -> 0.0
        }.takeIf { it.isFinite() } ?: 0.0
    }

    private fun customItemsTotal(value: JSONArray?): Double {
        if (value == null) return 0.0
        return value.objectList().sumOf { it.safeDouble("amount") }
    }

    private fun recordGrossPay(record: JSONObject): Long = (
        record.safeDouble("baseSalary") + record.safeDouble("mealAllowance") +
            record.safeDouble("positionAllowance") + record.safeDouble("overtime") +
            record.safeDouble("bonus") + customItemsTotal(record.optJSONArray("customEarnings"))
        ).roundToLong()

    private fun recordNetPay(record: JSONObject): Long {
        val deductions = record.safeDouble("laborIns") + record.safeDouble("healthIns") +
            record.safeDouble("taxWithheld") + record.safeDouble("otherDeduction") +
            customItemsTotal(record.optJSONArray("customDeductions")) + record.safeDouble("pensionSelf")
        return (recordGrossPay(record) - deductions + record.safeDouble("sideIncome")).roundToLong()
    }

    private fun overtimeAmount(log: JSONObject): Long = NativePayrollMath.overtimeAmount(
        type = normalizedOvertimeType(log.optString("type")),
        hours = log.safeDouble("hours"),
        hourlyRate = log.safeDouble("hourlyRate"),
        customRate = log.safeDouble("customRate").takeIf { it > 0 } ?: 1.34
    )

    private fun leaveCoversDate(record: JSONObject, date: String): Boolean {
        val start = record.optString("startDate", record.optString("date"))
        val end = record.optString("endDate", start)
        if (record.optString("durationMode") != "range") return start == date
        if (date < start || date > end) return false
        return record.optBoolean("includeWeekends", false) || !NativePayrollMath.isWeekend(date)
    }

    private fun existingLeavePortion(record: JSONObject, date: String): String = when (record.optString("durationMode")) {
        "half_am" -> "am"
        "half_pm" -> "pm"
        "range" -> when {
            date == record.optString("startDate") && record.optString("startPortion") == "pm" -> "pm"
            date == record.optString("endDate") && record.optString("endPortion") == "am" -> "am"
            else -> "full"
        }
        else -> "full"
    }

    private fun NativeLeaveDuration.portion(): String = when (this) {
        NativeLeaveDuration.HalfMorning -> "am"
        NativeLeaveDuration.HalfAfternoon -> "pm"
        else -> "full"
    }

    private fun portionsOverlap(first: String, second: String): Boolean =
        !(first == "am" && second == "pm") && !(first == "pm" && second == "am")

    private fun requestedLeaveDays(draft: NativeLeaveDraft, workHours: Double): Double = when (draft.duration) {
        NativeLeaveDuration.FullDay -> 1.0
        NativeLeaveDuration.HalfMorning, NativeLeaveDuration.HalfAfternoon -> 0.5
        NativeLeaveDuration.Hours -> draft.customHours / max(1.0, workHours)
    }

    private fun leaveDays(record: JSONObject): Double = when (record.optString("durationMode")) {
        "half_am", "half_pm" -> 0.5 * max(1.0, record.safeDouble("quantity"))
        "hours" -> {
            val hours = record.safeDouble("customHours").takeIf { it > 0 } ?: record.safeDouble("quantity")
            hours / 8.0
        }
        else -> max(1.0, record.safeDouble("quantity"))
    }

    private fun leaveDurationLabel(record: JSONObject): String = when (record.optString("durationMode")) {
        "half_am" -> "上午半天"
        "half_pm" -> "下午半天"
        "hours" -> "${record.safeDouble("customHours").cleanNumber()} 小時"
        "range" -> "${record.optString("startDate")}～${record.optString("endDate")}" 
        else -> "整天"
    }

    private fun normalizedOvertimeType(type: String): String = if (type == "weekend") "restday" else type

    private fun overtimeTypeLabel(type: String): String = when (normalizedOvertimeType(type)) {
        "weekday" -> "平日"
        "restday" -> "休息日"
        "holiday" -> "星期天"
        "spring" -> "春節"
        else -> "自訂"
    }

    private fun leaveTypeLabel(type: String): String = NativeLeaveType.entries
        .firstOrNull { it.storageValue == type }?.label ?: "其他假別"

    private fun formatMoney(value: Long): String = "$" + String.format(Locale.US, "%,d", value)

    private fun Double.cleanNumber(): String = if (this == roundToInt().toDouble()) {
        roundToInt().toString()
    } else {
        BigDecimalFormatter.format(this)
    }

    private fun nearlyEqual(first: Double, second: Double): Boolean = kotlin.math.abs(first - second) < 0.000001

    private fun isHalfHourIncrement(value: Double): Boolean =
        nearlyEqual(value * 2.0, (value * 2.0).roundToInt().toDouble())

    companion object {
        private const val DATABASE_NAME = "salarymateSQLite.db"
        private const val CREATE_SQL = """CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );"""
        private val BigDecimalFormatter = java.text.DecimalFormat("0.###")
    }
}
