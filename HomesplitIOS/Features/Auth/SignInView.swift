import SwiftUI

struct SignInView: View {
    @Environment(\.app) private var app
    @State private var email: String = ""
    @State private var emailError: String?
    @State private var submittedEmail: String?
    @State private var isSubmitting: Bool = false
    @State private var alertMessage: String?

    var body: some View {
        Group {
            if let submittedEmail {
                checkInboxView(email: submittedEmail)
            } else {
                signInForm
            }
        }
        .padding(.horizontal, HSSpacing.screenPadding)
        .background(HSColor.white)
        .alert("Sign-in failed",
               isPresented: Binding(
                   get: { alertMessage != nil },
                   set: { if !$0 { alertMessage = nil } }
               )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(alertMessage ?? "")
        }
    }

    private var signInForm: some View {
        VStack(alignment: .leading, spacing: HSSpacing.lg) {
            Text("Homesplit")
                .font(HSFont.title1)
                .foregroundStyle(HSColor.dark)

            Text("Sign in with your email. We'll send a magic link — no password needed.")
                .font(HSFont.body)
                .foregroundStyle(HSColor.mid)

            HSTextField(
                label: "Email",
                text: $email,
                placeholder: "you@example.com",
                errorMessage: emailError,
                keyboardType: .emailAddress,
                textContentType: .emailAddress,
                autocapitalization: .never,
                submitLabel: .send,
                onSubmit: submit
            )

            HSButton(
                label: "Send magic link",
                loading: isSubmitting,
                action: submit
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private func checkInboxView(email: String) -> some View {
        VStack(alignment: .leading, spacing: HSSpacing.lg) {
            Text("Check your inbox")
                .font(HSFont.title1)
                .foregroundStyle(HSColor.dark)

            (Text("We sent a sign-in link to ")
                .foregroundStyle(HSColor.mid)
             + Text(email)
                .foregroundStyle(HSColor.dark)
                .fontWeight(.semibold)
             + Text(". Tap the link on this device to finish signing in.")
                .foregroundStyle(HSColor.mid))
                .font(HSFont.body)

            HSButton(label: "Use a different email", variant: .secondary) {
                submittedEmail = nil
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    }

    private func submit() {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard isValidEmail(trimmed) else {
            emailError = "Enter a valid email"
            return
        }
        emailError = nil
        isSubmitting = true

        Task {
            defer { isSubmitting = false }
            do {
                try await app.auth.signInWithEmail(trimmed)
                submittedEmail = trimmed
            } catch {
                alertMessage = error.localizedDescription
            }
        }
    }

    private func isValidEmail(_ input: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return input.range(of: pattern, options: .regularExpression) != nil
    }
}

#Preview {
    SignInView()
}
