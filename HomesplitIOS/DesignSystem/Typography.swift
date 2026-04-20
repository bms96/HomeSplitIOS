import SwiftUI

/// Typography scale parity with RN. Prefer the Dynamic Type-friendly system
/// styles where they map cleanly (`.body`, `.title2`, …); use these tokens
/// when matching the RN spec exactly is more important than scaling.
enum HSFont {
    static let display  = Font.system(size: 34, weight: .bold)
    static let title1   = Font.system(size: 28, weight: .bold)
    static let title2   = Font.system(size: 22, weight: .semibold)
    static let title3   = Font.system(size: 20, weight: .semibold)
    static let body     = Font.system(size: 17, weight: .regular)
    static let callout  = Font.system(size: 16, weight: .regular)
    static let subhead  = Font.system(size: 15, weight: .regular)
    static let footnote = Font.system(size: 13, weight: .regular)
    static let caption  = Font.system(size: 12, weight: .regular)
    static let mono     = Font.system(size: 15, design: .monospaced)
}
