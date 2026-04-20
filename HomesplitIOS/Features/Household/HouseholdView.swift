import SwiftUI

struct HouseholdView: View {
    @Environment(\.app) private var app
    @State private var isSigningOut: Bool = false

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    if let email = app.auth.user?.email {
                        LabeledContent("Email", value: email)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        Task {
                            isSigningOut = true
                            await app.auth.signOut()
                            isSigningOut = false
                        }
                    } label: {
                        HStack {
                            Text("Sign out")
                            if isSigningOut {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(isSigningOut)
                }
            }
            .navigationTitle("Household")
        }
    }
}

#Preview {
    HouseholdView()
}
