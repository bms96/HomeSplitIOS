import SwiftUI
import UIKit

/// Design-token colors. Mirrors the RN `Colors` constant, but adaptive so
/// text and chrome remain legible under both `.light` and `.dark` traits.
///
/// Brand accents (`primary`, `success`, `warning`, `danger`) are held
/// constant across modes for recognizability. Neutrals (`dark`, `mid`,
/// `light`, `surface`, `white`) and tinted backgrounds flip to
/// dark-mode counterparts.
enum HSColor {
    static let primary    = Color(hex: 0x1F6FEB)
    static let primaryBg  = adaptive(light: 0xD8E8FD, dark: 0x1E3A5F)
    static let success    = Color(hex: 0x16A34A)
    static let successBg  = adaptive(light: 0xDCFCE7, dark: 0x14532D)
    static let warning    = Color(hex: 0xD97706)
    static let warningBg  = adaptive(light: 0xFEF3C7, dark: 0x78350F)
    static let danger     = Color(hex: 0xDC2626)
    static let dangerBg   = adaptive(light: 0xFEE2E2, dark: 0x7F1D1D)
    static let dark       = adaptive(light: 0x111827, dark: 0xF9FAFB)
    static let mid        = adaptive(light: 0x6B7280, dark: 0x9CA3AF)
    static let light      = adaptive(light: 0x9CA3AF, dark: 0x4B5563)
    static let surface    = adaptive(light: 0xF9FAFB, dark: 0x1C1C1E)
    static let white      = adaptive(light: 0xFFFFFF, dark: 0x000000)

    private static func adaptive(light: UInt32, dark: UInt32) -> Color {
        Color(UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(hex: dark)
                : UIColor(hex: light)
        })
    }
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

extension UIColor {
    fileprivate convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
        self.init(
            red:   CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue:  CGFloat(hex & 0xFF) / 255,
            alpha: alpha
        )
    }
}
