import SwiftUI

/// Labeled text field with inline error message.
///
/// Wraps SwiftUI's `TextField` so callers don't repeat the
/// label + error + accessibility scaffolding on every form.
struct HSTextField: View {
    let label: String
    @Binding var text: String
    var placeholder: String = ""
    var errorMessage: String?
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType?
    var autocapitalization: TextInputAutocapitalization = .sentences
    var isSecure: Bool = false
    var submitLabel: SubmitLabel = .done
    var onSubmit: (() -> Void)?

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: HSSpacing.xs) {
            Text(label)
                .font(HSFont.subhead.weight(.medium))
                .foregroundStyle(HSColor.dark)

            field
                .font(HSFont.body)
                .keyboardType(keyboardType)
                .textContentType(textContentType)
                .textInputAutocapitalization(autocapitalization)
                .autocorrectionDisabled(keyboardType == .emailAddress)
                .padding(.horizontal, HSSpacing.md)
                .padding(.vertical, HSSpacing.sm + 2)
                .background(HSColor.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(borderColor, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .submitLabel(submitLabel)
                .focused($isFocused)
                .onSubmit { onSubmit?() }
                .accessibilityLabel(label)

            if let errorMessage {
                Text(errorMessage)
                    .font(HSFont.footnote)
                    .foregroundStyle(HSColor.danger)
                    .accessibilityLabel("\(label) error: \(errorMessage)")
            }
        }
    }

    @ViewBuilder
    private var field: some View {
        if isSecure {
            SecureField(placeholder, text: $text)
        } else {
            TextField(placeholder, text: $text)
        }
    }

    private var borderColor: Color {
        if errorMessage != nil { return HSColor.danger }
        if isFocused           { return HSColor.primary }
        return HSColor.light.opacity(0.5)
    }
}

#Preview {
    @Previewable @State var email = ""
    return VStack(spacing: HSSpacing.lg) {
        HSTextField(
            label: "Email",
            text: $email,
            placeholder: "you@example.com",
            keyboardType: .emailAddress,
            textContentType: .emailAddress,
            autocapitalization: .never
        )
        HSTextField(
            label: "With error",
            text: .constant("bad"),
            errorMessage: "Enter a valid email"
        )
    }
    .padding()
}
