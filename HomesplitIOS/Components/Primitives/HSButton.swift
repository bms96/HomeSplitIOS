import SwiftUI

enum HSButtonVariant {
    case primary
    case secondary
    case destructive
}

/// Project-standard button. 44pt minimum height for HIG accessibility.
/// Loading state replaces the label with a `ProgressView` and disables taps.
struct HSButton: View {
    let label: String
    var variant: HSButtonVariant = .primary
    var loading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void

    var body: some View {
        Button(action: { if !loading { action() } }) {
            ZStack {
                Text(label)
                    .font(HSFont.body.weight(.semibold))
                    .opacity(loading ? 0 : 1)
                if loading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(foreground)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .padding(.horizontal, HSSpacing.base)
            .background(background)
            .foregroundStyle(foreground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(loading || !isEnabled)
        .opacity(isEnabled ? 1 : 0.5)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(label)
    }

    private var background: Color {
        switch variant {
        case .primary:     return HSColor.primary
        case .secondary:   return HSColor.surface
        case .destructive: return HSColor.danger
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary, .destructive: return .white
        case .secondary:             return HSColor.dark
        }
    }
}

#Preview {
    VStack(spacing: HSSpacing.md) {
        HSButton(label: "Primary") {}
        HSButton(label: "Secondary", variant: .secondary) {}
        HSButton(label: "Destructive", variant: .destructive) {}
        HSButton(label: "Loading", loading: true) {}
        HSButton(label: "Disabled", isEnabled: false) {}
    }
    .padding()
}
