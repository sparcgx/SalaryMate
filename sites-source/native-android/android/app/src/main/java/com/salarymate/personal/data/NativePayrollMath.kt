package com.salarymate.personal.data

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

data class SalaryMonth(val year: Int, val month: Int)

data class NativeSalaryTotals(
    val gross: Long,
    val deductions: Long,
    val pensionSelf: Long,
    val mainNet: Long,
    val combinedNet: Long
)

object NativePayrollMath {
    private val isoPattern = Regex("^(\\d{4})-(\\d{2})-(\\d{2})$")

    fun overtimeAmount(
        type: String,
        hours: Double,
        hourlyRate: Double,
        customRate: Double = 1.34
    ): Long {
        val safeHours = max(0.0, hours)
        val safeRate = max(0.0, roundHourlyRate(hourlyRate))
        if (safeHours == 0.0 || safeRate == 0.0) return 0
        val amount = when (type) {
            "weekday" -> {
                val first = min(safeHours, 2.0)
                val later = max(0.0, safeHours - 2.0)
                safeRate * (first * 1.34 + later * 1.67)
            }
            "restday", "weekend" -> {
                val first = min(safeHours, 2.0)
                val middle = min(max(safeHours - 2.0, 0.0), 6.0)
                val later = max(safeHours - 8.0, 0.0)
                safeRate * (first * 1.34 + middle * 1.67 + later * 2.67)
            }
            "holiday" -> safeHours * safeRate * 2.0
            "spring" -> safeHours * safeRate * 2.5
            else -> safeHours * safeRate * max(0.0, customRate.takeIf { it > 0 } ?: 1.0)
        }
        return amount.roundToLong()
    }

    fun roundHourlyRate(value: Double): Double = BigDecimal.valueOf(max(0.0, value))
        .setScale(3, RoundingMode.HALF_UP)
        .toDouble()

    fun inferOvertimeType(date: String): NativeOvertimeType {
        val calendar = calendarFor(date) ?: return NativeOvertimeType.Weekday
        return when (calendar.get(Calendar.DAY_OF_WEEK)) {
            Calendar.SATURDAY -> NativeOvertimeType.RestDay
            Calendar.SUNDAY -> NativeOvertimeType.Holiday
            else -> NativeOvertimeType.Weekday
        }
    }

    private data class PayrollCycle(val type: String, val startDay: Int, val endDay: Int)

    private fun payrollCycle(value: String): PayrollCycle {
        if (value.startsWith("custom:")) {
            val parts = value.split(':')
            val start = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(1, 31) ?: 1
            val end = parts.getOrNull(2)?.toIntOrNull()?.coerceIn(1, 31) ?: 31
            return PayrollCycle("custom", start, end)
        }
        return if (value == "prev16") PayrollCycle("prev16", 16, 15) else PayrollCycle("calendar", 1, 31)
    }

    private fun clampedIso(year: Int, month: Int, day: Int): String {
        val calendar = GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            isLenient = false
            clear()
            set(year, month - 1, 1)
        }
        return formatIso(year, month, day.coerceIn(1, calendar.getActualMaximum(Calendar.DAY_OF_MONTH)))
    }

    private fun salaryPeriodBounds(month: SalaryMonth, payrollPeriodType: String): Pair<String, String> {
        val cycle = payrollCycle(payrollPeriodType)
        if (cycle.type == "prev16" || (cycle.type == "custom" && cycle.startDay > cycle.endDay)) {
            val previous = shiftYearMonth(month.year, month.month, -1)
            return clampedIso(previous.year, previous.month, cycle.startDay) to
                clampedIso(month.year, month.month, cycle.endDay)
        }
        if (cycle.type == "custom") {
            return clampedIso(month.year, month.month, cycle.startDay) to
                clampedIso(month.year, month.month, cycle.endDay)
        }
        return clampedIso(month.year, month.month, 1) to clampedIso(month.year, month.month, 31)
    }

    fun salaryMonthForDate(date: String, payrollPeriodType: String): SalaryMonth? {
        val parts = parseIsoDate(date) ?: return null
        val cycle = payrollCycle(payrollPeriodType)
        if (cycle.type == "calendar") return SalaryMonth(parts.first, parts.second)
        if (cycle.type == "prev16") {
            return if (parts.third >= 16) shiftYearMonth(parts.first, parts.second, 1)
            else SalaryMonth(parts.first, parts.second)
        }
        val current = SalaryMonth(parts.first, parts.second)
        val candidates = listOf(current, shiftYearMonth(parts.first, parts.second, 1), shiftYearMonth(parts.first, parts.second, -1))
        return candidates.firstOrNull { candidate ->
            val bounds = salaryPeriodBounds(candidate, payrollPeriodType)
            date >= bounds.first && date <= bounds.second
        }
    }

    fun salaryPeriodLabel(month: SalaryMonth, payrollPeriodType: String): String {
        val bounds = salaryPeriodBounds(month, payrollPeriodType)
        return "${bounds.first.replace('-', '/')}～${bounds.second.replace('-', '/')}"
    }

    fun salaryPeriodEnd(month: SalaryMonth, payrollPeriodType: String): String =
        salaryPeriodBounds(month, payrollPeriodType).second

    fun defaultPayDate(year: Int, month: Int): String {
        val payMonth = shiftYearMonth(year, month, 1)
        val calendar = GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            isLenient = false
            clear()
            set(payMonth.year, payMonth.month - 1, 5)
        }
        while (calendar.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY ||
            calendar.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY
        ) {
            calendar.add(Calendar.DAY_OF_MONTH, -1)
        }
        return formatIso(
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH) + 1,
            calendar.get(Calendar.DAY_OF_MONTH)
        )
    }

    fun nextSalaryMonth(year: Int, month: Int): SalaryMonth = shiftYearMonth(year, month, 1)

    fun salaryTax(gross: Long): Long = if (gross > 86_001L) (gross * 0.05).roundToLong() else 0L

    fun salaryTotals(draft: NativeSalaryDraft): NativeSalaryTotals = salaryTotals(
        baseSalary = draft.baseSalary,
        mealAllowance = draft.mealAllowance,
        positionAllowance = draft.positionAllowance,
        overtime = draft.overtime,
        bonus = draft.bonus,
        customEarnings = draft.customEarnings,
        laborIns = draft.laborIns,
        healthIns = draft.healthIns,
        taxWithheld = draft.taxWithheld,
        otherDeduction = draft.otherDeduction,
        customDeductions = draft.customDeductions,
        pensionSelf = draft.pensionSelf,
        sideIncome = draft.sideIncome
    )

    fun salaryTotals(record: NativeSalaryRecord): NativeSalaryTotals = salaryTotals(
        baseSalary = record.baseSalary,
        mealAllowance = record.mealAllowance,
        positionAllowance = record.positionAllowance,
        overtime = record.overtime,
        bonus = record.bonus,
        customEarnings = record.customEarnings,
        laborIns = record.laborIns,
        healthIns = record.healthIns,
        taxWithheld = record.taxWithheld,
        otherDeduction = record.otherDeduction,
        customDeductions = record.customDeductions,
        pensionSelf = record.pensionSelf,
        sideIncome = record.sideIncome
    )

    fun todayIso(): String {
        val calendar = Calendar.getInstance()
        return formatIso(
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH) + 1,
            calendar.get(Calendar.DAY_OF_MONTH)
        )
    }

    fun parseIsoDate(value: String): Triple<Int, Int, Int>? {
        val match = isoPattern.matchEntire(value) ?: return null
        val year = match.groupValues[1].toIntOrNull() ?: return null
        val month = match.groupValues[2].toIntOrNull() ?: return null
        val day = match.groupValues[3].toIntOrNull() ?: return null
        val calendar = GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            isLenient = false
            clear()
            set(year, month - 1, day)
        }
        return try {
            calendar.time
            Triple(year, month, day)
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    fun compareMonth(date: String, month: SalaryMonth, payrollPeriodType: String): Boolean =
        salaryMonthForDate(date, payrollPeriodType) == month

    fun isWeekend(date: String): Boolean {
        val calendar = calendarFor(date) ?: return false
        return calendar.get(Calendar.DAY_OF_WEEK) == Calendar.SATURDAY ||
            calendar.get(Calendar.DAY_OF_WEEK) == Calendar.SUNDAY
    }

    private fun salaryTotals(
        baseSalary: Double,
        mealAllowance: Double,
        positionAllowance: Double,
        overtime: Double,
        bonus: Double,
        customEarnings: List<NativeMoneyItem>,
        laborIns: Double,
        healthIns: Double,
        taxWithheld: Double,
        otherDeduction: Double,
        customDeductions: List<NativeMoneyItem>,
        pensionSelf: Double,
        sideIncome: Double
    ): NativeSalaryTotals {
        val grossValue = baseSalary + mealAllowance + positionAllowance + overtime + bonus +
            customEarnings.sumOf { it.amount }
        val deductionValue = laborIns + healthIns + taxWithheld + otherDeduction +
            customDeductions.sumOf { it.amount }
        val mainNetValue = grossValue - deductionValue - pensionSelf
        return NativeSalaryTotals(
            gross = grossValue.roundToLong(),
            deductions = deductionValue.roundToLong(),
            pensionSelf = pensionSelf.roundToLong(),
            mainNet = mainNetValue.roundToLong(),
            combinedNet = (mainNetValue + sideIncome).roundToLong()
        )
    }

    private fun calendarFor(value: String): Calendar? {
        val parts = parseIsoDate(value) ?: return null
        return GregorianCalendar(TimeZone.getTimeZone("UTC")).apply {
            isLenient = false
            clear()
            set(parts.first, parts.second - 1, parts.third)
        }
    }

    private fun shiftYearMonth(year: Int, month: Int, offset: Int): SalaryMonth {
        val zeroBased = year * 12 + (month - 1) + offset
        return SalaryMonth(Math.floorDiv(zeroBased, 12), Math.floorMod(zeroBased, 12) + 1)
    }

    private fun formatIso(year: Int, month: Int, day: Int): String =
        String.format(Locale.US, "%04d-%02d-%02d", year, month, day)

    private fun formatDisplay(year: Int, month: Int, day: Int): String =
        String.format(Locale.US, "%04d/%02d/%02d", year, month, day)
}
