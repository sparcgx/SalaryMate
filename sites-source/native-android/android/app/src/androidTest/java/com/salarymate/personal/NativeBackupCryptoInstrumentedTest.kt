package com.salarymate.personal

import androidx.test.ext.junit.runners.AndroidJUnit4
import com.salarymate.personal.backup.NativeBackupCrypto
import com.salarymate.personal.backup.NativeBackupCryptoException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeBackupCryptoInstrumentedTest {
    private val payload = """{"schemaVersion":13,"companies":[],"records":[],"overtimeLogs":[]}"""

    @Test
    fun encryptedBackupRoundTripUsesCompatibleEnvelope() {
        val password = "測試密碼-1234567890"

        val encrypted = NativeBackupCrypto.encrypt(payload, password)

        assertTrue(encrypted.contains("salarymate-encrypted-backup"))
        assertTrue(encrypted.contains("PBKDF2"))
        assertTrue(encrypted.contains("AES-GCM"))
        assertEquals(payload, NativeBackupCrypto.decrypt(encrypted, password))
    }

    @Test
    fun wrongPasswordDoesNotExposePayload() {
        val encrypted = NativeBackupCrypto.encrypt(payload, "正確密碼-1234567890")
        var rejected = false

        try {
            NativeBackupCrypto.decrypt(encrypted, "錯誤密碼-1234567890")
        } catch (error: NativeBackupCryptoException) {
            rejected = error.code == "AUTH_FAILED"
        }

        assertTrue("Wrong password must be rejected", rejected)
    }

    @Test
    fun decryptsWebCryptoUtf8PasswordVector() {
        val webCryptoEnvelope = """{"format":"salarymate-encrypted-backup","version":1,"createdAt":"2026-09-22T00:00:00.000Z","kdf":{"name":"PBKDF2","hash":"SHA-256","iterations":310000,"salt":"AAECAwQFBgcICQoLDA0ODw=="},"cipher":{"name":"AES-GCM","iv":"EBESExQVFhcYGRob","tagLength":128},"payload":"H/ZgXL4NUHoLYlKYt8T82RO+a33yQU+CsfB0gB6qnl0kn1XwmSkH8y6fbc8fCZmUaGgWbyrDKiJFSjdm2QCbTtlnw/4ANpR8txGoci/xlLBb3w=="}"""

        assertEquals(payload, NativeBackupCrypto.decrypt(webCryptoEnvelope, "測試密碼-1234567890"))
    }
}
