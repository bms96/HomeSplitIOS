import SwiftUI

struct HomeView: View {
    @Environment(\.app) private var app

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: HSSpacing.lg) {
                    Text("Welcome")
                        .font(HSFont.title1)
                        .foregroundStyle(HSColor.dark)

                    if let email = app.auth.user?.email {
                        Text(email)
                            .font(HSFont.body)
                            .foregroundStyle(HSColor.mid)
                    }

                    Text("Dashboard coming soon.")
                        .font(HSFont.body)
                        .foregroundStyle(HSColor.mid)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, HSSpacing.screenPadding)
                .padding(.vertical, HSSpacing.lg)
            }
            .navigationTitle("Home")
        }
    }
}

#Preview {
    HomeView()
}
