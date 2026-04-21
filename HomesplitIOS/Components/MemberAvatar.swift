import SwiftUI

/// Circular colored avatar with the member's initials.
/// Color is a hex string (e.g. "#FF5733") stored on `members.color`.
struct MemberAvatar: View {
    let displayName: String
    let color: String
    var size: CGFloat = 36

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(hexString: color) ?? HSColor.primary)
                .frame(width: size, height: size)
            Text(initials)
                .font(.system(size: size * 0.4, weight: .semibold))
                .foregroundStyle(.white)
        }
        .accessibilityLabel("Avatar for \(displayName)")
    }

    private var initials: String {
        let parts = displayName
            .trimmingCharacters(in: .whitespaces)
            .split(whereSeparator: { $0.isWhitespace })
        guard let first = parts.first else { return "?" }
        if parts.count == 1 {
            return String(first.prefix(1)).uppercased()
        }
        let last = parts[parts.count - 1]
        return "\(first.prefix(1))\(last.prefix(1))".uppercased()
    }
}

private extension Color {
    /// Parse `#RRGGBB` / `RRGGBB` hex strings. Returns `nil` on invalid input
    /// so callers can fall back to a default color.
    init?(hexString: String) {
        var cleaned = hexString.trimmingCharacters(in: .whitespaces)
        if cleaned.hasPrefix("#") { cleaned.removeFirst() }
        guard cleaned.count == 6, let value = UInt32(cleaned, radix: 16) else {
            return nil
        }
        self.init(hex: value)
    }
}

#Preview {
    HStack(spacing: 12) {
        MemberAvatar(displayName: "Alex Jordan", color: "#1F6FEB")
        MemberAvatar(displayName: "Sam", color: "#16A34A")
        MemberAvatar(displayName: "", color: "invalid")
    }
    .padding()
}
