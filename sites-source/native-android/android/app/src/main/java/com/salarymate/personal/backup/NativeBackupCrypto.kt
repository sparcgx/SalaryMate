package com.salarymate.personal.backup

import android.util.Base64
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.SecureRandom
import java.text.Normalizer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import org.json.JSONObject

class NativeBackupCryptoException(
    val code: String,
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)

data class NativeBackupEnvelopeInfo(
    val format: String,
    val version: Int,
    val createdAt: String?
)

object NativeBackupCrypto {
    const val FORMAT = "salarymate-encrypted-backup"
    const val VERSION = 1
    const val ITERATIONS = 310_000
    const val MIN_PASSWORD_LENGTH = 12
    const val MAX_PLAINTEXT_BYTES = 20 * 1024 * 1024
    const val MAX_CIPHERTEXT_BYTES = 28 * 1024 * 1024
    const val AAD = "SalaryMate|encrypted-backup|v1"

    private const val MIN_ITERATIONS = 100_000
    private const val MAX_ITERATIONS = 1_000_000
    private const val TAG_LENGTH_BITS = 128
    private val base64Pattern = Regex("^[A-Za-z0-9+/]*={0,2}$")

    fun encrypt(payload: String, password: String): String {
        val normalizedPassword = normalizedPassword(password, enforceMinimum = true)
        val plaintext = payload.toByteArray(Charsets.UTF_8)
        if (plaintext.isEmpty() || plaintext.size > MAX_PLAINTEXT_BYTES) {
            throw NativeBackupCryptoException("PAYLOAD_TOO_LARGE", "備份內容為空或超過 20 MB")
        }

        val salt = ByteArray(16).also(SecureRandom()::nextBytes)
        val iv = ByteArray(12).also(SecureRandom()::nextBytes)
        val key = deriveKey(normalizedPassword, salt, ITERATIONS)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH_BITS, iv))
        cipher.updateAAD(AAD.toByteArray(Charsets.UTF_8))
        val ciphertext = cipher.doFinal(plaintext)

        return JSONObject().apply {
            put("format", FORMAT)
            put("version", VERSION)
            put("createdAt", isoNow())
            put("kdf", JSONObject().apply {
                put("name", "PBKDF2")
                put("hash", "SHA-256")
                put("iterations", ITERATIONS)
                put("salt", encodeBase64(salt))
            })
            put("cipher", JSONObject().apply {
                put("name", "AES-GCM")
                put("iv", encodeBase64(iv))
                put("tagLength", TAG_LENGTH_BITS)
            })
            put("payload", encodeBase64(ciphertext))
        }.toString()
    }

    fun decrypt(text: String, password: String): String {
        val normalizedPassword = normalizedPassword(password, enforceMinimum = false)
        val parsed = parseEnvelope(text)
        return try {
            val key = deriveKey(normalizedPassword, parsed.salt, parsed.iterations)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(TAG_LENGTH_BITS, parsed.iv))
            cipher.updateAAD(AAD.toByteArray(Charsets.UTF_8))
            val plaintext = cipher.doFinal(parsed.ciphertext)
            if (plaintext.isEmpty() || plaintext.size > MAX_PLAINTEXT_BYTES) {
                throw NativeBackupCryptoException("INVALID_FORMAT", "解密後的備份大小不正確")
            }
            Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(plaintext))
                .toString()
        } catch (error: NativeBackupCryptoException) {
            throw error
        } catch (error: AEADBadTagException) {
            throw NativeBackupCryptoException("AUTH_FAILED", "密碼錯誤，或備份檔案已損壞", error)
        } catch (error: Exception) {
            throw NativeBackupCryptoException("AUTH_FAILED", "密碼錯誤，或備份檔案已損壞", error)
        }
    }

    fun inspect(text: String): NativeBackupEnvelopeInfo {
        val parsed = parseEnvelope(text)
        return NativeBackupEnvelopeInfo(FORMAT, VERSION, parsed.createdAt)
    }

    private fun normalizedPassword(password: String, enforceMinimum: Boolean): String {
        val normalized = Normalizer.normalize(password, Normalizer.Form.NFC)
        if (normalized.isEmpty()) {
            throw NativeBackupCryptoException("PASSWORD_REQUIRED", "請輸入備份密碼")
        }
        if (enforceMinimum && normalized.codePointCount(0, normalized.length) < MIN_PASSWORD_LENGTH) {
            throw NativeBackupCryptoException(
                "PASSWORD_TOO_SHORT",
                "備份密碼至少需要 $MIN_PASSWORD_LENGTH 個字元"
            )
        }
        return normalized
    }

    private fun deriveKey(password: String, salt: ByteArray, iterations: Int): SecretKeySpec {
        val passwordBytes = password.toByteArray(Charsets.UTF_8)
        val block = ByteArray(salt.size + 4)
        salt.copyInto(block)
        block[block.lastIndex] = 1
        val mac = Mac.getInstance("HmacSHA256")
        return try {
            mac.init(SecretKeySpec(passwordBytes, "HmacSHA256"))
            var round = mac.doFinal(block)
            val derived = round.copyOf()
            repeat(iterations - 1) {
                round = mac.doFinal(round)
                for (index in derived.indices) {
                    derived[index] = (derived[index].toInt() xor round[index].toInt()).toByte()
                }
            }
            round.fill(0)
            val key = SecretKeySpec(derived, "AES")
            derived.fill(0)
            key
        } finally {
            passwordBytes.fill(0)
            block.fill(0)
        }
    }

    private data class ParsedEnvelope(
        val iterations: Int,
        val salt: ByteArray,
        val iv: ByteArray,
        val ciphertext: ByteArray,
        val createdAt: String?
    )

    private fun parseEnvelope(text: String): ParsedEnvelope {
        val envelope = try {
            JSONObject(text)
        } catch (error: Exception) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "不是有效的加密備份", error)
        }
        if (envelope.opt("format") !is String || envelope.getString("format") != FORMAT) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "不是個人薪資管理加密備份")
        }
        if (strictInteger(envelope, "version") != VERSION) {
            throw NativeBackupCryptoException("UNSUPPORTED_VERSION", "此加密備份版本尚不支援")
        }
        val kdf = envelope.optJSONObject("kdf")
            ?: throw NativeBackupCryptoException("INVALID_FORMAT", "加密參數不完整")
        val cipher = envelope.optJSONObject("cipher")
            ?: throw NativeBackupCryptoException("INVALID_FORMAT", "加密參數不完整")
        val iterations = strictInteger(kdf, "iterations")
        if (kdf.optString("name") != "PBKDF2" || kdf.optString("hash") != "SHA-256" ||
            iterations !in MIN_ITERATIONS..MAX_ITERATIONS || cipher.optString("name") != "AES-GCM" ||
            strictInteger(cipher, "tagLength") != TAG_LENGTH_BITS
        ) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "加密參數不受支援")
        }
        val salt = decodeBase64(strictString(kdf, "salt", "Salt"), "Salt")
        val iv = decodeBase64(strictString(cipher, "iv", "IV"), "IV")
        val ciphertext = decodeBase64(strictString(envelope, "payload", "Payload"), "Payload")
        if (salt.size != 16 || iv.size != 12 || ciphertext.size < 17 || ciphertext.size > MAX_CIPHERTEXT_BYTES) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "加密備份大小或參數錯誤")
        }
        return ParsedEnvelope(
            iterations = iterations,
            salt = salt,
            iv = iv,
            ciphertext = ciphertext,
            createdAt = (envelope.opt("createdAt") as? String)?.takeIf(String::isNotBlank)
        )
    }

    private fun strictInteger(value: JSONObject, name: String): Int {
        val number = value.opt(name) as? Number
            ?: throw NativeBackupCryptoException("INVALID_FORMAT", "$name 格式錯誤")
        val longValue = number.toLong()
        if (number.toDouble() != longValue.toDouble() || longValue !in Int.MIN_VALUE..Int.MAX_VALUE) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "$name 格式錯誤")
        }
        return longValue.toInt()
    }

    private fun strictString(value: JSONObject, name: String, label: String): String =
        value.opt(name) as? String
            ?: throw NativeBackupCryptoException("INVALID_FORMAT", "$label 格式錯誤")

    private fun encodeBase64(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    private fun decodeBase64(value: String, label: String): ByteArray {
        if (value.isEmpty() || value.length % 4 != 0 || !base64Pattern.matches(value)) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "$label 格式錯誤")
        }
        return try {
            Base64.decode(value, Base64.NO_WRAP)
        } catch (error: IllegalArgumentException) {
            throw NativeBackupCryptoException("INVALID_FORMAT", "$label 格式錯誤", error)
        }
    }

    private fun isoNow(): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
}
