import SwiftUI

struct MainTabView: View {
    @Environment(\.app) private var app

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Home", systemImage: "house.fill") }
                .badge(app.badges.youOweCount)

            ExpensesView()
                .tabItem { Label("Expenses", systemImage: "list.bullet") }

            BillsView()
                .tabItem { Label("Bills", systemImage: "calendar") }
                .badge(app.badges.overdueBillCount)

            HouseholdView()
                .tabItem { Label("Household", systemImage: "person.2.fill") }
        }
        .task(id: app.householdSession.membership?.householdId) {
            if let household = app.householdSession.membership {
                await app.badges.refresh(household: household)
            } else {
                app.badges.clear()
            }
        }
    }
}

#Preview {
    MainTabView()
}
