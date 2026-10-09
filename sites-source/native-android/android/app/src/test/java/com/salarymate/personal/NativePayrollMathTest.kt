package com.salarymate.personal

import com.salarymate.personal.data.NativeOvertimeType
import com.salarymate.personal.data.NativePayrollMath
import com.salarymate.personal.data.SalaryMonth
import org.junit.Assert.assertEquals
import org.junit.Test

class NativePayrollMathTest {
    @Test
    fun overtimeRulesMatchSchema13Core() {
        assertEquals(435L, NativePayrollMath.overtimeAmount("weekday", 3.0, 100.0))
        assertEquals(1804L, NativePayrollMath.overtimeAmount("restday", 10.0, 100.0))
        assertEquals(1600L, NativePayrollMath.overtimeAmount("holiday", 8.0, 100.0))
        assertEquals(2000L, NativePayrollMath.overtimeAmount("spring", 8.0, 100.0))
        assertEquals(450L, NativePayrollMath.overtimeAmount("custom", 3.0, 100.0, 1.5))
    }

    @Test
    fun hourlyRateRetainsThreeDecimalSnapshot() {
        assertEquals(100.111, NativePayrollMath.roundHourlyRate(100.1114), 0.0)
        assertEquals(100.112, NativePayrollMath.roundHourlyRate(100.1115), 0.0)
    }

    @Test
    fun previousMonthSixteenthCycleAttributesCorrectly() {
        assertEquals(
            SalaryMonth(2026, 8),
            NativePayrollMath.salaryMonthForDate("2026-07-16", "prev16")
        )
        assertEquals(
            SalaryMonth(2026, 8),
            NativePayrollMath.salaryMonthForDate("2026-08-15", "prev16")
        )
        assertEquals(
            SalaryMonth(2026, 9),
            NativePayrollMath.salaryMonthForDate("2026-08-16", "prev16")
        )
        assertEquals(
            "2026/07/16～2026/08/15",
            NativePayrollMath.salaryPeriodLabel(SalaryMonth(2026, 8), "prev16")
        )
    }

    @Test
    fun weekdaySaturdaySundayInferenceIsDeterministic() {
        assertEquals(NativeOvertimeType.Weekday, NativePayrollMath.inferOvertimeType("2026-09-18"))
        assertEquals(NativeOvertimeType.RestDay, NativePayrollMath.inferOvertimeType("2026-09-19"))
        assertEquals(NativeOvertimeType.Holiday, NativePayrollMath.inferOvertimeType("2026-09-20"))
    }

    @Test
    fun salaryTaxStartsOnlyAboveThreshold() {
        assertEquals(0L, NativePayrollMath.salaryTax(86_001L))
        assertEquals(4_300L, NativePayrollMath.salaryTax(86_002L))
    }

    @Test
    fun weekendPaydayMovesToPreviousFriday() {
        assertEquals("2026-09-04", NativePayrollMath.defaultPayDate(2026, 8))
        assertEquals("2026-10-05", NativePayrollMath.defaultPayDate(2026, 9))
    }
}
