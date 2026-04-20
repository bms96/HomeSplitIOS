import Foundation
import Security
import Supabase

/// `AuthLocalStorage` implementation backed by the iOS Keychain.
///
/// Tokens are written with `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
/// so they survive app restarts but never sync to iCloud or roam across devices.
/// We control the service identifier explicitly so production and dev builds
/// don't collide on the same Keychain entries.
struct KeychainAuthStorage: AuthLocalStorage {
    private let service: String

    init(service: String = "app.homesplit.ios.auth") {
        self.service = service
    }

    func store(key: String, value: Data) throws {
        var query = baseQuery(for: key)
        query[kSecValueData as String] = value
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(query as CFDictionary, nil)
        if status == errSecDuplicateItem {
            try update(key: key, value: value)
            return
        }
        guard status == errSecSuccess else {
            throw KeychainError.unexpected(status)
        }
    }

    func retrieve(key: String) throws -> Data? {
        var query = baseQuery(for: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        switch status {
        case errSecSuccess:
            return item as? Data
        case errSecItemNotFound:
            return nil
        default:
            throw KeychainError.unexpected(status)
        }
    }

    func remove(key: String) throws {
        let status = SecItemDelete(baseQuery(for: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpected(status)
        }
    }

    private func update(key: String, value: Data) throws {
        let query = baseQuery(for: key)
        let attributes: [String: Any] = [kSecValueData as String: value]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        guard status == errSecSuccess else {
            throw KeychainError.unexpected(status)
        }
    }

    private func baseQuery(for key: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}

enum KeychainError: Error, CustomStringConvertible, Equatable {
    case unexpected(OSStatus)

    var description: String {
        switch self {
        case .unexpected(let status):
            let message = SecCopyErrorMessageString(status, nil) as String? ?? "OSStatus \(status)"
            return "Keychain error: \(message)"
        }
    }
}
