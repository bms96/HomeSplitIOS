import SwiftUI

/// Design-token colors. Mirrors the RN `Colors` constant.
///
/// Rendered values are static for now to ship parity quickly. Migrate to
/// `Color("primary", bundle: .main)` once Asset Catalog entries land so
/// dark mode can override per-token.
enum HSColor {
    static let primary    = Color(hex: 0x1F6FEB)
    static let primaryBg  = Color(hex: 0xD8E8FD)
    static let success    = Color(hex: 0x16A34A)
    static let successBg  = Color(hex: 0xDCFCE7)
    static let warning    = Color(hex: 0xD97706)
    static let warningBg  = Color(hex: 0xFEF3C7)
    static let danger     = Color(hex: 0xDC2626)
    static let dangerBg   = Color(hex: 0xFEE2E2)
    static let dark       = Color(hex: 0x111827)
    static let mid        = Color(hex: 0x6B7280)
    static let light      = Color(hex: 0x9CA3AF)
    static let surface    = Color(hex: 0xF9FAFB)
    static let white      = Color.white
}

extension Color {
    init(hex: UInt32, opacity: Double = 1.0) {
        self.init(
            .sRGB,
            red:   Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue:  Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }
}
